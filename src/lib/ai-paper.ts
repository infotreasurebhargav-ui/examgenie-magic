import { aiChat } from "./sarvam.functions";
import type { Paper, Question, QuestionType } from "./paper-types";
import { newId } from "./paper-types";

export interface GenerateBrief {
  schoolName: string;
  className: string;
  subject: string;
  examName: string;
  durationMinutes: number;
  totalMarks: number;
  topics?: string;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  types: { type: QuestionType; count: number; marksEach: number }[];
  language?: string;
  extra?: string;
}

const SYS = `You are an expert academic question paper author. You ALWAYS reply with a single valid JSON object only, no markdown, no commentary. Schema:
{
  "instructions": string[],
  "questions": [
    { "type": "mcq"|"short"|"long"|"truefalse"|"fillblank", "text": string, "marks": number, "options"?: [string,string,string,string], "answer": string }
  ]
}
For mcq: options has exactly 4 plausible choices; answer is one of "A","B","C","D".
For truefalse: answer is "True" or "False".
For fillblank: use ____ in text; answer is the missing word/phrase.
For short/long: answer is a concise model answer.
Questions must be original, syllabus-appropriate, unambiguous, free of bias.`;

function buildPrompt(b: GenerateBrief): string {
  const breakdown = b.types
    .map((t) => `- ${t.count} ${t.type.toUpperCase()} questions, ${t.marksEach} marks each`)
    .join("\n");
  return `Create a question paper.
School: ${b.schoolName}
Class: ${b.className}
Subject: ${b.subject}
Exam: ${b.examName}
Duration: ${b.durationMinutes} minutes
Total Marks: ${b.totalMarks}
Language: ${b.language || "English"}
Difficulty: ${b.difficulty || "mixed"}
Topics / syllabus focus: ${b.topics || "general syllabus"}
Question breakdown:
${breakdown}
Additional notes: ${b.extra || "none"}

Return JSON only.`;
}

function extractJson(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : s).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Bad AI output");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function generatePaper(brief: GenerateBrief): Promise<Paper> {
  const { content } = await aiChat({
    data: {
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: buildPrompt(brief) },
      ],
      temperature: 0.6,
      max_tokens: 4000,
    },
  });
  const parsed = extractJson(content) as {
    instructions?: string[];
    questions: Array<Omit<Question, "id">>;
  };
  const questions: Question[] = (parsed.questions || []).map((q) => ({ ...q, id: newId() }));
  const paper: Paper = {
    id: newId(),
    createdAt: Date.now(),
    meta: {
      schoolName: brief.schoolName,
      className: brief.className,
      subject: brief.subject,
      examName: brief.examName,
      durationMinutes: brief.durationMinutes,
      totalMarks: brief.totalMarks,
      instructions: parsed.instructions || [
        "All questions are compulsory.",
        "Write answers neatly.",
      ],
    },
    questions,
  };
  return paper;
}

export async function gradeWrittenAnswer(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  maxMarks: number,
): Promise<{ score: number; feedback: string }> {
  const { content } = await aiChat({
    data: {
      messages: [
        {
          role: "system",
          content: `You are a strict but fair examiner. Return ONLY JSON: {"score": number, "feedback": string}. Score must be between 0 and ${maxMarks}.`,
        },
        {
          role: "user",
          content: `Question: ${question}\nModel answer: ${modelAnswer}\nStudent answer: ${studentAnswer}\nMax marks: ${maxMarks}. Grade and give 1-2 line feedback.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    },
  });
  try {
    const parsed = extractJson(content) as { score: number; feedback: string };
    return {
      score: Math.max(0, Math.min(maxMarks, Number(parsed.score) || 0)),
      feedback: parsed.feedback || "",
    };
  } catch {
    return { score: 0, feedback: "Could not grade automatically." };
  }
}
