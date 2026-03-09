import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Loader2, DollarSign, Type, Star, Shield, Megaphone, RefreshCw, 
  Palette, Clock, Bell, Gift, MessageSquare, Eye, MessageCircle, 
  HelpCircle, Video, Layout, Upload, Trash2, Plus, ChevronDown, ChevronUp,
  Image, Volume2, Target, ImagePlus, Sparkles, Grid3X3, Copy, Code, ExternalLink, Globe,
  CreditCard, Link2, CheckCircle2, Zap
} from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";
import { AIFieldHelper } from "@/components/AIFieldHelper";

const LANDING_KEYS = [
  'landing_preco_mensal', 'landing_preco_anual', 'landing_preco_anual_original',
  'landing_economia_anual', 'landing_preco_mensal_equivalente',
  'landing_preco_mensal_original',
  'landing_hero_titulo', 'landing_hero_subtitulo', 'landing_hero_descricao',
  'landing_social_proof_count', 'landing_social_proof_rating',
  'landing_garantia_dias', 'landing_btn_cta_texto', 'landing_badge_urgencia', 'landing_frase_destaque',
  'landing_cor_primaria', 'landing_cor_secundaria', 'landing_cor_destaque',
  'landing_cor_fundo', 'landing_cor_botao_cta',
  'landing_countdown_texto', 'landing_countdown_desconto',
  'landing_notif_intervalo', 'landing_notif_som', 'landing_notif_ativa',
  'landing_notif_acoes', 'landing_notif_nomes', 'landing_notif_cidades',
  'landing_notif_som_url',
  'landing_oferta1_titulo', 'landing_oferta1_descricao', 'landing_oferta1_badge', 'landing_oferta1_ativa',
  'landing_oferta1_btn_texto', 'landing_oferta1_features',
  'landing_oferta2_titulo', 'landing_oferta2_descricao', 'landing_oferta2_badge', 'landing_oferta2_ativa',
  'landing_oferta2_btn_texto', 'landing_oferta2_features',
  ...Array.from({length: 4}, (_, i) => [
    `landing_depoimento${i+1}_nome`, `landing_depoimento${i+1}_role`, 
    `landing_depoimento${i+1}_texto`, `landing_depoimento${i+1}_estrelas`,
    `landing_depoimento${i+1}_foto`, `landing_depoimento${i+1}_video`
  ]).flat(),
  'landing_video_prova_social_1', 'landing_video_prova_social_2', 'landing_video_prova_social_3',
  'landing_whatsapp_flutuante', 'landing_whatsapp_link', 'landing_whatsapp_mensagem', 'landing_whatsapp_icon_url',
  'landing_template',
  'landing_vsl_url', 'landing_vsl_trava',
  ...Array.from({length: 6}, (_, i) => [`landing_faq${i+1}_pergunta`, `landing_faq${i+1}_resposta`, `landing_faq${i+1}_ativa`]).flat(),
  'landing_pixel_facebook', 'landing_pixel_google', 'landing_pixel_tiktok',
  'landing_bg_image_url', 'landing_bg_overlay_opacity', 'landing_bg_particles',
  'landing_bg_effect', 'landing_bg_grid_color', 'landing_bg_grid_opacity', 'landing_bg_glow_color',
  'landing_secao_dor', 'landing_secao_features', 'landing_secao_comparativo',
  'landing_secao_depoimentos', 'landing_secao_faq', 'landing_secao_garantia',
  'landing_secao_hero', 'landing_secao_precos', 'landing_secao_urgencia_final', 'landing_secao_cta_final',
  'landing_hero_bg_image', 'landing_precos_bg_image', 'landing_depoimentos_bg_image',
  'landing_hero_font_size', 'landing_anim_speed',
  'landing_checkout_ativo', 'landing_checkout_mensal_link', 'landing_checkout_anual_link',
  'landing_checkout_redirect_sistema',
  'landing_banner_ativo', 'landing_banner_texto', 'landing_banner_cor', 'landing_banner_link',
  'landing_preco_mensal_riscado', 'landing_preco_anual_riscado',
  'landing_nome_riscado_ativo', 'landing_nome_riscado_texto',
  // Marquee & Effects settings
  'landing_animacoes_ativas', 'landing_scroll_reveal',
  'landing_marquee1_ativo', 'landing_marquee1_textos', 'landing_marquee1_direcao', 'landing_marquee1_velocidade',
  'landing_marquee1_cor_fundo', 'landing_marquee1_cor_texto', 'landing_marquee1_estilo', 'landing_marquee1_posicao',
  'landing_marquee1_tamanho', 'landing_marquee1_separador', 'landing_marquee1_tipo',
  'landing_marquee2_ativo', 'landing_marquee2_textos', 'landing_marquee2_direcao', 'landing_marquee2_velocidade',
  'landing_marquee2_cor_fundo', 'landing_marquee2_cor_texto', 'landing_marquee2_estilo', 'landing_marquee2_posicao',
  'landing_marquee2_tamanho', 'landing_marquee2_separador', 'landing_marquee2_tipo',
  'landing_marquee3_ativo', 'landing_marquee3_textos', 'landing_marquee3_direcao', 'landing_marquee3_velocidade',
  'landing_marquee3_cor_fundo', 'landing_marquee3_cor_texto', 'landing_marquee3_estilo', 'landing_marquee3_posicao',
  'landing_marquee3_tamanho', 'landing_marquee3_separador', 'landing_marquee3_tipo',
];

type LandingSettings = Record<string, string>;

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
    <div className="flex-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Input value={value || ''} onChange={e => onChange(e.target.value)}
        className="h-8 text-xs" placeholder="#hex" />
    </div>
  </div>
);

const TestimonialEditor: React.FC<{
  index: number; settings: LandingSettings; update: (k: string, v: string) => void;
}> = ({ index, settings, update }) => {
  const prefix = `landing_depoimento${index}`;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-primary font-semibold text-sm">Depoimento {index}</span>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => update(`${prefix}_estrelas`, String(s))}
                className={`text-lg ${Number(settings[`${prefix}_estrelas`] || 5) >= s ? 'text-amber-400' : 'text-muted-foreground/30'}`}>
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-muted-foreground text-xs">Nome</Label>
            <Input value={settings[`${prefix}_nome`] || ''} onChange={e => update(`${prefix}_nome`, e.target.value)}
              className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Cargo / Cidade</Label>
            <Input value={settings[`${prefix}_role`] || ''} onChange={e => update(`${prefix}_role`, e.target.value)}
              className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">Texto do depoimento</Label>
          <Textarea value={settings[`${prefix}_texto`] || ''} onChange={e => update(`${prefix}_texto`, e.target.value)}
            className="min-h-[60px] text-sm" />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs flex items-center gap-1">
            <Image className="w-3 h-3" /> URL da Foto do Cliente
          </Label>
          <Input value={settings[`${prefix}_foto`] || ''} onChange={e => update(`${prefix}_foto`, e.target.value)}
            className="h-8 text-sm" placeholder="https://... ou deixe vazio para avatar padrão" />
          {settings[`${prefix}_foto`] && (
            <div className="mt-2 flex items-center gap-2">
              <img src={settings[`${prefix}_foto`]} alt="foto" className="w-10 h-10 rounded-full object-cover border border-primary/30" />
              <Button variant="ghost" size="sm" onClick={() => update(`${prefix}_foto`, '')} className="text-destructive h-6 text-xs">
                <Trash2 className="w-3 h-3 mr-1" /> Remover
              </Button>
            </div>
          )}
        </div>
        <div>
          <Label className="text-muted-foreground text-xs flex items-center gap-1">
            <Video className="w-3 h-3" /> URL do Vídeo Depoimento (opcional)
          </Label>
          <Input value={settings[`${prefix}_video`] || ''} onChange={e => update(`${prefix}_video`, e.target.value)}
            className="h-8 text-sm" placeholder="https://youtube.com/watch?v=... ou link direto" />
        </div>
      </CardContent>
    </Card>
  );
};

export const AdminLandingTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<LandingSettings>({});
  const [previewKey, setPreviewKey] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pixelTab, setPixelTab] = useState<'facebook' | 'google' | 'tiktok'>('facebook');
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .like('key', 'landing_%');
      if (error) throw error;
      const map: LandingSettings = {};
      data?.forEach(item => { map[item.key] = item.value || ''; });
      setSettings(map);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Auto-refresh preview with debounce
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewKey(prev => prev + 1);
    }, 1500);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (!key.startsWith('landing_')) continue;
        const { error } = await supabase
          .from('admin_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      toast({ title: "Salvo! ✅", description: "Landing page atualizada. Atualize o preview." });
      setPreviewKey(prev => prev + 1);
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'icon' | 'sound') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: `Máximo ${type === 'video' ? '50MB' : '5MB'}`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('landing-media')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('landing-media').getPublicUrl(fileName);
      
      if (type === 'video') {
        update('landing_vsl_url', publicUrl);
      } else if (type === 'icon') {
        update('landing_whatsapp_icon_url', publicUrl);
      } else if (type === 'sound') {
        update('landing_notif_som_url', publicUrl);
      }
      toast({ title: `${type === 'video' ? 'Vídeo' : type === 'sound' ? 'Som' : 'Ícone'} enviado! ✅` });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleBgUpload = async (key: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev: any) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Máximo 10MB", variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        const ext = file.name.split('.').pop();
        const fileName = `bg-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('landing-media').upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('landing-media').getPublicUrl(fileName);
        update(key, publicUrl);
        toast({ title: "Imagem enviada! ✅" });
      } catch (err: any) {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const generateWithAI = async (type: string) => {
    setGeneratingAI(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-landing-copy', {
        body: { type, context: settings.landing_hero_descricao || '' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const gen = data.generated;

      if (type === 'hero') {
        update('landing_hero_titulo', gen.titulo);
        update('landing_hero_subtitulo', gen.subtitulo);
        update('landing_hero_descricao', gen.descricao);
        update('landing_badge_urgencia', gen.badge_urgencia);
        update('landing_frase_destaque', gen.frase_destaque);
        update('landing_btn_cta_texto', gen.btn_cta);
      } else if (type === 'faq') {
        gen.faqs?.forEach((faq: any, i: number) => {
          if (i < 6) {
            update(`landing_faq${i+1}_pergunta`, faq.pergunta);
            update(`landing_faq${i+1}_resposta`, faq.resposta);
            update(`landing_faq${i+1}_ativa`, 'true');
          }
        });
      } else if (type === 'depoimentos') {
        gen.depoimentos?.forEach((dep: any, i: number) => {
          if (i < 4) {
            update(`landing_depoimento${i+1}_nome`, dep.nome);
            update(`landing_depoimento${i+1}_role`, dep.role);
            update(`landing_depoimento${i+1}_texto`, dep.texto);
            update(`landing_depoimento${i+1}_estrelas`, dep.estrelas || '5');
          }
        });
      } else if (type === 'ofertas') {
        if (gen.plano1) {
          update('landing_oferta1_titulo', gen.plano1.titulo);
          update('landing_oferta1_descricao', gen.plano1.descricao);
          update('landing_oferta1_badge', gen.plano1.badge);
          update('landing_oferta1_btn_texto', gen.plano1.btn_texto);
          update('landing_oferta1_features', gen.plano1.features?.join('\n') || '');
        }
        if (gen.plano2) {
          update('landing_oferta2_titulo', gen.plano2.titulo);
          update('landing_oferta2_descricao', gen.plano2.descricao);
          update('landing_oferta2_badge', gen.plano2.badge);
          update('landing_oferta2_btn_texto', gen.plano2.btn_texto);
          update('landing_oferta2_features', gen.plano2.features?.join('\n') || '');
        }
      }
      toast({ title: "✨ Textos gerados com IA!", description: "Revise e clique 'Salvar Tudo' para aplicar." });
    } catch (err: any) {
      toast({ title: "Erro na geração", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAI(null);
    }
  };

  // Generate pixel head code
  const getPixelHeadCode = () => {
    const parts: string[] = [];
    if (settings.landing_pixel_facebook) {
      parts.push(`<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${settings.landing_pixel_facebook}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${settings.landing_pixel_facebook}&ev=PageView&noscript=1"/></noscript>
<!-- End Facebook Pixel Code -->`);
    }
    if (settings.landing_pixel_google) {
      parts.push(`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.landing_pixel_google}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${settings.landing_pixel_google}');
</script>
<!-- End Google tag -->`);
    }
    if (settings.landing_pixel_tiktok) {
      parts.push(`<!-- TikTok Pixel Code -->
<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${settings.landing_pixel_tiktok}');ttq.page();}(window,document,'ttq');
</script>
<!-- End TikTok Pixel Code -->`);
    }
    return parts.join('\n\n');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const templateOptions = [
    { id: 'persuasao', name: '🎯 Persuasão Total', desc: 'Hero, dores, comparativo, preços, depoimentos, FAQ e CTAs.',
      sections: ['Hero + Urgência', 'Seção de Dor', 'Features', 'Comparativo', 'Preços', 'Depoimentos', 'FAQ', 'CTA Final'],
      color: 'border-primary', gradient: 'from-primary/20 to-blue-500/20' },
    { id: 'vsl', name: '🎬 VSL (Vídeo)', desc: 'Foco no vídeo de vendas com preços e CTA.',
      sections: ['Vídeo Hero', 'CTA Abaixo', 'Preços', 'Depoimentos'],
      color: 'border-amber-500', gradient: 'from-amber-500/20 to-orange-500/20' },
    { id: 'minimalista', name: '✨ Minimalista', desc: 'Design limpo e direto. Ultra rápido.',
      sections: ['Hero Limpo', 'Features', 'Preços', 'CTA'],
      color: 'border-green-500', gradient: 'from-green-500/20 to-emerald-500/20' },
    { id: 'moderna', name: '🌐 Moderna', desc: 'Design escuro com grade mesh, glassmorphism e efeitos neon.',
      sections: ['Hero Neon', 'Features Grid', 'Preços Glass', 'Depoimentos', 'FAQ', 'CTA'],
      color: 'border-violet-500', gradient: 'from-violet-500/20 to-indigo-500/20' },
    { id: 'custom', name: '🛠️ Criar do Zero', desc: 'Página totalmente personalizada.',
      sections: ['Título Livre', 'Seções Livres', 'CTA Personalizado', 'Layout Aberto'],
      color: 'border-pink-500', gradient: 'from-pink-500/20 to-purple-500/20' },
  ];

  const landingUrl = `${window.location.origin}/vendas`;

  return (
    <div className="space-y-4">
      <AdminGuideCards tab="landing" />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Megaphone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Editor da Landing Page</h2>
            <p className="text-muted-foreground text-sm">Edite e visualize em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setShowPreview(prev => !prev); }}
            className={showPreview ? 'bg-primary/10 border-primary/30 text-primary' : ''}>
            <Eye className="w-4 h-4 mr-1" /> {showPreview ? 'Ocultar Preview' : 'Mostrar Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!window.confirm('Restaurar TODOS os valores para o padrão original?')) return;
            const defaults: Record<string, string> = {
              landing_hero_titulo: 'Pare de Perder Clientes e Dinheiro!',
              landing_hero_subtitulo: 'Sistema Completo para Técnicos de Ar Condicionado',
              landing_hero_descricao: 'Gerencie clientes, orçamentos, ordens de serviço, financeiro e muito mais em um só lugar.',
              landing_badge_urgencia: '🔥 Oferta por tempo limitado — Garanta agora!',
              landing_btn_cta_texto: 'QUERO COMEÇAR AGORA',
              landing_frase_destaque: 'Mais de 500 técnicos já transformaram seus negócios',
              landing_cor_primaria: '#06b6d4', landing_cor_secundaria: '#3b82f6',
              landing_cor_destaque: '#f59e0b', landing_cor_fundo: '#0f172a', landing_cor_botao_cta: '#22c55e',
              landing_preco_mensal: '39,90', landing_preco_anual: '370',
              landing_preco_anual_original: '478,80', landing_economia_anual: '108',
              landing_preco_mensal_equivalente: '30,83', landing_template: 'persuasao',
            };
            setSettings(prev => ({ ...prev, ...defaults }));
            toast({ title: "Restaurado! 🔄", description: "Clique 'Salvar Tudo' para aplicar." });
          }} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <RefreshCw className="w-4 h-4 mr-1" /> Restaurar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/vendas', '_blank')}>
            <ExternalLink className="w-4 h-4 mr-1" /> Abrir Landing
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

      {/* Split layout: Editor + Preview */}
      <div className={`grid gap-4 ${showPreview ? 'lg:grid-cols-[1fr,340px]' : 'grid-cols-1'}`}>
        {/* Editor Panel */}
        <div className="min-w-0">
      <Tabs defaultValue="template" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="template" className="text-xs"><Layout className="w-3 h-3 mr-1" />Template</TabsTrigger>
          <TabsTrigger value="textos" className="text-xs"><Type className="w-3 h-3 mr-1" />Textos</TabsTrigger>
          <TabsTrigger value="precos" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Preços</TabsTrigger>
          <TabsTrigger value="cores" className="text-xs"><Palette className="w-3 h-3 mr-1" />Cores</TabsTrigger>
          <TabsTrigger value="ofertas" className="text-xs"><Gift className="w-3 h-3 mr-1" />Ofertas</TabsTrigger>
          <TabsTrigger value="depoimentos" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Depoimentos</TabsTrigger>
          <TabsTrigger value="faq" className="text-xs"><HelpCircle className="w-3 h-3 mr-1" />FAQ</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="w-3 h-3 mr-1" />WhatsApp</TabsTrigger>
          <TabsTrigger value="video" className="text-xs"><Video className="w-3 h-3 mr-1" />Vídeo</TabsTrigger>
          <TabsTrigger value="notificacoes" className="text-xs"><Bell className="w-3 h-3 mr-1" />Notificações</TabsTrigger>
          <TabsTrigger value="pixel" className="text-xs"><Code className="w-3 h-3 mr-1" />Pixel Ads</TabsTrigger>
          <TabsTrigger value="efeitos" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />Efeitos</TabsTrigger>
          <TabsTrigger value="background" className="text-xs"><ImagePlus className="w-3 h-3 mr-1" />Fundo</TabsTrigger>
          <TabsTrigger value="extras" className="text-xs"><Star className="w-3 h-3 mr-1" />Extras</TabsTrigger>
          <TabsTrigger value="checkout" className="text-xs"><CreditCard className="w-3 h-3 mr-1" />Landing</TabsTrigger>
        </TabsList>

        {/* TEMPLATE */}
        <TabsContent value="template">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layout className="w-5 h-5 text-primary" /> Escolha o Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templateOptions.map(tmpl => (
                  <div key={tmpl.id}
                    className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${
                      settings.landing_template === tmpl.id 
                        ? `${tmpl.color} bg-accent/50 shadow-lg` 
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                    onClick={() => update('landing_template', tmpl.id)}>
                    <div className={`bg-gradient-to-br ${tmpl.gradient} rounded-lg p-3 mb-3 border border-border/50`}>
                      <div className="space-y-1.5">
                        {tmpl.sections.slice(0, 4).map((section, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            <div className="h-1.5 bg-muted-foreground/20 rounded-full flex-1" style={{ maxWidth: `${70 + Math.random() * 30}%` }} />
                            <span className="text-[8px] text-muted-foreground/60">{section}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <h3 className="font-bold text-sm mb-1">{tmpl.name}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed mb-3">{tmpl.desc}</p>
                    <Button size="sm" variant={settings.landing_template === tmpl.id ? "default" : "outline"} className="w-full">
                      {settings.landing_template === tmpl.id ? '✓ Ativo' : 'Selecionar'}
                    </Button>
                  </div>
                ))}
              </div>
              

            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTOS */}
        <TabsContent value="textos">
          <AdminGuideCards tab="landing-textos" />
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="w-5 h-5 text-primary" /> Textos Principais
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => generateWithAI('hero')} disabled={!!generatingAI}
                  className="border-primary/30 text-primary hover:bg-primary/10">
                  {generatingAI === 'hero' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Gerar com IA
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'landing_hero_titulo', label: 'Título Principal' },
                { key: 'landing_hero_subtitulo', label: 'Subtítulo' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-muted-foreground text-sm flex items-center">
                    {f.label}
                    <AIFieldHelper context="textos" fieldName={f.label} />
                  </Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                </div>
              ))}
              <div>
                <Label className="text-muted-foreground text-sm flex items-center">Descrição do Hero <AIFieldHelper context="textos" fieldName="descricao" /></Label>
                <Textarea value={settings.landing_hero_descricao || ''} onChange={e => update('landing_hero_descricao', e.target.value)}
                  className="min-h-[80px]" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm flex items-center">Frase de Destaque <AIFieldHelper context="textos" fieldName="frase destaque" /></Label>
                <Textarea value={settings.landing_frase_destaque || ''} onChange={e => update('landing_frase_destaque', e.target.value)}
                  className="min-h-[60px]" />
              </div>
              {[
                { key: 'landing_badge_urgencia', label: 'Badge de Urgência' },
                { key: 'landing_btn_cta_texto', label: 'Texto do Botão CTA' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-muted-foreground text-sm flex items-center">
                    {f.label}
                    <AIFieldHelper context="textos" fieldName={f.label} />
                  </Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                </div>
              ))}

              {/* Nome/Texto Riscado */}
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">✏️ Texto Riscado (Comparação)</Label>
                  <Switch checked={settings.landing_nome_riscado_ativo === 'true'}
                    onCheckedChange={v => update('landing_nome_riscado_ativo', v ? 'true' : 'false')} />
                </div>
                {settings.landing_nome_riscado_ativo === 'true' && (
                  <Input value={settings.landing_nome_riscado_texto || ''} onChange={e => update('landing_nome_riscado_texto', e.target.value)}
                    placeholder="Ex: Planilhas, cadernos, WhatsApp..." className="text-sm" />
                )}
                <p className="text-xs text-muted-foreground mt-1">Exibe um texto riscado no hero para comparação visual</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREÇOS */}
        <TabsContent value="precos">
          <AdminGuideCards tab="landing-precos" />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-5 h-5 text-green-500" /> Preços dos Planos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <h4 className="text-primary font-semibold text-sm flex items-center">💳 Plano Mensal <AIFieldHelper context="precos" fieldName="preco mensal" /></h4>
                  <div>
                    <Label className="text-muted-foreground text-sm">Preço (R$)</Label>
                    <Input value={settings.landing_preco_mensal || ''} onChange={e => update('landing_preco_mensal', e.target.value)}
                      placeholder="39,90" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Preço Original Riscado (R$)</Label>
                    <Input value={settings.landing_preco_mensal_original || ''} onChange={e => update('landing_preco_mensal_original', e.target.value)}
                      placeholder="Ex: 59,90 (deixe vazio para não mostrar)" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Exibir preço riscado</Label>
                    <Switch checked={settings.landing_preco_mensal_riscado === 'true'}
                      onCheckedChange={v => update('landing_preco_mensal_riscado', v ? 'true' : 'false')} />
                  </div>
                </div>
                <div className="bg-muted/30 border border-primary/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-amber-500 font-semibold text-sm flex items-center">⭐ Plano Anual <AIFieldHelper context="precos" fieldName="preco anual" /></h4>
                  {[
                    { key: 'landing_preco_anual', label: 'Preço Anual (R$)', ph: '370' },
                    { key: 'landing_preco_anual_original', label: 'Preço Original (riscado)', ph: '478,80' },
                    { key: 'landing_economia_anual', label: 'Economia (R$)', ph: '108' },
                    { key: 'landing_preco_mensal_equivalente', label: 'Equivalente Mensal (R$)', ph: '30,83' },
                  ].map(f => (
                    <div key={f.key}>
                      <Label className="text-muted-foreground text-sm">{f.label}</Label>
                      <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} placeholder={f.ph} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CORES */}
        <TabsContent value="cores">
          <AdminGuideCards tab="landing-cores" />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="w-5 h-5 text-pink-500" /> Paleta de Cores
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ColorInput label="Cor Primária" value={settings.landing_cor_primaria || '#06b6d4'} onChange={v => update('landing_cor_primaria', v)} />
              <ColorInput label="Cor Secundária" value={settings.landing_cor_secundaria || '#3b82f6'} onChange={v => update('landing_cor_secundaria', v)} />
              <ColorInput label="Cor Destaque" value={settings.landing_cor_destaque || '#f59e0b'} onChange={v => update('landing_cor_destaque', v)} />
              <ColorInput label="Cor de Fundo" value={settings.landing_cor_fundo || '#0f172a'} onChange={v => update('landing_cor_fundo', v)} />
              <ColorInput label="Cor Botão CTA" value={settings.landing_cor_botao_cta || '#22c55e'} onChange={v => update('landing_cor_botao_cta', v)} />
            </CardContent>
          </Card>
          <div className="mt-4 p-4 rounded-xl border border-border" style={{ background: settings.landing_cor_fundo || '#0f172a' }}>
            <div className="flex gap-3 justify-center flex-wrap">
              {[
                { k: 'primaria', label: 'Primária' },
                { k: 'secundaria', label: 'Secundária' },
                { k: 'destaque', label: 'Destaque' },
                { k: 'botao_cta', label: 'Botão CTA' }
              ].map(c => (
                <span key={c.k} className="px-4 py-2 rounded-lg text-white text-sm font-bold" 
                  style={{ background: settings[`landing_cor_${c.k}`] || '#06b6d4' }}>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* OFERTAS */}
        <TabsContent value="ofertas">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => generateWithAI('ofertas')} disabled={!!generatingAI}
                className="border-primary/30 text-primary hover:bg-primary/10">
                {generatingAI === 'ofertas' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Gerar Ofertas com IA
              </Button>
            </div>
            {[1, 2].map(i => {
              const isActive = settings[`landing_oferta${i}_ativa`] !== 'false';
              const defaultFeatures = i === 1 
                ? ['Acesso COMPLETO a tudo', 'Clientes e equipamentos ilimitados', 'Ordens de serviço profissionais', 'Controle financeiro real', 'Suporte humano no WhatsApp']
                : ['TUDO do mensal incluído', '2 meses DE GRAÇA', 'Suporte VIP prioritário', 'Relatórios avançados', 'Backup automático diário'];
              
              return (
                <Card key={i} className={`${!isActive ? 'opacity-50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Gift className="w-5 h-5 text-primary" /> 
                        {i === 1 ? '💳 Plano Mensal' : '⭐ Plano Anual'}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground text-xs">{isActive ? 'Visível' : 'Oculto'}</Label>
                        <Switch checked={isActive}
                          onCheckedChange={v => update(`landing_oferta${i}_ativa`, v ? 'true' : 'false')} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: `landing_oferta${i}_titulo`, label: 'Título do Plano', ph: i === 1 ? 'Plano Mensal' : 'Plano Anual' },
                        { key: `landing_oferta${i}_descricao`, label: 'Descrição', ph: 'Descrição curta do plano' },
                        { key: `landing_oferta${i}_badge`, label: 'Badge (ex: POPULAR)', ph: 'Deixe vazio para não mostrar' },
                      ].map(f => (
                        <div key={f.key}>
                          <Label className="text-muted-foreground text-sm">{f.label}</Label>
                          <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} placeholder={f.ph} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Texto do Botão CTA</Label>
                      <Input value={settings[`landing_oferta${i}_btn_texto`] || ''} 
                        onChange={e => update(`landing_oferta${i}_btn_texto`, e.target.value)}
                        placeholder={i === 1 ? `Começar por R$ ${settings.landing_preco_mensal || '39,90'}` : `QUERO ECONOMIZAR R$ ${settings.landing_economia_anual || '108'}`} />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Lista de Benefícios (um por linha)</Label>
                      <Textarea 
                        value={settings[`landing_oferta${i}_features`] || defaultFeatures.join('\n')} 
                        onChange={e => update(`landing_oferta${i}_features`, e.target.value)}
                        className="min-h-[120px] text-sm font-mono" placeholder="Um benefício por linha" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* DEPOIMENTOS */}
        <TabsContent value="depoimentos">
          <AdminGuideCards tab="landing-depoimentos" />
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => generateWithAI('depoimentos')} disabled={!!generatingAI}
                className="border-primary/30 text-primary hover:bg-primary/10">
                {generatingAI === 'depoimentos' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Gerar Depoimentos com IA
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <TestimonialEditor key={i} index={i} settings={settings} update={update} />
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="w-5 h-5 text-red-500" /> Vídeos de Prova Social
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-muted-foreground text-xs">Vídeo {i}</Label>
                      <Input value={settings[`landing_video_prova_social_${i}`] || ''} 
                        onChange={e => update(`landing_video_prova_social_${i}`, e.target.value)}
                        className="h-8 text-sm" placeholder="https://youtube.com/watch?v=..." />
                    </div>
                    {settings[`landing_video_prova_social_${i}`] && (
                      <Button variant="ghost" size="sm" onClick={() => update(`landing_video_prova_social_${i}`, '')} 
                        className="text-destructive h-8 mt-4">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq">
          <AdminGuideCards tab="landing-faq" />
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => generateWithAI('faq')} disabled={!!generatingAI}
                className="border-primary/30 text-primary hover:bg-primary/10">
                {generatingAI === 'faq' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Gerar FAQ com IA
              </Button>
            </div>
            {[1,2,3,4,5,6].map(i => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-semibold text-sm">FAQ {i}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">Ativa</Label>
                      <Switch checked={settings[`landing_faq${i}_ativa`] !== 'false'}
                        onCheckedChange={v => update(`landing_faq${i}_ativa`, v ? 'true' : 'false')} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Pergunta</Label>
                    <Input value={settings[`landing_faq${i}_pergunta`] || ''} 
                      onChange={e => update(`landing_faq${i}_pergunta`, e.target.value)}
                      className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Resposta</Label>
                    <Textarea value={settings[`landing_faq${i}_resposta`] || ''} 
                      onChange={e => update(`landing_faq${i}_resposta`, e.target.value)}
                      className="min-h-[50px] text-sm" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="w-5 h-5 text-green-500" /> Botão WhatsApp Flutuante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Ativo</Label>
                <Switch checked={settings.landing_whatsapp_flutuante !== 'false'}
                  onCheckedChange={v => update('landing_whatsapp_flutuante', v ? 'true' : 'false')} />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Link do WhatsApp</Label>
                <Input value={settings.landing_whatsapp_link || ''} 
                  onChange={e => update('landing_whatsapp_link', e.target.value)}
                  placeholder="https://wa.me/5511999999999" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Mensagem padrão</Label>
                <Textarea value={settings.landing_whatsapp_mensagem || ''} 
                  onChange={e => update('landing_whatsapp_mensagem', e.target.value)}
                  className="min-h-[60px]" placeholder="Olá! Vim pela landing page..." />
              </div>
              
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <Label className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4 text-green-500" /> Ícone personalizado
                </Label>
                <div className="flex items-center gap-3">
                  <input ref={iconInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handleFileUpload(e, 'icon')} />
                  <Button variant="outline" onClick={() => iconInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Enviar Imagem
                  </Button>
                  {settings.landing_whatsapp_icon_url && (
                    <>
                      <img src={settings.landing_whatsapp_icon_url} alt="icon" className="w-10 h-10 rounded-full object-cover border" />
                      <Button variant="ghost" size="sm" onClick={() => update('landing_whatsapp_icon_url', '')} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VÍDEO */}
        <TabsContent value="video">
          <AdminGuideCards tab="landing-video" />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="w-5 h-5 text-red-500" /> Vídeo de Vendas (VSL)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">URL do Vídeo</Label>
                <Input value={settings.landing_vsl_url || ''} onChange={e => update('landing_vsl_url', e.target.value)}
                  placeholder="https://youtube.com/watch?v=... ou link direto" />
              </div>
              <div className="flex items-center gap-3">
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => handleFileUpload(e, 'video')} />
                <Button variant="outline" onClick={() => videoInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Vídeo (max 50MB)
                </Button>
                {settings.landing_vsl_url && (
                  <Button variant="outline" onClick={() => update('landing_vsl_url', '')}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-1" /> Remover
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
                <div>
                  <Label className="text-sm">Travar até assistir</Label>
                  <p className="text-muted-foreground text-xs">Visitante assiste antes de navegar</p>
                </div>
                <Switch checked={settings.landing_vsl_trava === 'true'}
                  onCheckedChange={v => update('landing_vsl_trava', v ? 'true' : 'false')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes">
          <AdminGuideCards tab="landing-notificacoes" />
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-5 h-5 text-green-500" /> Notificações de Compra (Social Proof)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
                    <Label className="text-sm">Ativas</Label>
                    <Switch checked={settings.landing_notif_ativa !== 'false'}
                      onCheckedChange={v => update('landing_notif_ativa', v ? 'true' : 'false')} />
                  </div>
                  <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
                    <Label className="text-sm">Som</Label>
                    <Switch checked={settings.landing_notif_som !== 'false'}
                      onCheckedChange={v => update('landing_notif_som', v ? 'true' : 'false')} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Intervalo (segundos)</Label>
                  <Input type="number" value={settings.landing_notif_intervalo || '10'} 
                    onChange={e => update('landing_notif_intervalo', e.target.value)}
                    className="w-32" min="5" max="60" />
                </div>
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-primary" />
                      <Label className="font-semibold text-sm">Som Personalizado</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input value={settings.landing_notif_som_url || ''} 
                        onChange={e => update('landing_notif_som_url', e.target.value)}
                        placeholder="https://... ou faça upload" className="flex-1" />
                      {settings.landing_notif_som_url && (
                        <Button variant="ghost" size="sm" onClick={() => update('landing_notif_som_url', '')} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <input ref={soundInputRef} type="file" accept="audio/*" className="hidden"
                        onChange={e => handleFileUpload(e, 'sound')} />
                      <Button variant="outline" size="sm" onClick={() => soundInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Upload Áudio
                      </Button>
                      {settings.landing_notif_som_url && (
                        <Button variant="outline" size="sm" onClick={() => {
                          const audio = new Audio(settings.landing_notif_som_url);
                          audio.volume = 0.3;
                          audio.play().catch(() => {});
                        }}>
                          <Volume2 className="w-4 h-4 mr-1" /> Testar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <div>
                  <Label className="text-muted-foreground text-sm">Ações (uma por linha)</Label>
                  <Textarea 
                    value={settings.landing_notif_acoes || 'acabou de assinar\nacabou de renovar\nfez upgrade para anual\nativou sua conta'} 
                    onChange={e => update('landing_notif_acoes', e.target.value)}
                    className="min-h-[80px] text-sm font-mono" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Nomes (um por linha)</Label>
                  <Textarea value={settings.landing_notif_nomes || ''} onChange={e => update('landing_notif_nomes', e.target.value)}
                    className="min-h-[60px] text-sm font-mono" placeholder="Vazio = lista padrão" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Cidades (uma por linha)</Label>
                  <Textarea value={settings.landing_notif_cidades || ''} onChange={e => update('landing_notif_cidades', e.target.value)}
                    className="min-h-[60px] text-sm font-mono" placeholder="Vazio = lista padrão" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PIXEL ADS - COMPLETAMENTE REDESENHADO */}
        <TabsContent value="pixel">
          <AdminGuideCards tab="landing-pixel" />
          <div className="space-y-4">
            {/* Status Overview */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <Label className="font-bold text-sm">Status dos Pixels</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Meta/Facebook', active: !!settings.landing_pixel_facebook, color: 'blue' },
                    { name: 'Google Ads', active: !!settings.landing_pixel_google, color: 'amber' },
                    { name: 'TikTok', active: !!settings.landing_pixel_tiktok, color: 'pink' },
                  ].map(p => (
                    <div key={p.name} className={`flex items-center gap-2 p-2 rounded-lg border ${p.active ? 'border-green-500/30 bg-green-500/10' : 'border-border bg-muted/20'}`}>
                      <div className={`w-2 h-2 rounded-full ${p.active ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                      <span className={`text-xs font-medium ${p.active ? 'text-green-400' : 'text-muted-foreground'}`}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* URL da Landing */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <Label className="font-semibold text-sm">URL da Landing Page</Label>
                  <Badge variant="outline" className="text-[10px]">Use nos anúncios</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value={landingUrl} readOnly className="font-mono bg-muted/50 text-xs" />
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(landingUrl);
                    toast({ title: "Link copiado! ✅" });
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Cole no campo "URL de destino" do gerenciador de anúncios (Meta, Google ou TikTok).</p>
              </CardContent>
            </Card>

            {/* Internal Pixel / Analytics */}
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-5 h-5 text-violet-400" /> Pixel Interno (Analytics Próprio)
                  <Badge className="bg-green-500/20 text-green-400 border-0 text-[9px]">Automático</Badge>
                </CardTitle>
                <CardDescription>
                  Rastreamento automático integrado — sem precisar de plataformas externas. Registra visitas, cliques no CTA, profundidade de scroll e conversões.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3">
                  <Label className="text-xs font-semibold text-violet-400 mb-2 block">📊 Seu Pixel ID Interno</Label>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-violet-950/30 rounded px-3 py-2 text-sm font-mono text-violet-300">
                      ACS-{`gnrinwqmqhfasfojysep`.slice(0, 8).toUpperCase()}
                    </code>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                      navigator.clipboard.writeText(`ACS-${`gnrinwqmqhfasfojysep`.slice(0, 8).toUpperCase()}`);
                      toast({ title: "Pixel ID copiado! ✅" });
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Este pixel já está ativo na sua landing page automaticamente. Nenhuma configuração necessária.</p>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-3">
                  <Label className="text-xs font-semibold mb-2 block">🎯 Eventos rastreados internamente</Label>
                  <div className="space-y-1.5">
                    {[
                      { event: 'pageview', desc: 'Cada visita na landing page', icon: '👁️' },
                      { event: 'scroll', desc: 'Profundidade de rolagem (25%, 50%, 75%, 100%)', icon: '📜' },
                      { event: 'cta_click', desc: 'Clique nos botões de compra (com plano e valor)', icon: '🎯' },
                      { event: 'section_view', desc: 'Visualização de cada seção da página', icon: '📄' },
                    ].map(ev => (
                      <div key={ev.event} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                        <span>{ev.icon}</span>
                        <code className="text-violet-400 font-mono text-[10px]">{ev.event}</code>
                        <span className="text-muted-foreground">— {ev.desc}</span>
                        <Badge className="ml-auto bg-green-500/20 text-green-400 border-0 text-[9px] h-4">Auto</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-3">
                  <Label className="text-xs font-semibold mb-2 block">📋 Script do Pixel Interno (para outras páginas)</Label>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground">Cole em qualquer outra página para rastrear visitas</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                      const pixelScript = `<!-- AC Service Pro Internal Pixel -->\n<script>\n(function(){\n  var pid='ACS-${`gnrinwqmqhfasfojysep`.slice(0, 8).toUpperCase()}';\n  var vid=localStorage.getItem('ac_visitor_id')||([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)});\n  localStorage.setItem('ac_visitor_id',vid);\n  fetch('${window.location.origin.replace(/\/$/, '')}/rest/v1/page_analytics',{\n    method:'POST',\n    headers:{'Content-Type':'application/json','apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imducmlud3FtcWhmYXNmb2p5c2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjU2MzksImV4cCI6MjA4MDQ0MTYzOX0.bM1CBwE6Bn2fBZrOqQbEuw1fn17NyDY3HlTBkkpCjBs'},\n    body:JSON.stringify({page_url:location.pathname,event_type:'pageview',visitor_id:vid,referrer:document.referrer,user_agent:navigator.userAgent,metadata:{pixel:pid}})\n  });\n})();\n</script>`;
                      navigator.clipboard.writeText(pixelScript);
                      toast({ title: "Script do pixel interno copiado! ✅", description: "Cole na <head> de qualquer página para rastrear visitas." });
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar Script
                    </Button>
                  </div>
                  <pre className="text-[10px] font-mono text-violet-300/70 bg-violet-950/30 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32">{`// Pixel Interno AC Service Pro\n// ID: ACS-${`gnrinwqmqhfasfojysep`.slice(0, 8).toUpperCase()}\n// Rastreia: pageview, scroll, cta_click\n// Dados acessíveis no painel admin`}</pre>
                </div>

                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">💡 O que faz parte da integração:</strong> O pixel interno rastreia automaticamente todas as visitas, 
                    profundidade de scroll, cliques nos CTAs e conversões da sua landing page. Os dados ficam salvos no banco e podem 
                    ser consultados no painel. Diferente dos pixels externos (Meta, Google, TikTok), este é 100% seu — sem depender 
                    de plataformas terceiras.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Platform Tabs */}
            <Card>
              <CardContent className="p-0">
                <div className="flex border-b border-border">
                  {[
                    { key: 'facebook' as const, label: 'Meta Ads', icon: '📘', color: 'text-blue-400 border-blue-400' },
                    { key: 'google' as const, label: 'Google Ads', icon: '📊', color: 'text-amber-400 border-amber-400' },
                    { key: 'tiktok' as const, label: 'TikTok Ads', icon: '🎵', color: 'text-pink-400 border-pink-400' },
                  ].map(p => (
                    <button key={p.key}
                      onClick={() => setPixelTab(p.key)}
                      className={`flex-1 py-3 px-4 text-sm font-medium transition-all border-b-2 ${
                        pixelTab === p.key 
                          ? `${p.color} bg-muted/30` 
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
                      }`}>
                      <span className="mr-1">{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4">
                  {pixelTab === 'facebook' && (
                    <>
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Code className="w-4 h-4 text-blue-400" /> ID do Pixel Meta (Facebook)
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener" className="underline text-blue-400 hover:text-blue-300">Gerenciador de Eventos</a> → Fontes de dados → Pixel → ID
                        </p>
                        <Input value={settings.landing_pixel_facebook || ''} onChange={e => update('landing_pixel_facebook', e.target.value)}
                          placeholder="1234567890123456" className="font-mono" />
                      </div>
                      {settings.landing_pixel_facebook && (
                        <>
                          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-blue-400">📘 Código do Pixel Base</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${settings.landing_pixel_facebook}');\nfbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${settings.landing_pixel_facebook}&ev=PageView&noscript=1"/></noscript>\n<!-- End Meta Pixel Code -->`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código do pixel copiado! ✅" });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-blue-300/70 bg-blue-950/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`fbq('init', '${settings.landing_pixel_facebook}');\nfbq('track', 'PageView');`}</pre>
                          </div>

                          {/* Eventos rastreados */}
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <Label className="text-xs font-semibold mb-2 block">🎯 Eventos rastreados automaticamente</Label>
                            <div className="space-y-1.5">
                              {[
                                { event: 'PageView', desc: 'Quando a página carrega', icon: '👁️' },
                                { event: 'ViewContent', desc: 'Quando o visitante vê as seções', icon: '📄' },
                                { event: 'Lead', desc: 'Quando clica no botão de compra', icon: '🎯' },
                                { event: 'InitiateCheckout', desc: 'Quando é redirecionado ao checkout', icon: '🛒' },
                              ].map(ev => (
                                <div key={ev.event} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                                  <span>{ev.icon}</span>
                                  <code className="text-blue-400 font-mono text-[10px]">{ev.event}</code>
                                  <span className="text-muted-foreground">— {ev.desc}</span>
                                  <Badge className="ml-auto bg-green-500/20 text-green-400 border-0 text-[9px] h-4">Auto</Badge>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Código de conversão para copiar */}
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs font-semibold">🔥 Código de Conversão (para Thank You Page)</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- Evento de Conversão Meta -->\n<script>\nfbq('track', 'Purchase', {\n  value: 0.00,\n  currency: 'BRL',\n  content_name: 'AC Service Pro'\n});\n</script>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código de conversão copiado! ✅", description: "Cole na página de obrigado da sua plataforma de checkout." });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`fbq('track', 'Purchase', {\n  value: 0.00,\n  currency: 'BRL'\n});`}</pre>
                            <p className="text-[10px] text-muted-foreground mt-2">💡 Cole esse código na página de "Obrigado" do seu checkout para rastrear vendas finalizadas.</p>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {pixelTab === 'google' && (
                    <>
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Code className="w-4 h-4 text-amber-400" /> ID do Google Ads / GA4
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          <a href="https://ads.google.com" target="_blank" rel="noopener" className="underline text-amber-400 hover:text-amber-300">Google Ads</a> → Ferramentas → Conversões → Tag ID (ex: AW-123456789 ou G-XXXXXXX)
                        </p>
                        <Input value={settings.landing_pixel_google || ''} onChange={e => update('landing_pixel_google', e.target.value)}
                          placeholder="AW-123456789 ou G-XXXXXXX" className="font-mono" />
                      </div>
                      {settings.landing_pixel_google && (
                        <>
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-amber-400">📊 Código gtag.js Base</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.landing_pixel_google}"></script>\n<script>\nwindow.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${settings.landing_pixel_google}');\n</script>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código Google copiado! ✅" });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-amber-300/70 bg-amber-950/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`gtag('config', '${settings.landing_pixel_google}');`}</pre>
                          </div>

                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <Label className="text-xs font-semibold mb-2 block">🎯 Eventos rastreados automaticamente</Label>
                            <div className="space-y-1.5">
                              {[
                                { event: 'page_view', desc: 'Quando a página carrega', icon: '👁️' },
                                { event: 'view_item', desc: 'Quando vê seções da landing', icon: '📄' },
                                { event: 'generate_lead', desc: 'Quando clica no CTA', icon: '🎯' },
                                { event: 'begin_checkout', desc: 'Redirecionamento ao checkout', icon: '🛒' },
                              ].map(ev => (
                                <div key={ev.event} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                                  <span>{ev.icon}</span>
                                  <code className="text-amber-400 font-mono text-[10px]">{ev.event}</code>
                                  <span className="text-muted-foreground">— {ev.desc}</span>
                                  <Badge className="ml-auto bg-green-500/20 text-green-400 border-0 text-[9px] h-4">Auto</Badge>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs font-semibold">🔥 Código de Conversão Google</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- Google Ads Conversion -->\n<script>\ngtag('event', 'purchase', {\n  send_to: '${settings.landing_pixel_google}/CONVERSION_LABEL',\n  value: 0.00,\n  currency: 'BRL',\n  transaction_id: ''\n});\n</script>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código de conversão copiado! ✅" });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`gtag('event', 'purchase', {\n  send_to: '${settings.landing_pixel_google}/LABEL',\n  value: 0.00, currency: 'BRL'\n});`}</pre>
                            <p className="text-[10px] text-muted-foreground mt-2">💡 Substitua CONVERSION_LABEL pelo rótulo da conversão criada no Google Ads.</p>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {pixelTab === 'tiktok' && (
                    <>
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Code className="w-4 h-4 text-pink-400" /> ID do Pixel TikTok
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          <a href="https://ads.tiktok.com" target="_blank" rel="noopener" className="underline text-pink-400 hover:text-pink-300">TikTok Ads Manager</a> → Ativos → Eventos → Gerenciar → Pixel ID
                        </p>
                        <Input value={settings.landing_pixel_tiktok || ''} onChange={e => update('landing_pixel_tiktok', e.target.value)}
                          placeholder="ABCDEF123456" className="font-mono" />
                      </div>
                      {settings.landing_pixel_tiktok && (
                        <>
                          <div className="rounded-lg bg-pink-500/10 border border-pink-500/20 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-pink-400">🎵 Código do Pixel TikTok</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- TikTok Pixel Code -->\n<script>\n!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${settings.landing_pixel_tiktok}');ttq.page();}(window,document,'ttq');\n</script>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código TikTok copiado! ✅" });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-pink-300/70 bg-pink-950/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`ttq.load('${settings.landing_pixel_tiktok}');\nttq.page();`}</pre>
                          </div>

                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <Label className="text-xs font-semibold mb-2 block">🎯 Eventos rastreados automaticamente</Label>
                            <div className="space-y-1.5">
                              {[
                                { event: 'PageView', desc: 'Quando a página carrega', icon: '👁️' },
                                { event: 'ViewContent', desc: 'Quando vê seções da landing', icon: '📄' },
                                { event: 'SubmitForm', desc: 'Quando clica no CTA', icon: '🎯' },
                                { event: 'InitiateCheckout', desc: 'Redirecionamento ao checkout', icon: '🛒' },
                              ].map(ev => (
                                <div key={ev.event} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                                  <span>{ev.icon}</span>
                                  <code className="text-pink-400 font-mono text-[10px]">{ev.event}</code>
                                  <span className="text-muted-foreground">— {ev.desc}</span>
                                  <Badge className="ml-auto bg-green-500/20 text-green-400 border-0 text-[9px] h-4">Auto</Badge>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs font-semibold">🔥 Código de Conversão TikTok</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const code = `<!-- TikTok Conversion -->\n<script>\nttq.track('CompletePayment', {\n  value: 0.00,\n  currency: 'BRL',\n  content_name: 'AC Service Pro'\n});\n</script>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: "Código de conversão copiado! ✅" });
                              }}>
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                            <pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`ttq.track('CompletePayment', {\n  value: 0.00, currency: 'BRL'\n});`}</pre>
                            <p className="text-[10px] text-muted-foreground mt-2">💡 Cole na página de "Obrigado" do checkout para rastrear vendas.</p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Full Head Code Generator */}
            {(settings.landing_pixel_facebook || settings.landing_pixel_google || settings.landing_pixel_tiktok) && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="w-5 h-5 text-green-400" /> Código Completo para &lt;head&gt;
                    </CardTitle>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                      navigator.clipboard.writeText(getPixelHeadCode());
                      toast({ title: "Código completo copiado! ✅", description: "Cole na tag <head> do seu site ou gerenciador de anúncios." });
                    }}>
                      <Copy className="w-4 h-4 mr-2" /> Copiar Tudo
                    </Button>
                  </div>
                  <CardDescription>Todos os pixels combinados. Use no Google Tag Manager ou cole direto no &lt;head&gt;.</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted/50 border border-border rounded-lg p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                    {getPixelHeadCode()}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Resumo de como funciona */}
            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold text-sm flex items-center gap-2">⚡ Como funciona o rastreamento</Label>
                <div className="space-y-2">
                  {[
                    { step: '1', title: 'Cole o ID do pixel', desc: 'Pegue o ID na plataforma de ads e cole acima' },
                    { step: '2', title: 'Salve as configurações', desc: 'Clique em "Salvar Tudo" — o pixel é injetado automaticamente' },
                    { step: '3', title: 'Eventos são disparados', desc: 'PageView, ViewContent, Lead e InitiateCheckout são automáticos' },
                    { step: '4', title: 'Conversão na Thank You Page', desc: 'Copie o código de conversão e cole na página pós-compra do checkout' },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
                      <div>
                        <span className="text-xs font-medium text-foreground">{s.title}</span>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EFEITOS - NOVA ABA */}
        <TabsContent value="efeitos">
          <div className="space-y-4">
            {/* Toggle geral animações */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-primary" /> Controle de Animações
                </CardTitle>
                <CardDescription>Ative ou desative animações e efeitos visuais da landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Animações de Scroll (ScrollReveal)</Label>
                    <p className="text-xs text-muted-foreground">Efeitos de entrada ao rolar a página</p>
                  </div>
                  <Switch checked={settings.landing_scroll_reveal !== 'false'}
                    onCheckedChange={v => update('landing_scroll_reveal', v ? 'true' : 'false')} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Todas as animações</Label>
                    <p className="text-xs text-muted-foreground">Desativa bounce, pulse, gradientes animados, etc.</p>
                  </div>
                  <Switch checked={settings.landing_animacoes_ativas !== 'false'}
                    onCheckedChange={v => update('landing_animacoes_ativas', v ? 'true' : 'false')} />
                </div>
              </CardContent>
            </Card>

            {/* Marquee Banners */}
            {[1, 2, 3].map(num => {
              const prefix = `landing_marquee${num}`;
              const isActive = settings[`${prefix}_ativo`] === 'true';
              return (
                <Card key={num} className={isActive ? 'border-primary/30' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="w-5 h-5 text-primary" /> Banner Marquee #{num}
                      </CardTitle>
                      <Switch checked={isActive}
                        onCheckedChange={v => update(`${prefix}_ativo`, v ? 'true' : 'false')} />
                    </div>
                    <CardDescription>Texto animado passando na tela estilo banner cruzado</CardDescription>
                  </CardHeader>
                  {isActive && (
                    <CardContent className="space-y-4">
                      {/* Tipo de conteúdo */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Tipo de conteúdo</Label>
                        <Select value={settings[`${prefix}_tipo`] || 'texto'} onValueChange={v => update(`${prefix}_tipo`, v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="texto">✏️ Texto livre</SelectItem>
                            <SelectItem value="clientes">👥 Nomes de clientes</SelectItem>
                            <SelectItem value="fornecedores">🏭 Fornecedores</SelectItem>
                            <SelectItem value="misto">🔀 Misto (texto + dados)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Textos (separados por |) */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Textos (separe com |)</Label>
                        <Textarea value={settings[`${prefix}_textos`] || ''} onChange={e => update(`${prefix}_textos`, e.target.value)}
                          placeholder="🔥 PROMOÇÃO 50% OFF | ❄️ Instalação Grátis | ⚡ Últimas vagas"
                          className="min-h-[60px]" />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {settings[`${prefix}_tipo`] === 'clientes' ? '💡 Deixe vazio para exibir automaticamente nomes de clientes do sistema' :
                           settings[`${prefix}_tipo`] === 'fornecedores' ? '💡 Deixe vazio para exibir automaticamente fornecedores do sistema' :
                           '💡 Use | para separar cada item do banner'}
                        </p>
                      </div>

                      {/* Posição */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Posição na página</Label>
                        <Select value={settings[`${prefix}_posicao`] || 'hero-below'} onValueChange={v => update(`${prefix}_posicao`, v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">⬆️ Topo da página (fixo)</SelectItem>
                            <SelectItem value="hero-below">🏠 Abaixo do Hero</SelectItem>
                            <SelectItem value="above-prices">💰 Acima dos Preços</SelectItem>
                            <SelectItem value="bottom">⬇️ Rodapé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Direção */}
                        <div>
                          <Label className="text-muted-foreground text-sm">Direção</Label>
                          <Select value={settings[`${prefix}_direcao`] || 'left'} onValueChange={v => update(`${prefix}_direcao`, v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">← Esquerda</SelectItem>
                              <SelectItem value="right">→ Direita</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Velocidade */}
                        <div>
                          <Label className="text-muted-foreground text-sm">Velocidade</Label>
                          <Select value={settings[`${prefix}_velocidade`] || 'normal'} onValueChange={v => update(`${prefix}_velocidade`, v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="slow">🐢 Lenta</SelectItem>
                              <SelectItem value="normal">🚶 Normal</SelectItem>
                              <SelectItem value="fast">🏃 Rápida</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ColorInput label="Cor de fundo" value={settings[`${prefix}_cor_fundo`] || '#06b6d4'} onChange={v => update(`${prefix}_cor_fundo`, v)} />
                        <ColorInput label="Cor do texto" value={settings[`${prefix}_cor_texto`] || '#ffffff'} onChange={v => update(`${prefix}_cor_texto`, v)} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Estilo */}
                        <div>
                          <Label className="text-muted-foreground text-sm">Estilo visual</Label>
                          <Select value={settings[`${prefix}_estilo`] || 'solid'} onValueChange={v => update(`${prefix}_estilo`, v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solid">⬛ Sólido</SelectItem>
                              <SelectItem value="gradient">🌈 Gradiente</SelectItem>
                              <SelectItem value="glass">🔮 Glass (vidro)</SelectItem>
                              <SelectItem value="neon">💡 Neon</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Tamanho */}
                        <div>
                          <Label className="text-muted-foreground text-sm">Tamanho do texto</Label>
                          <Select value={settings[`${prefix}_tamanho`] || 'md'} onValueChange={v => update(`${prefix}_tamanho`, v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sm">Pequeno</SelectItem>
                              <SelectItem value="md">Médio</SelectItem>
                              <SelectItem value="lg">Grande</SelectItem>
                              <SelectItem value="xl">Extra Grande</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Separador */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Separador entre itens</Label>
                        <Select value={settings[`${prefix}_separador`] || '✦'} onValueChange={v => update(`${prefix}_separador`, v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="✦">✦ Estrela</SelectItem>
                            <SelectItem value="•">• Ponto</SelectItem>
                            <SelectItem value="⚡">⚡ Raio</SelectItem>
                            <SelectItem value="❄️">❄️ Floco</SelectItem>
                            <SelectItem value="|">| Barra</SelectItem>
                            <SelectItem value="—">— Travessão</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preview */}
                      <div className="rounded-xl overflow-hidden border border-border">
                        <div className="overflow-hidden py-2" style={{ backgroundColor: settings[`${prefix}_cor_fundo`] || '#06b6d4' }}>
                          <div className="flex items-center gap-4 animate-marquee-preview whitespace-nowrap text-sm" style={{ color: settings[`${prefix}_cor_texto`] || '#fff' }}>
                            {(settings[`${prefix}_textos`] || '🔥 Texto de exemplo | ❄️ Segundo texto').split('|').map((t: string, i: number) => (
                              <span key={i} className="font-medium px-2">{t.trim()} {settings[`${prefix}_separador`] || '✦'}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Info */}
            <Card className="border-border">
              <CardContent className="p-4">
                <Label className="font-semibold text-sm flex items-center gap-2 mb-2">💡 Dicas de efeitos</Label>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li>• <strong>Marquee #1 + posição "hero-below"</strong>: Banner com promoções logo após o título principal</li>
                  <li>• <strong>Marquee #2 + posição "above-prices"</strong>: Destaque antes dos preços para criar urgência</li>
                  <li>• <strong>Marquee #3 + tipo "clientes"</strong>: Exiba nomes de clientes como prova social automática</li>
                  <li>• <strong>Estilo Neon</strong>: Efeito luminoso ideal para fundos escuros</li>
                  <li>• <strong>Estilo Glass</strong>: Efeito transparente sofisticado com blur</li>
                  <li>• Combine direções opostas em marquees diferentes para efeito dinâmico</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BACKGROUND / FUNDO */}
        <TabsContent value="background">
          <AdminGuideCards tab="landing-background" />
          <div className="space-y-4">
            {/* Imagem de fundo global */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImagePlus className="w-5 h-5 text-primary" /> Imagem de Fundo Global
                </CardTitle>
                <CardDescription>Imagem de fundo aplicada em toda a landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.landing_bg_image_url && (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={settings.landing_bg_image_url} alt="Background" className="w-full h-48 object-cover" />
                    <Button variant="destructive" size="sm" className="absolute top-2 right-2" 
                      onClick={() => update('landing_bg_image_url', '')}>
                      <Trash2 className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={settings.landing_bg_image_url || ''} onChange={e => update('landing_bg_image_url', e.target.value)}
                    placeholder="URL da imagem ou faça upload" className="flex-1" />
                  <Button variant="outline" onClick={() => handleBgUpload('landing_bg_image_url')} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Opacidade do overlay ({settings.landing_bg_overlay_opacity || '70'}%)</Label>
                  <input type="range" min="0" max="100" value={settings.landing_bg_overlay_opacity || '70'}
                    onChange={e => update('landing_bg_overlay_opacity', e.target.value)}
                    className="w-full mt-1" />
                </div>
              </CardContent>
            </Card>

            {/* Efeitos Visuais */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-violet-500" /> Efeitos Visuais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Partículas interativas</Label>
                    <p className="text-xs text-muted-foreground">Efeito de partículas flutuantes no fundo</p>
                  </div>
                  <Switch checked={settings.landing_bg_particles !== 'false'}
                    onCheckedChange={v => update('landing_bg_particles', v ? 'true' : 'false')} />
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">Efeito de Fundo</Label>
                  <Select value={settings.landing_bg_effect || 'none'} onValueChange={v => update('landing_bg_effect', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (cor sólida)</SelectItem>
                      <SelectItem value="grid">🔲 Grade/Mesh</SelectItem>
                      <SelectItem value="gradient">🌈 Gradiente animado</SelectItem>
                      <SelectItem value="dots">⚪ Pontos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(settings.landing_bg_effect === 'grid' || settings.landing_bg_effect === 'dots') && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <ColorInput label="Cor da Grade/Pontos" value={settings.landing_bg_grid_color || '#6366f1'} onChange={v => update('landing_bg_grid_color', v)} />
                    <div>
                      <Label className="text-muted-foreground text-xs">Opacidade ({settings.landing_bg_grid_opacity || '15'}%)</Label>
                      <input type="range" min="5" max="50" value={settings.landing_bg_grid_opacity || '15'}
                        onChange={e => update('landing_bg_grid_opacity', e.target.value)} className="w-full mt-1" />
                    </div>
                    <ColorInput label="Cor do Brilho/Glow" value={settings.landing_bg_glow_color || '#7c3aed'} onChange={v => update('landing_bg_glow_color', v)} />
                  </div>
                )}

                {settings.landing_bg_effect === 'gradient' && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <ColorInput label="Cor do Gradiente 1" value={settings.landing_bg_grid_color || '#6366f1'} onChange={v => update('landing_bg_grid_color', v)} />
                    <ColorInput label="Cor do Gradiente 2" value={settings.landing_bg_glow_color || '#7c3aed'} onChange={v => update('landing_bg_glow_color', v)} />
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground text-sm">Velocidade das animações</Label>
                  <Select value={settings.landing_anim_speed || 'normal'} onValueChange={v => update('landing_anim_speed', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Lenta</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="fast">Rápida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview do efeito */}
                {settings.landing_bg_effect && settings.landing_bg_effect !== 'none' && (
                  <div className="rounded-xl overflow-hidden border border-border relative" style={{ height: '120px', background: settings.landing_cor_fundo || '#0f172a' }}>
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                      Preview: {settings.landing_bg_effect === 'grid' ? 'Grade/Mesh' : settings.landing_bg_effect === 'dots' ? 'Pontos' : 'Gradiente'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visibilidade das Seções */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-5 h-5 text-emerald-500" /> Visibilidade das Seções
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'landing_secao_hero', label: '🏠 Hero (Topo)' },
                  { key: 'landing_secao_dor', label: '😰 Seção de Dor (Problemas)' },
                  { key: 'landing_secao_features', label: '⚡ Funcionalidades' },
                  { key: 'landing_secao_comparativo', label: '📊 Comparativo' },
                  { key: 'landing_secao_precos', label: '💰 Preços' },
                  { key: 'landing_secao_depoimentos', label: '💬 Depoimentos' },
                  { key: 'landing_secao_faq', label: '❓ FAQ' },
                  { key: 'landing_secao_garantia', label: '🛡️ Garantia' },
                  { key: 'landing_secao_urgencia_final', label: '⚠️ Urgência Final' },
                  { key: 'landing_secao_cta_final', label: '🎯 CTA Final' },
                ].map(s => (
                  <div key={s.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-sm font-medium">{s.label}</span>
                    <Switch checked={settings[s.key] !== 'false'}
                      onCheckedChange={v => update(s.key, v ? 'true' : 'false')} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Fundos por Seção */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Image className="w-5 h-5 text-violet-500" /> Fundos por Seção
                </CardTitle>
                <CardDescription>Imagens de fundo específicas para cada seção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'landing_hero_bg_image', label: 'Fundo do Hero (Topo)' },
                  { key: 'landing_precos_bg_image', label: 'Fundo dos Preços' },
                  { key: 'landing_depoimentos_bg_image', label: 'Fundo dos Depoimentos' },
                ].map(s => (
                  <div key={s.key} className="space-y-2">
                    <Label className="text-muted-foreground text-sm">{s.label}</Label>
                    <div className="flex gap-2">
                      <Input value={settings[s.key] || ''} onChange={e => update(s.key, e.target.value)}
                        placeholder="URL da imagem" className="flex-1" />
                      <Button variant="outline" size="icon" onClick={() => handleBgUpload(s.key)} disabled={uploading}>
                        <Upload className="w-4 h-4" />
                      </Button>
                      {settings[s.key] && (
                        <Button variant="outline" size="icon" onClick={() => update(s.key, '')} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {settings[s.key] && (
                      <img src={settings[s.key]} alt={s.label} className="w-full h-24 object-cover rounded-lg border border-border" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EXTRAS */}
        <TabsContent value="extras">
          <AdminGuideCards tab="landing-extras" />
          <div className="space-y-4">
            {/* Banner Promocional */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="w-5 h-5 text-primary" /> Banner Promocional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <Label className="text-sm">Banner Ativo</Label>
                  <Switch checked={settings.landing_banner_ativo === 'true'}
                    onCheckedChange={v => update('landing_banner_ativo', v ? 'true' : 'false')} />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Texto do Banner</Label>
                  <Input value={settings.landing_banner_texto || ''} onChange={e => update('landing_banner_texto', e.target.value)}
                    placeholder="🔥 Promoção especial: 50% OFF no primeiro mês!" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Cor do Banner" value={settings.landing_banner_cor || '#ef4444'} onChange={v => update('landing_banner_cor', v)} />
                  <div>
                    <Label className="text-muted-foreground text-xs">Link (opcional)</Label>
                    <Input value={settings.landing_banner_link || ''} onChange={e => update('landing_banner_link', e.target.value)}
                      placeholder="https://..." className="h-8 text-sm" />
                  </div>
                </div>
                {settings.landing_banner_ativo === 'true' && settings.landing_banner_texto && (
                  <div className="rounded-lg p-3 text-center text-white text-sm font-medium" style={{ background: settings.landing_banner_cor || '#ef4444' }}>
                    {settings.landing_banner_texto}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="w-5 h-5 text-orange-500" /> Contador Regressivo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Texto</Label>
                  <Input value={settings.landing_countdown_texto || ''} onChange={e => update('landing_countdown_texto', e.target.value)} />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Badge Desconto</Label>
                  <Input value={settings.landing_countdown_desconto || ''} onChange={e => update('landing_countdown_desconto', e.target.value)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="w-5 h-5 text-amber-500" /> Prova Social & Garantia
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'landing_social_proof_count', label: 'Qtd Técnicos', ph: '500' },
                  { key: 'landing_social_proof_rating', label: 'Nota', ph: '4.9' },
                  { key: 'landing_garantia_dias', label: 'Dias Garantia', ph: '7' },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-muted-foreground text-sm">{f.label}</Label>
                    <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} placeholder={f.ph} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LANDING CONFIG */}
        <TabsContent value="checkout">
          <div className="space-y-4">
            {/* Toggle ativar landing */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Ativar Landing Page
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ative ou desative a landing page pública do sistema. Quando desativada, visitantes verão apenas a tela de login.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Landing Page Ativa</p>
                    <p className="text-xs text-muted-foreground">Os visitantes poderão ver sua página de vendas</p>
                  </div>
                  <Switch 
                    checked={settings.landing_checkout_ativo !== 'false'} 
                    onCheckedChange={v => update('landing_checkout_ativo', v ? 'true' : 'false')} 
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Redirecionar para o sistema após pagamento</p>
                    <p className="text-xs text-muted-foreground">O webhook reconhece o pagamento e libera o acesso automaticamente</p>
                  </div>
                  <Switch 
                    checked={settings.landing_checkout_redirect_sistema !== 'false'} 
                    onCheckedChange={v => update('landing_checkout_redirect_sistema', v ? 'true' : 'false')} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Checkout info */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    <strong>💳 Links de Checkout:</strong> Todos os links de checkout e preços são configurados exclusivamente na aba <strong>Integrações → Checkout</strong>. A landing page, tela de ativação e webhook puxam automaticamente de lá.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Fluxo de Pagamento
                  </h4>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Cliente clica no botão de compra na landing page</li>
                    <li>É redirecionado para a plataforma de pagamento configurada na aba Integrações</li>
                    <li>Após pagar, o webhook recebe a confirmação automaticamente</li>
                    <li>A assinatura é ativada e o acesso ao sistema é liberado</li>
                    <li>Você recebe uma notificação no painel admin</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Suporte */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  Mensagem de Suporte
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure a mensagem de suporte que aparece na landing page para visitantes.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mensagem do WhatsApp Flutuante</Label>
                  <Input 
                    value={settings.landing_whatsapp_mensagem || ''} 
                    onChange={e => update('landing_whatsapp_mensagem', e.target.value)} 
                    placeholder="Olá! Preciso de ajuda com o sistema..." 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Link do WhatsApp</Label>
                  <Input 
                    value={settings.landing_whatsapp_link || ''} 
                    onChange={e => update('landing_whatsapp_link', e.target.value)} 
                    placeholder="https://wa.me/5511999999999" 
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Botão WhatsApp Flutuante</p>
                    <p className="text-xs text-muted-foreground">Exibir botão de WhatsApp na landing page</p>
                  </div>
                  <Switch 
                    checked={settings.landing_whatsapp_flutuante === 'true'} 
                    onCheckedChange={v => update('landing_whatsapp_flutuante', v ? 'true' : 'false')} 
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
        </div>{/* end editor panel */}

        {/* Sticky Preview Panel */}
        {showPreview && (
          <div>
            <div className="sticky top-4 space-y-2">
              <Card className="overflow-hidden border-primary/20">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-primary" /> Preview em Tempo Real
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">ao vivo</span>
                    <Button size="sm" variant="ghost" onClick={() => setPreviewKey(prev => prev + 1)} className="h-6 w-6 p-0 ml-1">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="relative bg-muted/30" style={{ height: '520px' }}>
                  <iframe 
                    key={previewKey}
                    src={`/vendas?preview=true&t=${previewKey}`}
                    className="w-full h-full border-0"
                    style={{ transform: 'scale(0.27)', transformOrigin: 'top left', width: '370%', height: '370%' }}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
                <div className="px-3 py-2 border-t border-border bg-muted/30 flex gap-1">
                  <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => window.open('/vendas', '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setPreviewKey(prev => prev + 1)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Recarregar
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>{/* end grid */}
    </div>
  );
};

export default AdminLandingTab;
