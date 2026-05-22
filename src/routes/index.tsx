import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  Sparkles, Download, Link2, Eye, Pencil,
  Copy, Check, Loader2, GraduationCap, LayoutDashboard,
  BookOpen, Users, BarChart3, Settings, LogOut,
  ChevronRight, ArrowLeft, Zap, Menu, X,
  ChevronLeft, ChevronLast, FileText, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Step    = "configure" | "review";
type Section = "generate" | "bank" | "students" | "analytics" | "settings";

const NAV_ITEMS: { icon: React.ElementType; label: string; id: Section }[] = [
  { icon: LayoutDashboard, label: "Generate Paper", id: "generate"  },
  { icon: BookOpen,        label: "Question Bank",  id: "bank"      },
  { icon: Users,           label: "Students",       id: "students"  },
  { icon: BarChart3,       label: "Analytics",      id: "analytics" },
  { icon: Settings,        label: "Settings",       id: "settings"  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  onLogout, mobileOpen, onMobileClose,
  activeSection, onSectionChange, schoolName,
  collapsed, onToggleCollapse,
}: {
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeSection: Section;
  onSectionChange: (s: Section) => void;
  schoolName: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/10
        bg-[#0d0d1a] transition-all duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${collapsed ? "w-[68px]" : "w-64"}
      `}>

        {/* Logo area */}
        <div className={`flex h-16 items-center border-b border-white/10 px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white leading-tight">PaperForge</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">Admin Portal</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onMobileClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* School badge */}
        {!collapsed && (
          <div className="mx-3 mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest text-indigo-400">School</div>
            <div className="mt-0.5 truncate text-xs font-semibold text-white">{schoolName}</div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
            <span className="text-xs font-bold text-indigo-300">{schoolName.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Nav */}
        <nav className={`mt-4 flex-1 space-y-0.5 ${collapsed ? "px-2" : "px-2"}`}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => { onSectionChange(item.id); onMobileClose(); }}
                className={`
                  group relative flex w-full items-center rounded-xl transition-all duration-150
                  ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}
                  ${isActive
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}
                `}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-indigo-400" : ""}`} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                  </>
                )}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-lg border border-white/10 bg-[#1a1a2e] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className="mx-auto mb-2 hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white/5 hover:text-slate-300 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronLast className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* User footer */}
        <div className={`border-t border-white/10 p-3 ${collapsed ? "" : ""}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
              A
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">Administrator</div>
                  <div className="text-[11px] text-slate-500">admin</div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
            {collapsed && (
              <button
                onClick={onLogout}
                title="Sign out"
                className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white/5 hover:text-red-400 transition-colors"
              >
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-slate-600 hover:bg-white/5 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step, hasPaper }: { step: Step; hasPaper: boolean }) {
  const steps = [
    { id: "configure", label: "Configure" },
    { id: "review",    label: "Edit & Preview" },
    { id: "export",    label: "Export" },
  ];
  const active = step === "configure" ? 0 : 1;

  return (
    <div className="hidden items-center gap-1 sm:flex">
      {steps.map((s, i) => {
        const isDone   = hasPaper && ((step === "review" && i === 0) || (step === "review" && i === 2));
        const isActive = i === active || (hasPaper && step === "review" && i === 2);
        const isFaded  = !isDone && !isActive;
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
  const [loggedIn, setLoggedIn]       = useState(() => isLoggedIn());
  const [paper, setPaper]             = useState<Paper | null>(null);
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState<Step>("configure");
  const [showAnswers, setShowAnswers] = useState(false);
  const [shareUrl, setShareUrl]       = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [collapsed, setCollapsed]     = useState(() => {
    try { return localStorage.getItem("pf_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [activeSection, setActiveSection] = useState<Section>("generate");
  const [schoolName, setSchoolName]       = useState(() => getSettings().schoolName);
  const [pdfLoading, setPdfLoading]       = useState(false);

  const sheetRef    = useRef<HTMLDivElement>(null);
  const sheetKeyRef = useRef<HTMLDivElement>(null);
  // Hidden render refs for PDF — always in DOM so they're always available
  const pdfPaperRef  = useRef<HTMLDivElement>(null);
  const pdfAnswerRef = useRef<HTMLDivElement>(null);

  const handleLogin  = () => setLoggedIn(true);
  const handleLogout = () => { logout(); setLoggedIn(false); };

  const handleSectionChange = (s: Section) => {
    setActiveSection(s);
    setMobileOpen(false);
  };

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("pf_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  // Keep schoolName in sync when settings change
  useEffect(() => {
    if (activeSection === "settings") {
      const handler = () => setSchoolName(getSettings().schoolName);
      window.addEventListener("focus", handler);
      return () => window.removeEventListener("focus", handler);
    }
  }, [activeSection]);

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

  // ── PDF download ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async (withAnswerKey = false) => {
    if (!paper) return;
    const target = withAnswerKey ? pdfAnswerRef.current : pdfPaperRef.current;
    if (!target) return;
    setPdfLoading(true);
    const toastId = toast.loading(withAnswerKey ? "Preparing Answer Key PDF…" : "Preparing PDF…");
    try {
      const safeName = `${paper.meta.subject}_${paper.meta.examName}`
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_\-]/g, "");
      const filename = withAnswerKey ? `${safeName}_AnswerKey.pdf` : `${safeName}.pdf`;
      await exportElementToPdf(target, filename);
      toast.success("PDF downloaded", { id: toastId });
    } catch {
      toast.error("PDF export failed", { id: toastId });
    } finally {
      setPdfLoading(false);
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
        text: q.text, type: q.type, marks: q.marks,
        options: q.options, answer: q.answer,
        subject: paper.meta.subject,
        topic: undefined, difficulty: undefined, board: undefined,
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

  const sidebarW = collapsed ? "lg:ml-[68px]" : "lg:ml-64";

  return (
    <div className="flex min-h-screen bg-[#09090f] text-white">
      <Toaster theme="dark" position="top-right" />
      <InstallPrompt />

      <Sidebar
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        schoolName={schoolName}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main content */}
      <div className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${sidebarW}`}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-[#09090f]/90 px-4 backdrop-blur-md sm:px-6">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
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

                {/* PDF download dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      disabled={pdfLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 gap-1.5"
                    >
                      {pdfLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                      <span className="hidden sm:inline">Download PDF</span>
                      <ChevronRight className="h-3.5 w-3.5 rotate-90 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-[#1a1a2e] border-white/10 text-white min-w-[200px]"
                  >
                    <DropdownMenuItem
                      onClick={() => handleDownloadPdf(false)}
                      className="flex items-center gap-2.5 cursor-pointer focus:bg-white/10 focus:text-white py-2.5"
                    >
                      <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Question Paper</div>
                        <div className="text-[11px] text-slate-500">Questions only, no answers</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDownloadPdf(true)}
                      className="flex items-center gap-2.5 cursor-pointer focus:bg-white/10 focus:text-white py-2.5"
                    >
                      <KeyRound className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">With Answer Key</div>
                        <div className="text-[11px] text-slate-500">Questions + answer key appended</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 p-4 sm:p-6">

          {activeSection === "bank"      && <QuestionBankPage />}
          {activeSection === "students"  && <StudentsPage />}
          {activeSection === "analytics" && <AnalyticsPage />}
          {activeSection === "settings"  && (
            <SettingsPage onSettingsChange={() => setSchoolName(getSettings().schoolName)} />
          )}

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
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> New
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleSaveToBank}
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleShare}
                        className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleDownloadPdf(false)}
                        disabled={pdfLoading} className="bg-indigo-600 text-white">
                        {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* ── Split view: Editor + Preview ─────────────────────── */}
                  <div className="grid gap-4 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr]">
                    {/* Editor panel */}
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

                    {/* Preview panel */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3">
                      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                        <Eye className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">Live Preview</span>
                        <div className="ml-auto flex items-center gap-2">
                          <Tabs value={showAnswers ? "key" : "paper"} onValueChange={(v) => setShowAnswers(v === "key")}>
                            <TabsList className="h-7 bg-white/5 border border-white/10">
                              <TabsTrigger value="paper" className="h-6 px-3 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                Paper
                              </TabsTrigger>
                              <TabsTrigger value="key" className="h-6 px-3 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                Answer Key
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                      </div>
                      <div className="overflow-y-auto p-2 sm:p-3" style={{ maxHeight: "calc(100vh - 160px)" }}>
                        <Tabs value={showAnswers ? "key" : "paper"}>
                          <TabsContent value="paper" className="mt-0">
                            <PaperSheet ref={sheetRef} paper={paper} showAnswers={false} />
                          </TabsContent>
                          <TabsContent value="key" className="mt-0">
                            <PaperSheet ref={sheetKeyRef} paper={paper} showAnswers />
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </div>

                  {/* ── Action bar ───────────────────────────────────────── */}
                  <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">Ready to share?</div>
                        <div className="text-xs text-slate-500">Send an online test link or download a print-ready PDF.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleSaveToBank}
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                          <BookOpen className="mr-1.5 h-4 w-4" /> Save to Bank
                        </Button>
                        <Button variant="outline" onClick={handleShare}
                          className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20">
                          <Link2 className="mr-1.5 h-4 w-4" />
                          {copied ? "Copied!" : "Copy Test Link"}
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

      {/* ── Hidden off-screen renders for clean PDF capture ─────────────────── */}
      {paper && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: "820px",
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          {/* Question paper (no answers) */}
          <div ref={pdfPaperRef}>
            <PaperSheet paper={paper} showAnswers={false} />
          </div>
          {/* With answer key */}
          <div ref={pdfAnswerRef}>
            <PaperSheet paper={paper} showAnswers />
          </div>
        </div>
      )}
    </div>
  );
}
