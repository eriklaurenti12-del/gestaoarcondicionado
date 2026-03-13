import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wind, Save, Upload, Loader2, Image, Type, FileText, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const AdminBrandingTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [systemName, setSystemName] = useState('AC Service Pro');
  const [systemSubtitle, setSystemSubtitle] = useState('Sistema de Gestão para Ar Condicionado');
  const [systemLogoUrl, setSystemLogoUrl] = useState('');
  const [systemCreator, setSystemCreator] = useState('Erik Laurenti');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const keys = ['system_name', 'system_subtitle', 'system_logo_url', 'system_creator'];
    const { data } = await supabase.from('admin_settings').select('key, value').in('key', keys);
    if (data) {
      data.forEach(item => {
        if (item.key === 'system_name' && item.value) setSystemName(item.value);
        if (item.key === 'system_subtitle' && item.value) setSystemSubtitle(item.value);
        if (item.key === 'system_logo_url' && item.value) setSystemLogoUrl(item.value);
        if (item.key === 'system_creator' && item.value) setSystemCreator(item.value);
      });
    }
  };

  const saveSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', key).maybeSingle();
    if (existing) {
      await supabase.from('admin_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
    } else {
      await supabase.from('admin_settings').insert({ key, value, description: `System branding: ${key}` });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('system_name', systemName),
        saveSetting('system_subtitle', systemSubtitle),
        saveSetting('system_logo_url', systemLogoUrl),
        saveSetting('system_creator', systemCreator),
      ]);
      queryClient.invalidateQueries({ queryKey: ['system-branding'] });
      queryClient.invalidateQueries({ queryKey: ['company-data-sidebar'] });
      toast({ title: "✅ Identidade salva!", description: "Todas as páginas foram atualizadas." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `system-logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage.from('landing-media').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('landing-media').getPublicUrl(fileName);
      setSystemLogoUrl(urlData.publicUrl);
      toast({ title: "Logo enviado!", description: "Salve para aplicar em todo o sistema." });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wind className="w-5 h-5 text-primary" />
          Identidade do Sistema
        </CardTitle>
        <p className="text-xs text-muted-foreground">Altere o nome, subtítulo, logo e créditos. Aplica em login, sidebar e todas as páginas.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Type className="w-3 h-3" /> Nome do Sistema</Label>
            <Input value={systemName} onChange={e => setSystemName(e.target.value)} placeholder="AC Service Pro" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Subtítulo</Label>
            <Input value={systemSubtitle} onChange={e => setSystemSubtitle(e.target.value)} placeholder="Sistema de Gestão..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Criado por</Label>
            <Input value={systemCreator} onChange={e => setSystemCreator(e.target.value)} placeholder="Nome do criador" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Image className="w-3 h-3" /> Logo do Sistema</Label>
            <div className="flex items-center gap-2">
              {systemLogoUrl && <img src={systemLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain border border-border" />}
              <label className="flex-1">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" className="w-full gap-1" asChild>
                  <span>{uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} {systemLogoUrl ? 'Trocar' : 'Enviar'} Logo</span>
                </Button>
              </label>
            </div>
            {systemLogoUrl && (
              <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setSystemLogoUrl('')}>
                Remover logo
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização:</p>
          <div className="flex items-center gap-3">
            {systemLogoUrl ? (
              <img src={systemLogoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
            ) : (
              <div className="p-2 rounded-xl bg-primary"><Wind className="w-5 h-5 text-primary-foreground" /></div>
            )}
            <div>
              <p className="font-bold text-sm">{systemName}</p>
              <p className="text-[10px] text-muted-foreground">{systemSubtitle}</p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar e Atualizar Todo o Sistema
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminBrandingTab;
