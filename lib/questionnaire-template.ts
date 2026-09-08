import type { QuestionnaireQuestion } from "@/lib/types";

export const FAMILIARITY_OPTIONS = [
  "לא מכיר כלל",
  "היכרות בסיסית",
  "היכרות בינונית",
  "היכרות טובה",
  "היכרות מצוינת",
];

export const BASE_OPTIONS = ["צריפין", "פלמחים", "קריה"];

export const FILE_UPLOAD_FIELD_KEYS = new Set([
  "photo_upload",
  "grades_upload",
  "cv_upload",
  "personal_questionnaire_upload",
]);

export const PROGRAMMING_FIELD_KEYS = [
  "programming_java",
  "programming_c",
  "programming_cpp",
  "programming_csharp",
  "programming_assembly",
  "programming_python",
  "programming_angular",
];

export const OS_FIELD_KEYS = ["os_windows", "os_linux"];
export const BASE_PRIORITY_FIELD_KEYS = ["base_pref_1", "base_pref_2", "base_pref_3"];

export const questionnaireTemplate: QuestionnaireQuestion[] = [
  { id: "template_photo", fieldKey: "photo_upload", label: "תמונה", type: "short_text", required: true, mapsToCandidateField: "photo_url" },
  { id: "template_full_name", fieldKey: "full_name", label: "שם מלא", type: "short_text", required: true, mapsToCandidateField: "full_name" },
  { id: "template_personal_number", fieldKey: "personal_number", label: "מספר אישי", type: "short_text", required: true, mapsToCandidateField: "source:מספר אישי" },
  { id: "template_phone", fieldKey: "phone", label: "טלפון", type: "phone", required: true, mapsToCandidateField: "phone" },
  { id: "template_city", fieldKey: "city", label: "עיר", type: "short_text", required: true, mapsToCandidateField: "city" },
  { id: "template_marital", fieldKey: "marital_status", label: "מצב משפחתי", type: "single_choice", required: true, options: ["רווק/ה", "נשוי/אה", "אחר"], mapsToCandidateField: "source:מצב משפחתי" },
  { id: "template_profile", fieldKey: "medical_profile", label: "פרופיל רפואי", type: "short_text", required: true, mapsToCandidateField: "source:פרופיל רפואי" },
  { id: "template_tash", fieldKey: "tash", label: "הקלות ת״ש", type: "short_text", required: true, mapsToCandidateField: "source:הקלות ת״ש" },
  { id: "template_institution", fieldKey: "institution", label: "מוסד לימודים", type: "short_text", required: true, mapsToCandidateField: "source:מוסד לימודים" },
  { id: "template_average", fieldKey: "degree_average", label: "ממוצע תואר", type: "number", required: true, mapsToCandidateField: "source:ממוצע תואר" },
  { id: "template_degree_status", fieldKey: "degree_status", label: "סטטוס תואר והצטיינות", type: "long_text", required: true, mapsToCandidateField: "source:סטטוס תואר והצטיינות" },
  { id: "template_grades", fieldKey: "grades_upload", label: "גיליון ציונים", type: "short_text", required: true, mapsToCandidateField: "source:גיליון ציונים" },
  { id: "template_cv", fieldKey: "cv_upload", label: "קורות חיים", type: "short_text", required: true, mapsToCandidateField: "source:קורות חיים" },
  { id: "template_personal_form", fieldKey: "personal_questionnaire_upload", label: "שאלון אישי לעתודאים", type: "short_text", required: true, mapsToCandidateField: "source:שאלון אישי לעתודאים" },
  { id: "template_base_1", fieldKey: "base_pref_1", label: "עדיפות 1", type: "single_choice", required: true, options: BASE_OPTIONS, mapsToCandidateField: "source:עדיפות בסיס [עדיפות 1]" },
  { id: "template_base_2", fieldKey: "base_pref_2", label: "עדיפות 2", type: "single_choice", required: true, options: BASE_OPTIONS, mapsToCandidateField: "source:עדיפות בסיס [עדיפות 2]" },
  { id: "template_base_3", fieldKey: "base_pref_3", label: "עדיפות 3", type: "single_choice", required: true, options: BASE_OPTIONS, mapsToCandidateField: "source:עדיפות בסיס [עדיפות 3]" },
  { id: "template_housing", fieldKey: "prefer_base_housing", label: "האם תעדיף מגורים בבסיס?", type: "yes_no", required: true, mapsToCandidateField: "source:האם תעדיף מגורים בבסיס?" },
  { id: "template_strengths", fieldKey: "strengths", label: "3 תכונות חזקות", type: "long_text", required: true, mapsToCandidateField: "source:3 תכונות חזקות" },
  { id: "template_weaknesses", fieldKey: "weaknesses", label: "3 תכונות חלשות", type: "long_text", required: true, mapsToCandidateField: "source:3 תכונות חלשות" },
  { id: "template_liked", fieldKey: "liked_topics", label: "נושאים מקצועיים שאהב בתואר", type: "long_text", required: true, mapsToCandidateField: "source:נושאים מקצועיים שאהב בתואר" },
  { id: "template_disliked", fieldKey: "disliked_topics", label: "נושאים מקצועיים שלא אהב בתואר", type: "long_text", required: true, mapsToCandidateField: "source:נושאים מקצועיים שלא אהב בתואר" },
  { id: "template_java", fieldKey: "programming_java", label: "JAVA", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [JAVA]" },
  { id: "template_c", fieldKey: "programming_c", label: "C", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [C]" },
  { id: "template_cpp", fieldKey: "programming_cpp", label: "C++", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [C++]" },
  { id: "template_csharp", fieldKey: "programming_csharp", label: "C#", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [C#]" },
  { id: "template_assembly", fieldKey: "programming_assembly", label: "Assembly", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [Assembly]" },
  { id: "template_python", fieldKey: "programming_python", label: "Python", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [Python]" },
  { id: "template_angular", fieldKey: "programming_angular", label: "Angular", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:שפות תכנות - רמת היכרות [Angular]" },
  { id: "template_other_languages", fieldKey: "additional_languages", label: "שפות נוספות (במידה ויש)", type: "long_text", required: false, mapsToCandidateField: "source:שפות נוספות (במידה ויש)" },
  { id: "template_windows", fieldKey: "os_windows", label: "Windows", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:מערכת הפעלה - רמת היכרות [Windows]" },
  { id: "template_linux", fieldKey: "os_linux", label: "Linux", type: "single_choice", required: true, options: FAMILIARITY_OPTIONS, mapsToCandidateField: "source:מערכת הפעלה - רמת היכרות [Linux]" },
  { id: "template_tools", fieldKey: "dev_tools", label: "כלי פיתוח לתכנה ומסדי נתונים", type: "long_text", required: false, mapsToCandidateField: "source:כלי פיתוח לתכנה ומסדי נתונים" },
];

export function isLegacyDefaultQuestionnaire(keys: string[]) {
  const legacy = ["full_name", "phone", "city", "education", "skills", "motivation"];
  return keys.length === legacy.length && legacy.every((key) => keys.includes(key));
}
