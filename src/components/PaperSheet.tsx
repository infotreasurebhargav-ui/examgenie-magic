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
      <div data-pdf-section>
        <div className="ribbon mb-5" />
        <div className="text-center">
          <h1 className="text-3xl font-extrabold uppercase tracking-wide">{meta.schoolName}</h1>
          <div className="mt-1 text-base font-semibold text-[#4f46e5]">{meta.examName}</div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] text-gray-500">
            <span className="h-px w-10 bg-gray-300" /> Question Paper <span className="h-px w-10 bg-gray-300" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-300 bg-gray-50/60 p-3 text-sm sm:grid-cols-4">
          <div><span className="font-semibold">Class:</span> {meta.className}</div>
          <div><span className="font-semibold">Subject:</span> {meta.subject}</div>
          <div><span className="font-semibold">Time:</span> {meta.durationMinutes} min</div>
          <div><span className="font-semibold">Marks:</span> {meta.totalMarks}</div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>Name: ____________________________</div>
          <div className="text-right">Roll No: ______________</div>
        </div>
      </div>

      {meta.instructions.length > 0 && (
        <div data-pdf-section className="mt-5 rounded-lg border-l-4 border-[#4f46e5] bg-indigo-50/40 p-4 text-sm">
          <div className="mb-1 font-semibold text-[#4f46e5]">General Instructions</div>
          <ol className="ml-5 list-decimal space-y-1">
            {meta.instructions.map((s, i) => (<li key={i}>{s}</li>))}
          </ol>
        </div>
      )}

      <ol className="mt-6 space-y-5">
        {questions.map((q, i) => (
          <li key={q.id} data-pdf-section className="break-inside-avoid rounded-md border border-gray-200/70 bg-white/60 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4f46e5] text-xs font-bold text-white">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-relaxed">{q.text}</p>
                  <span className="shrink-0 rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{q.marks} M</span>
                </div>
                {q.type === "mcq" && q.options && (
                  <ol className="ml-1 mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" type="A">
                    {q.options.map((opt, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="font-semibold text-[#4f46e5]">{String.fromCharCode(65 + j)}.</span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {showAnswers && (
                  <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-sm italic text-emerald-700">Ans: {q.answer}</div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div data-pdf-section className="mt-8 text-center text-xs uppercase tracking-[0.3em] text-gray-400">
        — All The Best —
      </div>

      {showAnswers && (
        <div data-pdf-section className="mt-8 border-t-2 border-dashed border-gray-400 pt-4">
          <h2 className="mb-2 text-lg font-bold">Answer Key</h2>
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            {questions.map((q) => (<li key={q.id}><span className="font-medium">{q.answer}</span></li>))}
          </ol>
        </div>
      )}
    </div>
  );
});
