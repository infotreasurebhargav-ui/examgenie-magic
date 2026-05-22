import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { decodePaper } from "@/lib/test-share";
import type { Paper } from "@/lib/paper-types";
import { gradeWrittenAnswer } from "@/lib/ai-paper";

export const Route = createFileRoute("/test/$token")({
  component: TestRunner,
  loader: ({ params }) => {
    try {
      const paper = decodePaper(params.token);
      return { paper };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.paper.meta.examName} · ${loaderData.paper.meta.subject}` : "Test" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});

interface Answer { value: string }
interface Result { score: number; max: number; perQ: { id: string; awarded: number; max: number; correct?: boolean; feedback?: string }[] }

function TestRunner() {
  const { paper } = Route.useLoaderData() as { paper: Paper };
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const totalMax = useMemo(() => paper.questions.reduce((s, q) => s + q.marks, 0), [paper]);

  const submit = async () => {
    setGrading(true);
    try {
      const perQ: Result["perQ"] = [];
      let total = 0;
      for (const q of paper.questions) {
        const a = answers[q.id]?.value?.trim() ?? "";
        if (q.type === "mcq" || q.type === "truefalse" || q.type === "fillblank") {
          const correct = a.toLowerCase() === q.answer.trim().toLowerCase();
          const awarded = correct ? q.marks : 0;
          total += awarded;
          perQ.push({ id: q.id, awarded, max: q.marks, correct });
        } else {
          if (!a) { perQ.push({ id: q.id, awarded: 0, max: q.marks, feedback: "No answer" }); continue; }
          try {
            const g = await gradeWrittenAnswer(q.text, q.answer, a, q.marks);
            total += g.score;
            perQ.push({ id: q.id, awarded: g.score, max: q.marks, feedback: g.feedback });
          } catch {
            perQ.push({ id: q.id, awarded: 0, max: q.marks, feedback: "Grading failed" });
          }
        }
      }
      setResult({ score: total, max: totalMax, perQ });
    } finally {
      setGrading(false);
    }
  };

  if (result) {
    const pct = Math.round((result.score / result.max) * 100);
    return (
      <div className="min-h-screen p-4 no-select">
        <Toaster theme="dark" position="top-center" />
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center glow">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-2 font-display text-3xl font-bold">Test Complete</h1>
            <div className="mt-1 text-sm text-muted-foreground">{name || "Student"} · {paper.meta.subject}</div>
            <div className="mt-4 text-5xl font-bold text-gradient">{result.score} / {result.max}</div>
            <div className="text-sm text-muted-foreground">{pct}% score</div>
          </div>
          <div className="space-y-2">
            {paper.questions.map((q, i) => {
              const r = result.perQ.find((p) => p.id === q.id)!;
              return (
                <div key={q.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1"><span className="font-medium">Q{i + 1}.</span> {q.text}</div>
                    <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${r.awarded === r.max ? "bg-emerald-500/20 text-emerald-300" : r.awarded > 0 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}>{r.awarded}/{r.max}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Correct: {q.answer}</div>
                  {r.feedback && <div className="mt-1 text-xs italic text-muted-foreground">{r.feedback}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center p-4 no-select">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Sparkles className="h-6 w-6" /></div>
          <h1 className="mt-3 font-display text-2xl font-bold">{paper.meta.examName}</h1>
          <div className="mt-1 text-sm text-muted-foreground">{paper.meta.schoolName}</div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <div><div className="text-muted-foreground">Subject</div><div className="font-medium">{paper.meta.subject}</div></div>
            <div><div className="text-muted-foreground">Marks</div><div className="font-medium">{totalMax}</div></div>
            <div><div className="text-muted-foreground">Time</div><div className="font-medium">{paper.meta.durationMinutes}m</div></div>
          </div>
          <div className="mt-4 space-y-2 text-left">
            <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button className="w-full" size="lg" disabled={!name.trim()} onClick={() => setStarted(true)}>Start Test</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 no-select">
      <Toaster theme="dark" position="top-center" />
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-2 z-10 mb-4 flex items-center justify-between rounded-xl border border-border bg-surface/95 px-4 py-2 backdrop-blur">
          <div className="text-sm font-medium">{name}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{paper.meta.durationMinutes} min</div>
        </div>

        <div className="space-y-3">
          {paper.questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold">Q{i + 1}. <span className="font-normal">{q.text}</span></div>
                <span className="shrink-0 text-xs text-muted-foreground">[{q.marks}m]</span>
              </div>

              {q.type === "mcq" && q.options && (
                <div className="mt-3 grid gap-2">
                  {q.options.map((opt, j) => {
                    const letter = String.fromCharCode(65 + j);
                    const selected = answers[q.id]?.value === letter;
                    return (
                      <label key={j} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${selected ? "border-primary bg-primary/15" : "border-border bg-muted/40 hover:bg-muted"}`}>
                        <input type="radio" name={q.id} className="sr-only" checked={selected} onChange={() => setAnswers({ ...answers, [q.id]: { value: letter } })} />
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{letter}</span>
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.type === "truefalse" && (
                <div className="mt-3 flex gap-2">
                  {["True", "False"].map((v) => (
                    <button key={v} type="button" onClick={() => setAnswers({ ...answers, [q.id]: { value: v } })} className={`flex-1 rounded-lg border p-3 text-sm font-medium ${answers[q.id]?.value === v ? "border-primary bg-primary/15" : "border-border bg-muted/40"}`}>{v}</button>
                  ))}
                </div>
              )}

              {(q.type === "short" || q.type === "long" || q.type === "fillblank") && (
                <Textarea rows={q.type === "long" ? 6 : 2} className="mt-3" placeholder="Type your answer…" value={answers[q.id]?.value ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { value: e.target.value } })} />
              )}
            </div>
          ))}
        </div>

        <Button onClick={submit} size="lg" className="mt-4 w-full glow" disabled={grading}>
          {grading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Grading with AI…</> : "Submit Test"}
        </Button>
      </div>
    </div>
  );
}
