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
  Sparkles, Wand2
} from "lucide-react";

const LANDING_KEYS = [
  // Preços
  'landing_preco_mensal', 'landing_preco_anual', 'landing_preco_anual_original',
  'landing_economia_anual', 'landing_preco_mensal_equivalente',
  // Hero
  'landing_hero_titulo', 'landing_hero_subtitulo', 'landing_hero_descricao',
  'landing_social_proof_count', 'landing_social_proof_rating',
  'landing_garantia_dias', 'landing_btn_cta_texto', 'landing_badge_urgencia', 'landing_frase_destaque',
  // Cores
  'landing_cor_primaria', 'landing_cor_secundaria', 'landing_cor_destaque',
  'landing_cor_fundo', 'landing_cor_botao_cta',
  // Countdown
  'landing_countdown_texto', 'landing_countdown_desconto',
  // Notificações
  'landing_notif_intervalo', 'landing_notif_som', 'landing_notif_ativa',
  // Ofertas
  'landing_oferta1_titulo', 'landing_oferta1_descricao', 'landing_oferta1_badge', 'landing_oferta1_ativa',
  'landing_oferta2_titulo', 'landing_oferta2_descricao', 'landing_oferta2_badge', 'landing_oferta2_ativa',
  // Depoimentos
  'landing_depoimento1_nome', 'landing_depoimento1_role', 'landing_depoimento1_texto', 'landing_depoimento1_estrelas',
  'landing_depoimento2_nome', 'landing_depoimento2_role', 'landing_depoimento2_texto', 'landing_depoimento2_estrelas',
  'landing_depoimento3_nome', 'landing_depoimento3_role', 'landing_depoimento3_texto', 'landing_depoimento3_estrelas',
  'landing_depoimento4_nome', 'landing_depoimento4_role', 'landing_depoimento4_texto', 'landing_depoimento4_estrelas',
  // WhatsApp flutuante
  'landing_whatsapp_flutuante', 'landing_whatsapp_link', 'landing_whatsapp_mensagem',
  // Template
  'landing_template',
  // VSL
  'landing_vsl_url', 'landing_vsl_trava',
  // FAQ
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
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [settings, setSettings] = useState<LandingSettings>({});
  const videoInputRef = useRef<HTMLInputElement>(null);

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
      toast({ title: "Salvo! ✅", description: "Landing page atualizada." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateWithAI = async (type: 'colors' | 'texts' | 'full') => {
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-landing-theme', {
        body: { prompt: aiPrompt || undefined, type }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
        toast({ title: "IA gerou com sucesso! 🤖✨", description: `${Object.keys(data.settings).length} campos atualizados. Clique em Salvar para aplicar.` });
      }
    } catch (error: any) {
      toast({ title: "Erro na IA", description: error.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 50MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `vsl-video-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('landing-media')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('landing-media')
        .getPublicUrl(fileName);
      
      update('landing_vsl_url', publicUrl);
      toast({ title: "Vídeo enviado! ✅", description: "Salve para aplicar na landing." });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Megaphone className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Editor Completo da Landing Page</h2>
            <p className="text-gray-400 text-sm">Textos, cores, FAQ, WhatsApp, vídeo, templates e mais</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.open('/', '_blank')}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button onClick={saveAll} disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

      {/* Live Preview Iframe */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white text-sm">
              <Eye className="w-4 h-4 text-cyan-400" /> Preview ao Vivo
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => {
              const iframe = document.getElementById('landing-preview') as HTMLIFrameElement;
              if (iframe) iframe.src = iframe.src; // reload
            }} className="text-gray-400 hover:text-white h-7">
              <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="rounded-xl overflow-hidden border border-[#2a2a3a] bg-black" style={{ height: '400px' }}>
            <iframe 
              id="landing-preview"
              src="/" 
              className="w-full h-full"
              style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="template" className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="ia" className="text-xs bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600"><Wand2 className="w-3 h-3 mr-1" />🤖 IA</TabsTrigger>
          <TabsTrigger value="template" className="text-xs"><Layout className="w-3 h-3 mr-1" />Template</TabsTrigger>
          <TabsTrigger value="textos" className="text-xs"><Type className="w-3 h-3 mr-1" />Textos</TabsTrigger>
          <TabsTrigger value="precos" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Preços</TabsTrigger>
          <TabsTrigger value="ofertas" className="text-xs"><Gift className="w-3 h-3 mr-1" />Ofertas</TabsTrigger>
          <TabsTrigger value="cores" className="text-xs"><Palette className="w-3 h-3 mr-1" />Cores</TabsTrigger>
          <TabsTrigger value="depoimentos" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Depoimentos</TabsTrigger>
          <TabsTrigger value="faq" className="text-xs"><HelpCircle className="w-3 h-3 mr-1" />FAQ</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="w-3 h-3 mr-1" />WhatsApp</TabsTrigger>
          <TabsTrigger value="video" className="text-xs"><Video className="w-3 h-3 mr-1" />Vídeo</TabsTrigger>
          <TabsTrigger value="countdown" className="text-xs"><Clock className="w-3 h-3 mr-1" />Countdown</TabsTrigger>
          <TabsTrigger value="notificacoes" className="text-xs"><Bell className="w-3 h-3 mr-1" />Notificações</TabsTrigger>
          <TabsTrigger value="social" className="text-xs"><Star className="w-3 h-3 mr-1" />Prova Social</TabsTrigger>
        </TabsList>

        {/* IA GENERATOR */}
        <TabsContent value="ia">
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Wand2 className="w-5 h-5 text-purple-400" /> Gerador com IA
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Cole um prompt ou deixe em branco para gerar automaticamente. A IA gera cores, textos e temas completos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Prompt (opcional)</Label>
                <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Ex: Landing page moderna com tons de azul escuro e verde neon, estilo premium para técnicos de ar condicionado..."
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[80px]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button onClick={() => generateWithAI('colors')} disabled={aiGenerating}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                  {aiGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}
                  Gerar Cores
                </Button>
                <Button onClick={() => generateWithAI('texts')} disabled={aiGenerating}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                  {aiGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Type className="w-4 h-4 mr-2" />}
                  Gerar Textos
                </Button>
                <Button onClick={() => generateWithAI('full')} disabled={aiGenerating}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  {aiGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Gerar Tudo
                </Button>
              </div>
              {aiGenerating && (
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-purple-300 text-sm">IA gerando... aguarde alguns segundos</span>
                </div>
              )}
              <p className="text-gray-500 text-xs">
                💡 Após gerar, revise os valores nas abas ao lado e clique em "Salvar Tudo" para aplicar na landing page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEMPLATE */}
        <TabsContent value="template">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Layout className="w-5 h-5 text-purple-400" /> Escolha o Template
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Selecione o layout da sua página de vendas. A atual será salva como padrão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'persuasao', name: '🎯 Persuasão', desc: 'Layout completo com todas as seções de venda, prova social, dor e urgência. Ideal para conversão máxima.', color: 'border-cyan-500' },
                  { id: 'vsl', name: '🎬 VSL (Vídeo)', desc: 'Página focada em vídeo de vendas. O vídeo fica em destaque com CTA abaixo. Pode travar até assistir.', color: 'border-amber-500' },
                  { id: 'minimalista', name: '✨ Minimalista', desc: 'Layout limpo e direto ao ponto. Hero + preços + depoimentos + CTA. Sem distrações.', color: 'border-green-500' },
                ].map(tmpl => (
                  <div key={tmpl.id}
                    onClick={() => update('landing_template', tmpl.id)}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                      settings.landing_template === tmpl.id 
                        ? `${tmpl.color} bg-white/5 shadow-lg` 
                        : 'border-[#2a2a3a] hover:border-[#4a4a5a]'
                    }`}>
                    <h3 className="text-white font-bold text-sm mb-2">{tmpl.name}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{tmpl.desc}</p>
                    {settings.landing_template === tmpl.id && (
                      <Badge className="mt-3 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">✓ Ativo</Badge>
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
                <Type className="w-5 h-5 text-cyan-400" /> Textos Principais (Hero)
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
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'landing_preco_mensal', label: 'Preço Mensal (R$)', ph: '39,90' },
                { key: 'landing_preco_anual', label: 'Preço Anual (R$)', ph: '370' },
                { key: 'landing_preco_anual_original', label: 'Preço Original (riscado)', ph: '478,80' },
                { key: 'landing_economia_anual', label: 'Economia Anual (R$)', ph: '108' },
                { key: 'landing_preco_mensal_equivalente', label: 'Equivalente Mensal (R$)', ph: '30,83' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-gray-300 text-sm">{f.label}</Label>
                  <Input value={settings[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                    className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder={f.ph} />
                </div>
              ))}
            </CardContent>
          </Card>
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
              {['primaria','secundaria','destaque','botao_cta'].map(k => (
                <span key={k} className="px-4 py-2 rounded-lg text-white text-sm font-bold" 
                  style={{ background: settings[`landing_cor_${k}`] || '#06b6d4' }}>
                  {k}
                </span>
              ))}
            </div>
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
          <Card className="bg-[#1a1a24] border-[#2a2a3a] mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <HelpCircle className="w-5 h-5 text-blue-400" /> Perguntas Frequentes (FAQ)
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">Edite as perguntas e respostas exibidas na landing page</CardDescription>
            </CardHeader>
          </Card>
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
              <CardDescription className="text-gray-400 text-xs">
                Botão fixo no canto inferior direito da landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 text-sm">Botão ativo na landing</Label>
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
              {/* Preview */}
              <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-3">Preview do botão:</p>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce">
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-gray-300 text-sm">← Aparece assim no canto inferior direito</span>
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
              <CardDescription className="text-gray-400 text-xs">
                Faça upload do vídeo ou cole um link do YouTube/Vimeo. Aparece no template VSL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">URL do Vídeo (YouTube, Vimeo ou upload)</Label>
                <Input value={settings.landing_vsl_url || ''} 
                  onChange={e => update('landing_vsl_url', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" 
                  placeholder="https://youtube.com/watch?v=... ou URL do upload" />
              </div>
              <div className="flex gap-2">
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" 
                  onChange={handleVideoUpload} />
                <Button variant="outline" onClick={() => videoInputRef.current?.click()} disabled={uploading}
                  className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploading ? 'Enviando...' : 'Upload Vídeo (max 50MB)'}
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
                  <Label className="text-gray-300 text-sm">Travar sistema até assistir vídeo</Label>
                  <p className="text-gray-500 text-xs">Usuário precisa assistir o vídeo antes de acessar o sistema</p>
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

        {/* COUNTDOWN */}
        <TabsContent value="countdown">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Clock className="w-5 h-5 text-orange-400" /> Contador Regressivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Texto do Countdown</Label>
                <Input value={settings.landing_countdown_texto || ''} onChange={e => update('landing_countdown_texto', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Badge de Desconto</Label>
                <Input value={settings.landing_countdown_desconto || ''} onChange={e => update('landing_countdown_desconto', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes">
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
        </TabsContent>

        {/* PROVA SOCIAL */}
        <TabsContent value="social">
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
        </TabsContent>
      </Tabs>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 text-center">
        <p className="text-cyan-300 text-sm">
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Após salvar, recarregue a landing page para ver as alterações.
        </p>
      </div>
    </div>
  );
};

export default AdminLandingTab;