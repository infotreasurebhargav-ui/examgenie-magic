import { useState } from "react";
import {
  BookOpen, Plus, Trash2, Search, Download, Filter,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getBankQuestions, addBankQuestions, deleteBankQuestion } from "@/lib/store";
import type { BankQuestion } from "@/lib/app-types";

const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ", short: "Short", long: "Long",
  truefalse: "True/False", fillblank: "Fill Blank",
};

const TYPE_COLORS: Record<string, string> = {
  mcq: "bg-indigo-500/20 text-indigo-300",
  short: "bg-sky-500/20 text-sky-300",
  long: "bg-violet-500/20 text-violet-300",
  truefalse: "bg-amber-500/20 text-amber-300",
  fillblank: "bg-emerald-500/20 text-emerald-300",
};

export function QuestionBankPage() {
  const [questions, setQuestions] = useState<BankQuestion[]>(() => getBankQuestions());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    text: "", type: "mcq", marks: "1", options: ["", "", "", ""],
    answer: "", subject: "", topic: "", difficulty: "medium", board: "",
  });

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
    if (!form.text.trim() || !form.subject.trim()) {
      toast.error("Question text and subject are required");
      return;
    }
    if (!form.answer.trim()) {
      toast.error("Answer is required");
      return;
    }
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
    setForm({
      text: "", type: "mcq", marks: "1", options: ["", "", "", ""],
      answer: "", subject: "", topic: "", difficulty: "medium", board: "",
    });
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
            onClick={() => setDialogOpen(true)}
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
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 focus:outline-none"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 focus:outline-none"
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

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
                    <p className="text-xs text-slate-500">Difficulty: {q.difficulty}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#13131f] border-white/10 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Question to Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Question Text *</label>
              <textarea
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="Enter the question…"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
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
            </div>
            {form.type === "mcq" && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Options (A–D)</label>
                <div className="space-y-2">
                  {form.options.map((opt, j) => (
                    <Input
                      key={j}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...form.options];
                        opts[j] = e.target.value;
                        setForm((f) => ({ ...f, options: opts }));
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + j)}`}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">
                {form.type === "mcq" ? "Correct Option (A/B/C/D) *" : "Answer / Model Answer *"}
              </label>
              <Input
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                placeholder={form.type === "mcq" ? "e.g. B" : "Model answer…"}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Subject *</label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Topic</label>
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Algebra"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Board</label>
                <Input
                  value={form.board}
                  onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
                  placeholder="e.g. CBSE"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
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
