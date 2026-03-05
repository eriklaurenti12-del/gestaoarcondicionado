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
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Loader2, DollarSign, Type, Star, Shield, Megaphone, RefreshCw, 
  Palette, Clock, Bell, Gift, MessageSquare, Eye, MessageCircle, 
  HelpCircle, Video, Layout, Upload, Trash2, Plus, ChevronDown, ChevronUp,
  Image, Volume2, Target, ImagePlus
} from "lucide-react";

const LANDING_KEYS = [
  'landing_preco_mensal', 'landing_preco_anual', 'landing_preco_anual_original',
  'landing_economia_anual', 'landing_preco_mensal_equivalente',
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
    { id: 'custom', name: '🛠️ Criar do Zero', desc: 'Página totalmente personalizada.',
      sections: ['Título Livre', 'Seções Livres', 'CTA Personalizado', 'Layout Aberto'],
      color: 'border-pink-500', gradient: 'from-pink-500/20 to-purple-500/20' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Megaphone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Editor da Landing Page</h2>
            <p className="text-muted-foreground text-sm">Edite textos, cores, FAQ, WhatsApp, vídeo e templates</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => {
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
            <RefreshCw className="w-4 h-4 mr-2" /> Restaurar
          </Button>
          <Button variant="outline" onClick={() => window.open('/vendas', '_blank')}>
            <Eye className="w-4 h-4 mr-2" /> Abrir Landing
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

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
          <TabsTrigger value="pixel" className="text-xs"><Target className="w-3 h-3 mr-1" />Pixel Ads</TabsTrigger>
          <TabsTrigger value="background" className="text-xs"><ImagePlus className="w-3 h-3 mr-1" />Fundo</TabsTrigger>
          <TabsTrigger value="extras" className="text-xs"><Star className="w-3 h-3 mr-1" />Extras</TabsTrigger>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templateOptions.map(tmpl => (
                  <div key={tmpl.id}
                    className={`rounded-xl border-2 p-4 transition-all ${
                      settings.landing_template === tmpl.id 
                        ? `${tmpl.color} bg-accent/50 shadow-lg` 
                        : 'border-border hover:border-muted-foreground/30'
                    }`}>
                    <div className={`bg-gradient-to-br ${tmpl.gradient} rounded-lg p-3 mb-3 border border-border/50`}>
                      <div className="space-y-1.5">
                        {tmpl.sections.map((section, i) => (
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
                    <div className="flex gap-2">
                      <Button size="sm" variant={settings.landing_template === tmpl.id ? "default" : "outline"}
                        onClick={() => update('landing_template', tmpl.id)} className="flex-1">
                        {settings.landing_template === tmpl.id ? '✓ Ativo' : 'Selecionar'}
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => { update('landing_template', tmpl.id); saveAll().then(() => { window.open('/vendas', '_blank'); }); }}>
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Instant Preview */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" /> Pré-visualização Instantânea
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewKey(prev => prev + 1)} className="h-7">
                    <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
                  </Button>
                </div>
                <div className="rounded-xl overflow-hidden border border-border bg-black relative" style={{ height: '500px' }}>
                  <iframe 
                    key={previewKey}
                    src={`/vendas?preview=true&t=${previewKey}`}
                    className="w-full h-full border-0"
                    style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '222%', height: '222%' }}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTOS */}
        <TabsContent value="textos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="w-5 h-5 text-primary" /> Textos Principais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'landing_hero_titulo', label: 'Título Principal' },
                { key: 'landing_hero_subtitulo', label: 'Subtítulo' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-muted-foreground text-sm">{f.label}</Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                </div>
              ))}
              <div>
                <Label className="text-muted-foreground text-sm">Descrição do Hero</Label>
                <Textarea value={settings.landing_hero_descricao || ''} onChange={e => update('landing_hero_descricao', e.target.value)}
                  className="min-h-[80px]" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Frase de Destaque</Label>
                <Textarea value={settings.landing_frase_destaque || ''} onChange={e => update('landing_frase_destaque', e.target.value)}
                  className="min-h-[60px]" />
              </div>
              {[
                { key: 'landing_badge_urgencia', label: 'Badge de Urgência' },
                { key: 'landing_btn_cta_texto', label: 'Texto do Botão CTA' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-muted-foreground text-sm">{f.label}</Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREÇOS */}
        <TabsContent value="precos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-5 h-5 text-green-500" /> Preços dos Planos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <h4 className="text-primary font-semibold text-sm">💳 Plano Mensal</h4>
                  <div>
                    <Label className="text-muted-foreground text-sm">Preço (R$)</Label>
                    <Input value={settings.landing_preco_mensal || ''} onChange={e => update('landing_preco_mensal', e.target.value)}
                      placeholder="39,90" />
                  </div>
                </div>
                <div className="bg-muted/30 border border-primary/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-amber-500 font-semibold text-sm">⭐ Plano Anual</h4>
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
            {[1, 2].map(i => {
              const isActive = settings[`landing_oferta${i}_ativa`] !== 'false';
              const features = (settings[`landing_oferta${i}_features`] || '').split('\n').filter(Boolean);
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
                    {!isActive && (
                      <p className="text-xs text-amber-500 mt-1">⚠️ Este plano está oculto na landing page e no checkout</p>
                    )}
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
                      <p className="text-xs text-muted-foreground mt-1">Cada linha vira um item com ✓ na landing page</p>
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <ul className="space-y-1.5">
                        {(settings[`landing_oferta${i}_features`] || defaultFeatures.join('\n')).split('\n').filter(Boolean).map((f: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="text-green-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* DEPOIMENTOS */}
        <TabsContent value="depoimentos">
          <div className="space-y-4">
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
                <CardDescription className="text-xs">
                  Adicione até 3 vídeos de clientes reais (YouTube, Vimeo ou link direto)
                </CardDescription>
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
          <div className="space-y-3">
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
                      <img src={settings.landing_whatsapp_icon_url} alt="icon" className="w-12 h-12 rounded-full object-cover border-2 border-green-500/30" />
                      <Button variant="ghost" size="sm" onClick={() => update('landing_whatsapp_icon_url', '')}
                        className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VIDEO */}
        <TabsContent value="video">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="w-5 h-5 text-red-500" /> Vídeo de Vendas (VSL)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">URL do Vídeo</Label>
                <Input value={settings.landing_vsl_url || ''} 
                  onChange={e => update('landing_vsl_url', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="flex gap-2">
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
              {settings.landing_vsl_url && (
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-muted-foreground text-xs mb-2">Preview:</p>
                  {settings.landing_vsl_url.includes('youtube') || settings.landing_vsl_url.includes('youtu.be') ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe src={settings.landing_vsl_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                        className="w-full h-full" allowFullScreen />
                    </div>
                  ) : settings.landing_vsl_url.includes('vimeo') ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe src={settings.landing_vsl_url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                        className="w-full h-full" allowFullScreen />
                    </div>
                  ) : (
                    <video src={settings.landing_vsl_url} controls className="w-full rounded-lg max-h-64" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES - Dedicated tab */}
        <TabsContent value="notificacoes">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-5 h-5 text-green-500" /> Notificações de Compra (Social Proof)
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize as notificações de compra que aparecem na landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggles */}
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

                {/* Intervalo */}
                <div>
                  <Label className="text-muted-foreground text-sm">Intervalo entre notificações (segundos)</Label>
                  <Input type="number" value={settings.landing_notif_intervalo || '10'} 
                    onChange={e => update('landing_notif_intervalo', e.target.value)}
                    className="w-32" min="5" max="60" />
                  <p className="text-xs text-muted-foreground mt-1">De 5 a 60 segundos entre cada notificação</p>
                </div>

                {/* Som personalizado */}
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-primary" />
                      <Label className="font-semibold text-sm">Som Personalizado</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anexe um arquivo de áudio (.mp3, .wav, .ogg) ou cole uma URL. Deixe vazio para usar o som padrão do sistema.
                    </p>
                    <div className="flex items-center gap-3">
                      <Input value={settings.landing_notif_som_url || ''} 
                        onChange={e => update('landing_notif_som_url', e.target.value)}
                        placeholder="https://... ou faça upload abaixo" className="flex-1" />
                      {settings.landing_notif_som_url && (
                        <Button variant="ghost" size="sm" onClick={() => update('landing_notif_som_url', '')}
                          className="text-destructive">
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
                          <Volume2 className="w-4 h-4 mr-1" /> Testar Som
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Ações */}
                <div>
                  <Label className="text-muted-foreground text-sm">Ações das Notificações (uma por linha)</Label>
                  <Textarea 
                    value={settings.landing_notif_acoes || 'acabou de assinar\nacabou de renovar\nfez upgrade para anual\nativou sua conta'} 
                    onChange={e => update('landing_notif_acoes', e.target.value)}
                    className="min-h-[80px] text-sm font-mono"
                    placeholder="acabou de assinar&#10;acabou de renovar&#10;fez upgrade para anual&#10;ativou sua conta" />
                  <p className="text-xs text-muted-foreground mt-1">Cada linha será uma ação diferente exibida nas notificações</p>
                </div>

                {/* Nomes */}
                <div>
                  <Label className="text-muted-foreground text-sm">Nomes (um por linha) — deixe vazio para usar padrão</Label>
                  <Textarea 
                    value={settings.landing_notif_nomes || ''} 
                    onChange={e => update('landing_notif_nomes', e.target.value)}
                    className="min-h-[80px] text-sm font-mono"
                    placeholder="João Silva&#10;Maria Santos&#10;Pedro Oliveira..." />
                  <p className="text-xs text-muted-foreground mt-1">Nomes fictícios para exibir. Vazio = lista padrão de 60 nomes</p>
                </div>

                {/* Cidades */}
                <div>
                  <Label className="text-muted-foreground text-sm">Cidades (uma por linha) — deixe vazio para usar padrão</Label>
                  <Textarea 
                    value={settings.landing_notif_cidades || ''} 
                    onChange={e => update('landing_notif_cidades', e.target.value)}
                    className="min-h-[80px] text-sm font-mono"
                    placeholder="São Paulo&#10;Rio de Janeiro&#10;Belo Horizonte..." />
                  <p className="text-xs text-muted-foreground mt-1">Cidades para exibir. Vazio = lista padrão de 50 cidades</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PIXEL ADS */}
        <TabsContent value="pixel">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5 text-blue-500" /> Facebook / Meta Pixel
                </CardTitle>
                <CardDescription>Cole apenas o ID do Pixel (ex: 123456789012345). Será injetado automaticamente na landing page.</CardDescription>
              </CardHeader>
              <CardContent>
                <Input value={settings.landing_pixel_facebook || ''} onChange={e => update('landing_pixel_facebook', e.target.value)}
                  placeholder="Ex: 123456789012345" className="font-mono" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5 text-amber-500" /> Google Ads (gtag)
                </CardTitle>
                <CardDescription>Cole o ID de conversão do Google Ads (ex: AW-123456789).</CardDescription>
              </CardHeader>
              <CardContent>
                <Input value={settings.landing_pixel_google || ''} onChange={e => update('landing_pixel_google', e.target.value)}
                  placeholder="Ex: AW-123456789" className="font-mono" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5 text-foreground" /> TikTok Pixel
                </CardTitle>
                <CardDescription>Cole o ID do Pixel do TikTok (ex: ABCDEF123456).</CardDescription>
              </CardHeader>
              <CardContent>
                <Input value={settings.landing_pixel_tiktok || ''} onChange={e => update('landing_pixel_tiktok', e.target.value)}
                  placeholder="Ex: ABCDEF123456" className="font-mono" />
              </CardContent>
            </Card>
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                💡 Os pixels serão injetados automaticamente na landing page (<code>/vendas</code>) após salvar. 
                Eventos de <strong>PageView</strong> são disparados ao carregar a página, e eventos de <strong>Lead/Conversion</strong> ao clicar nos botões de checkout.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* BACKGROUND / FUNDO */}
        <TabsContent value="background">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImagePlus className="w-5 h-5 text-primary" /> Imagem de Fundo
                </CardTitle>
                <CardDescription>Faça upload de uma imagem para usar como fundo da landing page.</CardDescription>
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
                <div>
                  <Label className="text-muted-foreground text-sm">URL da imagem ou faça upload</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={settings.landing_bg_image_url || ''} onChange={e => update('landing_bg_image_url', e.target.value)}
                      placeholder="https://... ou faça upload" className="flex-1" />
                    <Button variant="outline" onClick={() => {
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
                          update('landing_bg_image_url', publicUrl);
                          toast({ title: "Imagem enviada! ✅" });
                        } catch (err: any) {
                          toast({ title: "Erro", description: err.message, variant: "destructive" });
                        } finally {
                          setUploading(false);
                        }
                      };
                      input.click();
                    }} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Opacidade do overlay escuro ({settings.landing_bg_overlay_opacity || '70'}%)</Label>
                  <input type="range" min="0" max="100" value={settings.landing_bg_overlay_opacity || '70'}
                    onChange={e => update('landing_bg_overlay_opacity', e.target.value)}
                    className="w-full mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="w-5 h-5 text-primary" /> Efeitos & Partículas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Partículas interativas</Label>
                  <Switch checked={settings.landing_bg_particles !== 'false'}
                    onCheckedChange={v => update('landing_bg_particles', v ? 'true' : 'false')} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ColorInput label="Cor Primária" value={settings.landing_cor_primaria || '#06b6d4'} onChange={v => update('landing_cor_primaria', v)} />
                  <ColorInput label="Cor Secundária" value={settings.landing_cor_secundaria || '#3b82f6'} onChange={v => update('landing_cor_secundaria', v)} />
                  <ColorInput label="Cor Destaque" value={settings.landing_cor_destaque || '#f59e0b'} onChange={v => update('landing_cor_destaque', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ColorInput label="Cor do Fundo" value={settings.landing_cor_fundo || '#0f172a'} onChange={v => update('landing_cor_fundo', v)} />
                  <ColorInput label="Cor Botão CTA" value={settings.landing_cor_botao_cta || '#22c55e'} onChange={v => update('landing_cor_botao_cta', v)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EXTRAS - Countdown + Prova Social */}
        <TabsContent value="extras">
          <div className="space-y-4">
            {/* Countdown */}
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

            {/* Prova Social */}
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
      </Tabs>
    </div>
  );
};

export default AdminLandingTab;
