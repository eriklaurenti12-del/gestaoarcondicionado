import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign, Type, Star, Shield, Megaphone, RefreshCw, Palette, Clock, Bell, Gift, MessageSquare, Eye } from "lucide-react";

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
  // Notificações de compra
  'landing_notif_intervalo', 'landing_notif_som', 'landing_notif_ativa',
  // Ofertas
  'landing_oferta1_titulo', 'landing_oferta1_descricao', 'landing_oferta1_badge', 'landing_oferta1_ativa',
  'landing_oferta2_titulo', 'landing_oferta2_descricao', 'landing_oferta2_badge', 'landing_oferta2_ativa',
  // Depoimentos
  'landing_depoimento1_nome', 'landing_depoimento1_role', 'landing_depoimento1_texto', 'landing_depoimento1_estrelas',
  'landing_depoimento2_nome', 'landing_depoimento2_role', 'landing_depoimento2_texto', 'landing_depoimento2_estrelas',
  'landing_depoimento3_nome', 'landing_depoimento3_role', 'landing_depoimento3_texto', 'landing_depoimento3_estrelas',
  'landing_depoimento4_nome', 'landing_depoimento4_role', 'landing_depoimento4_texto', 'landing_depoimento4_estrelas',
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
  const [settings, setSettings] = useState<LandingSettings>({});

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', LANDING_KEYS);
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
        if (!LANDING_KEYS.includes(key)) continue;
        const { error } = await supabase
          .from('admin_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      toast({ title: "Salvo! ✅", description: "Landing page atualizada. As alterações já estão visíveis." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openPreview = () => {
    window.open('/', '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
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
            <p className="text-gray-400 text-sm">Preços, textos, cores, depoimentos, ofertas e mais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openPreview}
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

      <Tabs defaultValue="textos" className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="textos" className="text-xs"><Type className="w-3 h-3 mr-1" />Textos</TabsTrigger>
          <TabsTrigger value="precos" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Preços</TabsTrigger>
          <TabsTrigger value="ofertas" className="text-xs"><Gift className="w-3 h-3 mr-1" />Ofertas</TabsTrigger>
          <TabsTrigger value="cores" className="text-xs"><Palette className="w-3 h-3 mr-1" />Cores</TabsTrigger>
          <TabsTrigger value="depoimentos" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Depoimentos</TabsTrigger>
          <TabsTrigger value="countdown" className="text-xs"><Clock className="w-3 h-3 mr-1" />Countdown</TabsTrigger>
          <TabsTrigger value="notificacoes" className="text-xs"><Bell className="w-3 h-3 mr-1" />Notificações</TabsTrigger>
          <TabsTrigger value="social" className="text-xs"><Star className="w-3 h-3 mr-1" />Prova Social</TabsTrigger>
        </TabsList>

        {/* TEXTOS */}
        <TabsContent value="textos">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Type className="w-5 h-5 text-cyan-400" /> Textos Principais (Hero)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-gray-300 text-sm">Título Principal</Label>
                <Input value={settings.landing_hero_titulo || ''} onChange={e => update('landing_hero_titulo', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Subtítulo</Label>
                <Input value={settings.landing_hero_subtitulo || ''} onChange={e => update('landing_hero_subtitulo', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
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
              <div>
                <Label className="text-gray-300 text-sm">Badge de Urgência</Label>
                <Input value={settings.landing_badge_urgencia || ''} onChange={e => update('landing_badge_urgencia', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Texto do Botão CTA</Label>
                <Input value={settings.landing_btn_cta_texto || ''} onChange={e => update('landing_btn_cta_texto', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              </div>
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
              <div>
                <Label className="text-gray-300 text-sm">Preço Mensal (R$)</Label>
                <Input value={settings.landing_preco_mensal || ''} onChange={e => update('landing_preco_mensal', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="39,90" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Preço Anual (R$)</Label>
                <Input value={settings.landing_preco_anual || ''} onChange={e => update('landing_preco_anual', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="370" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Preço Original Anual (riscado)</Label>
                <Input value={settings.landing_preco_anual_original || ''} onChange={e => update('landing_preco_anual_original', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="478,80" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Economia Anual (R$)</Label>
                <Input value={settings.landing_economia_anual || ''} onChange={e => update('landing_economia_anual', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="108" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Equivalente Mensal (R$)</Label>
                <Input value={settings.landing_preco_mensal_equivalente || ''} onChange={e => update('landing_preco_mensal_equivalente', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="30,83" />
              </div>
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
                      <Switch
                        checked={settings[`landing_oferta${i}_ativa`] !== 'false'}
                        onCheckedChange={v => update(`landing_oferta${i}_ativa`, v ? 'true' : 'false')}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-300 text-sm">Título</Label>
                    <Input value={settings[`landing_oferta${i}_titulo`] || ''} onChange={e => update(`landing_oferta${i}_titulo`, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Descrição</Label>
                    <Input value={settings[`landing_oferta${i}_descricao`] || ''} onChange={e => update(`landing_oferta${i}_descricao`, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Badge (ex: POPULAR, MAIS ESCOLHIDO)</Label>
                    <Input value={settings[`landing_oferta${i}_badge`] || ''} onChange={e => update(`landing_oferta${i}_badge`, e.target.value)}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  </div>
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
              <CardDescription className="text-gray-400 text-xs">Escolha as cores da landing page</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ColorInput label="Cor Primária (botões, links)" value={settings.landing_cor_primaria || '#06b6d4'} onChange={v => update('landing_cor_primaria', v)} />
              <ColorInput label="Cor Secundária" value={settings.landing_cor_secundaria || '#3b82f6'} onChange={v => update('landing_cor_secundaria', v)} />
              <ColorInput label="Cor Destaque (urgência, badges)" value={settings.landing_cor_destaque || '#f59e0b'} onChange={v => update('landing_cor_destaque', v)} />
              <ColorInput label="Cor de Fundo" value={settings.landing_cor_fundo || '#0f172a'} onChange={v => update('landing_cor_fundo', v)} />
              <ColorInput label="Cor Botão CTA" value={settings.landing_cor_botao_cta || '#22c55e'} onChange={v => update('landing_cor_botao_cta', v)} />
            </CardContent>
          </Card>
          {/* Preview */}
          <div className="mt-4 p-4 rounded-xl border border-[#2a2a3a]" style={{ background: settings.landing_cor_fundo || '#0f172a' }}>
            <p className="text-center text-sm mb-3" style={{ color: settings.landing_cor_primaria || '#06b6d4' }}>
              ★ Preview das cores ★
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: settings.landing_cor_primaria || '#06b6d4' }}>Primária</span>
              <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: settings.landing_cor_secundaria || '#3b82f6' }}>Secundária</span>
              <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: settings.landing_cor_destaque || '#f59e0b' }}>Destaque</span>
              <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: settings.landing_cor_botao_cta || '#22c55e' }}>CTA</span>
            </div>
          </div>
        </TabsContent>

        {/* DEPOIMENTOS */}
        <TabsContent value="depoimentos">
          <Card className="bg-[#1a1a24] border-[#2a2a3a] mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <MessageSquare className="w-5 h-5 text-amber-400" /> Depoimentos / Testemunhos
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">Edite nome, texto, cargo e avaliação de cada depoimento</CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <TestimonialEditor key={i} index={i} settings={settings} update={update} />
            ))}
          </div>
        </TabsContent>

        {/* COUNTDOWN */}
        <TabsContent value="countdown">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Clock className="w-5 h-5 text-orange-400" /> Contador Regressivo
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">Configure o timer de urgência no topo da landing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Texto do Countdown</Label>
                <Input value={settings.landing_countdown_texto || ''} onChange={e => update('landing_countdown_texto', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="🔥 PROMOÇÃO POR TEMPO LIMITADO!" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Badge de Desconto</Label>
                <Input value={settings.landing_countdown_desconto || ''} onChange={e => update('landing_countdown_desconto', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="22% OFF Plano Anual" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES DE COMPRA */}
        <TabsContent value="notificacoes">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Bell className="w-5 h-5 text-green-400" /> Notificações de Compra (Social Proof)
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">Popups simulados de compras recentes na landing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 text-sm">Notificações ativas</Label>
                <Switch
                  checked={settings.landing_notif_ativa !== 'false'}
                  onCheckedChange={v => update('landing_notif_ativa', v ? 'true' : 'false')}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 text-sm">Som nas notificações</Label>
                <Switch
                  checked={settings.landing_notif_som !== 'false'}
                  onCheckedChange={v => update('landing_notif_som', v ? 'true' : 'false')}
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Intervalo entre notificações (segundos)</Label>
                <Input type="number" value={settings.landing_notif_intervalo || '10'} onChange={e => update('landing_notif_intervalo', e.target.value)}
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
              <div>
                <Label className="text-gray-300 text-sm">Quantidade de Técnicos</Label>
                <Input value={settings.landing_social_proof_count || ''} onChange={e => update('landing_social_proof_count', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="500" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Nota de Avaliação</Label>
                <Input value={settings.landing_social_proof_rating || ''} onChange={e => update('landing_social_proof_rating', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="4.9" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Dias de Garantia</Label>
                <Input value={settings.landing_garantia_dias || ''} onChange={e => update('landing_garantia_dias', e.target.value)}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="7" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hint */}
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
