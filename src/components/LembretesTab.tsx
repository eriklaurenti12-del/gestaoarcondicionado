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
import { Bell, MessageCircle, Send, Users, CreditCard, Sparkles, Plus, X, CheckCircle, CalendarHeart, PartyPopper } from "lucide-react";
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

// Brazilian holidays with dynamic dates
function getBrazilianHolidays(year: number) {
  // Easter calculation (Anonymous Gregorian algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addDays = (date: Date, days: number) => {
    const r = new Date(date);
    r.setDate(r.getDate() + days);
    return r;
  };

  const carnival = addDays(easter, -47);
  const carnivalTuesday = addDays(easter, -47);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return [
    { date: new Date(year, 0, 1), name: 'Ano Novo', emoji: '🎆', message: 'Olá {nome}! 🎆 Feliz Ano Novo! Que {ano} seja repleto de conquistas. Conte conosco para manter seu ar condicionado funcionando perfeitamente o ano todo!' },
    { date: carnival, name: 'Carnaval', emoji: '🎭', message: 'Olá {nome}! 🎭 Feliz Carnaval! Antes de curtir a folia, que tal garantir a manutenção do seu ar condicionado? Agende já!' },
    { date: goodFriday, name: 'Sexta-feira Santa', emoji: '✝️', message: 'Olá {nome}! ✝️ Desejamos uma Sexta-feira Santa de paz e reflexão. Nosso atendimento retorna normalmente após o feriado!' },
    { date: easter, name: 'Páscoa', emoji: '🐣', message: 'Olá {nome}! 🐣 Feliz Páscoa! Que este dia traga renovação. Lembre-se: ar condicionado bem cuidado é sinônimo de conforto!' },
    { date: new Date(year, 3, 21), name: 'Tiradentes', emoji: '🇧🇷', message: 'Olá {nome}! 🇧🇷 Feliz Dia de Tiradentes! Aproveite o feriado com conforto — agende sua manutenção preventiva conosco!' },
    { date: new Date(year, 4, 1), name: 'Dia do Trabalho', emoji: '👷', message: 'Olá {nome}! 👷 Feliz Dia do Trabalho! Nós trabalhamos para garantir seu conforto. Agende uma revisão!' },
    { date: corpusChristi, name: 'Corpus Christi', emoji: '⛪', message: 'Olá {nome}! ⛪ Feliz Corpus Christi! Aproveite o feriado prolongado e não esqueça da limpeza do seu ar condicionado!' },
    { date: new Date(year, 8, 7), name: 'Independência do Brasil', emoji: '🇧🇷', message: 'Olá {nome}! 🇧🇷 Feliz 7 de Setembro! Independência é ter um ar condicionado sempre funcionando. Agende sua manutenção!' },
    { date: new Date(year, 9, 12), name: 'Nossa Sra. Aparecida', emoji: '🙏', message: 'Olá {nome}! 🙏 Feliz Dia de Nossa Senhora Aparecida! Que ela abençoe seu lar. Cuide do seu ar condicionado conosco!' },
    { date: new Date(year, 10, 2), name: 'Finados', emoji: '🕯️', message: 'Olá {nome}! 🕯️ Neste Dia de Finados, lembramos de quem amamos. Nosso atendimento segue normalmente após o feriado.' },
    { date: new Date(year, 10, 15), name: 'Proclamação da República', emoji: '🏛️', message: 'Olá {nome}! 🏛️ Feliz Proclamação da República! Feriado é hora de descansar com conforto. Seu ar condicionado está em dia?' },
    { date: new Date(year, 11, 25), name: 'Natal', emoji: '🎄', message: 'Olá {nome}! 🎄 Feliz Natal! Que seu lar esteja sempre fresquinho e aconchegante. Conte conosco no próximo ano!' },
    { date: new Date(year, 5, 12), name: 'Dia dos Namorados', emoji: '❤️', message: 'Olá {nome}! ❤️ Feliz Dia dos Namorados! Um ambiente climatizado é perfeito para momentos especiais. Cuide do seu ar!' },
    { date: new Date(year, 7, 11), name: 'Dia dos Pais', emoji: '👨', message: 'Olá {nome}! 👨 Feliz Dia dos Pais! Que tal presentear com conforto? Agende uma manutenção para o lar da família!' },
    { date: new Date(year, 4, 11), name: 'Dia das Mães', emoji: '👩', message: 'Olá {nome}! 👩 Feliz Dia das Mães! Presenteie com conforto — ar condicionado limpo e funcionando perfeitamente!' },
    { date: new Date(year, 9, 12), name: 'Dia das Crianças', emoji: '👧', message: 'Olá {nome}! 👧 Feliz Dia das Crianças! Ambiente climatizado é saúde para os pequenos. Agende a limpeza do seu ar!' },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

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

  const currentYear = new Date().getFullYear();
  const holidays = useMemo(() => getBrazilianHolidays(currentYear), [currentYear]);
  
  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays.filter(h => h.date >= today).slice(0, 10);
  }, [holidays]);

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

  const applyHolidayTemplate = (holidayMessage: string) => {
    const msg = holidayMessage.replace(/\{ano\}/gi, String(currentYear));
    setMessage(msg);
    setActiveTab('mensagens');
    toast({ title: '📋 Mensagem de feriado carregada! Selecione os clientes e envie.' });
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
      const personalizedMsg = message.replace(/\{nome\}/gi, client.name).replace(/\{ano\}/gi, String(currentYear));
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
        { icon: CalendarHeart, title: "Feriados", badge: "Datas", badgeColor: "purple", description: "Gere mensagens personalizadas sobre feriados e datas comemorativas para seus clientes." },
      ]} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="parcelas" className="gap-2"><CreditCard className="w-4 h-4" /> Parcelas</TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-2"><MessageCircle className="w-4 h-4" /> Mensagens</TabsTrigger>
          <TabsTrigger value="feriados" className="gap-2"><PartyPopper className="w-4 h-4" /> Feriados</TabsTrigger>
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
                  Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para o nome e <code className="bg-muted px-1 rounded">{'{ano}'}</code> para o ano atual.
                </p>

                <Button className="w-full h-11 gap-2" onClick={sendMessages}>
                  <Send className="w-4 h-4" /> Enviar para {selectedClients.length} Cliente(s)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FERIADOS */}
        <TabsContent value="feriados" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarHeart className="w-4 h-4 text-primary" /> Feriados & Datas Comemorativas — {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Clique em um feriado para carregar a mensagem personalizada na aba de mensagens. Depois selecione os clientes e envie!
              </p>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {upcomingHolidays.map((holiday, idx) => {
                  const daysUntil = differenceInDays(holiday.date, new Date());
                  const isToday = daysUntil === 0;
                  const isSoon = daysUntil >= 0 && daysUntil <= 7;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        isToday ? 'border-primary bg-primary/5 shadow-sm' : isSoon ? 'border-accent/50 bg-accent/5' : 'border-border bg-muted/30'
                      }`}
                      onClick={() => applyHolidayTemplate(holiday.message)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{holiday.emoji}</span>
                        <div>
                          <p className="text-sm font-medium">{holiday.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(holiday.date, "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isToday ? 'default' : isSoon ? 'secondary' : 'outline'} className="text-[10px]">
                          {isToday ? 'Hoje!' : daysUntil < 0 ? 'Passou' : `${daysUntil} dias`}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary">
                          <Send className="w-3 h-3" /> Usar
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {upcomingHolidays.length === 0 && (
                  <div className="text-center py-8">
                    <PartyPopper className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Nenhum feriado próximo este ano.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* All holidays grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PartyPopper className="w-4 h-4" /> Todos os Feriados de {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {holidays.map((holiday, idx) => {
                  const isPast = holiday.date < new Date();
                  return (
                    <button
                      key={idx}
                      onClick={() => applyHolidayTemplate(holiday.message)}
                      className={`p-3 rounded-lg border text-left transition-all hover:shadow-md hover:border-primary/50 ${
                        isPast ? 'opacity-50 border-border' : 'border-border bg-card'
                      }`}
                    >
                      <span className="text-xl block mb-1">{holiday.emoji}</span>
                      <p className="text-xs font-medium truncate">{holiday.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(holiday.date, 'dd/MM')}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LembretesTab;
