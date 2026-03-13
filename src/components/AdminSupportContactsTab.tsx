import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Plus, Trash2, Save, Loader2, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SupportContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  available: boolean;
}

const AdminSupportContactsTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'support_contacts')
      .maybeSingle();
    if (data?.value) {
      try { setContacts(JSON.parse(data.value)); } catch { setContacts([]); }
    } else {
      // Default contact
      setContacts([{
        id: crypto.randomUUID(),
        name: 'Suporte Geral',
        phone: '5516992600631',
        role: 'Suporte Técnico',
        available: true,
      }]);
    }
    setLoading(false);
  };

  const addContact = () => {
    setContacts(prev => [...prev, {
      id: crypto.randomUUID(),
      name: '',
      phone: '',
      role: '',
      available: true,
    }]);
  };

  const removeContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const updateContact = (id: string, field: keyof SupportContact, value: any) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    const valid = contacts.filter(c => c.name && c.phone);
    if (valid.length === 0) {
      toast({ title: "Adicione pelo menos um contato válido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', 'support_contacts').maybeSingle();
      if (existing) {
        await supabase.from('admin_settings').update({ value: JSON.stringify(contacts), updated_at: new Date().toISOString() }).eq('key', 'support_contacts');
      } else {
        await supabase.from('admin_settings').insert({ key: 'support_contacts', value: JSON.stringify(contacts), description: 'Support contacts list' });
      }
      queryClient.invalidateQueries({ queryKey: ['support-contacts'] });
      toast({ title: "✅ Contatos salvos!", description: `${contacts.length} contato(s) de suporte configurado(s).` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const availableContacts = contacts.filter(c => c.available && c.name && c.phone);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            Gestão de Contatos de Suporte
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cadastre múltiplos números de suporte. O sistema exibirá os disponíveis para o usuário no botão "Falar com suporte".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status summary */}
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {contacts.length} cadastrado(s)
            </Badge>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
              {availableContacts.length} disponível(is)
            </Badge>
          </div>

          {/* Contact list */}
          <div className="space-y-3">
            {contacts.map((contact, idx) => (
              <div key={contact.id} className="rounded-xl border border-border p-4 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Contato #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Disponível</span>
                      <Switch
                        checked={contact.available}
                        onCheckedChange={(v) => updateContact(contact.id, 'available', v)}
                      />
                    </div>
                    {contacts.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => removeContact(contact.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Nome</Label>
                    <Input
                      value={contact.name}
                      onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                      placeholder="Ex: João Silva"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Telefone (com DDD)</Label>
                    <Input
                      value={contact.phone}
                      onChange={(e) => updateContact(contact.id, 'phone', e.target.value.replace(/\D/g, ''))}
                      placeholder="5516999999999"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Função</Label>
                    <Input
                      value={contact.role}
                      onChange={(e) => updateContact(contact.id, 'role', e.target.value)}
                      placeholder="Ex: Suporte Técnico"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {contact.phone && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => window.open(`https://wa.me/${contact.phone}`, '_blank')}>
                      <MessageCircle className="w-3 h-3" /> Testar WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => window.open(`tel:+${contact.phone}`)}>
                      <Phone className="w-3 h-3" /> Ligar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={addContact}>
            <Plus className="w-4 h-4" /> Adicionar Contato de Suporte
          </Button>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Contatos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSupportContactsTab;
