/**
 * Board-specific guidelines injected into the AI prompt.
 * Each entry describes the board's curriculum style, question conventions,
 * and marking-scheme patterns so the AI produces board-accurate papers.
 */
export interface BoardContext {
  fullName: string;
  style: string; // Concise style guide for the AI
}

const BOARD_MAP: Record<string, BoardContext> = {
  // ─── National Boards ─────────────────────────────────────────────────────
  CBSE: {
    fullName: "Central Board of Secondary Education",
    style: `Follow CBSE / NCERT curriculum strictly.
- Section pattern: Section A (1-mark objective / MCQ / Assertion-Reason), Section B (2-mark short), Section C (3-mark), Section D (4–5-mark long / case-based). Label sections accordingly when you write instructions.
- Competency-based questions: frame MCQs as scenario-based, not rote-recall. Include at least 20% higher-order thinking (application/analysis level) questions per Bloom's taxonomy.
- Use NCERT textbook terminology and definitions exactly.
- For Science: include assertion-reason MCQs where appropriate.
- Marking scheme: each sub-part must clearly state its marks in brackets, e.g. (1) or (3).
- Avoid questions that can be solved by pure memory. Prefer graph reading, diagram labeling, or contextual application.`,
  },

  "ICSE/ISC": {
    fullName: "Indian Certificate of Secondary Education / ISC",
    style: `Follow CISCE / ICSE syllabus. ICSE is known for detailed, application-based questions.
- Questions should require conceptual explanation and reasoning, not just factual recall.
- English grammar/literature questions must use prescribed authors/texts where possible.
- Science questions should link theory to real-world application.
- Mathematics: show all working steps in model answers; accept alternative valid methods.
- Instruction note: "Attempt all questions from Section A; attempt any four from Section B."
- Use formal, precise academic language throughout.`,
  },

  NIOS: {
    fullName: "National Institute of Open Schooling",
    style: `NIOS follows a self-learning, open-schooling format.
- Questions should be direct, clearly worded, and avoid ambiguity — learners are often self-studying.
- Prefer application-level questions that connect to everyday life examples.
- Include step-by-step model answers for all non-MCQ questions.
- Difficulty should lean slightly easier than mainstream boards; focus on concept clarity.`,
  },

  // ─── International (India) ────────────────────────────────────────────────
  "IB (MYP/DP)": {
    fullName: "International Baccalaureate MYP / Diploma Programme",
    style: `Follow IB MYP/DP assessment criteria. IB emphasises critical thinking and ATL skills.
- Use command terms precisely: Define, Describe, Explain, Analyse, Evaluate, Justify, Compare.
- Questions should require synthesis and evaluation, not rote recall.
- Include at least one open-ended, extended-response question that asks students to "evaluate" or "to what extent".
- Mark schemes should list indicative content points and note: "Award marks for any other valid answer."
- Do NOT use section labels A/B/C/D; use Paper 1, Paper 2 convention or plain numbered questions.`,
  },

  "Cambridge IGCSE/A-Level": {
    fullName: "Cambridge Assessment International Education (IGCSE / A-Level)",
    style: `Follow Cambridge IGCSE / AS & A-Level syllabus conventions.
- Use Cambridge mark-scheme style: bullet points in model answers, "accept any two valid points".
- Command words must be used correctly: State, Describe, Explain, Calculate, Deduce, Discuss.
- Structured questions: part (a) for recall, part (b) for application, part (c) for evaluation.
- For Science: include data interpretation and graph analysis questions.
- Mathematics: show clear working; award marks for method even if the final answer is wrong.
- Formal British English spelling and terminology (e.g., "analyse" not "analyze").`,
  },

  // ─── State Boards ─────────────────────────────────────────────────────────
  "GSEB (Gujarat)": {
    fullName: "Gujarat Secondary & Higher Secondary Education Board",
    style: `Follow GSEB / Gujarat state textbook content exactly.
- Question format: Section A (MCQ 1M), Section B (Short 2M), Section C (Short 3M), Section D (Long 5M).
- Base all factual questions on the GSEB textbook definitions, examples, and diagrams.
- Use Gujarati numerals (૧,૨,૩…) and script if the language is set to Gujarati.
- Science: include diagram-drawing or labeling questions.
- Social Science: include map-work questions where applicable.
- Mathematics: follow GSEB prescribed method; alternative methods may not receive full credit.`,
  },

  "MSBSHSE (Maharashtra)": {
    fullName: "Maharashtra State Board of Secondary and Higher Secondary Education",
    style: `Follow Maharashtra State Board (SSC / HSC) syllabus and textbook content.
- Question pattern: Q1 MCQ, Q2 True/False or Match the column, Q3 Short notes (2M), Q4 Short answer (3M), Q5 Long answer (5M).
- Base all questions strictly on the state textbook (Balbharati).
- Science: include activity-based questions ("What is observed when…").
- Marathi medium: use standard Marathi grammatical forms; avoid colloquialisms.
- Marks for steps in Mathematics — show full step-by-step model solutions.`,
  },

  "TNBSE (Tamil Nadu)": {
    fullName: "Tamil Nadu Board of Secondary Education (Samacheer Kalvi)",
    style: `Follow Tamil Nadu Samacheer Kalvi uniform curriculum.
- Section pattern: Section I (1M objective), Section II (2M very short), Section III (3–4M short), Section IV (5M long), Section V (8M paragraph / creative).
- Questions must align with Samacheer Kalvi textbook content and examples.
- Social Science: include map and timeline questions.
- Tamil language papers: use classical Tamil grammar conventions (இலக்கணம்).
- Science: include "draw and label" and "difference between" table-format questions.`,
  },

  "KSEEB (Karnataka)": {
    fullName: "Karnataka Secondary Education Examination Board",
    style: `Follow Karnataka SSLC / PUC syllabus (NCERT-aligned but with Karnataka-specific content).
- Question pattern: One-mark (MCQ/fill), Two-mark (very short), Three-mark (short), Four-mark (long), Five-mark (essay).
- Use Karnataka textbook definitions and diagrams.
- Kannada medium: use formal ಕನ್ನಡ; avoid transliteration.
- Science: emphasise cause-effect and real-life application questions.`,
  },

  "KBPE (Kerala)": {
    fullName: "Kerala Board of Public Examinations (SCERT Kerala)",
    style: `Follow Kerala SCERT activity-based, constructivist curriculum.
- Kerala board is ACTIVITY and PROCESS-ORIENTED — questions should assess learning process, not just recall.
- Include open-ended analytical questions; avoid purely factual MCQs where possible.
- Science: include questions based on lab activities and experiments described in the textbook.
- Malayalam medium: use formal literary Malayalam (ഗ്രന്ഥഭാഷ) register.`,
  },

  "WBBSE/WBCHSE (West Bengal)": {
    fullName: "West Bengal Board of Secondary Education / Higher Secondary Council",
    style: `Follow West Bengal Madhyamik / HS syllabus and WBBSE textbooks.
- Section pattern: MCQ (1M), Short answer (2M), Descriptive (5M / 8M).
- Bengali medium: use standard সাধু বাংলা (formal/literary Bengali) in answer keys.
- History and Geography: include source-based and map questions.
- Science: use WBBSE prescribed experiments and definitions.`,
  },

  "UPMSP (Uttar Pradesh)": {
    fullName: "Uttar Pradesh Madhyamik Shiksha Parishad (UP Board)",
    style: `Follow UP Board (High School / Intermediate) syllabus.
- Questions should be based on UP Board prescribed textbooks, not NCERT alone.
- Long-answer questions expect detailed, point-by-point answers (5–7 points).
- Hindi medium: use standard खड़ी बोली हिन्दी; avoid English loanwords unless technical terms.
- Include "difference between" (अन्तर बताइए) and "definition" (परिभाषा दीजिए) question types.`,
  },

  "RBSE (Rajasthan)": {
    fullName: "Rajasthan Board of Secondary Education",
    style: `Follow RBSE syllabus. RBSE follows NCERT with Rajasthan-specific supplementary content.
- Section pattern: Objective (1M), Very short (1M), Short (2M), Long (4–5M).
- Hindi medium: formal standard Hindi. Rajasthan culture/geography questions should reference local examples.
- Science: use RBSE textbook definitions; lab-based questions are common.`,
  },

  "MPBSE (Madhya Pradesh)": {
    fullName: "Madhya Pradesh Board of Secondary Education",
    style: `Follow MPBSE syllabus (close to NCERT). Include MP-specific examples in Geography/History.
- Question format: Objective (1M), Short (2M), Medium (3M), Long (4M), Very long (5M).
- Hindi medium: use standard academic Hindi; avoid regional dialectal forms.`,
  },

  "BSEB (Bihar)": {
    fullName: "Bihar School Examination Board",
    style: `Follow BSEB Bihar Board syllabus.
- Includes objective (MCQ), very short (1–2M), short (3M), long (5M) type questions.
- Questions should be direct and concept-focused; avoid high-level analytical questions.
- Hindi medium: formal standard Hindi register.`,
  },

  "BSEAP (Andhra Pradesh)": {
    fullName: "Board of Secondary Education, Andhra Pradesh",
    style: `Follow AP Board (SSC / Intermediate) syllabus — AP State textbooks (not NCERT directly).
- Section I: Fill/Match/MCQ (1M), Section II: Very short (2M), Section III: Short (4M), Section IV: Long (8M).
- Telugu medium: use formal written Telugu; avoid English words except technical terms.
- Science: AP board asks practical-application questions; include "give reasons" type.`,
  },

  "TSBIE (Telangana)": {
    fullName: "Telangana State Board of Intermediate Education",
    style: `Follow Telangana Intermediate Board syllabus.
- Section A: Very short (2M), Section B: Short (4M), Section C: Long (8M).
- Telugu medium: formal standard Telugu script; avoid transliterations.
- Mathematics: step-marking is standard — show detailed method in model answers.`,
  },

  "PSEB (Punjab)": {
    fullName: "Punjab School Education Board",
    style: `Follow PSEB Punjab Board syllabus.
- Punjabi medium: use standard Gurmukhi script ਪੰਜਾਬੀ; avoid Roman transliteration.
- Include objective (1M), short (2–3M), and long (5M) question types.
- Punjabi language questions: include paraphrasing (ਵਿਆਖਿਆ), summary, and grammar (ਵਿਆਕਰਣ) questions.`,
  },

  "HBSE (Haryana)": {
    fullName: "Haryana Board of School Education",
    style: `Follow HBSE Haryana Board syllabus (NCERT-aligned with Haryana local content).
- Objective (1M), Short (2M), Long (5M) pattern.
- Hindi medium: standard academic Hindi; include Haryana-specific history/geography references.`,
  },

  "HPBOSE (Himachal Pradesh)": {
    fullName: "Himachal Pradesh Board of School Education",
    style: `Follow HPBOSE syllabus (NCERT-based). Include HP regional geography and culture references.
- Objective, Short, and Long question types as per standard HP Board pattern.`,
  },

  "UBSE (Uttarakhand)": {
    fullName: "Uttarakhand Board of School Education",
    style: `Follow UBSE syllabus (NCERT-aligned). Include Uttarakhand regional ecology and culture references.
- Standard Objective + Short + Long question pattern.`,
  },

  "JAC (Jharkhand)": {
    fullName: "Jharkhand Academic Council",
    style: `Follow JAC Jharkhand Board syllabus. Include Jharkhand tribal culture and local history references where relevant.
- Standard MCQ + Short + Long pattern.`,
  },

  "CHSE (Odisha)": {
    fullName: "Council of Higher Secondary Education, Odisha",
    style: `Follow CHSE Odisha Board syllabus. Odia medium: use formal Odia script; avoid transliterations.
- Include short notes (4M) and long essay (8M) question types.
- Odia literature questions: reference Panchasakha and Odisha literary tradition.`,
  },

  "SEBA/AHSEC (Assam)": {
    fullName: "Board of Secondary Education Assam / Assam Higher Secondary Education Council",
    style: `Follow SEBA/AHSEC Assam Board syllabus. Include Assam culture, history, and biodiversity references.
- Standard MCQ + Short + Long pattern. Assamese medium: formal Assamese script.`,
  },

  "CGBSE (Chhattisgarh)": {
    fullName: "Chhattisgarh Board of Secondary Education",
    style: `Follow CGBSE syllabus. Include Chhattisgarh tribal heritage and local history references.
- Standard question pattern; Hindi medium is most common.`,
  },

  "GBSHSE (Goa)": {
    fullName: "Goa Board of Secondary and Higher Secondary Education",
    style: `Follow GBSHSE Goa Board syllabus. Questions may include Goa-specific history, geography, and culture.
- English medium is most common. Include objective and descriptive sections.`,
  },

  "JKBOSE (J&K)": {
    fullName: "Jammu & Kashmir Board of School Education",
    style: `Follow JKBOSE J&K Board syllabus (close to NCERT). Include J&K geography and cultural heritage references.
- Standard Objective + Short + Long pattern.`,
  },

  "DBSE (Delhi)": {
    fullName: "Delhi Board of School Education",
    style: `Follow DBSE Delhi Board syllabus, which is competency-based and activity-oriented.
- Questions should emphasise real-life application and critical thinking.
- Use Delhi-specific local examples (governance, urban planning, metro connectivity) in Social Science.`,
  },
};

const DEFAULT_CONTEXT: BoardContext = {
  fullName: "General Education Board",
  style: `Follow standard academic question-paper conventions.
- Include objective, short-answer, and long-answer sections as specified.
- Questions should be unambiguous, age-appropriate, and curriculum-relevant.`,
};

export function getBoardContext(board: string): BoardContext {
  // Exact match first
  if (BOARD_MAP[board]) return BOARD_MAP[board];
  // Partial/fuzzy match (e.g. "CBSE" inside "CBSE – Central Board...")
  for (const [key, ctx] of Object.entries(BOARD_MAP)) {
    if (board.includes(key) || key.includes(board.split(" ")[0])) return ctx;
  }
  return DEFAULT_CONTEXT;
}
