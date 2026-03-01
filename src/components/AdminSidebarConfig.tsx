import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, GripVertical, ArrowUp, ArrowDown, Plus, Trash2, Menu } from "lucide-react";

const defaultSections = [
  { label: "Principal", icon: "Snowflake", items: [
    { id: "dashboard", title: "Painel" },
    { id: "cadastros", title: "Cadastros" },
    { id: "appointments", title: "Agenda" },
    { id: "online-bookings", title: "Agendamento Online" },
  ]},
  { label: "Gestão", icon: "ClipboardList", items: [
    { id: "documents", title: "Orçamentos & O.S." },
    { id: "services", title: "Manutenções" },
    { id: "btu-calculator", title: "Medição BTUs" },
  ]},
  { label: "Vendas", icon: "ShoppingCart", items: [
    { id: "pdv", title: "PDV / Vendas" },
  ]},
  { label: "Financeiro", icon: "Wallet", items: [
    { id: "financeiro", title: "Financeiro" },
    { id: "impostos", title: "Impostos" },
  ]},
  { label: "Configurações", icon: "Settings", items: [
    { id: "company", title: "Minha Empresa" },
    { id: "notifications-settings", title: "Notificações" },
    { id: "backup", title: "Backup" },
  ]},
];

const AdminSidebarConfig: React.FC = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'sidebar_config')
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed.sections) setSections(parsed.sections);
      } catch {}
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase.from('admin_settings').upsert({
      key: 'sidebar_config',
      value: JSON.stringify({ sections }),
      description: 'Configuração do menu lateral',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Menu salvo!", description: "As alterações serão aplicadas ao recarregar." });
    }
    setSaving(false);
  };

  const resetToDefault = () => {
    setSections(defaultSections);
    toast({ title: "Menu restaurado ao padrão" });
  };

  const moveSectionUp = (idx: number) => {
    if (idx === 0) return;
    const newSections = [...sections];
    [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
    setSections(newSections);
  };

  const moveSectionDown = (idx: number) => {
    if (idx >= sections.length - 1) return;
    const newSections = [...sections];
    [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
    setSections(newSections);
  };

  const updateSectionLabel = (idx: number, label: string) => {
    const newSections = [...sections];
    newSections[idx] = { ...newSections[idx], label };
    setSections(newSections);
  };

  const updateItemTitle = (sectionIdx: number, itemIdx: number, title: string) => {
    const newSections = [...sections];
    newSections[sectionIdx] = {
      ...newSections[sectionIdx],
      items: newSections[sectionIdx].items.map((item, i) => i === itemIdx ? { ...item, title } : item)
    };
    setSections(newSections);
  };

  const moveItemUp = (sectionIdx: number, itemIdx: number) => {
    if (itemIdx === 0) return;
    const newSections = [...sections];
    const items = [...newSections[sectionIdx].items];
    [items[itemIdx - 1], items[itemIdx]] = [items[itemIdx], items[itemIdx - 1]];
    newSections[sectionIdx] = { ...newSections[sectionIdx], items };
    setSections(newSections);
  };

  const moveItemDown = (sectionIdx: number, itemIdx: number) => {
    const items = sections[sectionIdx].items;
    if (itemIdx >= items.length - 1) return;
    const newSections = [...sections];
    const newItems = [...newSections[sectionIdx].items];
    [newItems[itemIdx], newItems[itemIdx + 1]] = [newItems[itemIdx + 1], newItems[itemIdx]];
    newSections[sectionIdx] = { ...newSections[sectionIdx], items: newItems };
    setSections(newSections);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Menu className="w-5 h-5 text-primary" />
            Configuração do Menu Lateral
          </h2>
          <p className="text-muted-foreground text-sm">Reorganize seções, renomeie abas e mude a ordem dos itens</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>Restaurar Padrão</Button>
          <Button onClick={saveConfig} disabled={saving} size="sm">
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar Menu'}
          </Button>
        </div>
      </div>

      {sections.map((section, sIdx) => (
        <Card key={sIdx}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveSectionUp(sIdx)} disabled={sIdx === 0}>
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveSectionDown(sIdx)} disabled={sIdx >= sections.length - 1}>
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Nome da Seção</Label>
                <Input
                  value={section.label}
                  onChange={(e) => updateSectionLabel(sIdx, e.target.value)}
                  className="h-8 font-semibold"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.items.map((item, iIdx) => (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col gap-0.5 mr-1">
                  <Button size="icon" variant="ghost" className="h-4 w-4" onClick={() => moveItemUp(sIdx, iIdx)} disabled={iIdx === 0}>
                    <ArrowUp className="w-2.5 h-2.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-4 w-4" onClick={() => moveItemDown(sIdx, iIdx)} disabled={iIdx >= section.items.length - 1}>
                    <ArrowDown className="w-2.5 h-2.5" />
                  </Button>
                </div>
                <Input
                  value={item.title}
                  onChange={(e) => updateItemTitle(sIdx, iIdx, e.target.value)}
                  className="h-7 text-sm flex-1"
                />
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">{item.id}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminSidebarConfig;
