export type QuestionType = "mcq" | "short" | "long" | "truefalse" | "fillblank";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options?: string[]; // for mcq
  answer: string; // correct option letter (A/B/C/D) for mcq, or model answer text
}

export interface PaperMeta {
  schoolName: string;
  className: string;
  subject: string;
  examName: string;
  durationMinutes: number;
  totalMarks: number;
  instructions: string[];
  date?: string;
}

export interface Paper {
  id: string;
  meta: PaperMeta;
  questions: Question[];
  createdAt: number;
}

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
