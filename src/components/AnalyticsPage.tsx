import { useState, useRef, useMemo } from "react";
import {
  BarChart2, Download, ChevronDown, ChevronUp, User,
  Trophy, Target, BookOpen, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStudents, getSessions } from "@/lib/store";
import { exportElementToPdf } from "@/lib/pdf-export";
import type { Student, TestSession } from "@/lib/app-types";

function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function grade(p: number) {
  if (p >= 90) return { label: "A+", color: "text-emerald-400" };
  if (p >= 80) return { label: "A",  color: "text-emerald-400" };
  if (p >= 70) return { label: "B",  color: "text-sky-400" };
  if (p >= 60) return { label: "C",  color: "text-amber-400" };
  if (p >= 40) return { label: "D",  color: "text-orange-400" };
  return { label: "F", color: "text-rose-400" };
}

function barColor(p: number) {
  if (p >= 75) return "#22c55e";
  if (p >= 50) return "#6366f1";
  return "#f43f5e";
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 bg-white/5`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const students = getStudents();
  const allSessions = getSessions();

  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const displayedSessions = useMemo(() => {
    const sessions =
      selectedStudentId === "all"
        ? allSessions
        : allSessions.filter((s) => s.studentId === selectedStudentId);
    return [...sessions].sort((a, b) => b.completedAt - a.completedAt);
  }, [selectedStudentId, allSessions]);

  const overallStats = useMemo(() => {
    const total = displayedSessions.length;
    if (total === 0) return { avg: 0, best: 0, total: 0 };
    const avg = Math.round(displayedSessions.reduce((s, x) => s + x.percentage, 0) / total);
    const best = Math.max(...displayedSessions.map((s) => s.percentage));
    return { avg, best, total };
  }, [displayedSessions]);

  const chartData = useMemo(
    () =>
      [...displayedSessions]
        .reverse()
        .slice(-10)
        .map((s) => ({
          name: new Date(s.completedAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short",
          }),
          score: s.percentage,
          label: `${s.score}/${s.maxScore}`,
          exam: s.examName,
        })),
    [displayedSessions],
  );

  const handleExportPdf = async () => {
    if (!reportRef.current || displayedSessions.length === 0) {
      toast.error("No data to export");
      return;
    }
    setExporting(true);
    const toastId = toast.loading("Generating PDF report…");
    try {
      const name = selectedStudent?.name ?? "All_Students";
      await exportElementToPdf(
        reportRef.current,
        `${name.replace(/\s+/g, "_")}_Report.pdf`,
      );
      toast.success("Report downloaded", { id: toastId });
    } catch {
      toast.error("PDF export failed", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (displayedSessions.length === 0) { toast.error("No data to export"); return; }
    import("xlsx").then((XLSX) => {
      const data = displayedSessions.map((s) => ({
        "Student Name": s.studentName,
        "Roll Number": s.rollNumber,
        "Exam": s.examName,
        "Subject": s.subject,
        "Class": s.className,
        "Score": s.score,
        "Max Score": s.maxScore,
        "Percentage": `${s.percentage}%`,
        "Grade": grade(s.percentage).label,
        "Date": new Date(s.completedAt).toLocaleDateString("en-IN"),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Test Results");
      XLSX.writeFile(
        wb,
        selectedStudent
          ? `${selectedStudent.name.replace(/\s+/g, "_")}_results.xlsx`
          : "all_results.xlsx",
      );
      toast.success("Exported results.xlsx");
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics</h2>
          <p className="text-sm text-slate-400">{allSessions.length} test attempts recorded</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline"
            onClick={handleExportExcel}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <Download className="mr-1.5 h-4 w-4" /> Export Excel
          </Button>
          <Button
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting || displayedSessions.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? "Generating…" : "Export PDF Report"}
          </Button>
        </div>
      </div>

      {/* Student Filter */}
      <div className="flex items-center gap-3">
        <User className="h-4 w-4 text-slate-500 shrink-0" />
        <select
          value={selectedStudentId}
          onChange={(e) => {
            setSelectedStudentId(e.target.value);
            setExpandedSession(null);
          }}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — Roll: {s.rollNumber} ({s.className}{s.section ? "-" + s.section : ""})
            </option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tests Taken"
          value={overallStats.total}
          icon={BookOpen}
          color="text-indigo-400"
        />
        <StatCard
          label="Avg Score"
          value={`${overallStats.avg}%`}
          sub={overallStats.total > 0 ? grade(overallStats.avg).label : undefined}
          icon={Target}
          color="text-sky-400"
        />
        <StatCard
          label="Best Score"
          value={overallStats.best > 0 ? `${overallStats.best}%` : "—"}
          icon={Trophy}
          color="text-amber-400"
        />
        <StatCard
          label="Students"
          value={selectedStudentId === "all" ? students.length : 1}
          sub={selectedStudentId === "all" ? "enrolled" : selectedStudent?.rollNumber}
          icon={TrendingUp}
          color="text-emerald-400"
        />
      </div>

      {displayedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/3 py-16 text-center">
          <BarChart2 className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No test data yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Test results are recorded when students complete online tests
          </p>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-6">
          {selectedStudent && (
            <div className="rounded-xl border border-white/10 bg-white/3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-sm">
                  {selectedStudent.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-white">{selectedStudent.name}</p>
                  <p className="text-xs text-slate-400">
                    Roll: {selectedStudent.rollNumber} · Class: {selectedStudent.className}
                    {selectedStudent.section && `-${selectedStudent.section}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Score Chart */}
          {chartData.length > 1 && (
            <div className="rounded-xl border border-white/10 bg-white/3 p-4">
              <p className="text-sm font-semibold text-white mb-4">
                Score Trend (last {chartData.length} tests)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e1e30",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value, _, props) => [
                      `${value}% (${props.payload.label})`,
                      "Score",
                    ]}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={barColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session List */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Test History</p>
            {displayedSessions.map((session) => {
              const g = grade(session.percentage);
              const isExpanded = expandedSession === session.id;
              return (
                <div
                  key={session.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/3"
                >
                  <button
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm ${g.color} bg-white/5`}>
                      {g.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {session.examName} · {session.subject}
                      </p>
                      <p className="text-xs text-slate-400">
                        {session.studentName} · Roll: {session.rollNumber} ·{" "}
                        {new Date(session.completedAt).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold ${g.color}`}>{session.percentage}%</p>
                      <p className="text-xs text-slate-500">{session.score}/{session.maxScore}</p>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/10 bg-white/3 p-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Per-Question Breakdown
                      </p>
                      {session.perQuestion.map((pq, i) => {
                        const p = pct(pq.awarded, pq.max);
                        return (
                          <div
                            key={pq.questionId}
                            className="rounded-lg border border-white/5 bg-white/3 p-3 text-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-slate-300 flex-1 leading-relaxed">
                                <span className="font-semibold text-white">Q{i + 1}.</span>{" "}
                                {pq.questionText}
                              </p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                pq.awarded === pq.max
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : pq.awarded > 0
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}>
                                {pq.awarded}/{pq.max}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500">Student: </span>
                                <span className="text-slate-300">{pq.studentAnswer || "—"}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Correct: </span>
                                <span className="text-emerald-400">{pq.correctAnswer}</span>
                              </div>
                            </div>
                            {pq.feedback && (
                              <p className="mt-1.5 text-xs italic text-slate-400">{pq.feedback}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
