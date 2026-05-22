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

const SYS = `You are an expert academic question paper author and a native-level writer of the target language. You ALWAYS reply with a single valid JSON object only, no markdown, no commentary. Schema:
{
  "instructions": string[],
  "questions": [
    { "type": "mcq"|"short"|"long"|"truefalse"|"fillblank", "text": string, "marks": number, "options"?: [string,string,string,string], "answer": string }
  ]
}
For mcq: options has exactly 4 plausible choices; answer is one of "A","B","C","D".
For truefalse: answer is "True" or "False" (or the target language equivalent like "સાચું"/"ખોટું", "सही"/"गलत").
For fillblank: use ____ in text; answer is the missing word/phrase.
For short/long: answer is a concise model answer.
LANGUAGE RULES (CRITICAL):
- Write EVERY field (instructions, text, options, answer) in the requested language using its native script.
- Use grammatically correct, exam-appropriate, formal academic register native to that language. No transliteration, no English loanwords unless they are standard terms (e.g., proper nouns).
- For Gujarati/Hindi/Marathi/Bengali/Tamil/Telugu/Kannada/Malayalam/Punjabi/Odia: use proper case markers (વિભક્તિ/कारक), correct gender-number agreement, idiomatic phrasing, and standard textbook style.
- Proofread mentally for spelling, sandhi, postpositions, and verb conjugation before emitting.
Questions must be original, syllabus-appropriate, unambiguous, and free of bias.`;

function buildPrompt(b: GenerateBrief): string {
  const breakdown = b.types
    .map((t) => `- ${t.count} ${t.type.toUpperCase()} questions, ${t.marksEach} marks each`)
    .join("\n");
  const lang = b.language || "English";
  return `Create a question paper.
School: ${b.schoolName}
Class: ${b.className}
Subject: ${b.subject}
Exam: ${b.examName}
Duration: ${b.durationMinutes} minutes
Total Marks: ${b.totalMarks}
OUTPUT LANGUAGE: ${lang}. Write ALL text (instructions, questions, options, answers) in ${lang} using its native script. Use formal, grammatically perfect, textbook-quality ${lang}. Do not mix English unless the term is a standard proper noun.
Difficulty: ${b.difficulty || "mixed"}
Topics / syllabus focus: ${b.topics || "general syllabus"}
Question breakdown:
${breakdown}
Additional notes: ${b.extra || "none"}

Return JSON only.`;
}

function repairJson(s: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let lastSafe = -1;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    out += c;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      stack.pop();
      if (stack.length > 0) lastSafe = out.length;
    }
  }
  if (inStr || stack.length > 0) {
    if (lastSafe > 0) out = out.slice(0, lastSafe);
    inStr = false; esc = false;
    const st2: string[] = [];
    for (let i = 0; i < out.length; i++) {
      const c = out[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") st2.push("}");
      else if (c === "[") st2.push("]");
      else if (c === "}" || c === "]") st2.pop();
    }
    if (inStr) out += '"';
    while (st2.length) out += st2.pop();
  }
  return out;
}

function extractJson(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : s).trim();
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("Bad AI output");
  const end = raw.lastIndexOf("}");
  const slice = end > start ? raw.slice(start, end + 1) : raw.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const repaired = repairJson(slice);
    try {
      return JSON.parse(repaired);
    } catch (e) {
      console.error("JSON repair failed", e, repaired.slice(0, 800));
      throw new Error("AI returned malformed output. Try fewer questions and retry.");
    }
  }
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
