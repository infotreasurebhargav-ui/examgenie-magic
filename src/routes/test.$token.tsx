import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, Clock, User, Hash } from "lucide-react";
import { decodePaper } from "@/lib/test-share";
import { findStudentByRoll, saveSession } from "@/lib/store";
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
      {
        title: loaderData
          ? `${loaderData.paper.meta.examName} · ${loaderData.paper.meta.subject}`
          : "Test",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});

interface Answer { value: string }
interface PerQ { id: string; awarded: number; max: number; correct?: boolean; feedback?: string }
interface Result { score: number; max: number; perQ: PerQ[]; studentLinked: boolean }

function TestRunner() {
  const { paper } = Route.useLoaderData() as { paper: Paper };
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const totalMax = useMemo(
    () => paper.questions.reduce((s, q) => s + q.marks, 0),
    [paper],
  );

  const handleStart = () => {
    if (!name.trim()) { toast.error("Please enter your full name"); return; }
    if (!rollNumber.trim()) { toast.error("Please enter your roll number"); return; }
    setStarted(true);
  };

  const submit = async () => {
    setGrading(true);
    try {
      const perQ: PerQ[] = [];
      let total = 0;

      for (const q of paper.questions) {
        const a = answers[q.id]?.value?.trim() ?? "";
        if (q.type === "mcq" || q.type === "truefalse" || q.type === "fillblank") {
          const correct = a.toLowerCase() === q.answer.trim().toLowerCase();
          const awarded = correct ? q.marks : 0;
          total += awarded;
          perQ.push({ id: q.id, awarded, max: q.marks, correct });
        } else {
          if (!a) {
            perQ.push({ id: q.id, awarded: 0, max: q.marks, feedback: "No answer provided" });
            continue;
          }
          try {
            const g = await gradeWrittenAnswer(q.text, q.answer, a, q.marks);
            total += g.score;
            perQ.push({ id: q.id, awarded: g.score, max: q.marks, feedback: g.feedback });
          } catch {
            perQ.push({ id: q.id, awarded: 0, max: q.marks, feedback: "Auto-grading unavailable" });
          }
        }
      }

      let studentLinked = false;
      try {
        const student = findStudentByRoll(rollNumber);
        if (student) studentLinked = true;
        saveSession({
          studentId: student?.id,
          studentName: name.trim(),
          rollNumber: rollNumber.trim(),
          paperId: paper.id,
          examName: paper.meta.examName,
          subject: paper.meta.subject,
          className: paper.meta.className,
          score: total,
          maxScore: totalMax,
          percentage: Math.round((total / totalMax) * 100),
          completedAt: Date.now(),
          perQuestion: perQ.map((r) => {
            const q = paper.questions.find((q) => q.id === r.id)!;
            return {
              questionId: r.id,
              questionText: q.text,
              type: q.type,
              correctAnswer: q.answer,
              studentAnswer: answers[r.id]?.value ?? "",
              awarded: r.awarded,
              max: r.max,
              correct: r.correct,
              feedback: r.feedback,
            };
          }),
        });
      } catch {
        // localStorage might not be available
      }

      setResult({ score: total, max: totalMax, perQ, studentLinked });
    } finally {
      setGrading(false);
    }
  };

  // ── Result screen ─────────────────────────────────────────────────────────
  if (result) {
    const pct = Math.round((result.score / result.max) * 100);
    const gradeLabel =
      pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F";
    const gradeColor =
      pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-rose-400";

    return (
      <div className="min-h-screen p-4 no-select">
        <Toaster theme="dark" position="top-center" />
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center glow">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h1 className="mt-2 font-display text-3xl font-bold">Test Complete!</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {name} · Roll: {rollNumber} · {paper.meta.subject}
            </div>
            <div className={`mt-4 text-6xl font-bold ${gradeColor}`}>{pct}%</div>
            <div className={`text-xl font-bold ${gradeColor}`}>{gradeLabel}</div>
            <div className="mt-1 text-sm text-muted-foreground">{result.score} / {result.max} marks</div>
            {result.studentLinked && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Result saved to student record
              </div>
            )}
          </div>

          <div className="space-y-2">
            {paper.questions.map((q, i) => {
              const r = result.perQ.find((p) => p.id === q.id)!;
              return (
                <div key={q.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className="font-medium text-white">Q{i + 1}.</span>{" "}
                      <span className="text-muted-foreground">{q.text}</span>
                    </div>
                    <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.awarded === r.max ? "bg-emerald-500/20 text-emerald-300"
                        : r.awarded > 0 ? "bg-amber-500/20 text-amber-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}>
                      {r.awarded}/{r.max}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-emerald-400">✓ {q.answer}</div>
                  {r.feedback && (
                    <div className="mt-1 text-xs italic text-muted-foreground">{r.feedback}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-start screen ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center p-4 no-select">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold">{paper.meta.examName}</h1>
          <div className="mt-1 text-sm text-muted-foreground">{paper.meta.schoolName}</div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <div><div className="text-muted-foreground">Subject</div><div className="font-medium">{paper.meta.subject}</div></div>
            <div><div className="text-muted-foreground">Marks</div><div className="font-medium">{totalMax}</div></div>
            <div><div className="text-muted-foreground">Time</div><div className="font-medium">{paper.meta.durationMinutes}m</div></div>
          </div>

          <div className="mt-5 space-y-2.5 text-left">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" /> Full Name
              </label>
              <Input
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" /> Roll Number
              </label>
              <Input
                placeholder="Enter your roll number"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!name.trim() || !rollNumber.trim()}
              onClick={handleStart}
            >
              Start Test →
            </Button>
          </div>

          {paper.meta.instructions.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-left">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Instructions</p>
              <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
                {paper.meta.instructions.map((ins, i) => <li key={i}>{ins}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active test ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 no-select">
      <Toaster theme="dark" position="top-center" />
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-2 z-10 mb-4 flex items-center justify-between rounded-xl border border-border bg-surface/95 px-4 py-2 backdrop-blur">
          <div className="text-sm font-medium">
            {name} <span className="text-xs text-muted-foreground">· Roll: {rollNumber}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />{paper.meta.durationMinutes} min
          </div>
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
                    <button key={v} type="button" onClick={() => setAnswers({ ...answers, [q.id]: { value: v } })} className={`flex-1 rounded-lg border p-3 text-sm font-medium transition ${answers[q.id]?.value === v ? "border-primary bg-primary/15" : "border-border bg-muted/40 hover:bg-muted"}`}>{v}</button>
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
          {grading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI is grading your answers…</> : "Submit Test"}
        </Button>
      </div>
    </div>
  );
}
