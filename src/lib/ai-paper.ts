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

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM = `You are a senior academic examiner. Output ONLY a JSON object — no markdown, no text outside JSON.

SCHEMA:
{"instructions":["string × 3-5"],"translatedHeader":{"schoolName":"string","examName":"string","className":"string","subject":"string"},"questions":[{"type":"mcq|short|long|truefalse|fillblank","text":"string","marks":number,"options":["A","B","C","D"],"answer":"string"}]}

RULES:
- mcq: options = exactly 4 strings; answer = "A"/"B"/"C"/"D"
- truefalse: answer = "True"/"False" (or native equivalent: Hindi सही/गलत, Gujarati સાચું/ખોટું, Marathi सत्य/असत्य, Tamil சரி/தவறு, Telugu నిజం/తప్పు, Bengali সত্য/মিথ্যা)
- fillblank: text has exactly one "____"; answer = fill word
- short: 2-4 sentence model answer
- long: 5-8 sentence detailed model answer
- ALL strings in the requested output language using native script
- Questions must be original, age-appropriate, syllabus-accurate
- MCQ distractors must be plausible`;

// ─── Batch token budget ───────────────────────────────────────────────────────

// Per-batch budget: reasoning overhead (1000) + output tokens + structural (200)
// Reduced from original 1800 overhead to speed up generation while still
// leaving enough room for the model to produce complete answers.
const BATCH_REASONING_OVERHEAD = 1000;

function calcBatchBudget(
  typeSpec: { type: QuestionType; count: number; marksEach: number },
): number {
  const outputTokens = typeSpec.count * (TOKENS_PER_QUESTION[typeSpec.type] ?? 150);
  return Math.min(4096, Math.max(1800, outputTokens + BATCH_REASONING_OVERHEAD + 200));
}

// ─── Batch prompt builder ─────────────────────────────────────────────────────

function buildBatchPrompt(
  brief: GenerateBrief,
  typeSpec: { type: QuestionType; count: number; marksEach: number },
  isPrimary: boolean,
  attempt: number,
  validationErrors: string[],
): string {
  const lang = brief.language || "English";
  const board = brief.board || "General";
  const boardCtx = getBoardContext(board);
  const isNonEnglish = lang.toLowerCase() !== "english";
  const { type, count, marksEach } = typeSpec;

  const retryBlock =
    attempt > 1 && validationErrors.length > 0
      ? `⚠️ RETRY ${attempt} — fix: ${validationErrors.map((e) => `✗ ${e}`).join("; ")}\n\n`
      : "";

  const schemaNote = isPrimary
    ? `Return JSON: {"instructions":["..."],"translatedHeader":{"schoolName":"...","examName":"...","className":"...","subject":"..."},"questions":[...]}`
    : `Return JSON: {"questions":[...]}`;

  const typeGuide: Record<string, string> = {
    mcq:       `Each MCQ: "type":"mcq","text":"...","marks":${marksEach},"options":["opt1","opt2","opt3","opt4"],"answer":"A"/"B"/"C"/"D"`,
    short:     `Each SHORT: "type":"short","text":"...","marks":${marksEach},"answer":"2-4 sentence model answer"`,
    long:      `Each LONG: "type":"long","text":"...","marks":${marksEach},"answer":"5-8 sentence detailed model answer"`,
    truefalse: `Each T/F: "type":"truefalse","text":"...","marks":${marksEach},"answer":"True" or "False"`,
    fillblank: `Each FILL: "type":"fillblank","text":"sentence with exactly one ____","marks":${marksEach},"answer":"fill word"`,
  };

  return `${retryBlock}Generate EXACTLY ${count} ${type.toUpperCase()} question${count > 1 ? "s" : ""} for this exam:

School: ${brief.schoolName} | Class: ${brief.className} | Subject: ${brief.subject}
Exam: ${brief.examName} | Board: ${boardCtx.fullName} | Difficulty: ${brief.difficulty || "mixed"}
${brief.topics ? `Topics: ${brief.topics}` : ""}
Language: ${lang}${isNonEnglish ? ` (native script, formal academic register, no English mixing)` : ""}

${typeGuide[type] ?? ""}
Count rule: you MUST produce EXACTLY ${count} question${count > 1 ? "s" : ""} — not ${count - 1}, not ${count + 1}.
${isPrimary ? `Also include ${lang} exam instructions (3-5 items) and translated header fields.` : ""}
${brief.extra ? `Notes: ${brief.extra}` : ""}

${schemaNote}
Output JSON only. Start with { end with }.`;
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
  // 1. Strip markdown code fences (```json … ``` or ``` … ```)
  let text = raw.replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1").trim();

  // 2. Strip any leading prose before the first { (model sometimes adds preamble)
  const start = text.indexOf("{");
  if (start === -1) throw new Error("AI response contained no JSON object.");
  // Also trim trailing prose after the last }
  const end = text.lastIndexOf("}");
  text = end > start ? text.slice(start, end + 1) : text.slice(start);

  // 3. Direct parse
  try { return JSON.parse(text) as RawOutput; } catch { /* fall through */ }

  // 4. Light sanitisation: remove JS-style comments and trailing commas
  const sanitised = text
    .replace(/\/\/[^\n]*/g, "")           // // comments
    .replace(/\/\*[\s\S]*?\*\//g, "")     // /* block comments */
    .replace(/,\s*([}\]])/g, "$1");       // trailing commas before } or ]
  try { return JSON.parse(sanitised) as RawOutput; } catch { /* fall through */ }

  // 5. Full structural repair for truncated / badly escaped responses
  const repaired = repairJson(sanitised);
  try { return JSON.parse(repaired) as RawOutput; } catch (e) {
    console.error("JSON repair failed", e, repaired.slice(0, 800));
    throw new Error("AI returned malformed JSON. Retrying…");
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

// ─── Single-batch generator (one question type, with retries) ─────────────────

const MAX_ATTEMPTS = 3;

interface BatchResult {
  questions: Question[];
  /** Only populated for the primary (first) batch */
  raw?: RawOutput;
}

async function generateBatch(
  brief: GenerateBrief,
  typeSpec: { type: QuestionType; count: number; marksEach: number },
  isPrimary: boolean,
): Promise<BatchResult> {
  const tokenBudget = calcBatchBudget(typeSpec);
  // Build a single-type brief for validation purposes
  const batchBrief: GenerateBrief = { ...brief, types: [typeSpec] };

  let validationErrors: string[] = [];
  let bestQuestions: Question[] = [];
  let bestRaw: RawOutput | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = buildBatchPrompt(brief, typeSpec, isPrimary, attempt, validationErrors);

    let content: string;
    try {
      const result = await aiChat({
        data: {
          messages: [
            { role: "system", content: BASE_SYSTEM },
            { role: "user", content: prompt },
          ],
          temperature: attempt === 1 ? 0.5 : 0.3,
          max_tokens: tokenBudget,
        },
      });
      content = result.content;
    } catch (e) {
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
        if (bestQuestions.length > 0) return { questions: bestQuestions, raw: bestRaw ?? undefined };
        throw new Error(`AI returned invalid JSON for ${typeSpec.type.toUpperCase()} questions after ${MAX_ATTEMPTS} retries. Please try again.`);
      }
      validationErrors = [e instanceof Error ? e.message : "Invalid JSON — retrying"];
      continue;
    }

    const { questions, errors, warnings } = validateAndFix(raw, batchBrief);
    if (warnings.length > 0) console.info(`[batch:${typeSpec.type}] Auto-fixed:`, warnings.join("; "));

    if (questions.length > bestQuestions.length) {
      bestQuestions = questions;
      bestRaw = raw;
    }

    if (errors.length === 0) {
      return { questions, raw: isPrimary ? raw : undefined };
    }

    console.warn(`[batch:${typeSpec.type}] Attempt ${attempt} errors:`, errors);
    validationErrors = errors;

    if (attempt === MAX_ATTEMPTS) {
      if (bestQuestions.length > 0) {
        console.error(`[batch:${typeSpec.type}] Returning best partial (${bestQuestions.length}/${typeSpec.count})`);
        return { questions: bestQuestions, raw: isPrimary ? (bestRaw ?? undefined) : undefined };
      }
      throw new Error(`Could not generate ${typeSpec.type.toUpperCase()} questions after ${MAX_ATTEMPTS} attempts: ${errors.slice(0, 2).join("; ")}`);
    }
  }

  throw new Error("Batch generation failed unexpectedly.");
}

// ─── Main export: generatePaper — parallel batches per question type ──────────

export async function generatePaper(brief: GenerateBrief): Promise<Paper> {
  if (brief.types.length === 0) throw new Error("No question types specified.");

  // Fire all question-type batches in parallel.
  // The largest type (most questions) is the "primary" batch and also returns
  // instructions + translatedHeader (saves the model from doing this twice).
  const sorted = [...brief.types].sort(
    (a, b) => b.count * (TOKENS_PER_QUESTION[b.type] ?? 150)
            - a.count * (TOKENS_PER_QUESTION[a.type] ?? 150),
  );
  const primaryType = sorted[0];

  console.info(
    `[generatePaper] Launching ${brief.types.length} parallel batch(es):`,
    brief.types.map((t) => `${t.count}×${t.type}`).join(", "),
  );

  const batchPromises = brief.types.map((typeSpec) =>
    generateBatch(brief, typeSpec, typeSpec === primaryType),
  );

  // Collect results — if any batch hard-fails, propagate immediately
  const results = await Promise.all(batchPromises);

  // Merge questions in the original type order (MCQ first, then short, then long…)
  const allQuestions: Question[] = brief.types.flatMap((typeSpec, i) => results[i].questions);

  // Get instructions/header from whichever batch was primary
  const primaryResult = results[brief.types.indexOf(primaryType)];
  const mergedRaw: RawOutput = {
    instructions: primaryResult.raw?.instructions,
    translatedHeader: primaryResult.raw?.translatedHeader,
    questions: allQuestions.map((q) => q as unknown as RawQuestion),
  };

  return buildPaper(mergedRaw, allQuestions, brief);
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
