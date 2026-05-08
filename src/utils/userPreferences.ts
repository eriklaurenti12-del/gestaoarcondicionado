import { supabase } from '@/integrations/supabase/client';

/**
 * Reads a single boolean/value from `profiles.preferences[key]`
 * for the currently authenticated user. Falls back to `localStorage`
 * (legacy) so existing dismissals are honoured on first run.
 */
export async function getUserPref<T = unknown>(key: string): Promise<T | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const ls = localStorage.getItem(`pref_${key}`);
      return ls ? (JSON.parse(ls) as T) : null;
    }
    const { data } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();
    const prefs = (data?.preferences as Record<string, unknown> | null) || {};
    if (key in prefs) return prefs[key] as T;
    const ls = localStorage.getItem(`pref_${key}`);
    return ls ? (JSON.parse(ls) as T) : null;
  } catch {
    return null;
  }
}

export async function setUserPref(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(`pref_${key}`, JSON.stringify(value));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();
    const prefs = ((existing?.preferences as Record<string, unknown> | null) || {});
    prefs[key] = value;
    await supabase.from('profiles').update({ preferences: prefs as any }).eq('user_id', user.id);
  } catch (err) {
    console.warn('[setUserPref] failed', err);
  }
}
