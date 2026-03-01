import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, GripVertical, Menu, RotateCcw } from "lucide-react";

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

type DragSource = {
  type: 'section' | 'item';
  sectionIdx: number;
  itemIdx?: number;
};

const AdminSidebarConfig: React.FC = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

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

  // --- Drag & Drop for sections ---
  const handleSectionDragStart = (e: React.DragEvent, sIdx: number) => {
    setDragSource({ type: 'section', sectionIdx: sIdx });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleSectionDragOver = (e: React.DragEvent, sIdx: number) => {
    e.preventDefault();
    if (dragSource?.type === 'section' && dragSource.sectionIdx !== sIdx) {
      setDragOverTarget(`section-${sIdx}`);
    }
  };

  const handleSectionDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragSource?.type === 'section' && dragSource.sectionIdx !== targetIdx) {
      const newSections = [...sections];
      const [moved] = newSections.splice(dragSource.sectionIdx, 1);
      newSections.splice(targetIdx, 0, moved);
      setSections(newSections);
    }
    setDragSource(null);
    setDragOverTarget(null);
  };

  // --- Drag & Drop for items (within & across sections) ---
  const handleItemDragStart = (e: React.DragEvent, sIdx: number, iIdx: number) => {
    e.stopPropagation();
    setDragSource({ type: 'item', sectionIdx: sIdx, itemIdx: iIdx });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleItemDragOver = (e: React.DragEvent, sIdx: number, iIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragSource?.type === 'item') {
      setDragOverTarget(`item-${sIdx}-${iIdx}`);
    }
  };

  const handleItemDrop = (e: React.DragEvent, targetSIdx: number, targetIIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragSource?.type === 'item' && dragSource.itemIdx !== undefined) {
      const newSections = [...sections];
      // Remove from source
      const sourceItems = [...newSections[dragSource.sectionIdx].items];
      const [movedItem] = sourceItems.splice(dragSource.itemIdx, 1);
      newSections[dragSource.sectionIdx] = { ...newSections[dragSource.sectionIdx], items: sourceItems };
      // Insert at target
      const targetItems = [...newSections[targetSIdx].items];
      targetItems.splice(targetIIdx, 0, movedItem);
      newSections[targetSIdx] = { ...newSections[targetSIdx], items: targetItems };
      setSections(newSections);
    }
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOverTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Menu className="w-5 h-5 text-primary" />
            Configuração do Menu Lateral
          </h2>
          <p className="text-muted-foreground text-sm">Arraste para reorganizar seções e itens</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restaurar
          </Button>
          <Button onClick={saveConfig} disabled={saving} size="sm">
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar Menu'}
          </Button>
        </div>
      </div>

      {sections.map((section, sIdx) => (
        <Card
          key={sIdx}
          draggable
          onDragStart={(e) => handleSectionDragStart(e, sIdx)}
          onDragOver={(e) => handleSectionDragOver(e, sIdx)}
          onDrop={(e) => handleSectionDrop(e, sIdx)}
          onDragEnd={handleDragEnd}
          className={`transition-all cursor-grab active:cursor-grabbing ${
            dragOverTarget === `section-${sIdx}` ? 'border-primary ring-2 ring-primary/30' : ''
          } ${dragSource?.type === 'section' && dragSource.sectionIdx === sIdx ? 'opacity-50' : ''}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Nome da Seção</Label>
                <Input
                  value={section.label}
                  onChange={(e) => updateSectionLabel(sIdx, e.target.value)}
                  className="h-8 font-semibold"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  draggable={false}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {section.items.map((item, iIdx) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, sIdx, iIdx)}
                onDragOver={(e) => handleItemDragOver(e, sIdx, iIdx)}
                onDrop={(e) => handleItemDrop(e, sIdx, iIdx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 p-2 rounded-lg border bg-muted/30 cursor-grab active:cursor-grabbing transition-all ${
                  dragOverTarget === `item-${sIdx}-${iIdx}` ? 'border-primary bg-primary/10' : ''
                } ${dragSource?.type === 'item' && dragSource.sectionIdx === sIdx && dragSource.itemIdx === iIdx ? 'opacity-40' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={item.title}
                  onChange={(e) => updateItemTitle(sIdx, iIdx, e.target.value)}
                  className="h-7 text-sm flex-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  draggable={false}
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
