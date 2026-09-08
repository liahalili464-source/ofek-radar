"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
export type NormalizedCandidateRow = {
  fullName: string;
  phone: string;
  city: string;
  photoUrl: string;
  sourceData: Row;
};

type FieldKey = "fullName" | "phone" | "city" | "photoUrl";

const fields: { key: FieldKey; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "fullName", label: "שם מלא", required: true, aliases: ["שם מלא", "שם", "שם מועמד", "שם מועמדת", "full name", "fullname", "name"] },
  { key: "phone", label: "טלפון", required: true, aliases: ["טלפון", "נייד", "טלפון נייד", "מספר טלפון", "phone", "mobile"] },
  { key: "city", label: "עיר מגורים", aliases: ["עיר", "יישוב", "מגורים", "city"] },
  { key: "photoUrl", label: "תמונה / URL", aliases: ["תמונה", "photo", "image", "photo url", "image url"] },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/["'׳״._-]/g, "").replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

function cell(row: Row, header: string) {
  const v = header ? row[header] : "";
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(/\.0+$/, "");
  return String(v).trim();
}

function looksLikePersonName(value: string) {
  const text = value.trim();
  if (!text || text.length > 70 || /https?:\/\//i.test(text) || /@/.test(text) || /\d/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 6;
}

function detectMapping(headers: string[], rows: Row[]) {
  const result: Record<FieldKey, string> = { fullName: "", phone: "", city: "", photoUrl: "" };
  for (const field of fields) {
    const match = headers.find((h) => field.aliases.some((a) => normalizeHeader(h) === normalizeHeader(a)));
    if (match) result[field.key] = match;
  }

  if (!result.fullName) {
    const fallback = headers.find((header) => {
      if (Object.values(result).includes(header)) return false;
      const values = rows.slice(0, 12).map((row) => cell(row, header)).filter(Boolean);
      if (values.length < 2) return false;
      const matches = values.filter(looksLikePersonName).length;
      return matches / values.length >= 0.7;
    });
    if (fallback) result.fullName = fallback;
  }

  return result;
}

function headerLabel(header: string) {
  const trimmed = header.trim();
  if (!trimmed || /^__EMPTY(?:_\d+)?$/i.test(trimmed)) return "עמודה ללא כותרת";
  return header;
}

export function ExcelImporter({ onImport }: { onImport?: (rows: NormalizedCandidateRow[]) => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({ fullName: "", phone: "", city: "", photoUrl: "" });
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    setImported(false);
    if (file.size > 10 * 1024 * 1024) {
      setError("הקובץ גדול מ-10MB");
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: false });
      if (!json.length) throw new Error("הקובץ ריק או שלא נמצאו שורות נתונים");
      const h = Object.keys(json[0]);
      setFileName(file.name);
      setHeaders(h);
      setAllRows(json);
      setMapping(detectMapping(h, json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא ניתן לקרוא את הקובץ");
    }
  }

  const validation = useMemo(() => {
    if (!allRows.length) return null;
    const missingRequiredMappings = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
    const normalized = allRows.map((row) => ({
      fullName: cell(row, mapping.fullName),
      phone: normalizePhone(cell(row, mapping.phone)),
      city: cell(row, mapping.city),
      photoUrl: cell(row, mapping.photoUrl),
      sourceData: row,
    }));
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    let missingPhone = 0;
    let missingName = 0;
    normalized.forEach((r) => {
      if (!r.phone) missingPhone++;
      if (!r.fullName) missingName++;
      if (r.phone) {
        if (seen.has(r.phone)) duplicates.add(r.phone);
        seen.add(r.phone);
      }
    });
    const valid = normalized.filter((r) => r.fullName && r.phone && !duplicates.has(r.phone));
    return { missingRequiredMappings, normalized, duplicates: duplicates.size, missingPhone, missingName, valid };
  }, [allRows, mapping]);

  function importRows() {
    if (!validation || validation.missingRequiredMappings.length) return;
    onImport?.(validation.valid);
    setImported(true);
  }

  return (
    <div>
      <label className="dropzone" style={{ display: "block" }}>
        <b>גרור/י לכאן קובץ Excel או לחץ/י לבחירה</b>
        <div className="stat-label" style={{ marginTop: 6 }}>XLSX / XLS · עד 10MB · הגיליון הראשון ייקרא אוטומטית</div>
        <input type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>

      {error && <div className="notice danger" style={{ marginTop: 12 }}>⚠️ {error}</div>}
      {fileName && <div className="notice success" style={{ marginTop: 12 }}>✓ <b>{fileName}</b> — {allRows.length} שורות, {headers.length} עמודות</div>}

      {!!headers.length && (
        <>
          <div className="card" style={{ marginTop: 14, boxShadow: "none" }}>
            <h3 className="section-title">התאמת עמודות</h3>
            <div className="grid grid-3">
              {fields.map((field) => (
                <div className="field" key={field.key}>
                  <label>{field.label}{field.required ? " *" : ""}</label>
                  <select className="select" value={mapping[field.key]} onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}>
                    <option value="">לא ממופה</option>
                    {headers.map((h, index) => <option key={`${h}-${index}`} value={h}>{headerLabel(h)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {validation && (
            <div className="grid grid-4" style={{ marginTop: 14 }}>
              <div className="notice"><div className="stat-label">שורות בקובץ</div><b>{allRows.length}</b></div>
              <div className="notice"><div className="stat-label">תקינות לייבוא</div><b style={{ color: "var(--success)" }}>{validation.valid.length}</b></div>
              <div className="notice"><div className="stat-label">טלפונים כפולים</div><b style={{ color: validation.duplicates ? "var(--danger)" : "inherit" }}>{validation.duplicates}</b></div>
              <div className="notice"><div className="stat-label">חסר שם / טלפון</div><b style={{ color: validation.missingPhone + validation.missingName ? "var(--warning)" : "inherit" }}>{validation.missingPhone + validation.missingName}</b></div>
            </div>
          )}

          {validation?.missingRequiredMappings.length ? (
            <div className="notice danger" style={{ marginTop: 14 }}>יש למפות את שדות החובה: {validation.missingRequiredMappings.join(", ")}</div>
          ) : null}

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead><tr>{headers.slice(0, 7).map((h, i) => <th key={`${h}-${i}`}>{headerLabel(h)}</th>)}</tr></thead>
              <tbody>{allRows.slice(0, 5).map((r, i) => <tr key={i}>{headers.slice(0, 7).map((h, j) => <td key={`${h}-${j}`}>{cell(r, h)}</td>)}</tr>)}</tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" disabled={!validation || !!validation.missingRequiredMappings.length} onClick={importRows}>אישור {validation?.valid.length ?? 0} מועמדים</button>
            {imported && <span className="badge ok">✓ הקובץ מוכן לשמירה במחזור</span>}
          </div>
        </>
      )}
    </div>
  );
}
