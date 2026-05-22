import { useState } from "react";
import {
  BookOpen, Plus, Trash2, Search, Download,
  ChevronDown, ChevronUp, Sparkles, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getBankQuestions, addBankQuestions, deleteBankQuestion } from "@/lib/store";
import { aiChat } from "@/lib/sarvam.functions";
import type { BankQuestion } from "@/lib/app-types";

const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  short: "Short Answer",
  long: "Long Answer",
  truefalse: "True / False",
  fillblank: "Fill in the Blank",
};

const TYPE_COLORS: Record<string, string> = {
  mcq: "bg-indigo-500/20 text-indigo-300",
  short: "bg-sky-500/20 text-sky-300",
  long: "bg-violet-500/20 text-violet-300",
  truefalse: "bg-amber-500/20 text-amber-300",
  fillblank: "bg-emerald-500/20 text-emerald-300",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy", medium: "Medium", hard: "Hard",
};

type FormState = {
  text: string;
  type: string;
  marks: string;
  options: string[];
  answer: string;
  subject: string;
  topic: string;
  difficulty: string;
  board: string;
};

const DEFAULT_FORM: FormState = {
  text: "", type: "short", marks: "2",
  options: ["", "", "", ""],
  answer: "", subject: "", topic: "",
  difficulty: "medium", board: "",
};

export function QuestionBankPage() {
  const [questions, setQuestions] = useState<BankQuestion[]>(() => getBankQuestions());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [genQuestion, setGenQuestion] = useState(false);
  const [genAnswer, setGenAnswer] = useState(false);

  const refresh = () => setQuestions(getBankQuestions());

  const subjects = Array.from(new Set(questions.map((q) => q.subject).filter(Boolean)));
  const types = Array.from(new Set(questions.map((q) => q.type)));

  const filtered = questions.filter((q) => {
    const matchSearch =
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      (q.subject ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (q.topic ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || q.type === filterType;
    const matchSubject = filterSubject === "all" || q.subject === filterSubject;
    return matchSearch && matchType && matchSubject;
  });

  const handleDelete = (id: string) => {
    deleteBankQuestion(id);
    refresh();
    toast.success("Question removed");
  };

  const handleAdd = () => {
    if (!form.text.trim()) { toast.error("Question text is required"); return; }
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    if (!form.answer.trim()) { toast.error("Answer is required"); return; }
    const q: Omit<BankQuestion, "id" | "createdAt"> = {
      text: form.text.trim(),
      type: form.type,
      marks: Number(form.marks) || 1,
      answer: form.answer.trim(),
      subject: form.subject.trim(),
      topic: form.topic.trim() || undefined,
      difficulty: form.difficulty,
      board: form.board.trim() || undefined,
      options: form.type === "mcq" ? form.options.filter(Boolean) : undefined,
    };
    addBankQuestions([q]);
    refresh();
    toast.success("Question added to bank");
    setDialogOpen(false);
    setForm(DEFAULT_FORM);
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("No questions to export"); return; }
    const data = filtered.map((q) => ({
      Type: TYPE_LABELS[q.type] ?? q.type,
      Question: q.text,
      Answer: q.answer,
      Options: q.options?.join(" | ") ?? "",
      Marks: q.marks,
      Subject: q.subject,
      Topic: q.topic ?? "",
      Difficulty: q.difficulty ?? "",
      Board: q.board ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Question Bank");
    XLSX.writeFile(wb, "question_bank.xlsx");
    toast.success("Exported question_bank.xlsx");
  };

  // ── AI: Generate question text ──────────────────────────────────────────────
  const handleGenerateQuestion = async () => {
    if (!form.subject.trim()) {
      toast.error("Please enter a Subject first so AI knows what to write about");
      return;
    }
    setGenQuestion(true);
    try {
      const typeName = TYPE_LABELS[form.type] ?? form.type;
      const context = [
        form.subject && `Subject: ${form.subject}`,
        form.topic && `Topic: ${form.topic}`,
        form.board && `Board: ${form.board}`,
        `Type: ${typeName}`,
        `Difficulty: ${form.difficulty}`,
        `Marks: ${form.marks}`,
      ].filter(Boolean).join(", ");

      const result = await aiChat({
        data: {
          messages: [
            {
              role: "system",
              content:
                "You are an expert school teacher. Generate exactly ONE exam question. " +
                "Return ONLY the question text — no numbering, no explanation, no answer, no extra lines.",
            },
            {
              role: "user",
              content: `Generate a ${typeName} exam question. ${context}. Return only the question text.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
        },
      });
      const text = result.content.trim();
      setForm((f) => ({ ...f, text }));
      toast.success("Question generated!");
    } catch {
      toast.error("AI generation failed. Please try again.");
    } finally {
      setGenQuestion(false);
    }
  };

  // ── AI: Generate model answer ───────────────────────────────────────────────
  const handleGenerateAnswer = async () => {
    if (!form.text.trim()) {
      toast.error("Please enter the Question Text first");
      return;
    }
    setGenAnswer(true);
    try {
      const typeName = TYPE_LABELS[form.type] ?? form.type;
      const isMcq = form.type === "mcq";
      const systemPrompt = isMcq
        ? "You are an expert teacher. Given the MCQ question and its options, return ONLY the correct option letter (A, B, C, or D). Nothing else."
        : "You are an expert teacher. Write a clear, concise model answer suitable for an exam mark scheme. Return only the answer text, no labels.";

      const userContent = isMcq
        ? `Question: ${form.text}\nOptions:\nA. ${form.options[0]}\nB. ${form.options[1]}\nC. ${form.options[2]}\nD. ${form.options[3]}\n\nWhich option is correct? Reply with only the letter.`
        : `Question: ${form.text}\nType: ${typeName}, Marks: ${form.marks}${form.subject ? `, Subject: ${form.subject}` : ""}. Write the model answer.`;

      const result = await aiChat({
        data: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 400,
        },
      });
      setForm((f) => ({ ...f, answer: result.content.trim() }));
      toast.success("Answer generated!");
    } catch {
      toast.error("AI generation failed. Please try again.");
    } finally {
      setGenAnswer(false);
    }
  };

  // ── AI: Generate MCQ options ────────────────────────────────────────────────
  const handleGenerateMcqOptions = async () => {
    if (!form.text.trim()) {
      toast.error("Please enter the Question Text first");
      return;
    }
    setGenAnswer(true);
    try {
      const result = await aiChat({
        data: {
          messages: [
            {
              role: "system",
              content:
                "You are an expert teacher. Given an MCQ question, generate 4 answer options and identify the correct one. " +
                "Respond ONLY as valid JSON: {\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":\"A\"}. No extra text.",
            },
            {
              role: "user",
              content: `MCQ Question: ${form.text}${form.subject ? ` (Subject: ${form.subject})` : ""}. Generate 4 options and the correct letter.`,
            },
          ],
          temperature: 0.5,
          max_tokens: 300,
        },
      });
      const raw = result.content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.options) && parsed.options.length === 4) {
        setForm((f) => ({
          ...f,
          options: parsed.options,
          answer: parsed.answer ?? f.answer,
        }));
        toast.success("MCQ options generated!");
      } else {
        toast.error("Could not parse AI response. Please try again.");
      }
    } catch {
      toast.error("AI generation failed. Please try again.");
    } finally {
      setGenAnswer(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Question Bank</h2>
          <p className="text-sm text-slate-400">{questions.length} questions saved</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline"
            onClick={handleExport}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <Download className="mr-1.5 h-4 w-4" /> Export Excel
          </Button>
          <Button
            size="sm"
            onClick={() => { setForm(DEFAULT_FORM); setDialogOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Question
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border-white/10 pl-9 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 bg-white/5 border-white/10 text-slate-300 focus:ring-0">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
            <SelectItem value="all" className="focus:bg-white/10 focus:text-white">All Types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white">
                {TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-slate-300 focus:ring-0">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
            <SelectItem value="all" className="focus:bg-white/10 focus:text-white">All Subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s} className="focus:bg-white/10 focus:text-white">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/3 py-16 text-center">
            <BookOpen className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 font-medium">
              {search || filterType !== "all" || filterSubject !== "all"
                ? "No questions match your filters"
                : "No questions in the bank yet"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Generate a paper and click "Save to Bank", or add questions manually
            </p>
          </div>
        ) : (
          filtered.map((q, i) => (
            <div
              key={q.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/3 transition-colors hover:bg-white/5"
            >
              <div
                className="flex cursor-pointer items-start gap-3 p-4"
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-400">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-relaxed line-clamp-2">{q.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[q.type] ?? "bg-slate-500/20 text-slate-300"}`}>
                      {TYPE_LABELS[q.type] ?? q.type}
                    </span>
                    {q.subject && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">{q.subject}</span>
                    )}
                    {q.topic && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">{q.topic}</span>
                    )}
                    {q.difficulty && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-500 capitalize">{q.difficulty}</span>
                    )}
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-semibold">{q.marks}M</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expandedId === q.id
                    ? <ChevronUp className="h-4 w-4 text-slate-500" />
                    : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </div>
              </div>
              {expandedId === q.id && (
                <div className="border-t border-white/10 bg-white/3 px-4 pb-4 pt-3 text-sm space-y-2">
                  {q.type === "mcq" && q.options && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Options</p>
                      <ol className="ml-4 space-y-1">
                        {q.options.map((opt, j) => (
                          <li key={j} className={`text-sm ${q.answer === String.fromCharCode(65 + j) ? "text-emerald-400 font-semibold" : "text-slate-300"}`}>
                            {String.fromCharCode(65 + j)}. {opt}
                            {q.answer === String.fromCharCode(65 + j) && " ✓"}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Answer / Key</p>
                    <p className="text-sm text-emerald-400">{q.answer}</p>
                  </div>
                  {q.difficulty && (
                    <p className="text-xs text-slate-500">Difficulty: <span className="capitalize">{q.difficulty}</span></p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Add Question Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#13131f] border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Question to Bank</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">

            {/* ── Context row: Subject + Topic + Board (filled first for better AI) */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Subject *</label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Topic</label>
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Algebra"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Board</label>
                <Input
                  value={form.board}
                  onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
                  placeholder="e.g. CBSE"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* ── Type + Marks + Difficulty row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Type *</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="focus:bg-white/10 focus:text-white">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Marks *</label>
                <Input
                  type="number" min="1" max="20"
                  value={form.marks}
                  onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Difficulty</label>
                <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
                    {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="focus:bg-white/10 focus:text-white">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Question Text with AI button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">Question Text *</label>
                <button
                  type="button"
                  onClick={handleGenerateQuestion}
                  disabled={genQuestion}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 px-2.5 py-1 text-xs font-medium text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {genQuestion
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {genQuestion ? "Generating…" : "AI Generate"}
                </button>
              </div>
              <textarea
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={
                  form.subject
                    ? `Enter the question, or click "AI Generate" above…`
                    : `Fill Subject above, then click "AI Generate" to auto-write a question…`
                }
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
              />
            </div>

            {/* ── MCQ Options with AI generate button */}
            {form.type === "mcq" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">Options (A – D)</label>
                  <button
                    type="button"
                    onClick={handleGenerateMcqOptions}
                    disabled={genAnswer}
                    className="flex items-center gap-1.5 rounded-md bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {genAnswer
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    {genAnswer ? "Generating…" : "AI Fill Options"}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.options.map((opt, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-500">
                        {String.fromCharCode(65 + j)}
                      </span>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const opts = [...form.options];
                          opts[j] = e.target.value;
                          setForm((f) => ({ ...f, options: opts }));
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + j)}`}
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Answer / Model Answer with AI button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">
                  {form.type === "mcq" ? "Correct Option (A / B / C / D) *" : "Answer / Model Answer *"}
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAnswer}
                  disabled={genAnswer}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {genAnswer
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {genAnswer ? "Generating…" : "AI Answer"}
                </button>
              </div>
              {form.type === "mcq" ? (
                <Input
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B"
                  maxLength={1}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 uppercase"
                />
              ) : (
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  placeholder={
                    form.text
                      ? `Enter model answer, or click "AI Answer" above…`
                      : `Enter the question first, then click "AI Answer" to auto-generate…`
                  }
                  rows={form.type === "long" ? 4 : 2}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none transition-colors"
                />
              )}
            </div>

            {/* ── Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} className="flex-1 bg-indigo-600 hover:bg-indigo-500">
                Add to Bank
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-white/10 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
