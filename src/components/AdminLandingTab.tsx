import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign, Type, Star, Shield, Megaphone, RefreshCw } from "lucide-react";

const LANDING_KEYS = [
  'landing_preco_mensal',
  'landing_preco_anual',
  'landing_preco_anual_original',
  'landing_economia_anual',
  'landing_preco_mensal_equivalente',
  'landing_hero_titulo',
  'landing_hero_subtitulo',
  'landing_hero_descricao',
  'landing_social_proof_count',
  'landing_social_proof_rating',
  'landing_garantia_dias',
  'landing_btn_cta_texto',
  'landing_badge_urgencia',
  'landing_frase_destaque',
];

type LandingSettings = Record<string, string>;

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
        const { error } = await supabase
          .from('admin_settings')
          .update({ value })
          .eq('key', key);
        if (error) throw error;
      }
      toast({ title: "Salvo!", description: "Landing page atualizada. Recarregue a página para ver as mudanças." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Megaphone className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Editor da Landing Page</h2>
            <p className="text-gray-400">Edite preços, textos e conteúdo da página de vendas</p>
          </div>
        </div>
        <Button
          onClick={saveAll}
          disabled={saving}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar e Atualizar
        </Button>
      </div>

      {/* Preços */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <DollarSign className="w-5 h-5 text-green-400" />
            Preços dos Planos
          </CardTitle>
          <CardDescription className="text-gray-400">Altere os valores exibidos nos cards de preço</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-300">Preço Mensal (R$)</Label>
            <Input value={settings.landing_preco_mensal || ''} onChange={e => update('landing_preco_mensal', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="39,90" />
          </div>
          <div>
            <Label className="text-gray-300">Preço Anual (R$)</Label>
            <Input value={settings.landing_preco_anual || ''} onChange={e => update('landing_preco_anual', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="370" />
          </div>
          <div>
            <Label className="text-gray-300">Preço Original Anual (riscado)</Label>
            <Input value={settings.landing_preco_anual_original || ''} onChange={e => update('landing_preco_anual_original', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="478,80" />
          </div>
          <div>
            <Label className="text-gray-300">Economia Anual (R$)</Label>
            <Input value={settings.landing_economia_anual || ''} onChange={e => update('landing_economia_anual', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="108" />
          </div>
          <div>
            <Label className="text-gray-300">Equivalente Mensal do Anual (R$)</Label>
            <Input value={settings.landing_preco_mensal_equivalente || ''} onChange={e => update('landing_preco_mensal_equivalente', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="30,83" />
          </div>
        </CardContent>
      </Card>

      {/* Textos do Hero */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Type className="w-5 h-5 text-cyan-400" />
            Textos Principais (Hero)
          </CardTitle>
          <CardDescription className="text-gray-400">Edite o título, subtítulo e descrição principal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-300">Título Principal</Label>
            <Input value={settings.landing_hero_titulo || ''} onChange={e => update('landing_hero_titulo', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="Chega de Perder Clientes" />
          </div>
          <div>
            <Label className="text-gray-300">Subtítulo</Label>
            <Input value={settings.landing_hero_subtitulo || ''} onChange={e => update('landing_hero_subtitulo', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="e Trabalhar no Prejuízo" />
          </div>
          <div>
            <Label className="text-gray-300">Descrição do Hero</Label>
            <Textarea value={settings.landing_hero_descricao || ''} onChange={e => update('landing_hero_descricao', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[80px]" />
          </div>
          <div>
            <Label className="text-gray-300">Frase de Destaque</Label>
            <Textarea value={settings.landing_frase_destaque || ''} onChange={e => update('landing_frase_destaque', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white min-h-[60px]" />
          </div>
          <div>
            <Label className="text-gray-300">Badge de Urgência</Label>
            <Input value={settings.landing_badge_urgencia || ''} onChange={e => update('landing_badge_urgencia', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
          </div>
          <div>
            <Label className="text-gray-300">Texto do Botão CTA</Label>
            <Input value={settings.landing_btn_cta_texto || ''} onChange={e => update('landing_btn_cta_texto', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="QUERO PARAR DE PERDER DINHEIRO" />
          </div>
        </CardContent>
      </Card>

      {/* Prova Social */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Star className="w-5 h-5 text-amber-400" />
            Prova Social & Garantia
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-300">Quantidade de Técnicos</Label>
            <Input value={settings.landing_social_proof_count || ''} onChange={e => update('landing_social_proof_count', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="500" />
          </div>
          <div>
            <Label className="text-gray-300">Nota de Avaliação</Label>
            <Input value={settings.landing_social_proof_rating || ''} onChange={e => update('landing_social_proof_rating', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="4.9" />
          </div>
          <div>
            <Label className="text-gray-300">Dias de Garantia</Label>
            <Input value={settings.landing_garantia_dias || ''} onChange={e => update('landing_garantia_dias', e.target.value)}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="7" />
          </div>
        </CardContent>
      </Card>

      {/* Preview hint */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
        <p className="text-cyan-300 text-sm">
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Após salvar, recarregue a landing page para ver as alterações em tempo real.
        </p>
      </div>
    </div>
  );
};

export default AdminLandingTab;
