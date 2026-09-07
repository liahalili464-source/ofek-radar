export type CandidateCore = {
  nationalId: string;
  fullName: string;
  phone?: string;
  city?: string;
  photoUrl?: string;
  excelData?: Record<string, unknown>;
  questionnaireData?: Record<string, unknown>;
};

/**
 * Keeps the original Excel source and questionnaire answers separately,
 * while exposing one combined candidate card. Explicit questionnaire fields
 * can override contact data after the admin reviews conflicts.
 */
export function mergeCandidateSources(
  base: CandidateCore,
  questionnaire: Record<string, unknown>,
  approvedOverrides: Array<"fullName"|"phone"|"city">=[]
): CandidateCore {
  const next={...base, questionnaireData: questionnaire};
  for(const key of approvedOverrides){
    const qKey = key === "fullName" ? "full_name" : key;
    const value=questionnaire[qKey];
    if(typeof value==="string" && value.trim()) (next as Record<string, unknown>)[key]=value.trim();
  }
  return next;
}
