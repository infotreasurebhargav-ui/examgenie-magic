import type { Student, TestSession, BankQuestion, AppSettings } from "./app-types";
import type { Paper } from "./paper-types";
import { newId } from "./paper-types";

const KEYS = {
  students: "pf_students",
  sessions: "pf_sessions",
  bank: "pf_bank",
  papers: "pf_papers",
  settings: "pf_settings",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Students ──────────────────────────────────────────────────────────────────
export const getStudents = (): Student[] => read<Student[]>(KEYS.students, []);
export const saveStudents = (s: Student[]): void => write(KEYS.students, s);
export const addStudent = (s: Omit<Student, "id">): Student => {
  const student: Student = { ...s, id: newId() };
  saveStudents([...getStudents(), student]);
  return student;
};
export const updateStudent = (s: Student): void =>
  saveStudents(getStudents().map((x) => (x.id === s.id ? s : x)));
export const deleteStudent = (id: string): void =>
  saveStudents(getStudents().filter((s) => s.id !== id));
export const findStudentByRoll = (roll: string): Student | undefined =>
  getStudents().find(
    (s) => s.rollNumber.trim().toLowerCase() === roll.trim().toLowerCase(),
  );

// ── Test Sessions ─────────────────────────────────────────────────────────────
export const getSessions = (): TestSession[] =>
  read<TestSession[]>(KEYS.sessions, []);
export const saveSession = (session: Omit<TestSession, "id">): TestSession => {
  const s: TestSession = { ...session, id: newId() };
  write(KEYS.sessions, [...getSessions(), s]);
  return s;
};
export const deleteSession = (id: string): void =>
  write(KEYS.sessions, getSessions().filter((s) => s.id !== id));

// ── Question Bank ─────────────────────────────────────────────────────────────
export const getBankQuestions = (): BankQuestion[] =>
  read<BankQuestion[]>(KEYS.bank, []);
export const addBankQuestions = (
  qs: Omit<BankQuestion, "id" | "createdAt">[],
): void => {
  const newOnes = qs.map((q) => ({ ...q, id: newId(), createdAt: Date.now() }));
  write(KEYS.bank, [...getBankQuestions(), ...newOnes]);
};
export const deleteBankQuestion = (id: string): void =>
  write(KEYS.bank, getBankQuestions().filter((q) => q.id !== id));
export const clearBank = (): void => write(KEYS.bank, []);

// ── Saved Papers ──────────────────────────────────────────────────────────────
export const getSavedPapers = (): Array<{ paper: Paper; savedAt: number }> =>
  read(KEYS.papers, []);
export const savePaper = (paper: Paper): void => {
  const existing = getSavedPapers().filter((p) => p.paper.id !== paper.id);
  write(KEYS.papers, [{ paper, savedAt: Date.now() }, ...existing].slice(0, 50));
};
export const deleteSavedPaper = (id: string): void =>
  write(KEYS.papers, getSavedPapers().filter((p) => p.paper.id !== id));

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = (): AppSettings =>
  read<AppSettings>(KEYS.settings, {
    schoolName: "My School",
    adminUsername: "admin",
    adminPassword: "123",
  });
export const saveSettings = (s: AppSettings): void => write(KEYS.settings, s);

// ── Nuclear ───────────────────────────────────────────────────────────────────
export const clearAllData = (): void => {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
};
