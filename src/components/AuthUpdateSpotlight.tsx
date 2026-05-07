import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { forceUpdateApp } from "@/lib/updateApp";

/**
 * "Spotlight" update prompt for the auth/login page.
 *
 * - Shows ONCE per browser (until user clicks Atualizar or X).
 * - Dims and blurs the rest of the page; only the "Atualizar" button stays in focus.
 * - "X" closes the prompt without reloading and remembers the choice forever
 *   (until a new build is published).
 */
const STORAGE_KEY = "auth_update_spotlight_dismissed_v";

export default function AuthUpdateSpotlight() {
  const [show, setShow] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let buildId: string | null = null;
    try {
      // @ts-ignore - injected via vite define
      buildId = typeof __APP_BUILD_ID__ !== "undefined" ? String(__APP_BUILD_ID__) : null;
    } catch {
      buildId = null;
    }
    const key = STORAGE_KEY + (buildId || "static");
    const dismissed = localStorage.getItem(key);

    // Only show automatically once per build
    if (!dismissed) {
      // Slight delay so the page renders first
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissForBuild = () => {
    try {
      // @ts-ignore
      const buildId = typeof __APP_BUILD_ID__ !== "undefined" ? String(__APP_BUILD_ID__) : "static";
      localStorage.setItem(STORAGE_KEY + buildId, "1");
    } catch {}
    setShow(false);
  };

  const handleUpdate = async () => {
    setRunning(true);
    dismissForBuild();
    await forceUpdateApp();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Dim + blur everything */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={dismissForBuild}
        aria-hidden
      />

      {/* Spotlight content (top-right, near where the Atualizar button lives) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-start gap-3 animate-in fade-in zoom-in duration-300">
        {/* Update button — fully focused */}
        <button
          onClick={handleUpdate}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-primary shadow-2xl shadow-primary/40 hover:bg-primary/10 transition-all active:scale-95 ring-4 ring-primary/30"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${running ? "animate-spin" : ""}`} />
          <span className="text-sm font-bold text-foreground">Atualizar</span>
        </button>

        {/* Tooltip card explaining */}
        <div className="max-w-[260px] rounded-xl bg-card border border-border shadow-2xl p-4 relative">
          <button
            onClick={dismissForBuild}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Fechar sem atualizar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Atualizar Sistema</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Se a tela estiver preta, com erro de login ou lenta, clique no botão{" "}
            <span className="font-semibold text-foreground">Atualizar</span> para corrigir.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">1 de 1</span>
            <button
              onClick={dismissForBuild}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Entendi →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
