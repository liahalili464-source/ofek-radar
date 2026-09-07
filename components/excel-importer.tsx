"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
export type NormalizedCandidateRow = {
  fullName: string;
  nationalId: string;
  phone: string;
  city: string;
  photoUrl: string;
  sourceData: Row;
};

type FieldKey = "fullName" | "nationalId" | "phone" | "city" | "photoUrl";

const fields: { key: FieldKey; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "fullName", label: "שם מלא", required: true, aliases: ["שם מלא", "שם", "full name", "fullname", "name"] },
  { key: "nationalId", label: "תעודת זהות", required: true, aliases: ["ת.ז", "תז", "תעודת זהות", "מספר זהות", "id", "national id"] },
  { key: "phone", label: "טלפון", aliases: ["טלפון", "נייד", "טלפון נייד", "phone", "mobile"] },
  { key: "city", label: "עיר מגורים", aliases: ["עיר", "יישוב", "מגורים", "city"] },
  { key: "photoUrl", label: "תמונה / URL", aliases: ["תמונה", "photo", "image", "photo url", "image url"] },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/["'׳״._-]/g, "").replace(/\s+/g, " ");
}

function detectMapping(headers: string[]) {
  const result: Record<FieldKey, string> = { fullName: "", nationalId: "", phone: "", city: "", photoUrl: "" };
  for (const field of fields) {
    const match = headers.find((h) => field.aliases.some((a) => normalizeHeader(h) === normalizeHeader(a)));
    if (match) result[field.key] = match;
  }
  return result;
}

function cell(row: Row, header: string) {
  const v = header ? row[header] : "";
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(/\.0+$/, "");
  return String(v).trim();
}

export function ExcelImporter({ onImport }: { onImport?: (rows: NormalizedCandidateRow[]) => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({ fullName: "", nationalId: "", phone: "", city: "", photoUrl: "" });
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
      setMapping(detectMapping(h));
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא ניתן לקרוא את הקובץ");
    }
  }

  const validation = useMemo(() => {
    if (!allRows.length) return null;
    const missingRequiredMappings = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
    const normalized = allRows.map((row) => ({
      fullName: cell(row, mapping.fullName),
      nationalId: cell(row, mapping.nationalId).replace(/\D/g, ""),
      phone: cell(row, mapping.phone),
      city: cell(row, mapping.city),
      photoUrl: cell(row, mapping.photoUrl),
      sourceData: row,
    }));
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    let missingId = 0;
    let missingName = 0;
    normalized.forEach((r) => {
      if (!r.nationalId) missingId++;
      if (!r.fullName) missingName++;
      if (r.nationalId) {
        if (seen.has(r.nationalId)) duplicates.add(r.nationalId);
        seen.add(r.nationalId);
      }
    });
    const valid = normalized.filter((r) => r.fullName && r.nationalId && !duplicates.has(r.nationalId));
    return { missingRequiredMappings, normalized, duplicates: duplicates.size, missingId, missingName, valid };
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
            <p className="section-subtitle">המערכת ניסתה לזהות אוטומטית. אפשר לשנות לפני הייבוא.</p>
            <div className="grid grid-3">
              {fields.map((field) => (
                <div className="field" key={field.key}>
                  <label>{field.label}{field.required ? " *" : ""}</label>
                  <select className="select" value={mapping[field.key]} onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}>
                    <option value="">לא ממופה</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {validation && (
            <div className="grid grid-4" style={{ marginTop: 14 }}>
              <div className="notice"><div className="stat-label">שורות בקובץ</div><b>{allRows.length}</b></div>
              <div className="notice"><div className="stat-label">תקינות לייבוא</div><b style={{ color: "var(--success)" }}>{validation.valid.length}</b></div>
              <div className="notice"><div className="stat-label">ת.ז כפולות</div><b style={{ color: validation.duplicates ? "var(--danger)" : "inherit" }}>{validation.duplicates}</b></div>
              <div className="notice"><div className="stat-label">חסר שם / ת.ז</div><b style={{ color: validation.missingId + validation.missingName ? "var(--warning)" : "inherit" }}>{validation.missingId + validation.missingName}</b></div>
            </div>
          )}

          {validation?.missingRequiredMappings.length ? (
            <div className="notice danger" style={{ marginTop: 14 }}>יש למפות את שדות החובה: {validation.missingRequiredMappings.join(", ")}</div>
          ) : null}

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead><tr>{headers.slice(0, 7).map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{allRows.slice(0, 5).map((r, i) => <tr key={i}>{headers.slice(0, 7).map((h) => <td key={h}>{cell(r, h)}</td>)}</tr>)}</tbody>
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
