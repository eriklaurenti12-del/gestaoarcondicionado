
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyCustomColors(colors: Record<string, string>, isDark: boolean) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = `--${key}`;
    root.style.setProperty(cssVar, value);
    if (['primary', 'secondary', 'accent', 'destructive'].includes(key)) {
      root.style.setProperty(`${cssVar}-foreground`, '0 0% 100%');
    }
    if (key === 'card') {
      root.style.setProperty('--card-foreground', colors.foreground || '');
      root.style.setProperty('--popover', value);
      root.style.setProperty('--popover-foreground', colors.foreground || '');
    }
    if (key === 'muted') {
      root.style.setProperty('--muted-foreground', isDark ? '220 15% 55%' : '215 18% 40%');
      root.style.setProperty('--input', value);
    }
  });
  root.style.setProperty('--ring', colors.primary || '');
  if (colors.background) {
    root.style.setProperty('--sidebar-background', colors.background);
    root.style.setProperty('--sidebar-foreground', colors.foreground || '');
    root.style.setProperty('--sidebar-primary', colors.primary || '');
    root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
    root.style.setProperty('--sidebar-accent', colors.muted || '');
    root.style.setProperty('--sidebar-accent-foreground', colors.foreground || '');
    root.style.setProperty('--sidebar-border', colors.border || '');
    root.style.setProperty('--sidebar-ring', colors.primary || '');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Load and apply custom colors
    loadCustomTheme(theme);
  }, [theme]);

  const loadCustomTheme = async (currentTheme: Theme) => {
    try {
      const key = currentTheme === 'dark' ? 'theme_dark_colors' : 'theme_light_colors';
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (data?.value) {
        const colors = JSON.parse(data.value);
        applyCustomColors(colors, currentTheme === 'dark');
      } else {
        // No custom theme - remove inline styles to use CSS defaults
        document.documentElement.removeAttribute('style');
      }
      // Load border radius
      const { data: radiusData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'theme_border_radius')
        .maybeSingle();
      if (radiusData?.value) {
        document.documentElement.style.setProperty('--radius', `${Number(radiusData.value) / 16}rem`);
      }
    } catch {
      // Silently fail - use CSS defaults
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
