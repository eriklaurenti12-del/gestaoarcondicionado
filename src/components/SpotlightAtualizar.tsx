import React, { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";

const SESSION_KEY = "spotlight_atualizar_dismissed";

/**
 * Renders a focus spotlight that highlights the "Atualizar" button on
 * every login until the user clicks the X. Dismissal is per session.
 */
const SpotlightAtualizar: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;

    const tryFind = () => {
      // Locate the Atualizar button by visible label.
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /(atualizar|sincronizar)/i.test(b.textContent || "")
      ) as HTMLElement | undefined;
      if (btn) {
        setRect(btn.getBoundingClientRect());
        setVisible(true);
        return true;
      }
      return false;
    };

    if (!tryFind()) {
      const interval = setInterval(() => {
        if (tryFind()) clearInterval(interval);
      }, 400);
      const stop = setTimeout(() => clearInterval(interval), 8000);
      return () => {
        clearInterval(interval);
        clearTimeout(stop);
      };
    }

    const onResize = () => tryFind();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, []);

  if (!visible || !rect) return null;

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  // Padding around the button cutout
  const pad = 8;
  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  // Tooltip below or above based on space
  const placeBelow = y + h + 200 < window.innerHeight;
  const tipTop = placeBelow ? y + h + 12 : y - 180;
  const tipLeft = Math.min(
    window.innerWidth - 320,
    Math.max(12, x + w / 2 - 160)
  );

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      {/* SVG mask: dark backdrop with a transparent rounded cutout */}
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
        {/* Glow ring */}
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

      {/* Tooltip card */}
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
