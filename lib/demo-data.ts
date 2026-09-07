import type { Candidate, Unit } from "./types";

export const demoUnits: Unit[] = [
  { id: "8200", name: "יחידה 8200", code: "8200", interviewer: "אלון פרץ" },
  { id: "81", name: "יחידה 81", code: "81", interviewer: "מיכל לוי" },
  { id: "mamar", name: "ממ״ר", code: "ממ״ר", interviewer: "יובל שגיא" },
  { id: "mafat", name: "מפא״ת", code: "מפא״ת", interviewer: "דנה אלמוג" },
  { id: "modiin", name: "יחידת מודיעין", code: "מודיעין", interviewer: "גיא רזון" },
  { id: "tikshuv", name: "יחידת תקשוב", code: "תקשוב", interviewer: "רוני כספי" },
];

export const demoCandidates: Candidate[] = [
  {
    id: "1",
    nationalId: "034821756",
    fullName: "נועה אביטן",
    phone: "052-555-0182",
    city: "תל אביב",
    status: "בדיקת חו״ד",
    targetUnit: "יחידת סייבר",
    education: "תואר ראשון במדעי המחשב, אוניברסיטת תל אביב",
    experience: "מפתחת Full-Stack, כשנתיים ניסיון בחברת הייטק",
    skills: ["Python", "JavaScript", "C++", "SQL"],
    motivation: "מעוניינת לתרום בתחום הסייבר ולהתפתח מקצועית בסביבה טכנולוגית מאתגרת ומשמעותית.",
  },
  { id: "2", nationalId: "204313482", fullName: "דניאל שמעוני", phone: "050-555-0118", city: "רמת גן", status: "שובץ", targetUnit: "יחידת מודיעין", skills: ["Python", "OSINT"] },
  { id: "3", nationalId: "318044952", fullName: "עידן בר-און", phone: "054-555-0193", city: "חיפה", status: "ממתין לראיון", targetUnit: "תקשוב", skills: ["Networking", "Linux"] },
  { id: "4", nationalId: "207554381", fullName: "רוני כספי", phone: "052-555-0107", city: "באר שבע", status: "שאלון הושלם", targetUnit: "מפא״ת", skills: ["C#", ".NET"] },
  { id: "5", nationalId: "206937104", fullName: "תום גולן", phone: "053-555-0185", city: "הרצליה", status: "שובץ", targetUnit: "יחידה 8200", skills: ["Java", "Kotlin"] },
  { id: "6", nationalId: "315081449", fullName: "שירה מזרחי", phone: "050-555-0151", city: "ראשון לציון", status: "חדש", targetUnit: "יחידה 81", skills: ["Data", "Python"] },
  { id: "7", nationalId: "203644571", fullName: "יונתן בכר", phone: "052-555-0191", city: "פתח תקווה", status: "ממתין לראיון", targetUnit: "תקשוב", skills: ["DevOps", "Docker"] },
  { id: "8", nationalId: "212487563", fullName: "מיכל אדרי", phone: "054-555-0164", city: "כפר סבא", status: "שאלון הושלם", targetUnit: "יחידת מודיעין", skills: ["SQL", "BI"] },
];

export const demoCycles = [
  { id: "sep-2026", name: "מחזור ספטמבר 2026", start: "01.09.2026", end: "21.09.2026", candidates: 58, interviewers: 6, interviewsThisWeek: 42, progress: 12, status: "בתכנון" },
  { id: "aug-2026", name: "מחזור אוגוסט 2026", start: "02.08.2026", end: "24.08.2026", candidates: 58, interviewers: 9, interviewsThisWeek: 27, progress: 64, status: "פעיל" },
  { id: "jul-2026", name: "מחזור יולי 2026", start: "05.07.2026", end: "28.07.2026", candidates: 74, interviewers: 12, interviewsThisWeek: 18, progress: 88, status: "פעיל" },
  { id: "jun-2026", name: "מחזור יוני 2026", start: "01.06.2026", end: "22.06.2026", candidates: 65, interviewers: 10, interviewsThisWeek: 0, progress: 100, status: "הושלם" },
  { id: "may-2026", name: "מחזור מאי 2026", start: "04.05.2026", end: "26.05.2026", candidates: 61, interviewers: 11, interviewsThisWeek: 0, progress: 100, status: "הושלם" },
  { id: "apr-2026", name: "מחזור אפריל 2026", start: "06.04.2026", end: "27.04.2026", candidates: 53, interviewers: 8, interviewsThisWeek: 0, progress: 100, status: "הושלם" },
];

export const defaultQuestions = [
  { id: "q1", fieldKey: "full_name", label: "שם מלא", type: "short_text" as const, required: true, mapsToCandidateField: "full_name" },
  { id: "q2", fieldKey: "national_id", label: "תעודת זהות", type: "short_text" as const, required: true, mapsToCandidateField: "national_id" },
  { id: "q3", fieldKey: "phone", label: "טלפון", type: "phone" as const, required: true, mapsToCandidateField: "phone" },
  { id: "q4", fieldKey: "city", label: "עיר מגורים", type: "short_text" as const, required: false, mapsToCandidateField: "city" },
  { id: "q5", fieldKey: "education", label: "השכלה", type: "long_text" as const, required: false },
  { id: "q6", fieldKey: "skills", label: "באילו שפות/טכנולוגיות יש לך ניסיון?", type: "multi_choice" as const, required: true, options: ["Python", "JavaScript", "C++", "C#", "Java", "SQL", "Linux", "DevOps"] },
  { id: "q7", fieldKey: "motivation", label: "למה מעניין אותך להשתלב ביחידה טכנולוגית?", type: "long_text" as const, required: true },
];
