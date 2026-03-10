
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
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .like('key', 'theme_%');
      
      if (!data || data.length === 0) {
        document.documentElement.removeAttribute('style');
        return;
      }

      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key] = r.value || ''; });

      // Apply colors
      const colorKey = currentTheme === 'dark' ? 'theme_dark_colors' : 'theme_light_colors';
      if (map[colorKey]) {
        const colors = JSON.parse(map[colorKey]);
        applyCustomColors(colors, currentTheme === 'dark');
      }

      // Apply border radius
      if (map.theme_border_radius) {
        document.documentElement.style.setProperty('--radius', `${Number(map.theme_border_radius) / 16}rem`);
      }

      // Apply fonts
      if (map.theme_font_family) {
        const ff = map.theme_font_family;
        const familyName = ff.replace(/["']/g, '').split(',')[0].trim();
        if (familyName && !['sans-serif','serif','monospace'].includes(familyName)) {
          const linkId = `gfont-${familyName.replace(/\s+/g, '-')}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${familyName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
            document.head.appendChild(link);
          }
        }
        document.body.style.fontFamily = ff;
      }
      if (map.theme_heading_font) {
        const hf = map.theme_heading_font;
        const familyName = hf.replace(/["']/g, '').split(',')[0].trim();
        if (familyName && !['sans-serif','serif','monospace'].includes(familyName)) {
          const linkId = `gfont-${familyName.replace(/\s+/g, '-')}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${familyName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
            document.head.appendChild(link);
          }
        }
        document.documentElement.style.setProperty('--font-heading', hf);
      }
      if (map.theme_font_weight) document.body.style.fontWeight = map.theme_font_weight;
      if (map.theme_font_size) document.body.style.fontSize = `${map.theme_font_size}px`;
      if (map.theme_letter_spacing) document.body.style.letterSpacing = `${map.theme_letter_spacing}em`;
      if (map.theme_transition_speed) {
        document.documentElement.style.setProperty('--transition-speed', `${map.theme_transition_speed}ms`);
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
