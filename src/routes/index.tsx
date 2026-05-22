import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Sparkles, Download, Link2, Eye, Pencil,
  Copy, Check, Loader2, GraduationCap, LayoutDashboard,
  BookOpen, Users, BarChart3, Settings, LogOut,
  ChevronRight, ArrowLeft, Zap, Menu, X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaperBuilder } from "@/components/PaperBuilder";
import { PaperSheet } from "@/components/PaperSheet";
import { PaperEditor } from "@/components/PaperEditor";
import { LoginPage } from "@/components/LoginPage";
import { InstallPrompt } from "@/components/InstallPrompt";
import { StudentsPage } from "@/components/StudentsPage";
import { QuestionBankPage } from "@/components/QuestionBankPage";
import { AnalyticsPage } from "@/components/AnalyticsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { generatePaper } from "@/lib/ai-paper";
import { exportElementToPdf } from "@/lib/pdf-export";
import { buildTestUrl } from "@/lib/test-share";
import { isLoggedIn, logout } from "@/lib/auth";
import { savePaper, addBankQuestions, getSettings } from "@/lib/store";
import type { Paper } from "@/lib/paper-types";
import type { GenerateBrief } from "@/lib/ai-paper";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "PaperForge — AI Question Paper Studio" },
      { name: "description", content: "Generate, edit, and share beautiful question papers with AI." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "configure" | "review";
type Section = "generate" | "bank" | "students" | "analytics" | "settings";

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_ITEMS: { icon: React.ElementType; label: string; id: Section }[] = [
  { icon: LayoutDashboard, label: "Generate Paper", id: "generate" },
  { icon: BookOpen,        label: "Question Bank",  id: "bank" },
  { icon: Users,           label: "Students",        id: "students" },
  { icon: BarChart3,       label: "Analytics",       id: "analytics" },
  { icon: Settings,        label: "Settings",        id: "settings" },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  onLogout, open, onClose, activeSection, onSectionChange, schoolName,
}: {
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  activeSection: Section;
  onSectionChange: (s: Section) => void;
  schoolName: string;
}) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-white/10
        bg-[#0d0d1a] transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white">PaperForge</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Admin Portal</div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* School badge */}
        <div className="mx-4 mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-indigo-400">School</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-white">{schoolName}</div>
        </div>

        {/* Nav */}
        <nav className="mt-6 flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onSectionChange(item.id); onClose(); }}
              className={`
                flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors
                ${activeSection === item.id
                  ? "bg-indigo-500/20 text-indigo-300 font-medium"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}
              `}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {activeSection === item.id && (
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">Administrator</div>
              <div className="text-xs text-slate-500">admin</div>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step, hasPaper }: { step: Step; hasPaper: boolean }) {
  const steps = [
    { id: "configure", label: "Configure Paper" },
    { id: "review",    label: "Edit & Preview" },
    { id: "export",    label: "Share / Export" },
  ];
  const active = step === "configure" ? 0 : 1;

  return (
    <div className="hidden items-center gap-1 sm:flex">
      {steps.map((s, i) => {
        const isDone = (hasPaper && step === "review" && i < 1) || (hasPaper && step === "review" && i === 2);
        const isActive = i === active || (hasPaper && step === "review" && i === 2);
        const isFaded = !isDone && !isActive;
        return (
          <div key={s.id} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${isActive ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                : isDone  ? "bg-green-500/15 text-green-400"
                          : "text-slate-600"}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold
                ${isActive ? "bg-indigo-500 text-white"
                  : isDone  ? "bg-green-500 text-white"
                             : "bg-slate-700 text-slate-500"}`}>
                {isDone ? "✓" : i + 1}
              </span>
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className={`h-3 w-3 ${isFaded ? "text-slate-700" : "text-slate-600"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function Home() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("configure");
  const [showAnswers, setShowAnswers] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("generate");
  const [schoolName, setSchoolName] = useState(() => getSettings().schoolName);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleLogin = () => setLoggedIn(true);
  const handleLogout = () => { logout(); setLoggedIn(false); };

  const handleSectionChange = (s: Section) => {
    setActiveSection(s);
    setSidebarOpen(false);
  };

  const onGenerate = async (brief: GenerateBrief) => {
    setLoading(true);
    try {
      const p = await generatePaper(brief);
      setPaper(p);
      savePaper(p);
      setShareUrl(null);
      setStep("review");
      toast.success("Paper generated and auto-saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPaper = () => {
    setPaper(null);
    setShareUrl(null);
    setStep("configure");
    setShowAnswers(false);
  };

  const handleDownload = async () => {
    if (!sheetRef.current || !paper) return;
    const toastId = toast.loading("Preparing PDF…");
    try {
      await exportElementToPdf(
        sheetRef.current,
        `${paper.meta.subject}_${paper.meta.examName}.pdf`.replace(/\s+/g, "_"),
      );
      toast.success("PDF downloaded", { id: toastId });
    } catch {
      toast.error("PDF export failed", { id: toastId });
    }
  };

  const handleShare = () => {
    if (!paper) return;
    const url = buildTestUrl(paper);
    setShareUrl(url);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Live test link copied to clipboard");
    });
  };

  const handleSaveToBank = () => {
    if (!paper) return;
    addBankQuestions(
      paper.questions.map((q) => ({
        text: q.text,
        type: q.type,
        marks: q.marks,
        options: q.options,
        answer: q.answer,
        subject: paper.meta.subject,
        topic: undefined,
        difficulty: undefined,
        board: undefined,
      })),
    );
    toast.success(`${paper.questions.length} questions saved to Question Bank`);
  };

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <>
        <Toaster theme="dark" position="top-center" />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#09090f] text-white">
      <Toaster theme="dark" position="top-right" />
      <InstallPrompt />

      <Sidebar
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        schoolName={schoolName}
      />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-white/10 bg-[#09090f]/90 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {activeSection === "generate" ? (
            <Stepper step={step} hasPaper={!!paper} />
          ) : (
            <span className="text-sm font-semibold text-white">
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {activeSection === "generate" && paper && step === "review" && (
              <>
                <Button
                  variant="ghost" size="sm"
                  onClick={handleNewPaper}
                  className="hidden text-slate-400 hover:text-white sm:flex"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> New Paper
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={handleSaveToBank}
                  className="hidden border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 sm:flex"
                >
                  <BookOpen className="mr-1.5 h-4 w-4" /> Save to Bank
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={handleShare}
                  className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200"
                >
                  <Link2 className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Online Test</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </Button>
              </>
            )}
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6">

          {/* ── Section pages ────────────────────────────────────────────── */}
          {activeSection === "bank"      && <QuestionBankPage />}
          {activeSection === "students"  && <StudentsPage />}
          {activeSection === "analytics" && <AnalyticsPage />}
          {activeSection === "settings"  && (
            <SettingsPage
              onSettingsChange={() => setSchoolName(getSettings().schoolName)}
            />
          )}

          {/* ── Generate Paper ───────────────────────────────────────────── */}
          {activeSection === "generate" && (
            <>
              {/* Step 1: Configure */}
              {step === "configure" && (
                <div className="mx-auto max-w-5xl">
                  <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold sm:text-5xl">
                      Craft exam papers in{" "}
                      <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                        seconds
                      </span>
                      , not hours.
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
                      Configure your paper below. The AI will generate questions tailored to your board, subject, and difficulty — ready to edit, share, or print.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/3 p-6 shadow-xl backdrop-blur-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-white">Paper Configuration</h2>
                        <p className="text-xs text-slate-500">Fill in the details and click Generate</p>
                      </div>
                    </div>
                    <PaperBuilder onGenerate={onGenerate} loading={loading} />
                  </div>

                  {loading && (
                    <div className="mt-6 flex items-center justify-center gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-6 py-8">
                      <div className="relative">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
                        <Zap className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-indigo-300" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">AI is composing your paper…</div>
                        <div className="text-sm text-slate-400">Generating questions, balancing difficulty, writing the answer key.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Edit & Preview */}
              {step === "review" && paper && (
                <div className="flex flex-col gap-4">
                  {/* Share URL banner */}
                  {shareUrl && (
                    <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm">
                      <Link2 className="h-4 w-4 shrink-0 text-indigo-400" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider">Online Test Link</div>
                        <div className="truncate font-mono text-xs text-slate-300">{shareUrl}</div>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="shrink-0 text-indigo-400 hover:text-white"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}

                  {/* Mobile actions */}
                  <div className="flex items-center gap-2 sm:hidden">
                    <Button size="sm" variant="ghost" onClick={handleNewPaper} className="text-slate-400">
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> New Paper
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleSaveToBank} className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleShare} className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={handleDownload} className="bg-indigo-600 text-white">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Split view: Editor + Preview */}
                  <div className="grid gap-4 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr]">
                    {/* Editor */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3">
                      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                        <Pencil className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">Edit Questions</span>
                        <span className="ml-auto rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                          {paper.questions.length} Qs
                        </span>
                      </div>
                      <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 160px)" }}>
                        <PaperEditor paper={paper} onChange={setPaper} />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3">
                      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                        <Eye className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">Live Preview</span>
                        <div className="ml-auto">
                          <Tabs value={showAnswers ? "key" : "paper"} onValueChange={(v) => setShowAnswers(v === "key")}>
                            <TabsList className="h-7 bg-white/5 border border-white/10">
                              <TabsTrigger value="paper" className="h-6 px-3 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                Question Paper
                              </TabsTrigger>
                              <TabsTrigger value="key" className="h-6 px-3 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                Answer Key
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                      </div>
                      <div className="overflow-y-auto p-4 sm:p-6" style={{ maxHeight: "calc(100vh - 160px)" }}>
                        <Tabs value={showAnswers ? "key" : "paper"}>
                          <TabsContent value="paper" className="mt-0">
                            <PaperSheet ref={sheetRef} paper={paper} showAnswers={false} />
                          </TabsContent>
                          <TabsContent value="key" className="mt-0">
                            <PaperSheet paper={paper} showAnswers />
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">Ready to share?</div>
                        <div className="text-xs text-slate-500">Send an online test link or download a print-ready PDF.</div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={handleSaveToBank}
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 gap-2"
                        >
                          <BookOpen className="h-4 w-4" /> Save to Bank
                        </Button>
                        <Button
                          onClick={handleShare}
                          variant="outline"
                          className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 gap-2"
                        >
                          <Link2 className="h-4 w-4" />
                          Share Online Test
                          <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">Live</span>
                        </Button>
                        <Button
                          onClick={handleDownload}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download PDF
                          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">A4</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
