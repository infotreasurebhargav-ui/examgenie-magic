import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { Paper, Question, QuestionType } from "@/lib/paper-types";
import { newId } from "@/lib/paper-types";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  short: "Short Answer",
  long: "Long Answer",
  truefalse: "True / False",
  fillblank: "Fill in the Blank",
};

interface Props { paper: Paper; onChange: (p: Paper) => void }

export function PaperEditor({ paper, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(paper.questions[0]?.id ?? null);

  const updateMeta = (patch: Partial<Paper["meta"]>) => onChange({ ...paper, meta: { ...paper.meta, ...patch } });
  const updateQ = (id: string, patch: Partial<Question>) =>
    onChange({ ...paper, questions: paper.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const removeQ = (id: string) => onChange({ ...paper, questions: paper.questions.filter((q) => q.id !== id) });
  const addQ = () => {
    const q: Question = { id: newId(), type: "short", text: "New question", marks: 2, answer: "" };
    onChange({ ...paper, questions: [...paper.questions, q] });
    setOpen(q.id);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Header</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={paper.meta.schoolName} onChange={(e) => updateMeta({ schoolName: e.target.value })} placeholder="School" />
          <Input value={paper.meta.examName} onChange={(e) => updateMeta({ examName: e.target.value })} placeholder="Exam" />
          <Input value={paper.meta.className} onChange={(e) => updateMeta({ className: e.target.value })} placeholder="Class" />
          <Input value={paper.meta.subject} onChange={(e) => updateMeta({ subject: e.target.value })} placeholder="Subject" />
          <Input type="number" value={paper.meta.durationMinutes} onChange={(e) => updateMeta({ durationMinutes: +e.target.value })} placeholder="Duration" />
          <Input type="number" value={paper.meta.totalMarks} onChange={(e) => updateMeta({ totalMarks: +e.target.value })} placeholder="Total marks" />
        </div>
      </div>

      <div className="space-y-2">
        {paper.questions.map((q, i) => {
          const isOpen = open === q.id;
          return (
            <div key={q.id} className="rounded-xl border border-border bg-surface">
              <button type="button" onClick={() => setOpen(isOpen ? null : q.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Q{i + 1} · {q.type} · {q.marks}m</div>
                  <div className="truncate text-sm">{q.text}</div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeQ(q.id); }} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border p-3">
                  <Select
                    value={q.type}
                    onValueChange={(v) => {
                      const newType = v as QuestionType;
                      const patch: Partial<Question> = { type: newType };
                      if (newType === "mcq" && !q.options) patch.options = ["", "", "", ""];
                      if (newType !== "mcq") patch.options = undefined;
                      updateQ(q.id, patch);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea rows={2} value={q.text} onChange={(e) => updateQ(q.id, { text: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={q.marks} onChange={(e) => updateQ(q.id, { marks: +e.target.value })} placeholder="Marks" />
                    <Input value={q.answer} onChange={(e) => updateQ(q.id, { answer: e.target.value })} placeholder={q.type === "mcq" ? "Correct option (A/B/C/D)" : "Answer"} />
                  </div>
                  {q.type === "mcq" && (
                    <div className="space-y-1">
                      {(q.options ?? ["", "", "", ""]).map((opt, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="w-5 text-sm font-medium text-muted-foreground">{String.fromCharCode(65 + j)}.</span>
                          <Input value={opt} onChange={(e) => {
                            const opts = [...(q.options ?? ["", "", "", ""])];
                            opts[j] = e.target.value;
                            updateQ(q.id, { options: opts });
                          }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={addQ} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Question
        </Button>
      </div>
    </div>
  );
}
