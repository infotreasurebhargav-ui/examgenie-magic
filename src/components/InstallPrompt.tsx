import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !evt) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-4 md:mx-0">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-base font-semibold">Install PaperForge</div>
          <div className="text-sm text-muted-foreground">Faster access, works offline, full-screen experience.</div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await evt.prompt();
                await evt.userChoice;
                setVisible(false);
              }}
            >
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVisible(false)}>
              Not now
            </Button>
          </div>
        </div>
        <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
