import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Bell, MessageCircle, Send, Users, CreditCard, Sparkles, Plus, X, CheckCircle } from "lucide-react";
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TabGuideCards from './TabGuideCards';

const messageTemplates: Record<string, string> = {
  'Promoção': 'Olá {nome}! 🎉 Aproveite nossa promoção especial! Entre em contato para saber mais.',
  'Lembrete de Agendamento': 'Olá {nome}! 📅 Lembramos que você tem um agendamento conosco. Confirme sua presença!',
  'Aniversário': 'Parabéns {nome}! 🎂 Desejamos um feliz aniversário! Como presente, temos uma condição especial para você.',
  'Retorno': 'Olá {nome}! 😊 Sentimos sua falta! Que tal agendar uma visita? Temos novidades esperando por você.',
  'Novidades': 'Olá {nome}! 🆕 Temos novidades incríveis! Novos serviços e condições especiais. Venha conferir!',
};

const LembretesTab: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('mensagens');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [savedModels, setSavedModels] = useState<{ name: string; text: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('msg_models') || '[]'); } catch { return []; }
  });
  const [newModelName, setNewModelName] = useState('');
  const [showSaveModel, setShowSaveModel] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-lembretes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: installments = [] } = useQuery({
    queryKey: ['installments-pending'],
    queryFn: async () => {
      const { data, error } = await supabase.from('installments').select('*, sales(clients(name, telefone))').eq('is_paid', false).order('due_date');
      if (error) throw error;
      return data;
    }
  });

  const clientsWithPhone = useMemo(() => clients.filter((c: any) => c.telefone), [clients]);

  const toggleClient = (id: number) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedClients.length === clientsWithPhone.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clientsWithPhone.map((c: any) => c.id));
    }
  };

  const applyTemplate = (template: string) => {
    setMessage(messageTemplates[template] || template);
  };

  const saveModel = () => {
    if (!newModelName.trim() || !message.trim()) return;
    const updated = [...savedModels, { name: newModelName, text: message }];
    setSavedModels(updated);
    localStorage.setItem('msg_models', JSON.stringify(updated));
    setNewModelName('');
    setShowSaveModel(false);
    toast({ title: 'Modelo salvo!' });
  };

  const deleteModel = (idx: number) => {
    const updated = savedModels.filter((_, i) => i !== idx);
    setSavedModels(updated);
    localStorage.setItem('msg_models', JSON.stringify(updated));
  };

  const sendMessages = () => {
    if (!message.trim()) { toast({ title: 'Digite uma mensagem', variant: 'destructive' }); return; }
    if (selectedClients.length === 0) { toast({ title: 'Selecione ao menos 1 cliente', variant: 'destructive' }); return; }

    const selected = clientsWithPhone.filter((c: any) => selectedClients.includes(c.id));
    selected.forEach((client: any) => {
      const personalizedMsg = message.replace(/\{nome\}/gi, client.name);
      const phone = client.telefone.replace(/\D/g, '');
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(personalizedMsg)}`;
      window.open(url, '_blank');
    });

    toast({ title: `✅ ${selected.length} mensagem(ns) enviada(s) via WhatsApp!` });
  };

  const pendingInstallments = useMemo(() => {
    return installments.map((inst: any) => {
      const daysUntil = differenceInDays(new Date(inst.due_date), new Date());
      return { ...inst, daysUntil };
    }).sort((a: any, b: any) => a.daysUntil - b.daysUntil);
  }, [installments]);

  return (
    <div className="space-y-4">
      <TabGuideCards cards={[
        { icon: MessageCircle, title: "Mensagens em Massa", badge: "WhatsApp", badgeColor: "green", description: "Envie mensagens personalizadas para clientes individuais ou em grupo via WhatsApp." },
        { icon: Bell, title: "Parcelas Pendentes", badge: "Cobranças", badgeColor: "rose", description: "Acompanhe parcelas vencidas e envie lembretes de pagamento automaticamente." },
      ]} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="parcelas" className="gap-2"><CreditCard className="w-4 h-4" /> Parcelas Pendentes</TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-2"><MessageCircle className="w-4 h-4" /> Mensagens em Massa</TabsTrigger>
        </TabsList>

        {/* PARCELAS PENDENTES */}
        <TabsContent value="parcelas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Parcelas Pendentes ({pendingInstallments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingInstallments.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhuma parcela pendente!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {pendingInstallments.map((inst: any) => {
                    const clientName = inst.sales?.clients?.name || 'Cliente';
                    const clientPhone = inst.sales?.clients?.telefone;
                    const isOverdue = inst.daysUntil < 0;
                    return (
                      <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'}`}>
                        <div>
                          <p className="text-sm font-medium">{clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Parcela {inst.installment_number}/{inst.total_installments} • Vence: {format(new Date(inst.due_date), 'dd/MM/yyyy')}
                          </p>
                          <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[10px] mt-1">
                            {isOverdue ? `Vencida há ${Math.abs(inst.daysUntil)} dias` : inst.daysUntil === 0 ? 'Vence hoje' : `Vence em ${inst.daysUntil} dias`}
                          </Badge>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="font-bold text-sm text-primary">R$ {Number(inst.amount).toFixed(2)}</p>
                          {clientPhone && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                              const msg = `Olá ${clientName}! Lembramos que a parcela ${inst.installment_number}/${inst.total_installments} no valor de R$ ${Number(inst.amount).toFixed(2)} vence em ${format(new Date(inst.due_date), 'dd/MM/yyyy')}. Entre em contato para efetuar o pagamento.`;
                              window.open(`https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                            }}>
                              <Send className="w-3 h-3" /> Cobrar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MENSAGENS EM MASSA */}
        <TabsContent value="mensagens" className="mt-4 space-y-4">
          {/* Templates */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Mensagens Prontas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(messageTemplates).map(t => (
                  <Button key={t} size="sm" variant="outline" className="text-xs h-8" onClick={() => applyTemplate(t)}>{t}</Button>
                ))}
                {savedModels.map((m, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="text-xs h-8 bg-primary/5" onClick={() => setMessage(m.text)}>{m.name}</Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteModel(i)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client list */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" /> Clientes ({clientsWithPhone.length})
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={selectAll}>
                      {selectedClients.length === clientsWithPhone.length ? 'Limpar' : 'Todos'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {clientsWithPhone.map((client: any) => (
                    <label key={client.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedClients.includes(client.id)} onCheckedChange={() => toggleClient(client.id)} />
                      <div>
                        <p className="text-sm font-medium">{client.name}</p>
                        <p className="text-[10px] text-muted-foreground">{client.telefone}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{selectedClients.length} selecionado(s)</p>
              </CardContent>
            </Card>

            {/* Message composer */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Mensagem
                  </span>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setShowSaveModel(!showSaveModel)}>
                    <Plus className="w-3 h-3" /> Salvar Modelo
                  </Button>
                </div>

                {showSaveModel && (
                  <div className="flex gap-2 mb-3">
                    <Input placeholder="Nome do modelo" value={newModelName} onChange={e => setNewModelName(e.target.value)} className="h-8 text-xs" />
                    <Button size="sm" className="h-8 text-xs" onClick={saveModel}>Salvar</Button>
                  </div>
                )}

                <Textarea
                  placeholder="Digite sua mensagem... Use {nome} para personalizar com o nome do cliente."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  className="mb-2"
                />
                <p className="text-[10px] text-muted-foreground mb-4">
                  Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para inserir o nome do cliente automaticamente.
                </p>

                <Button className="w-full h-11 gap-2" onClick={sendMessages}>
                  <Send className="w-4 h-4" /> Enviar para {selectedClients.length} Cliente(s)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LembretesTab;
