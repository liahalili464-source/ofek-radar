export type UserRole = "admin" | "interviewer";
export type CycleStatus = "draft" | "active" | "completed" | "archived";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type Unit = {
  id: string;
  name: string;
  code?: string;
  interviewer?: string;
};

export type Candidate = {
  id: string;
  nationalId: string;
  fullName: string;
  phone?: string;
  city?: string;
  photoUrl?: string;
  status: string;
  targetUnit?: string;
  education?: string;
  experience?: string;
  skills?: string[];
  motivation?: string;
};

export type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "single_choice"
  | "multi_choice"
  | "date"
  | "yes_no"
  | "phone"
  | "email";

export type QuestionnaireQuestion = {
  id: string;
  fieldKey: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  mapsToCandidateField?: string;
};
