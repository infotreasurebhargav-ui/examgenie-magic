import { forwardRef } from "react";
import type { Paper } from "@/lib/paper-types";

interface Props { paper: Paper; showAnswers?: boolean }

export const PaperSheet = forwardRef<HTMLDivElement, Props>(function PaperSheet(
  { paper, showAnswers = false },
  ref,
) {
  const { meta, questions } = paper;
  return (
    <div ref={ref} className="paper-sheet mx-auto w-full max-w-[820px] rounded-xl p-8 sm:p-12 shadow-2xl print:shadow-none">
      <div data-pdf-section className="border-b-2 border-black/80 pb-4 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{meta.schoolName}</h1>
        <div className="mt-1 text-sm">{meta.examName}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-medium">
          <div className="text-left">Class: {meta.className}</div>
          <div>Subject: {meta.subject}</div>
          <div className="text-right">Marks: {meta.totalMarks}</div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
          <div className="text-left">Time: {meta.durationMinutes} minutes</div>
          <div className="text-right">Name: ____________________</div>
        </div>
      </div>

      {meta.instructions.length > 0 && (
        <div data-pdf-section className="mt-4 rounded-md border border-black/20 p-3 text-sm">
          <div className="mb-1 font-semibold">General Instructions:</div>
          <ol className="ml-5 list-decimal space-y-0.5">
            {meta.instructions.map((s, i) => (<li key={i}>{s}</li>))}
          </ol>
        </div>
      )}

      <ol className="mt-6 space-y-5">
        {questions.map((q, i) => (
          <li key={q.id} data-pdf-section className="break-inside-avoid">
            <div className="flex items-start gap-2">
              <span className="font-semibold">Q{i + 1}.</span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-relaxed">{q.text}</p>
                  <span className="shrink-0 text-sm font-medium">[{q.marks}]</span>
                </div>
                {q.type === "mcq" && q.options && (
                  <ol className="ml-1 mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" type="A">
                    {q.options.map((opt, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="font-medium">{String.fromCharCode(65 + j)}.</span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {showAnswers && (
                  <div className="mt-1 text-sm italic text-emerald-700">Ans: {q.answer}</div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {showAnswers && (
        <div data-pdf-section className="mt-8 border-t-2 border-dashed border-black/40 pt-4">
          <h2 className="mb-2 text-lg font-bold">Answer Key</h2>
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            {questions.map((q) => (<li key={q.id}><span className="font-medium">{q.answer}</span></li>))}
          </ol>
        </div>
      )}
    </div>
  );
});
