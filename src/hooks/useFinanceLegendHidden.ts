import { useEffect, useState } from "react";

const KEY = "fin_hide_origin_legend";
const EVT = "fin-hide-legend-change";

export function useFinanceLegendHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const sync = () => {
      try { setHidden(localStorage.getItem(KEY) === "1"); } catch {}
    };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = () => {
    setHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
      window.dispatchEvent(new Event(EVT));
      return next;
    });
  };

  return [hidden, toggle];
}
