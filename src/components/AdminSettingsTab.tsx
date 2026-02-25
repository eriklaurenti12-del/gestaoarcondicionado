import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Link, MessageCircle, Calendar, Loader2, ExternalLink, Settings2 } from "lucide-react";

type AdminSetting = {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
};

export const AdminSettingsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    checkout_mensal: '',
    checkout_anual: '',
    whatsapp_suporte: '',
    promo_end_date: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      (data as AdminSetting[])?.forEach(item => {
        settingsMap[item.key] = item.value || '';
      });
      setSettings(prev => ({ ...prev, ...settingsMap }));
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;

      toast({
        title: "Salvo!",
        description: "Configuração atualizada com sucesso."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (error) throw error;
      }

      toast({
        title: "Todas configurações salvas! ✅",
        description: "Os links de checkout e configurações foram atualizados."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
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
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          <Settings2 className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configurações de Checkout</h2>
          <p className="text-gray-400">Configure os links de pagamento GGCheckout</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Checkout Mensal */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Link className="w-5 h-5 text-cyan-400" />
              Link Checkout Mensal (R$ 39,90)
            </CardTitle>
            <CardDescription className="text-gray-400">
              Cole aqui o link do GGCheckout para o plano mensal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://pay.ggcheckout.com.br/..."
                value={settings.checkout_mensal}
                onChange={(e) => setSettings(prev => ({ ...prev, checkout_mensal: e.target.value }))}
                className="bg-[#0f0f17] border-[#2a2a3a] text-white"
              />
              {settings.checkout_mensal && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(settings.checkout_mensal, '_blank')}
                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checkout Anual */}
        <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Link className="w-5 h-5 text-amber-400" />
              Link Checkout Anual (R$ 370,00)
            </CardTitle>
            <CardDescription className="text-cyan-300/70">
              Cole aqui o link do GGCheckout para o plano anual - Este é destacado na landing page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://pay.ggcheckout.com.br/..."
                value={settings.checkout_anual}
                onChange={(e) => setSettings(prev => ({ ...prev, checkout_anual: e.target.value }))}
                className="bg-[#0f0f17] border-[#2a2a3a] text-white"
              />
              {settings.checkout_anual && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(settings.checkout_anual, '_blank')}
                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Suporte */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageCircle className="w-5 h-5 text-green-400" />
              WhatsApp do Suporte
            </CardTitle>
            <CardDescription className="text-gray-400">
              Link do WhatsApp para ativação dos 7 dias grátis e suporte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://wa.me/5511999999999"
                value={settings.whatsapp_suporte}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_suporte: e.target.value }))}
                className="bg-[#0f0f17] border-[#2a2a3a] text-white"
              />
              {settings.whatsapp_suporte && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(settings.whatsapp_suporte, '_blank')}
                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data fim promoção */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5 text-amber-400" />
              Data Fim da Promoção
            </CardTitle>
            <CardDescription className="text-gray-400">
              Data e hora de término da promoção (aparece como contagem regressiva)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="datetime-local"
              value={settings.promo_end_date}
              onChange={(e) => setSettings(prev => ({ ...prev, promo_end_date: e.target.value }))}
              className="bg-[#0f0f17] border-[#2a2a3a] text-white"
            />
            <p className="text-xs text-gray-500">
              Deixe vazio para esconder o timer de promoção
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={saveAllSettings}
          disabled={saving}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Todas Configurações
        </Button>
      </div>
    </div>
  );
};

export default AdminSettingsTab;
