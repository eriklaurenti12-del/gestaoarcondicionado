import { useEffect, useState } from "react";
import { getUserPref, setUserPref } from "@/utils/userPreferences";

const PREF_KEY = "finance_hide_origin_legend"; // saved in profiles.preferences
const EVT = "fin-hide-legend-change";

export function useFinanceLegendHidden(): [boolean, () => void] {
  // Optimistic initial value from localStorage mirror to avoid flicker.
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(`pref_${PREF_KEY}`) === "true"; } catch { return false; }
  });

  // Hydrate from per-user profile preference (cross-device).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await getUserPref<boolean>(PREF_KEY);
      if (!cancelled && typeof v === "boolean") setHidden(v);
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync between tabs/components in same session.
  useEffect(() => {
    const sync = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      if (typeof ce.detail === "boolean") setHidden(ce.detail);
    };
    window.addEventListener(EVT, sync as EventListener);
    return () => window.removeEventListener(EVT, sync as EventListener);
  }, []);

  const toggle = () => {
    setHidden(prev => {
      const next = !prev;
      // Persist per-user (DB) + local mirror, broadcast to siblings.
      setUserPref(PREF_KEY, next);
      window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
      return next;
    });
  };

  return [hidden, toggle];
}
