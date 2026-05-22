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

const SYS = `You are a senior academic question-paper author and a NATIVE-LEVEL writer of the target language (Gujarati, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, English, etc.).
Reply with a SINGLE valid JSON object only — no markdown, no commentary. Schema:
{
  "instructions": string[],
  "translatedHeader"?: { "schoolName"?: string, "examName"?: string, "className"?: string, "subject"?: string },
  "questions": [
    { "type": "mcq"|"short"|"long"|"truefalse"|"fillblank", "text": string, "marks": number, "options"?: [string,string,string,string], "answer": string }
  ]
}
For mcq: options has exactly 4 plausible choices; answer is one of "A","B","C","D".
For truefalse: answer in target language ("સાચું"/"ખોટું", "सही"/"गलत", "True"/"False").
For fillblank: use ____ in text; answer is the missing word/phrase.
For short/long: answer is a concise model answer.

LANGUAGE RULES (CRITICAL — ZERO TOLERANCE):
- Write EVERY field (instructions, text, options, answer, translatedHeader) in the requested language using its native script.
- Also TRANSLATE the header values (schoolName, examName, className, subject) into the target language inside translatedHeader. Example for Gujarati: subject "Mathematics" -> "ગણિત", "Class 10" -> "ધોરણ ૧૦", "Mid-Term Examination" -> "પ્રથમ સત્ર પરીક્ષા". Keep proper nouns (school names) in original script unless they have a well-known native form.
- Use grammatically correct, exam-board-quality, formal academic register. No transliteration. No Hinglish/Gujlish. No English loanwords unless they are standard technical terms.
- For Gujarati specifically: use proper વિભક્તિ (case markers: -નો/-ની/-નું/-માં/-થી/-ને), correct જાતિ-વચન agreement, સંધિ rules, idiomatic textbook phrasing matching GSEB/NCERT style. Numbers in Gujarati numerals (૧૨૩૪૫૬૭૮૯૦) where natural.
- For Hindi/Marathi: proper कारक, लिंग-वचन agreement, मात्रा correctness, NCERT textbook register.
- Mentally proofread every sentence for spelling, sandhi, postpositions, and verb conjugation before emitting.
Questions must be original, syllabus-appropriate, unambiguous, age-appropriate, and free of bias.`;

function buildPrompt(b: GenerateBrief): string {
  const breakdown = b.types
    .map((t) => `- ${t.count} ${t.type.toUpperCase()} questions, ${t.marksEach} marks each`)
    .join("\n");
  const lang = b.language || "English";
  const nonEnglish = lang.toLowerCase() !== "english";
  return `Create a question paper.
School: ${b.schoolName}
Class: ${b.className}
Subject: ${b.subject}
Exam: ${b.examName}
Duration: ${b.durationMinutes} minutes
Total Marks: ${b.totalMarks}

OUTPUT LANGUAGE: ${lang}.
${nonEnglish ? `Write ALL text (instructions, questions, options, answers) in ${lang} using its native script. Use formal, grammatically perfect, textbook-quality ${lang}. DO NOT mix English. ALSO populate "translatedHeader" with ${lang} translations of schoolName, examName, className and subject.` : ""}

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
    translatedHeader?: { schoolName?: string; examName?: string; className?: string; subject?: string };
    questions: Array<Omit<Question, "id">>;
  };
  const questions: Question[] = (parsed.questions || []).map((q) => ({ ...q, id: newId() }));
  const th = parsed.translatedHeader || {};
  const paper: Paper = {
    id: newId(),
    createdAt: Date.now(),
    meta: {
      schoolName: th.schoolName || brief.schoolName,
      className: th.className || brief.className,
      subject: th.subject || brief.subject,
      examName: th.examName || brief.examName,
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
