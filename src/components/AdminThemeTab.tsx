import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { Palette, Sun, Moon, Save, Loader2, RotateCcw, Sparkles, Eye, Zap, Droplets } from "lucide-react";

type ThemeColors = Record<string, string>;

const PRESETS: Record<string, { label: string; emoji: string; light: ThemeColors; dark: ThemeColors }> = {
  default: {
    label: 'Azul Profissional', emoji: '🔵',
    light: {
      background: '215 25% 93%', foreground: '215 30% 12%', primary: '215 75% 48%',
      secondary: '205 65% 52%', accent: '205 65% 52%', muted: '212 20% 88%',
      card: '212 20% 97%', border: '212 18% 82%',
    },
    dark: {
      background: '225 40% 6%', foreground: '210 20% 92%', primary: '225 70% 60%',
      secondary: '235 55% 55%', accent: '230 65% 58%', muted: '225 30% 14%',
      card: '225 35% 10%', border: '225 25% 16%',
    },
  },
  emerald: {
    label: 'Esmeralda', emoji: '🟢',
    light: {
      background: '160 20% 93%', foreground: '160 30% 12%', primary: '160 70% 38%',
      secondary: '170 60% 45%', accent: '170 60% 45%', muted: '160 18% 88%',
      card: '160 18% 97%', border: '160 16% 82%',
    },
    dark: {
      background: '160 35% 6%', foreground: '155 20% 92%', primary: '160 65% 50%',
      secondary: '170 50% 45%', accent: '165 60% 48%', muted: '160 28% 14%',
      card: '160 30% 10%', border: '160 22% 16%',
    },
  },
  amber: {
    label: 'Âmbar Quente', emoji: '🟠',
    light: {
      background: '35 25% 93%', foreground: '35 30% 12%', primary: '35 85% 50%',
      secondary: '25 75% 55%', accent: '25 75% 55%', muted: '35 20% 88%',
      card: '35 20% 97%', border: '35 18% 82%',
    },
    dark: {
      background: '25 35% 6%', foreground: '30 20% 92%', primary: '35 80% 55%',
      secondary: '25 65% 50%', accent: '30 70% 52%', muted: '25 28% 14%',
      card: '25 30% 10%', border: '25 22% 16%',
    },
  },
  rose: {
    label: 'Rosa Elegante', emoji: '🌸',
    light: {
      background: '340 20% 93%', foreground: '340 30% 12%', primary: '340 75% 55%',
      secondary: '330 60% 52%', accent: '330 60% 52%', muted: '340 18% 88%',
      card: '340 18% 97%', border: '340 16% 82%',
    },
    dark: {
      background: '340 35% 6%', foreground: '335 20% 92%', primary: '340 70% 60%',
      secondary: '330 55% 50%', accent: '335 65% 55%', muted: '340 28% 14%',
      card: '340 30% 10%', border: '340 22% 16%',
    },
  },
  purple: {
    label: 'Roxo Premium', emoji: '🟣',
    light: {
      background: '270 20% 93%', foreground: '270 30% 12%', primary: '270 70% 55%',
      secondary: '280 60% 52%', accent: '280 60% 52%', muted: '270 18% 88%',
      card: '270 18% 97%', border: '270 16% 82%',
    },
    dark: {
      background: '270 35% 6%', foreground: '265 20% 92%', primary: '270 65% 60%',
      secondary: '280 55% 55%', accent: '275 60% 58%', muted: '270 28% 14%',
      card: '270 30% 10%', border: '270 22% 16%',
    },
  },
  cyan: {
    label: 'Ciano Futurista', emoji: '🩵',
    light: {
      background: '190 22% 93%', foreground: '190 30% 12%', primary: '190 80% 42%',
      secondary: '200 70% 48%', accent: '200 70% 48%', muted: '190 18% 88%',
      card: '190 18% 97%', border: '190 16% 82%',
    },
    dark: {
      background: '195 40% 5%', foreground: '190 20% 92%', primary: '190 75% 50%',
      secondary: '200 60% 50%', accent: '195 70% 48%', muted: '195 30% 12%',
      card: '195 35% 9%', border: '195 25% 15%',
    },
  },
};

const COLOR_LABELS: Record<string, string> = {
  background: 'Fundo',
  foreground: 'Texto',
  primary: 'Cor Primária',
  secondary: 'Cor Secundária',
  accent: 'Cor de Destaque',
  muted: 'Fundo Suave',
  card: 'Fundo dos Cards',
  border: 'Bordas',
};

// Convert HSL string "H S% L%" to hex for color picker
function hslToHex(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/);
    const h = parseFloat(parts[0]) || 0;
    const s = (parseFloat(parts[1]) || 0) / 100;
    const l = (parseFloat(parts[2]) || 0) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return '#000000'; }
}

// Convert hex to HSL string
function hexToHsl(hex: string): string {
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0 0% 0%';
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch { return '0 0% 0%'; }
}

const EFFECTS_KEYS = [
  { key: 'theme_glassmorphism', label: 'Glassmorphism (Cards translúcidos)', default: 'true' },
  { key: 'theme_glow_effects', label: 'Efeito Glow (Brilho ambiente)', default: 'true' },
  { key: 'theme_gradient_mesh', label: 'Gradient Mesh (Fundo gradiente)', default: 'true' },
  { key: 'theme_animations', label: 'Animações de entrada', default: 'true' },
  { key: 'theme_shadows', label: 'Sombras elegantes', default: 'true' },
];

const AdminThemeTab: React.FC = () => {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [lightColors, setLightColors] = useState<ThemeColors>(PRESETS.default.light);
  const [darkColors, setDarkColors] = useState<ThemeColors>(PRESETS.default.dark);
  const [effects, setEffects] = useState<Record<string, string>>({});
  const [glowIntensity, setGlowIntensity] = useState(50);
  const [borderRadius, setBorderRadius] = useState(12);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value')
      .like('key', 'theme_%');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key] = r.value || ''; });

      if (map.theme_light_colors) {
        try { setLightColors(JSON.parse(map.theme_light_colors)); } catch {}
      }
      if (map.theme_dark_colors) {
        try { setDarkColors(JSON.parse(map.theme_dark_colors)); } catch {}
      }
      if (map.theme_glow_intensity) setGlowIntensity(Number(map.theme_glow_intensity) || 50);
      if (map.theme_border_radius) setBorderRadius(Number(map.theme_border_radius) || 12);

      const fx: Record<string, string> = {};
      EFFECTS_KEYS.forEach(e => { fx[e.key] = map[e.key] || e.default; });
      setEffects(fx);
    }
  };

  // Apply theme colors instantly to CSS custom properties
  const applyThemeInstantly = useCallback((light: ThemeColors, dark: ThemeColors, radius: number, intensity: number) => {
    const root = document.documentElement;
    const currentColors = root.classList.contains('dark') ? dark : light;
    
    Object.entries(currentColors).forEach(([key, value]) => {
      const cssVar = key === 'background' ? '--background' :
        key === 'foreground' ? '--foreground' :
        key === 'card' ? '--card' :
        key === 'border' ? '--border' :
        `--${key}`;
      root.style.setProperty(cssVar, value);
      // Also set foreground variants
      if (['primary', 'secondary', 'accent', 'destructive'].includes(key)) {
        root.style.setProperty(`${cssVar}-foreground`, '0 0% 100%');
      }
      if (key === 'card') {
        root.style.setProperty('--card-foreground', currentColors.foreground || '');
      }
      if (key === 'muted') {
        root.style.setProperty('--muted-foreground', root.classList.contains('dark') ? '220 15% 55%' : '215 18% 40%');
      }
    });
    root.style.setProperty('--radius', `${radius / 16}rem`);
    root.style.setProperty('--popover', currentColors.card || '');
    root.style.setProperty('--popover-foreground', currentColors.foreground || '');
    root.style.setProperty('--input', currentColors.muted || currentColors.border || '');
    root.style.setProperty('--ring', currentColors.primary || '');

    // Sidebar
    root.style.setProperty('--sidebar-background', root.classList.contains('dark') 
      ? adjustLightness(currentColors.background, 2) 
      : adjustLightness(currentColors.background, -1));
    root.style.setProperty('--sidebar-foreground', currentColors.foreground);
    root.style.setProperty('--sidebar-primary', currentColors.primary);
    root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
    root.style.setProperty('--sidebar-accent', currentColors.muted);
    root.style.setProperty('--sidebar-accent-foreground', currentColors.foreground);
    root.style.setProperty('--sidebar-border', currentColors.border);
    root.style.setProperty('--sidebar-ring', currentColors.primary);
  }, []);

  const adjustLightness = (hsl: string, delta: number): string => {
    const parts = hsl.trim().split(/\s+/);
    const l = Math.max(0, Math.min(100, (parseFloat(parts[2]) || 0) + delta));
    return `${parts[0]} ${parts[1]} ${l}%`;
  };

  const updateColor = (mode: 'light' | 'dark', key: string, value: string) => {
    const hslValue = hexToHsl(value);
    if (mode === 'light') {
      const updated = { ...lightColors, [key]: hslValue };
      setLightColors(updated);
      applyThemeInstantly(updated, darkColors, borderRadius, glowIntensity);
    } else {
      const updated = { ...darkColors, [key]: hslValue };
      setDarkColors(updated);
      applyThemeInstantly(lightColors, updated, borderRadius, glowIntensity);
    }
  };

  const updateRadius = (val: number) => {
    setBorderRadius(val);
    applyThemeInstantly(lightColors, darkColors, val, glowIntensity);
  };

  const updateGlowIntensity = (val: number) => {
    setGlowIntensity(val);
    applyThemeInstantly(lightColors, darkColors, borderRadius, val);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setLightColors(preset.light);
    setDarkColors(preset.dark);
    applyThemeInstantly(preset.light, preset.dark, borderRadius, glowIntensity);
    toast({ title: `Tema "${preset.label}" aplicado! ${preset.emoji}` });
  };

  const resetToDefault = () => {
    applyPreset('default');
    setBorderRadius(12);
    setGlowIntensity(50);
    const root = document.documentElement;
    // Remove all inline styles to revert to CSS defaults
    root.removeAttribute('style');
    toast({ title: 'Tema resetado para o padrão 🔄' });
  };

  const saveTheme = async () => {
    setSaving(true);
    try {
      const entries = [
        { key: 'theme_light_colors', value: JSON.stringify(lightColors), description: 'Cores do tema claro' },
        { key: 'theme_dark_colors', value: JSON.stringify(darkColors), description: 'Cores do tema escuro' },
        { key: 'theme_glow_intensity', value: String(glowIntensity), description: 'Intensidade do glow' },
        { key: 'theme_border_radius', value: String(borderRadius), description: 'Arredondamento das bordas' },
        ...EFFECTS_KEYS.map(e => ({ key: e.key, value: effects[e.key] || e.default, description: e.label })),
      ];

      for (const entry of entries) {
        await supabase.from('admin_settings').upsert({
          ...entry,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      }
      toast({ title: '✅ Tema salvo com sucesso!', description: 'As cores serão aplicadas para todos os usuários.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar tema', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const currentColors = theme === 'dark' ? darkColors : lightColors;
  const currentMode = theme === 'dark' ? 'dark' : 'light';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20">
          <Palette className="w-6 h-6 text-violet-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Editor de Tema & Cores</h2>
          <p className="text-sm text-muted-foreground">Customize as cores, efeitos e aparência de todo o sistema em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw className="w-4 h-4 mr-1" /> Resetar
          </Button>
          <Button onClick={saveTheme} disabled={saving} className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar Tema
          </Button>
        </div>
      </div>

      {/* Mode Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
              <div>
                <p className="font-medium text-sm">Modo Atual: {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                <p className="text-xs text-muted-foreground">Clique para alternar e editar as cores do outro modo</p>
              </div>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      {/* Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Temas Prontos
          </CardTitle>
          <CardDescription>Clique para aplicar instantaneamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => applyPreset(key)}
                className="p-3 rounded-xl border border-border hover:border-primary/50 transition-all text-center space-y-2 hover:scale-105 active:scale-95">
                <div className="flex justify-center gap-1">
                  {Object.values(theme === 'dark' ? preset.dark : preset.light).slice(2, 5).map((hsl, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: `hsl(${hsl})` }} />
                  ))}
                </div>
                <p className="text-xs font-medium">{preset.emoji} {preset.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Editors - Current Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
            Cores do Modo {theme === 'dark' ? 'Escuro' : 'Claro'}
          </CardTitle>
          <CardDescription>Altere as cores e veja o resultado instantaneamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(COLOR_LABELS).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hslToHex(currentColors[key] || '0 0% 50%')}
                    onChange={e => updateColor(currentMode, key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="w-full h-8 rounded-lg border border-border/50" style={{ backgroundColor: `hsl(${currentColors[key]})` }} />
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{currentColors[key]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" /> Preview ao Vivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl border border-border space-y-3" style={{ backgroundColor: `hsl(${currentColors.background})` }}>
            <div className="flex items-center gap-2">
              <div className="h-8 px-4 rounded-lg flex items-center text-xs font-bold text-white" style={{ backgroundColor: `hsl(${currentColors.primary})` }}>
                Botão Primário
              </div>
              <div className="h-8 px-4 rounded-lg flex items-center text-xs font-bold text-white" style={{ backgroundColor: `hsl(${currentColors.secondary})` }}>
                Secundário
              </div>
              <div className="h-8 px-4 rounded-lg flex items-center text-xs font-bold text-white" style={{ backgroundColor: `hsl(${currentColors.accent})` }}>
                Destaque
              </div>
            </div>
            <div className="p-3 rounded-lg border" style={{ backgroundColor: `hsl(${currentColors.card})`, borderColor: `hsl(${currentColors.border})` }}>
              <p className="text-sm font-medium" style={{ color: `hsl(${currentColors.foreground})` }}>Card de exemplo</p>
              <p className="text-xs" style={{ color: `hsl(${currentColors.foreground} / 0.6)` }}>Texto secundário dentro de um card</p>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: `hsl(${currentColors.muted})` }}>
              <p className="text-xs" style={{ color: `hsl(${currentColors.foreground} / 0.7)` }}>Fundo muted para elementos sutis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Border Radius & Glow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-400" /> Arredondamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Slider value={[borderRadius]} onValueChange={v => updateRadius(v[0])} min={0} max={24} step={1} className="flex-1" />
              <Badge variant="outline" className="text-xs w-14 justify-center">{borderRadius}px</Badge>
            </div>
            <div className="flex gap-2">
              {[0, 4, 8, 12, 16, 24].map(v => (
                <button key={v} onClick={() => updateRadius(v)}
                  className={`w-10 h-10 border transition-all ${borderRadius === v ? 'border-primary bg-primary/10' : 'border-border'}`}
                  style={{ borderRadius: `${v}px` }}>
                  <span className="text-[10px]">{v}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Intensidade do Glow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Slider value={[glowIntensity]} onValueChange={v => updateGlowIntensity(v[0])} min={0} max={100} step={5} className="flex-1" />
              <Badge variant="outline" className="text-xs w-14 justify-center">{glowIntensity}%</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Effects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            ✨ Efeitos Visuais
          </CardTitle>
          <CardDescription>Ative ou desative efeitos visuais do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {EFFECTS_KEYS.map(ef => (
            <div key={ef.key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <p className="text-sm">{ef.label}</p>
              <Switch
                checked={effects[ef.key] !== 'false'}
                onCheckedChange={v => setEffects(prev => ({ ...prev, [ef.key]: v ? 'true' : 'false' }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminThemeTab;
