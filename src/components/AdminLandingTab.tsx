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
  Image
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
  'landing_oferta1_titulo', 'landing_oferta1_descricao', 'landing_oferta1_badge', 'landing_oferta1_ativa',
  'landing_oferta2_titulo', 'landing_oferta2_descricao', 'landing_oferta2_badge', 'landing_oferta2_ativa',
  'landing_depoimento1_nome', 'landing_depoimento1_role', 'landing_depoimento1_texto', 'landing_depoimento1_estrelas',
  'landing_depoimento2_nome', 'landing_depoimento2_role', 'landing_depoimento2_texto', 'landing_depoimento2_estrelas',
  'landing_depoimento3_nome', 'landing_depoimento3_role', 'landing_depoimento3_texto', 'landing_depoimento3_estrelas',
  'landing_depoimento4_nome', 'landing_depoimento4_role', 'landing_depoimento4_texto', 'landing_depoimento4_estrelas',
  'landing_whatsapp_flutuante', 'landing_whatsapp_link', 'landing_whatsapp_mensagem', 'landing_whatsapp_icon_url',
  'landing_template',
  'landing_vsl_url', 'landing_vsl_trava',
  ...Array.from({length: 6}, (_, i) => [`landing_faq${i+1}_pergunta`, `landing_faq${i+1}_resposta`, `landing_faq${i+1}_ativa`]).flat(),
];

type LandingSettings = Record<string, string>;

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
      className="w-10 h-10 rounded-lg border border-[#2a2a3a] cursor-pointer bg-transparent" />
    <div className="flex-1">
      <Label className="text-gray-300 text-xs">{label}</Label>
      <Input value={value || ''} onChange={e => onChange(e.target.value)}
        className="bg-[#0f0f17] border-[#2a2a3a] text-white h-8 text-xs" placeholder="#hex" />
    </div>
  </div>
);

const TestimonialEditor: React.FC<{
  index: number; settings: LandingSettings; update: (k: string, v: string) => void;
}> = ({ index, settings, update }) => {
  const prefix = `landing_depoimento${index}`;
  return (
    <Card className="bg-[#12121a] border-[#2a2a3a]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-cyan-400 font-semibold text-sm">Depoimento {index}</span>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => update(`${prefix}_estrelas`, String(s))}
                className={`text-lg ${Number(settings[`${prefix}_estrelas`] || 5) >= s ? 'text-amber-400' : 'text-gray-600'}`}>
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-400 text-xs">Nome</Label>
            <Input value={settings[`${prefix}_nome`] || ''} onChange={e => update(`${prefix}_nome`, e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white h-8 text-sm" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Cargo / Cidade</Label>
            <Input value={settings[`${prefix}_role`] || ''} onChange={e => update(`${prefix}_role`, e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-gray-400 text-xs">Texto do depoimento</Label>
          <Textarea value={settings[`${prefix}_texto`] || ''} onChange={e => update(`${prefix}_texto`, e.target.value)}
            className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[60px] text-sm" />
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'icon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: `Máximo ${type === 'video' ? '50MB' : '2MB'}`, variant: "destructive" });
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
      } else {
        update('landing_whatsapp_icon_url', publicUrl);
      }
      toast({ title: `${type === 'video' ? 'Vídeo' : 'Ícone'} enviado! ✅` });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  const templateOptions = [
    { 
      id: 'persuasao', 
      name: '🎯 Persuasão Total', 
      desc: 'Hero, dores, comparativo, preços, depoimentos, FAQ e CTAs.',
      sections: ['Hero + Urgência', 'Seção de Dor', 'Features', 'Comparativo', 'Preços', 'Depoimentos', 'FAQ', 'CTA Final'],
      color: 'border-cyan-500',
      gradient: 'from-cyan-500/20 to-blue-500/20'
    },
    { 
      id: 'vsl', 
      name: '🎬 VSL (Vídeo)', 
      desc: 'Foco no vídeo de vendas com preços e CTA.',
      sections: ['Vídeo Hero', 'CTA Abaixo', 'Preços', 'Depoimentos'],
      color: 'border-amber-500',
      gradient: 'from-amber-500/20 to-orange-500/20'
    },
    { 
      id: 'minimalista', 
      name: '✨ Minimalista', 
      desc: 'Design limpo e direto. Ultra rápido.',
      sections: ['Hero Limpo', 'Features', 'Preços', 'CTA'],
      color: 'border-green-500',
      gradient: 'from-green-500/20 to-emerald-500/20'
    },
    { 
      id: 'custom', 
      name: '🛠️ Criar do Zero', 
      desc: 'Página totalmente personalizada. Você decide cada seção, texto e layout.',
      sections: ['Título Livre', 'Seções Livres', 'CTA Personalizado', 'Layout Aberto'],
      color: 'border-pink-500',
      gradient: 'from-pink-500/20 to-purple-500/20'
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Megaphone className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Editor da Landing Page</h2>
            <p className="text-gray-400 text-sm">Edite textos, cores, FAQ, WhatsApp, vídeo e templates</p>
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
          }} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            <RefreshCw className="w-4 h-4 mr-2" /> Restaurar
          </Button>
          <Button variant="outline" onClick={() => window.open('/', '_blank')}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
            <Eye className="w-4 h-4 mr-2" /> Abrir Landing
          </Button>
          <Button onClick={saveAll} disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white text-sm">
              <Eye className="w-4 h-4 text-cyan-400" /> Preview ao Vivo
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setPreviewKey(prev => prev + 1)} 
              className="text-gray-400 hover:text-white h-7">
              <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="rounded-xl overflow-hidden border border-[#2a2a3a] bg-black relative" style={{ height: '350px' }}>
            <iframe 
              key={previewKey}
              src={`https://gestaoarcondicionado.lovable.app/?preview=true&t=${previewKey}`}
              className="w-full h-full border-0"
              style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="template" className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="template" className="text-xs"><Layout className="w-3 h-3 mr-1" />Template</TabsTrigger>
          <TabsTrigger value="textos" className="text-xs"><Type className="w-3 h-3 mr-1" />Textos</TabsTrigger>
          <TabsTrigger value="precos" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Preços</TabsTrigger>
          <TabsTrigger value="cores" className="text-xs"><Palette className="w-3 h-3 mr-1" />Cores</TabsTrigger>
          <TabsTrigger value="ofertas" className="text-xs"><Gift className="w-3 h-3 mr-1" />Ofertas</TabsTrigger>
          <TabsTrigger value="depoimentos" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Depoimentos</TabsTrigger>
          <TabsTrigger value="faq" className="text-xs"><HelpCircle className="w-3 h-3 mr-1" />FAQ</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="w-3 h-3 mr-1" />WhatsApp</TabsTrigger>
          <TabsTrigger value="video" className="text-xs"><Video className="w-3 h-3 mr-1" />Vídeo</TabsTrigger>
          <TabsTrigger value="extras" className="text-xs"><Star className="w-3 h-3 mr-1" />Extras</TabsTrigger>
        </TabsList>

        {/* TEMPLATE */}
        <TabsContent value="template">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Layout className="w-5 h-5 text-purple-400" /> Escolha o Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {templateOptions.map(tmpl => (
                  <div key={tmpl.id}
                    onClick={() => update('landing_template', tmpl.id)}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:scale-[1.02] ${
                      settings.landing_template === tmpl.id 
                        ? `${tmpl.color} bg-white/5 shadow-lg` 
                        : 'border-[#2a2a3a] hover:border-[#4a4a5a]'
                    }`}>
                    <div className={`bg-gradient-to-br ${tmpl.gradient} rounded-lg p-3 mb-3 border border-white/5`}>
                      <div className="space-y-1.5">
                        {tmpl.sections.map((section, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-cyan-400' : 'bg-white/30'}`} />
                            <div className="h-1.5 bg-white/20 rounded-full flex-1" style={{ maxWidth: `${70 + Math.random() * 30}%` }} />
                            <span className="text-[8px] text-white/40">{section}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <h3 className="text-white font-bold text-sm mb-1">{tmpl.name}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{tmpl.desc}</p>
                    {settings.landing_template === tmpl.id && (
                      <Badge className="mt-2 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">✓ Ativo</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTOS */}
        <TabsContent value="textos">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Type className="w-5 h-5 text-cyan-400" /> Textos Principais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'landing_hero_titulo', label: 'Título Principal' },
                { key: 'landing_hero_subtitulo', label: 'Subtítulo' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-gray-300 text-sm">{f.label}</Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
              ))}
              <div>
                <Label className="text-gray-300 text-sm">Descrição do Hero</Label>
                <Textarea value={settings.landing_hero_descricao || ''} onChange={e => update('landing_hero_descricao', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[80px]" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Frase de Destaque</Label>
                <Textarea value={settings.landing_frase_destaque || ''} onChange={e => update('landing_frase_destaque', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[60px]" />
              </div>
              {[
                { key: 'landing_badge_urgencia', label: 'Badge de Urgência' },
                { key: 'landing_btn_cta_texto', label: 'Texto do Botão CTA' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-gray-300 text-sm">{f.label}</Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREÇOS */}
        <TabsContent value="precos">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <DollarSign className="w-5 h-5 text-green-400" /> Preços dos Planos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
                  <h4 className="text-cyan-400 font-semibold text-sm">💳 Plano Mensal</h4>
                  <div>
                    <Label className="text-gray-300 text-sm">Preço (R$)</Label>
                    <Input value={settings.landing_preco_mensal || ''} onChange={e => update('landing_preco_mensal', e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="39,90" />
                  </div>
                </div>
                <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-amber-400 font-semibold text-sm">⭐ Plano Anual</h4>
                  <div>
                    <Label className="text-gray-300 text-sm">Preço Anual (R$)</Label>
                    <Input value={settings.landing_preco_anual || ''} onChange={e => update('landing_preco_anual', e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="370" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Preço Original <span className="text-red-400 line-through">(riscado)</span></Label>
                    <Input value={settings.landing_preco_anual_original || ''} onChange={e => update('landing_preco_anual_original', e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="478,80" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Economia (R$)</Label>
                    <Input value={settings.landing_economia_anual || ''} onChange={e => update('landing_economia_anual', e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="108" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Equivalente Mensal (R$)</Label>
                    <Input value={settings.landing_preco_mensal_equivalente || ''} onChange={e => update('landing_preco_mensal_equivalente', e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="30,83" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CORES */}
        <TabsContent value="cores">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Palette className="w-5 h-5 text-pink-400" /> Paleta de Cores
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
          <div className="mt-4 p-4 rounded-xl border border-[#2a2a3a]" style={{ background: settings.landing_cor_fundo || '#0f172a' }}>
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
            {[1, 2].map(i => (
              <Card key={i} className="bg-[#1a1a24] border-[#2a2a3a]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                      <Gift className="w-5 h-5 text-purple-400" /> Oferta {i}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-400 text-xs">Ativa</Label>
                      <Switch checked={settings[`landing_oferta${i}_ativa`] !== 'false'}
                        onCheckedChange={v => update(`landing_oferta${i}_ativa`, v ? 'true' : 'false')} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['titulo', 'descricao', 'badge'].map(field => (
                    <div key={field}>
                      <Label className="text-gray-300 text-sm capitalize">{field === 'badge' ? 'Badge (ex: POPULAR)' : field}</Label>
                      <Input value={settings[`landing_oferta${i}_${field}`] || ''} 
                        onChange={e => update(`landing_oferta${i}_${field}`, e.target.value)}
                        className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DEPOIMENTOS */}
        <TabsContent value="depoimentos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <TestimonialEditor key={i} index={i} settings={settings} update={update} />
            ))}
          </div>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq">
          <div className="space-y-3">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i} className="bg-[#12121a] border-[#2a2a3a]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-semibold text-sm">FAQ {i}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-400 text-xs">Ativa</Label>
                      <Switch checked={settings[`landing_faq${i}_ativa`] !== 'false'}
                        onCheckedChange={v => update(`landing_faq${i}_ativa`, v ? 'true' : 'false')} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Pergunta</Label>
                    <Input value={settings[`landing_faq${i}_pergunta`] || ''} 
                      onChange={e => update(`landing_faq${i}_pergunta`, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Resposta</Label>
                    <Textarea value={settings[`landing_faq${i}_resposta`] || ''} 
                      onChange={e => update(`landing_faq${i}_resposta`, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[50px] text-sm" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <MessageCircle className="w-5 h-5 text-green-400" /> Botão WhatsApp Flutuante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 text-sm">Ativo</Label>
                <Switch checked={settings.landing_whatsapp_flutuante !== 'false'}
                  onCheckedChange={v => update('landing_whatsapp_flutuante', v ? 'true' : 'false')} />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Link do WhatsApp</Label>
                <Input value={settings.landing_whatsapp_link || ''} 
                  onChange={e => update('landing_whatsapp_link', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" 
                  placeholder="https://wa.me/5511999999999" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Mensagem padrão</Label>
                <Textarea value={settings.landing_whatsapp_mensagem || ''} 
                  onChange={e => update('landing_whatsapp_mensagem', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[60px]" 
                  placeholder="Olá! Vim pela landing page..." />
              </div>
              
              {/* Custom icon */}
              <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
                <Label className="text-gray-300 text-sm flex items-center gap-2">
                  <Image className="w-4 h-4 text-green-400" /> Ícone personalizado
                </Label>
                <div className="flex items-center gap-3">
                  <input ref={iconInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handleFileUpload(e, 'icon')} />
                  <Button variant="outline" onClick={() => iconInputRef.current?.click()} disabled={uploading}
                    className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]">
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Enviar Imagem
                  </Button>
                  {settings.landing_whatsapp_icon_url && (
                    <>
                      <img src={settings.landing_whatsapp_icon_url} alt="icon" className="w-12 h-12 rounded-full object-cover border-2 border-green-500/30" />
                      <Button variant="ghost" size="sm" onClick={() => update('landing_whatsapp_icon_url', '')}
                        className="text-red-400 hover:text-red-300">
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
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Video className="w-5 h-5 text-red-400" /> Vídeo de Vendas (VSL)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">URL do Vídeo</Label>
                <Input value={settings.landing_vsl_url || ''} 
                  onChange={e => update('landing_vsl_url', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" 
                  placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="flex gap-2">
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" 
                  onChange={e => handleFileUpload(e, 'video')} />
                <Button variant="outline" onClick={() => videoInputRef.current?.click()} disabled={uploading}
                  className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Vídeo (max 50MB)
                </Button>
                {settings.landing_vsl_url && (
                  <Button variant="outline" onClick={() => update('landing_vsl_url', '')}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-1" /> Remover
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
                <div>
                  <Label className="text-gray-300 text-sm">Travar até assistir</Label>
                  <p className="text-gray-500 text-xs">Visitante assiste antes de navegar</p>
                </div>
                <Switch checked={settings.landing_vsl_trava === 'true'}
                  onCheckedChange={v => update('landing_vsl_trava', v ? 'true' : 'false')} />
              </div>
              {settings.landing_vsl_url && (
                <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-2">Preview:</p>
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

        {/* EXTRAS - Countdown + Notificações + Prova Social combined */}
        <TabsContent value="extras">
          <div className="space-y-4">
            {/* Countdown */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Clock className="w-5 h-5 text-orange-400" /> Contador Regressivo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 text-sm">Texto</Label>
                  <Input value={settings.landing_countdown_texto || ''} onChange={e => update('landing_countdown_texto', e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Badge Desconto</Label>
                  <Input value={settings.landing_countdown_desconto || ''} onChange={e => update('landing_countdown_desconto', e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
              </CardContent>
            </Card>

            {/* Notificações de compra */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Bell className="w-5 h-5 text-green-400" /> Notificações de Compra
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm">Ativas</Label>
                  <Switch checked={settings.landing_notif_ativa !== 'false'}
                    onCheckedChange={v => update('landing_notif_ativa', v ? 'true' : 'false')} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm">Som</Label>
                  <Switch checked={settings.landing_notif_som !== 'false'}
                    onCheckedChange={v => update('landing_notif_som', v ? 'true' : 'false')} />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Intervalo (segundos)</Label>
                  <Input type="number" value={settings.landing_notif_intervalo || '10'} 
                    onChange={e => update('landing_notif_intervalo', e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white w-32" min="5" max="60" />
                </div>
              </CardContent>
            </Card>

            {/* Prova Social */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Star className="w-5 h-5 text-amber-400" /> Prova Social & Garantia
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'landing_social_proof_count', label: 'Qtd Técnicos', ph: '500' },
                  { key: 'landing_social_proof_rating', label: 'Nota', ph: '4.9' },
                  { key: 'landing_garantia_dias', label: 'Dias Garantia', ph: '7' },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-gray-300 text-sm">{f.label}</Label>
                    <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder={f.ph} />
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
