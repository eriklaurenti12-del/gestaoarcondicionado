import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create a custom storage wrapper to catch errors
const customStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Supabase Storage] Failed to set item:', e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

// Helper to safely get user without crashing or throwing
export const getSafeUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
        console.warn('[Auth] Invalid session detected, clearing storage...');
        await supabase.auth.signOut().catch(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      }
      return { user: null, error };
    }
    return { user: data?.user, error: null };
  } catch (err) {
    console.error('[Auth] Fatal error in getUser:', err);
    return { user: null, error: err };
  }
};