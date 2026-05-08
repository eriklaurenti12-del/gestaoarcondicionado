import React, { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";

const SESSION_KEY = "spotlight_atualizar_dismissed";
const SELECTOR = '[data-spotlight-target="atualizar"]';

/**
 * Renders a focus spotlight that highlights the dashboard "Atualizar" button.
 * - Targets ONLY the button with [data-spotlight-target="atualizar"]
 * - Keeps the cutout in sync with scroll/resize/layout changes
 * - Hides itself if the target is off-screen or not present
 */
const SpotlightAtualizar: React.FC = () => {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (dismissed) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const btn = document.querySelector(SELECTOR) as HTMLElement | null;
        if (!btn) {
          setRect(null);
          return;
        }
        const r = btn.getBoundingClientRect();
        // Hide if button not actually visible on screen
        if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) {
          setRect(null);
          return;
        }
        setRect(r);
      });
    };

    update();
    const interval = setInterval(update, 500); // catch async-mounted buttons / layout shifts
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [dismissed]);

  if (dismissed || !rect) return null;

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  };

  const pad = 8;
  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  const placeBelow = y + h + 200 < window.innerHeight;
  const tipTop = placeBelow ? y + h + 12 : Math.max(12, y - 190);
  const tipLeft = Math.min(
    window.innerWidth - 312,
    Math.max(12, x + w / 2 - 150)
  );

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={close}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={12} ry={12} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(2, 6, 23, 0.78)"
          mask="url(#spotlight-mask)"
        />
        <rect
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
          rx={14}
          ry={14}
          fill="none"
          stroke="hsl(217 91% 60%)"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 12px hsl(217 91% 60%))" }}
        />
      </svg>

      <div
        className="absolute w-[300px] rounded-2xl bg-slate-900 border border-blue-500/40 shadow-2xl p-4 text-white"
        style={{ top: tipTop, left: tipLeft }}
      >
        <button
          onClick={close}
          className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 font-semibold mb-1">
          <RefreshCw className="h-4 w-4 text-blue-400" /> Atualizar Sistema
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Se a tela estiver preta, com erro de login ou lenta, clique neste
          botão para atualizar e corrigir o sistema.
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-slate-500">1 de 1</span>
          <button
            onClick={close}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700"
          >
            Entendi →
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpotlightAtualizar;
