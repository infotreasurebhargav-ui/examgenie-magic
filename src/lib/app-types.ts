export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
}

export interface PerQuestionResult {
  questionId: string;
  questionText: string;
  type: string;
  correctAnswer: string;
  studentAnswer: string;
  awarded: number;
  max: number;
  correct?: boolean;
  feedback?: string;
}

export interface TestSession {
  id: string;
  studentId?: string;
  studentName: string;
  rollNumber: string;
  paperId: string;
  examName: string;
  subject: string;
  className: string;
  score: number;
  maxScore: number;
  percentage: number;
  completedAt: number;
  perQuestion: PerQuestionResult[];
}

export interface BankQuestion {
  id: string;
  text: string;
  type: string;
  marks: number;
  options?: string[];
  answer: string;
  subject: string;
  topic?: string;
  difficulty?: string;
  board?: string;
  createdAt: number;
}

export interface AppSettings {
  schoolName: string;
  adminUsername: string;
  adminPassword: string;
}
