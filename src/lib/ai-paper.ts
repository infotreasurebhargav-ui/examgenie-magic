import { aiChat } from "./sarvam.functions";
import type { Paper, Question, QuestionType } from "./paper-types";
import { newId } from "./paper-types";
import { getBoardContext } from "./board-context";

// ─── Public interface ─────────────────────────────────────────────────────────

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
  board?: string;
  extra?: string;
}

// ─── Token budget ─────────────────────────────────────────────────────────────

// Empirical tokens-per-question estimates (question text + answer + overhead).
const TOKENS_PER_QUESTION: Record<QuestionType, number> = {
  mcq: 140,       // 4 options + answer letter
  truefalse: 80,
  fillblank: 100,
  short: 200,     // question + 2–3 sentence model answer
  long: 400,      // question + detailed model answer
};

function calcTokenBudget(brief: GenerateBrief): number {
  const questionTokens = brief.types.reduce(
    (sum, t) => sum + t.count * (TOKENS_PER_QUESTION[t.type] ?? 150),
    0,
  );
  // 800 overhead: system prompt injection, JSON braces, instructions, translatedHeader
  return Math.min(8000, Math.max(2500, questionTokens + 800));
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM = `You are a senior academic examiner and a NATIVE-LEVEL writer of the requested language.
Your ONLY output is a single valid JSON object — no markdown, no prose, no code fences, no comments.

JSON SCHEMA (follow exactly):
{
  "instructions": string[],          // 3–5 exam instructions in the output language
  "translatedHeader": {              // translate school/exam/class/subject into the output language
    "schoolName": string,
    "examName": string,
    "className": string,
    "subject": string
  },
  "questions": [                     // array of question objects
    {
      "type": "mcq"|"short"|"long"|"truefalse"|"fillblank",
      "text": string,                // question text — never empty
      "marks": number,               // marks for this question
      "options": [A, B, C, D],       // ONLY for mcq — EXACTLY 4 strings
      "answer": string               // see rules below
    }
  ]
}

ANSWER RULES (critical — zero tolerance):
• mcq       → answer MUST be exactly one of: "A" "B" "C" "D"  (uppercase single letter)
• truefalse → answer MUST be exactly "True" or "False" (English), OR the native-language equivalent below:
              Hindi: "सही"/"गलत" | Gujarati: "સાચું"/"ખોટું" | Marathi: "सत्य"/"असत्य"
              Tamil: "சரி"/"தவறு" | Telugu: "నిజం"/"తప్పు" | Kannada: "ಸರಿ"/"ತಪ್ಪು"
              Bengali: "সত্য"/"মিথ্যা" | Malayalam: "ശരി"/"തെറ്റ്" | Punjabi: "ਸੱਚ"/"ਝੂਠ"
• fillblank → text MUST contain exactly one "____"; answer is the word/phrase that fills it
• short     → answer is a concise model answer (2–4 sentences)
• long      → answer is a detailed model answer with all key points (5–8 sentences or bullet list)

LANGUAGE RULES (absolute):
• Write EVERY string — instructions, text, options, answer, translatedHeader — in the requested output language.
• Use the native script. No transliteration. No English loanwords (except universally accepted technical terms).
• Gujarati: use proper વિભક્તિ, correct gender-number agreement, Gujarati numerals (૧,૨,…) where natural.
• Hindi/Marathi: correct कारक, लिंग-वचन. Bengali: সাধু or চলিত consistently. Tamil: formal literary Tamil.
• Proofread every sentence for grammar, spelling, sandhi, and verb conjugation before emitting.

QUALITY RULES:
• All questions must be original, unambiguous, age-appropriate, and syllabus-accurate.
• MCQ distractors must be plausible — avoid obviously wrong options.
• Difficulty must match the requested level; "mixed" means distribute across easy/medium/hard.
• Do NOT repeat the same question twice or trivially rephrase it.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  brief: GenerateBrief,
  attempt: number,
  validationErrors: string[],
): string {
  const lang = brief.language || "English";
  const board = brief.board || "General";
  const boardCtx = getBoardContext(board);
  const isNonEnglish = lang.toLowerCase() !== "english";

  // Build exact required-count table — this is the single most important part
  const countTable = brief.types
    .map((t) => `  • ${t.count} × ${t.type.toUpperCase()} questions, ${t.marksEach} mark${t.marksEach > 1 ? "s" : ""} each  → subtotal ${t.count * t.marksEach} marks`)
    .join("\n");

  const totalExpected = brief.types.reduce((s, t) => s + t.count * t.marksEach, 0);

  // On retry attempts, include the specific errors from previous attempt
  const retryBlock =
    attempt > 1 && validationErrors.length > 0
      ? `\n⚠️ RETRY ATTEMPT ${attempt} — FIX THESE ERRORS FROM YOUR PREVIOUS RESPONSE:\n${validationErrors.map((e) => `  ✗ ${e}`).join("\n")}\nDo NOT repeat the same mistakes. Count every question type before outputting.\n`
      : "";

  return `${retryBlock}Generate a complete question paper with the following specification.

━━━ PAPER DETAILS ━━━
School:     ${brief.schoolName}
Class:      ${brief.className}
Subject:    ${brief.subject}
Exam:       ${brief.examName}
Duration:   ${brief.durationMinutes} minutes
Total Marks: ${totalExpected}
Difficulty: ${brief.difficulty || "mixed"}
Topics:     ${brief.topics || "full syllabus / general"}
Board:      ${boardCtx.fullName}

━━━ BOARD-SPECIFIC GUIDELINES ━━━
${boardCtx.style}

━━━ OUTPUT LANGUAGE ━━━
${lang}
${isNonEnglish ? `ALL text (instructions, questions, options, answers, translatedHeader) must be written in ${lang} using its native script. Formal academic register. Zero English mixing except unavoidable technical terms.` : "Use formal, standard English."}

━━━ QUESTION BREAKDOWN (MANDATORY — EXACT COUNTS) ━━━
YOU MUST GENERATE EXACTLY THESE QUESTIONS — NOT ONE MORE, NOT ONE LESS:
${countTable}
TOTAL: ${brief.types.reduce((s, t) => s + t.count, 0)} questions | ${totalExpected} marks

CRITICAL COUNT RULE: Before you output, count the number of questions of each type in your JSON.
If any count is wrong, recount and fix it. The numbers above are non-negotiable.

━━━ ADDITIONAL NOTES ━━━
${brief.extra || "None"}

Return JSON only. No markdown. No explanation. Start your response with { and end with }.`;
}

// ─── Raw AI output types ──────────────────────────────────────────────────────

interface RawQuestion {
  type?: unknown;
  text?: unknown;
  marks?: unknown;
  options?: unknown;
  answer?: unknown;
}

interface RawOutput {
  instructions?: unknown;
  translatedHeader?: unknown;
  questions?: RawQuestion[];
}

// ─── JSON parsing & repair ────────────────────────────────────────────────────

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
    // Re-close any open structures
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

function extractJson(raw: string): RawOutput {
  // Strip markdown code fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("AI response contained no JSON object.");
  const end = text.lastIndexOf("}");
  const slice = end > start ? text.slice(start, end + 1) : text.slice(start);
  try {
    return JSON.parse(slice) as RawOutput;
  } catch {
    const repaired = repairJson(slice);
    try {
      return JSON.parse(repaired) as RawOutput;
    } catch (e) {
      console.error("JSON repair failed", e, repaired.slice(0, 800));
      throw new Error("AI returned malformed JSON. Retrying…");
    }
  }
}

// ─── Validation & auto-fix ────────────────────────────────────────────────────

const TRUE_WORDS = new Set([
  "true", "सही", "સાચું", "सत्य", "ਸੱਚ", "சரி", "నిజం", "ಸರಿ", "സരി", "ශ්‍රී", "সত্য",
]);
const FALSE_WORDS = new Set([
  "false", "गलत", "ખોટું", "असत्य", "ਝੂਠ", "தவறு", "తప్పు", "ತಪ್ಪು", "തെറ്റ്", "মিথ্যা",
]);

function normaliseTF(raw: string, lang: string): string {
  const s = raw.trim().toLowerCase();
  if (TRUE_WORDS.has(s)) {
    // Map back to language-correct form
    const map: Record<string, string> = {
      Hindi: "सही", Gujarati: "સાચું", Marathi: "सत्य",
      Tamil: "சரி", Telugu: "నిజం", Kannada: "ಸರಿ",
      Malayalam: "ശരി", Bengali: "সত্য", Punjabi: "ਸੱਚ",
    };
    return map[lang] ?? "True";
  }
  if (FALSE_WORDS.has(s)) {
    const map: Record<string, string> = {
      Hindi: "गलत", Gujarati: "ખોટું", Marathi: "असत्य",
      Tamil: "தவறு", Telugu: "తప్పు", Kannada: "ತಪ್ಪು",
      Malayalam: "തെറ്റ്", Bengali: "মিথ্যা", Punjabi: "ਝੂਠ",
    };
    return map[lang] ?? "False";
  }
  return raw; // keep as-is; will fail validation and force retry
}

interface ValidationResult {
  questions: Question[];
  errors: string[];
  warnings: string[];
}

function validateAndFix(raw: RawOutput, brief: GenerateBrief): ValidationResult {
  const lang = brief.language || "English";
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: Question[] = [];

  // Build required-count map
  const required = new Map(
    brief.types.map((t) => [t.type as QuestionType, { count: t.count, marks: t.marksEach }]),
  );
  const got = new Map<QuestionType, number>();

  const rawQs: RawQuestion[] = Array.isArray(raw.questions) ? raw.questions : [];

  for (let i = 0; i < rawQs.length; i++) {
    const rq = rawQs[i];
    const idx = i + 1;
    const type = (typeof rq.type === "string" ? rq.type.trim().toLowerCase() : "") as QuestionType;
    const text = typeof rq.text === "string" ? rq.text.trim() : "";
    const rawMarks = Number(rq.marks);
    const reqInfo = required.get(type);
    const expectedMarks = reqInfo?.marks ?? rawMarks;
    const marks = isNaN(rawMarks) || rawMarks <= 0 ? expectedMarks : rawMarks;

    // ── Type check ──
    const validTypes: QuestionType[] = ["mcq", "short", "long", "truefalse", "fillblank"];
    if (!validTypes.includes(type)) {
      errors.push(`Q${idx}: unknown type "${rq.type}" — skipped`);
      continue;
    }

    // ── Text check ──
    if (!text) {
      errors.push(`Q${idx} (${type}): question text is empty`);
      continue;
    }

    // ── Marks mismatch (auto-fix) ──
    if (reqInfo && marks !== reqInfo.marks) {
      warnings.push(`Q${idx} (${type}): marks ${marks} → auto-corrected to ${reqInfo.marks}`);
    }

    // ── Type-specific validation ──
    let answer = typeof rq.answer === "string" ? rq.answer.trim() : "";
    let options: string[] | undefined;

    if (type === "mcq") {
      const rawOpts = Array.isArray(rq.options) ? rq.options : [];
      // Normalise options to strings
      const opts = rawOpts.map((o) => (typeof o === "string" ? o.trim() : String(o)));
      if (opts.length !== 4) {
        errors.push(`Q${idx} (mcq): needs exactly 4 options, got ${opts.length}`);
        continue;
      }
      options = opts;
      // Normalise answer to uppercase A-D
      const ansUp = answer.toUpperCase();
      if (!["A", "B", "C", "D"].includes(ansUp)) {
        errors.push(`Q${idx} (mcq): answer "${answer}" is not A/B/C/D`);
        continue;
      }
      answer = ansUp;

    } else if (type === "truefalse") {
      answer = normaliseTF(answer, lang);
      const valid = [...TRUE_WORDS, ...FALSE_WORDS];
      if (!valid.includes(answer.trim().toLowerCase())) {
        errors.push(`Q${idx} (truefalse): answer "${answer}" is not True/False (or its language equivalent)`);
        continue;
      }

    } else if (type === "fillblank") {
      if (!text.includes("____")) {
        // Try to insert a blank — look for a plausible spot, or just flag error
        errors.push(`Q${idx} (fillblank): question text must contain "____" but doesn't`);
        continue;
      }
      if (!answer) {
        errors.push(`Q${idx} (fillblank): answer is empty`);
        continue;
      }

    } else {
      // short / long
      if (!answer) {
        errors.push(`Q${idx} (${type}): model answer is empty`);
        continue;
      }
    }

    got.set(type, (got.get(type) ?? 0) + 1);
    questions.push({
      id: newId(),
      type,
      text,
      marks: reqInfo ? reqInfo.marks : marks,
      ...(options ? { options } : {}),
      answer,
    });
  }

  // ── Count validation ──
  for (const [type, { count }] of required) {
    const actual = got.get(type) ?? 0;
    if (actual !== count) {
      errors.push(
        `Wrong count for ${type.toUpperCase()}: needed ${count}, got ${actual}. ` +
        `Generate exactly ${count} ${type.toUpperCase()} questions.`,
      );
    }
  }

  return { questions, errors, warnings };
}

// ─── Build final Paper from validated questions ───────────────────────────────

function buildPaper(
  raw: RawOutput,
  questions: Question[],
  brief: GenerateBrief,
): Paper {
  const th = (raw.translatedHeader ?? {}) as Record<string, string>;
  const rawInstr = Array.isArray(raw.instructions) ? raw.instructions : [];
  const instructions: string[] =
    rawInstr.length > 0
      ? rawInstr.map((s) => String(s))
      : ["All questions are compulsory.", "Write answers neatly.", "Do not write on the question paper."];

  return {
    id: newId(),
    createdAt: Date.now(),
    meta: {
      schoolName: th.schoolName || brief.schoolName,
      className: th.className || brief.className,
      subject: th.subject || brief.subject,
      examName: th.examName || brief.examName,
      durationMinutes: brief.durationMinutes,
      totalMarks: brief.totalMarks,
      instructions,
    },
    questions,
  };
}

// ─── Main export: generatePaper with retry loop ───────────────────────────────

const MAX_ATTEMPTS = 3;

export async function generatePaper(brief: GenerateBrief): Promise<Paper> {
  const tokenBudget = calcTokenBudget(brief);
  let validationErrors: string[] = [];
  let lastRaw: RawOutput | null = null;
  let bestQuestions: Question[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = buildPrompt(brief, attempt, validationErrors);

    let content: string;
    try {
      const result = await aiChat({
        data: {
          messages: [
            { role: "system", content: BASE_SYSTEM },
            { role: "user", content: prompt },
          ],
          temperature: attempt === 1 ? 0.55 : 0.35, // lower temperature on retries for consistency
          max_tokens: tokenBudget,
        },
      });
      content = result.content;
    } catch (e) {
      // If it's a truncation error, throw immediately — no retry will help
      if (e instanceof Error && e.message.includes("truncated")) throw e;
      if (attempt === MAX_ATTEMPTS) throw e;
      validationErrors = [e instanceof Error ? e.message : "Network error — retrying"];
      continue;
    }

    let raw: RawOutput;
    try {
      raw = extractJson(content);
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          "AI returned unrecoverable invalid JSON after all retries. Please try again.",
        );
      }
      validationErrors = [e instanceof Error ? e.message : "Invalid JSON — retrying"];
      continue;
    }

    lastRaw = raw;
    const { questions, errors, warnings } = validateAndFix(raw, brief);

    if (warnings.length > 0) {
      console.info("[generatePaper] Auto-fixed:", warnings.join("; "));
    }

    if (errors.length === 0) {
      // ✅ Perfect — return immediately
      return buildPaper(raw, questions, brief);
    }

    console.warn(`[generatePaper] Attempt ${attempt} validation errors:`, errors);
    validationErrors = errors;

    // Keep the best partial result in case all retries fail
    if (questions.length > bestQuestions.length) {
      bestQuestions = questions;
    }

    if (attempt === MAX_ATTEMPTS) {
      // If we have ANY questions, return a partial paper rather than crashing
      if (bestQuestions.length > 0) {
        console.error("[generatePaper] Returning best partial result after all retries failed.");
        return buildPaper(lastRaw!, bestQuestions, brief);
      }
      throw new Error(
        `Could not generate a valid paper after ${MAX_ATTEMPTS} attempts. ` +
        `Last issues: ${errors.slice(0, 3).join("; ")}`,
      );
    }
    // else loop continues with validationErrors injected into next prompt
  }

  // Should never reach here
  throw new Error("Generation failed unexpectedly.");
}

// ─── Grading (unchanged logic, improved prompt) ───────────────────────────────

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
          content: `You are a strict but fair examiner. Award partial marks for partially correct answers.
Return ONLY a JSON object: {"score": number, "feedback": string}
Score must be an integer between 0 and ${maxMarks}. Feedback must be 1–2 sentences.`,
        },
        {
          role: "user",
          content: `Question: ${question}
Model answer: ${modelAnswer}
Student answer: ${studentAnswer}
Max marks: ${maxMarks}

Grade the student answer. Award marks proportional to correctness. Give 1-2 sentence feedback.`,
        },
      ],
      temperature: 0.15,
      max_tokens: 200,
    },
  });

  try {
    const parsed = extractJson(content) as { score: number; feedback: string };
    return {
      score: Math.max(0, Math.min(maxMarks, Math.round(Number(parsed.score) || 0))),
      feedback: parsed.feedback || "",
    };
  } catch {
    return { score: 0, feedback: "Could not grade automatically." };
  }
}
