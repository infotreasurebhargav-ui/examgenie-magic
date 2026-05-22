import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Link2, FileText, Eye, Pencil, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { PaperBuilder } from "@/components/PaperBuilder";
import { PaperSheet } from "@/components/PaperSheet";
import { PaperEditor } from "@/components/PaperEditor";
import { InstallPrompt } from "@/components/InstallPrompt";
import { generatePaper } from "@/lib/ai-paper";
import type { Paper } from "@/lib/paper-types";
import { exportElementToPdf } from "@/lib/pdf-export";
import { buildTestUrl } from "@/lib/test-share";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "PaperForge — AI Question Paper Studio" },
      { name: "description", content: "Generate, edit, and share beautiful question papers with AI. PDF download and live online tests included." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
});

function Home() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const onGenerate = async (brief: Parameters<typeof generatePaper>[0]) => {
    setLoading(true);
    try {
      const p = await generatePaper(brief);
      setPaper(p);
      setShareUrl(null);
      toast.success("Question paper generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!sheetRef.current || !paper) return;
    toast.message("Preparing PDF…");
    try {
      await exportElementToPdf(sheetRef.current, `${paper.meta.subject}-${paper.meta.examName}.pdf`.replace(/\s+/g, "_"));
    } catch {
      toast.error("PDF export failed");
    }
  };

  const handleShare = () => {
    if (!paper) return;
    const url = buildTestUrl(paper);
    setShareUrl(url);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Live test link copied");
    });
  };

  return (
    <div className="min-h-screen no-select">
      <Toaster theme="dark" position="top-center" />
      <InstallPrompt />

      <header className="border-b border-border/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-base font-bold leading-tight">PaperForge</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Question Paper Studio</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {!paper && (
          <section className="mb-8 text-center sm:mb-12">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
              Powered by next-gen reasoning
            </div>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold sm:text-6xl">
              Craft exam papers in <span className="text-gradient">seconds</span>, not hours.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Tell us the basics, edit live, export a print-ready PDF, or share a live online test with automatic grading.
            </p>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{paper ? "Edit Paper" : "Setup"}</h2>
              {paper && (
                <Button size="sm" variant="ghost" onClick={() => { setPaper(null); setShareUrl(null); }}>
                  New
                </Button>
              )}
            </div>
            {!paper ? (
              <PaperBuilder onGenerate={onGenerate} loading={loading} />
            ) : (
              <PaperEditor paper={paper} onChange={setPaper} />
            )}
          </aside>

          <section className="min-w-0">
            {!paper ? (
              <EmptyPreview loading={loading} />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs value={showAnswers ? "key" : "paper"} onValueChange={(v) => setShowAnswers(v === "key")}>
                    <TabsList>
                      <TabsTrigger value="paper"><Eye className="mr-1.5 h-4 w-4" />Paper</TabsTrigger>
                      <TabsTrigger value="key"><Pencil className="mr-1.5 h-4 w-4" />Answer Key</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button onClick={handleDownload} variant="secondary"><Download className="mr-1.5 h-4 w-4" />PDF</Button>
                    <Button onClick={handleShare}><Link2 className="mr-1.5 h-4 w-4" />Live Test Link</Button>
                  </div>
                </div>

                {shareUrl && (
                  <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm sm:flex-row sm:items-center">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 truncate font-mono text-xs">{shareUrl}</div>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(()=>setCopied(false),1500); }}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                <Tabs value={showAnswers ? "key" : "paper"}>
                  <TabsContent value="paper" className="mt-0">
                    <PaperSheet ref={sheetRef} paper={paper} showAnswers={false} />
                  </TabsContent>
                  <TabsContent value="key" className="mt-0">
                    <PaperSheet paper={paper} showAnswers={true} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyPreview({ loading }: { loading: boolean }) {
  return (
    <div className="grid h-[60vh] place-items-center rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
      <div>
        {loading ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="mt-3 font-display text-lg">Composing your paper…</div>
            <div className="text-sm text-muted-foreground">The AI is drafting questions, balancing difficulty, and writing the answer key.</div>
          </>
        ) : (
          <>
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-3 font-display text-lg">Your paper preview will appear here</div>
            <div className="text-sm text-muted-foreground">Fill in the basics on the left and hit Generate.</div>
          </>
        )}
      </div>
    </div>
  );
}
