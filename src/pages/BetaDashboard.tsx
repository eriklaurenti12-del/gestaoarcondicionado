import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBetaMode } from '@/contexts/BetaModeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, CalendarDays, Users, DollarSign, FileText, 
  Plus, Search, ArrowLeft, Moon, Sun, Zap, Clock, 
  Phone, Wallet, ShoppingCart, ClipboardList, Wind,
  Download, Minus, Trash2, Receipt, Package,
  Wrench, FileCheck, Thermometer, Home, MoreHorizontal,
  TrendingUp, Bell, Globe, Settings, X, RefreshCw,
  Check, MapPin, Navigation, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, isToday, startOfDay, isSameDay, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import LembretesTab from '@/components/LembretesTab';
import ImpostosTab from '@/components/ImpostosTab';
import OnlineBookingsTab from '@/components/OnlineBookingsTab';
import CompanyDataTab from '@/components/CompanyDataTab';

type BetaView = 'home' | 'agenda' | 'pdv' | 'cadastros' | 'mais' | 'financeiro' | 'impostos' | 'lembretes' | 'online-bookings' | 'configuracoes' | 'novo-cliente' | 'estoque' | 'orcamentos' | 'os';

export default function BetaDashboard() {
  const navigate = useNavigate();
  const { toggleBeta } = useBetaMode();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [view, setView] = useState<BetaView>('home');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentFinancial, setRecentFinancial] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cadastroTab, setCadastroTab] = useState<'clientes' | 'servicos'>('clientes');

  // Form states  
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  // PDV states
  const [pdvCart, setPdvCart] = useState<{ product: any; qty: number }[]>([]);
  const [pdvSearch, setPdvSearch] = useState('');
  const [pdvPayment, setPdvPayment] = useState<'PIX' | 'Dinheiro' | 'Débito' | 'Crédito'>('PIX');
  const [pdvClientSearch, setPdvClientSearch] = useState('');
  const [pdvSelectedClient, setPdvSelectedClient] = useState<any>(null);
  const [pdvClientMode, setPdvClientMode] = useState<'cadastrado' | 'nome' | 'consumidor'>('cadastrado');
  const [pdvClientName, setPdvClientName] = useState('');
  const [pdvDiscount, setPdvDiscount] = useState(0);
  const [pdvDiscountValue, setPdvDiscountValue] = useState(0);
  const [pdvTab, setPdvTab] = useState<'pdv' | 'historico'>('pdv');

  // Agenda states
  const [agendaTab, setAgendaTab] = useState<'lista' | 'horarios'>('lista');
  const [agendaSearch, setAgendaSearch] = useState('');
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('todos');
  const [boardDate, setBoardDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mais panel open state
  const [maisOpen, setMaisOpen] = useState(false);

  // Real-time clock for schedule board
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return; }
      switch (e.key) {
        case 'F1': e.preventDefault(); setView('home'); break;
        case 'F2': e.preventDefault(); setView('pdv'); break;
        case 'F3': e.preventDefault(); setView('agenda'); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view]);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/'); return; }
    setUserId(session.user.id);
    setLoading(false);
    loadData(session.user.id);
  };

  const loadData = async (uid: string) => {
    const [aptsRes, allAptsRes, clientsRes, finRes, prodsRes, quotesRes, salesRes, expensesRes] = await Promise.all([
      supabase.from('appointments').select('*, clients(name, telefone, address), products(name, price, service_duration, cost_price)').eq('user_id', uid).gte('appointment_date', startOfDay(new Date()).toISOString()).order('appointment_date', { ascending: true }).limit(50),
      supabase.from('appointments').select('*, clients(name, telefone, address), products(name, price, service_duration, cost_price)').eq('user_id', uid).order('appointment_date', { ascending: false }).limit(500),
      supabase.from('clients').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
      supabase.from('financial_records').select('*').eq('user_id', uid).order('record_date', { ascending: false }).limit(100),
      supabase.from('products').select('*, suppliers(name)').eq('user_id', uid).order('name').limit(500),
      supabase.from('quotes').select('*, clients(name)').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
      supabase.from('sales').select('*, clients(name), products(name)').eq('user_id', uid).order('sale_date', { ascending: false }).limit(100),
      supabase.from('fixed_expenses').select('*').eq('user_id', uid).order('expense_date', { ascending: false }).limit(100),
    ]);
    if (aptsRes.data) setTodayAppointments(aptsRes.data);
    if (allAptsRes.data) setAllAppointments(allAptsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (finRes.data) setRecentFinancial(finRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
    if (quotesRes.data) setQuotes(quotesRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (expensesRes.data) setFixedExpenses(expensesRes.data);
  };

  const addClient = async () => {
    if (!newClientName.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    const { error } = await supabase.from('clients').insert({ user_id: userId, name: newClientName, telefone: newClientPhone, address: newClientAddress });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Cliente cadastrado!' });
    setNewClientName(''); setNewClientPhone(''); setNewClientAddress('');
    setView('cadastros');
    loadData(userId);
  };

  // Update appointment status
  const updateAppointmentStatus = async (id: string, status: string, appointment?: any) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    
    // If completing, register sale + financial record
    if ((status === 'concluido' || status === 'concluído') && appointment?.service_id && appointment?.client_id && appointment?.products) {
      const salePrice = Number(appointment.products.price);
      const costPrice = Number(appointment.products.cost_price || 0);
      
      await supabase.from('sales').insert({
        user_id: userId, client_id: appointment.client_id, product_id: appointment.service_id,
        qty: 1, sale_price: salePrice, total_profit: salePrice - costPrice, payment_method: 'Dinheiro' as const,
      });
      await supabase.from('financial_records').insert({
        user_id: userId, type: 'entrada', amount: salePrice,
        description: `Serviço concluído: ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`,
        payment_method: 'Dinheiro', category: 'Serviço Agenda',
      });
    }
    
    toast({ title: `✅ Status: ${status}` });
    loadData(userId);
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm('Excluir agendamento?')) return;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', variant: 'destructive' }); return; }
    toast({ title: 'Agendamento removido' });
    loadData(userId);
  };

  // PDV functions
  const addToCart = (product: any) => {
    setPdvCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (productId: number) => setPdvCart(prev => prev.filter(i => i.product.id !== productId));
  const cartSubtotal = pdvCart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartTotal = Math.max(0, cartSubtotal - pdvDiscountValue - (cartSubtotal * pdvDiscount / 100));

  const finalizePdvSale = async () => {
    if (pdvCart.length === 0) { toast({ title: 'Carrinho vazio', variant: 'destructive' }); return; }
    for (const item of pdvCart) {
      const { error } = await supabase.from('sales').insert({
        user_id: userId, product_id: item.product.id, client_id: pdvSelectedClient?.id || 1,
        qty: item.qty, sale_price: item.product.price,
        total_profit: (item.product.price - item.product.cost_price) * item.qty, payment_method: pdvPayment,
      });
      if (error) { toast({ title: 'Erro na venda', description: error.message, variant: 'destructive' }); return; }
    }
    // Financial record
    await supabase.from('financial_records').insert({
      user_id: userId, type: 'entrada', amount: cartTotal,
      description: `Venda PDV - ${pdvCart.map(i => i.product.name).join(', ')}`,
      payment_method: pdvPayment, category: 'Venda PDV',
    });
    toast({ title: `✅ Venda de R$ ${cartTotal.toFixed(2)} finalizada!` });
    setPdvCart([]); setPdvSelectedClient(null); setPdvDiscount(0); setPdvDiscountValue(0);
    loadData(userId);
  };

  // PDF Exports
  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Agenda - Gestao AC', 14, 20);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    const data = (agendaStatusFilter === 'todos' ? filteredAgenda : filteredAgenda).map(a => [
      format(new Date(a.appointment_date), 'dd/MM/yyyy HH:mm'),
      (a.clients as any)?.name || '-',
      (a.products as any)?.name || '-',
      a.status,
      `R$ ${Number((a.products as any)?.price || 0).toFixed(2)}`
    ]);
    autoTable(doc, { startY: 34, head: [['Data/Hora', 'Cliente', 'Serviço', 'Status', 'Valor']], body: data });
    doc.save('agenda.pdf'); toast({ title: '📄 PDF exportado!' });
  };

  const exportClientesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Clientes - Gestao AC', 14, 20);
    doc.setFontSize(10); doc.text(`Total: ${clients.length} clientes`, 14, 28);
    autoTable(doc, { startY: 34, head: [['Nome', 'Telefone', 'Endereço']],
      body: clients.map(c => [c.name, c.telefone || '-', c.address || '-']),
    });
    doc.save('clientes.pdf'); toast({ title: '📄 PDF exportado!' });
  };

  const exportFinanceiroPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Financeiro - Gestao AC', 14, 20);
    const monthStr = format(new Date(), 'MMMM yyyy', { locale: ptBR });
    doc.setFontSize(10); doc.text(`Período: ${monthStr}`, 14, 28);
    autoTable(doc, { startY: 34, head: [['Data', 'Descrição', 'Tipo', 'Valor']],
      body: recentFinancial.map(r => [
        format(new Date(r.record_date), 'dd/MM/yyyy'),
        r.description || r.category || '-',
        r.type === 'entrada' ? 'Receita' : 'Despesa',
        `R$ ${Number(r.amount).toFixed(2)}`
      ]),
    });
    doc.save('financeiro.pdf'); toast({ title: '📄 PDF exportado!' });
  };

  const exportOrcamentoPDF = (quote: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Orçamento #${quote.quote_number}`, 14, 20);
    doc.setFontSize(12); doc.text(quote.title, 14, 30);
    doc.setFontSize(10);
    doc.text(`Cliente: ${(quote.clients as any)?.name || '-'}`, 14, 40);
    doc.text(`Data: ${format(new Date(quote.created_at), 'dd/MM/yyyy')}`, 14, 48);
    doc.text(`Status: ${quote.status}`, 14, 56);
    doc.setFontSize(14); doc.text(`Total: R$ ${Number(quote.total).toFixed(2)}`, 14, 70);
    doc.save(`orcamento-${quote.quote_number}.pdf`);
    toast({ title: '📄 PDF exportado!' });
  };



  // Computed values
  const agendaStats = useMemo(() => {
    const total = allAppointments.length;
    const agendados = allAppointments.filter(a => a.status === 'agendado').length;
    const confirmados = allAppointments.filter(a => a.status === 'confirmado').length;
    const concluidos = allAppointments.filter(a => a.status === 'concluído' || a.status === 'concluido').length;
    const cancelados = allAppointments.filter(a => a.status === 'cancelado').length;
    const faturamento = allAppointments.filter(a => a.status === 'concluído' || a.status === 'concluido').reduce((s, a) => s + ((a.products as any)?.price || 0), 0);
    return { total, agendados, confirmados, concluidos, cancelados, faturamento };
  }, [allAppointments]);

  const filteredAgenda = useMemo(() => {
    return allAppointments.filter(a => {
      const matchSearch = agendaSearch === '' || 
        (a.clients as any)?.name?.toLowerCase().includes(agendaSearch.toLowerCase()) ||
        (a.products as any)?.name?.toLowerCase().includes(agendaSearch.toLowerCase());
      const matchStatus = agendaStatusFilter === 'todos' || a.status === agendaStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [allAppointments, agendaSearch, agendaStatusFilter]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.telefone?.includes(searchQuery)
  );

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(pdvSearch.toLowerCase()));

  // Financial computed
  const monthPrefix = format(new Date(), 'yyyy-MM');
  const monthReceitas = recentFinancial.filter(r => r.type === 'entrada' && r.record_date?.substring(0, 7) === monthPrefix).reduce((s, r) => s + Number(r.amount), 0);
  const monthDespesas = recentFinancial.filter(r => r.type === 'saida' && r.record_date?.substring(0, 7) === monthPrefix).reduce((s, r) => s + Number(r.amount), 0);
  const monthExpenses = fixedExpenses.filter(e => e.expense_date?.substring(0, 7) === monthPrefix).reduce((s, e) => s + Number(e.amount), 0);

  const todayApts = allAppointments.filter(a => isToday(new Date(a.appointment_date)));
  const todayRevenue = todayApts.filter(a => a.status === 'concluído' || a.status === 'concluido').reduce((s, a) => s + ((a.products as any)?.price || 0), 0);

  // Schedule board time slots
  const timeSlots = ['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];

  const boardAppointments = allAppointments.filter(a => 
    isSameDay(new Date(a.appointment_date), boardDate) && a.status !== 'cancelado'
  );

  const slotMap = useMemo(() => {
    const map: Record<string, { appointment: any; isBlocked: boolean }> = {};
    boardAppointments.forEach(apt => {
      const aptTime = new Date(apt.appointment_date);
      const time = format(aptTime, 'HH:mm');
      const duration = (apt.products as any)?.service_duration || 60;
      const slots = Math.ceil(duration / 30);
      map[time] = { appointment: apt, isBlocked: false };
      for (let i = 1; i < slots; i++) {
        const blockedTime = new Date(aptTime.getTime() + i * 30 * 60000);
        const blockedSlot = format(blockedTime, 'HH:mm');
        if (!map[blockedSlot]) map[blockedSlot] = { appointment: apt, isBlocked: true };
      }
    });
    return map;
  }, [boardAppointments]);

  // Early return AFTER all hooks
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Wind className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  const isSlotPast = (time: string) => {
    if (!isToday(boardDate)) return isBefore(boardDate, startOfDay(new Date()));
    const [h, m] = time.split(':').map(Number);
    const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
    return isBefore(slotTime, currentTime);
  };

  const isCurrentSlot = (time: string) => {
    if (!isToday(boardDate)) return false;
    const [h, m] = time.split(':').map(Number);
    return h === currentTime.getHours() && ((m === 0 && currentTime.getMinutes() < 30) || (m === 30 && currentTime.getMinutes() >= 30));
  };

  // ========== VIEWS ==========

  const renderHome = () => (
    <div className="space-y-3 px-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer" onClick={() => setView('agenda')}>
          <CardContent className="p-4 text-center">
            <CalendarDays className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{todayApts.length}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setView('financeiro')}>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">R$ {todayRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Faturado Hoje</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer" onClick={() => setView('financeiro')}>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">R$ {monthReceitas.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Mês</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setView('cadastros')}>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{clients.length}</p>
            <p className="text-xs text-muted-foreground">Clientes</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('pdv')}><ShoppingCart className="w-4 h-4" /> Nova Venda</Button>
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('agenda')}><CalendarDays className="w-4 h-4" /> Agendar</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('cadastros')}><Users className="w-4 h-4" /> Cadastros</Button>
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('financeiro')}><TrendingUp className="w-4 h-4" /> Financeiro</Button>
      </div>

      {/* Today's schedule */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Próximos de Hoje</span>
          </div>
          {todayApts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento para hoje 🌿</p>
          ) : (
            <div className="space-y-2">
              {todayApts.slice(0, 5).map(apt => (
                <div key={apt.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{(apt.clients as any)?.name || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">{(apt.products as any)?.name} • {format(new Date(apt.appointment_date), 'HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{apt.status}</Badge>
                    {apt.status === 'agendado' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateAppointmentStatus(apt.id, 'confirmado', apt)}>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAgenda = () => (
    <div className="space-y-3 px-4 pt-4">
      {/* Tabs */}
      <div className="flex bg-muted/50 rounded-lg p-1">
        {[{ id: 'lista', icon: ClipboardList, label: 'Lista' }, { id: 'horarios', icon: Clock, label: 'Quadro' }].map(t => (
          <button key={t.id} onClick={() => setAgendaTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${agendaTab === t.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { label: 'Total', value: agendaStats.total, color: 'text-foreground' },
          { label: 'Agendados', value: agendaStats.agendados, color: 'text-yellow-500' },
          { label: 'Confirmados', value: agendaStats.confirmados, color: 'text-blue-500' },
          { label: 'Concluídos', value: agendaStats.concluidos, color: 'text-green-500' },
          { label: 'Faturamento', value: `R$ ${agendaStats.faturamento.toFixed(0)}`, color: 'text-green-500' },
        ].map(s => (
          <Card key={s.label} className="min-w-[90px]">
            <CardContent className="p-2.5">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportAgendaPDF}><Download className="w-3.5 h-3.5" /> PDF</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => loadData(userId)}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {agendaTab === 'lista' ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4" />
              <span className="font-semibold text-sm">Agendamentos</span>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente ou serviço..." className="pl-9 h-9" value={agendaSearch} onChange={e => setAgendaSearch(e.target.value)} />
            </div>
            {/* Status filter */}
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {['todos', 'agendado', 'confirmado', 'concluído', 'cancelado'].map(s => (
                <Button key={s} size="sm" variant={agendaStatusFilter === s ? 'default' : 'outline'} className="text-[10px] h-7 capitalize" onClick={() => setAgendaStatusFilter(s)}>
                  {s}
                </Button>
              ))}
            </div>
            {filteredAgenda.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">Nenhum agendamento encontrado</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredAgenda.slice(0, 50).map(apt => {
                  const aptDate = new Date(apt.appointment_date);
                  const isPast = aptDate < new Date() && apt.status !== 'concluído' && apt.status !== 'concluido' && apt.status !== 'cancelado';
                  return (
                    <div key={apt.id} className={`p-3 rounded-lg border border-border/50 ${isPast ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{(apt.clients as any)?.name || 'Cliente'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(aptDate, 'dd/MM/yyyy')} • {format(aptDate, 'HH:mm')} 
                            {(apt.products as any)?.service_duration && <span className="text-primary"> ({(apt.products as any).service_duration}min)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{(apt.products as any)?.name}</p>
                          {(apt.products as any)?.price && <p className="text-xs font-medium text-primary">R$ {Number((apt.products as any).price).toFixed(2)}</p>}
                        </div>
                        <Badge variant={apt.status === 'concluído' || apt.status === 'concluido' ? 'default' : apt.status === 'cancelado' ? 'destructive' : 'outline'} className="text-[10px] ml-2">
                          {apt.status}
                        </Badge>
                      </div>
                      {/* Action buttons */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(apt.status === 'agendado') && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => updateAppointmentStatus(apt.id, 'confirmado', apt)}>
                              <Check className="w-3 h-3" /> Confirmar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 text-destructive" onClick={() => updateAppointmentStatus(apt.id, 'cancelado')}>
                              <X className="w-3 h-3" /> Cancelar
                            </Button>
                          </>
                        )}
                        {(apt.status === 'confirmado') && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 text-green-600" onClick={() => updateAppointmentStatus(apt.id, 'concluido', apt)}>
                              <Check className="w-3 h-3" /> Concluir
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 text-destructive" onClick={() => updateAppointmentStatus(apt.id, 'cancelado')}>
                              <X className="w-3 h-3" /> Cancelar
                            </Button>
                          </>
                        )}
                        {isPast && apt.status === 'agendado' && (
                          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1 bg-green-600" onClick={() => updateAppointmentStatus(apt.id, 'concluido', apt)}>
                            <Check className="w-3 h-3" /> Serviço Feito
                          </Button>
                        )}
                        {(apt.clients as any)?.telefone && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`https://wa.me/55${(apt.clients as any).telefone.replace(/\D/g, '')}`, '_blank')}>
                            <Phone className="w-3 h-3 text-green-500" />
                          </Button>
                        )}
                        {(apt.clients as any)?.address && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((apt.clients as any).address)}`, '_blank')}>
                            <MapPin className="w-3 h-3 text-blue-500" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAppointment(apt.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Schedule Board */
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                {format(currentTime, 'HH:mm:ss')}
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setBoardDate(addDays(boardDate, -1))} disabled={isSameDay(boardDate, new Date())}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">{isToday(boardDate) ? 'Hoje' : format(boardDate, 'dd/MM', { locale: ptBR })}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setBoardDate(addDays(boardDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y">
              {timeSlots.map(time => {
                const slotData = slotMap[time];
                const appointment = slotData?.appointment;
                const isBlocked = slotData?.isBlocked;
                const isPast = isSlotPast(time);
                const isCurrent = isCurrentSlot(time);
                return (
                  <div key={time} className={`flex items-stretch ${
                    isCurrent ? 'bg-primary/20 border-l-4 border-primary' :
                    isPast ? 'bg-muted/50 opacity-60' :
                    isBlocked ? 'bg-orange-50 dark:bg-orange-950/20' :
                    appointment ? 'bg-green-50 dark:bg-green-950/20' : ''
                  }`}>
                    <div className={`w-14 flex-shrink-0 p-2 text-center font-mono text-xs border-r ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{time}</div>
                    <div className="flex-1 p-2 min-h-[40px]">
                      {isBlocked && !appointment ? (
                        <span className="text-[10px] text-orange-600">⏳ Em serviço</span>
                      ) : appointment && !isBlocked ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">{appointment.clients?.name || 'Cliente'}</p>
                            <p className="text-[10px] text-muted-foreground">{appointment.products?.name} {appointment.products?.service_duration && `(${appointment.products.service_duration}min)`}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px]">{appointment.status}</Badge>
                        </div>
                      ) : isPast ? (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      ) : (
                        <span className="text-[10px] text-green-600">Disponível</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderPDV = () => (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex bg-muted/50 rounded-lg p-1">
        <button onClick={() => setPdvTab('pdv')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${pdvTab === 'pdv' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> PDV
        </button>
        <button onClick={() => setPdvTab('historico')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${pdvTab === 'historico' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
          <TrendingUp className="w-3.5 h-3.5" /> Histórico
        </button>
      </div>

      {pdvTab === 'pdv' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Produtos & Serviços</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={pdvSearch} onChange={e => setPdvSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-left transition-colors">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-16 object-cover rounded mb-1.5" />}
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-sm font-bold text-primary">R$ {Number(p.price).toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Carrinho</h3>
              <div className="flex gap-1 mb-3">
                {(['cadastrado', 'consumidor'] as const).map(m => (
                  <Button key={m} size="sm" variant={pdvClientMode === m ? 'default' : 'outline'} className="flex-1 text-[10px] h-7 capitalize" onClick={() => setPdvClientMode(m)}>
                    {m === 'cadastrado' ? 'Cadastrado' : 'Consumidor'}
                  </Button>
                ))}
              </div>
              {pdvClientMode === 'cadastrado' && (
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mb-3"
                  onChange={e => { const c = clients.find(cl => cl.id === Number(e.target.value)); setPdvSelectedClient(c); }}>
                  <option value="">Selecione cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}

              {pdvCart.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Carrinho vazio</p>
              ) : (
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {pdvCart.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPdvCart(prev => prev.map(i => i.product.id === item.product.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i))}><Minus className="w-3 h-3" /></Button>
                        <span className="font-medium text-xs">{item.qty}x</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPdvCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, qty: i.qty + 1 } : i))}><Plus className="w-3 h-3" /></Button>
                        <span className="truncate text-xs">{item.product.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs">R$ {(item.product.price * item.qty).toFixed(2)}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <div className="flex-1"><label className="text-[10px] text-muted-foreground">Desc. %</label><Input type="number" min="0" max="100" value={pdvDiscount} onChange={e => setPdvDiscount(Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="flex-1"><label className="text-[10px] text-muted-foreground">Desc. R$</label><Input type="number" min="0" value={pdvDiscountValue} onChange={e => setPdvDiscountValue(Number(e.target.value))} className="h-8 text-xs" /></div>
              </div>

              <div className="mb-3">
                <div className="flex gap-1.5">
                  <select className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs" value={pdvPayment} onChange={e => setPdvPayment(e.target.value as any)}>
                    <option>Dinheiro</option><option>PIX</option><option>Débito</option><option>Crédito</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-border pt-3 mb-3">
                <span className="font-bold">Total:</span>
                <span className="text-xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => { setPdvCart([]); setPdvDiscount(0); setPdvDiscountValue(0); }}>Limpar</Button>
                <Button className="flex-1 h-10 bg-primary" onClick={finalizePdvSale}>Finalizar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Últimas Vendas</h3>
            {sales.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">Nenhuma venda</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sales.slice(0, 30).map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">{(s.products as any)?.name || 'Produto'}</p>
                      <p className="text-[10px] text-muted-foreground">{(s.clients as any)?.name || '-'} • {format(new Date(s.sale_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-primary">R$ {Number(s.sale_price * s.qty).toFixed(2)}</p>
                      <Badge variant="outline" className="text-[9px]">{s.payment_method}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCadastros = () => (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex bg-muted/50 rounded-lg p-1">
        <button onClick={() => setCadastroTab('clientes')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${cadastroTab === 'clientes' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
          <Users className="w-3.5 h-3.5" /> Clientes
        </button>
        <button onClick={() => setCadastroTab('servicos')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${cadastroTab === 'servicos' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
          <Wrench className="w-3.5 h-3.5" /> Serviços & Produtos
        </button>
      </div>

      {cadastroTab === 'clientes' ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Clientes ({clients.length})</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="gap-1 text-xs h-8" onClick={() => setView('novo-cliente')}><Plus className="w-3 h-3" /> Novo</Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={exportClientesPDF}><Download className="w-3 h-3" /> PDF</Button>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum cliente</p>
              ) : filteredClients.slice(0, 50).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{c.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.telefone || '-'} {c.address ? `• ${c.address}` : ''}</p>
                    </div>
                  </div>
                  {c.telefone && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')}>
                      <Phone className="w-3.5 h-3.5 text-green-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Serviços & Produtos ({products.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {products.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.type === 'service' ? 'Serviço' : p.type === 'piece' ? `Peça • Est: ${p.qty}` : 'Produto'}
                      {p.service_duration && ` • ${p.service_duration}min`}
                    </p>
                  </div>
                  <p className="font-bold text-sm text-primary">R$ {Number(p.price).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderNovoCliente = () => (
    <div className="px-4 pt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Novo Cliente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Nome completo *" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
          <Input placeholder="Telefone / WhatsApp" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
          <Input placeholder="Endereço" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} />
          <Button onClick={addClient} className="w-full h-11"><Plus className="w-4 h-4 mr-2" /> Cadastrar Cliente</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderFinanceiro = () => (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportFinanceiroPDF}><Download className="w-3.5 h-3.5" /> PDF</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => loadData(userId)}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Receitas (Mês)</p>
          <p className="text-xl font-bold text-green-500">R$ {monthReceitas.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Despesas (Mês)</p>
          <p className="text-xl font-bold text-destructive">R$ {(monthDespesas + monthExpenses).toFixed(2)}</p>
        </CardContent></Card>
      </div>
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Lucro Líquido (Mês)</p>
        <p className={`text-2xl font-bold ${(monthReceitas - monthDespesas - monthExpenses) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
          R$ {(monthReceitas - monthDespesas - monthExpenses).toFixed(2)}
        </p>
      </CardContent></Card>
      
      <h3 className="font-semibold text-sm">Últimos Registros</h3>
      {recentFinancial.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">Nenhum registro financeiro</p>
      ) : recentFinancial.slice(0, 20).map(rec => (
        <Card key={rec.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${rec.type === 'entrada' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`w-4 h-4 ${rec.type === 'entrada' ? 'text-green-500' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm font-medium">{rec.description || rec.category || 'Registro'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(rec.record_date), 'dd/MM/yyyy')}</p>
              </div>
            </div>
            <p className={`font-bold text-sm ${rec.type === 'entrada' ? 'text-green-500' : 'text-destructive'}`}>
              {rec.type === 'entrada' ? '+' : '-'}R$ {Number(rec.amount).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderImpostos = () => (
    <div className="px-4 pt-4"><ImpostosTab /></div>
  );

  const renderLembretes = () => (<div className="px-4 pt-4"><LembretesTab /></div>);

  const renderOnlineBookings = () => (
    <div className="px-4 pt-4"><OnlineBookingsTab userId={userId} /></div>
  );

  const renderConfiguracoes = () => (
    <div className="px-4 pt-4"><CompanyDataTab /></div>
  );

  const renderEstoque = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Estoque ({products.filter(p => p.type === 'piece').length} itens)</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.filter(p => p.type === 'piece').length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum item no estoque</p>
            ) : products.filter(p => p.type === 'piece').map(p => (
              <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(p as any).suppliers?.name || '-'} • R$ {Number(p.price).toFixed(2)}</p>
                </div>
                <Badge variant={p.qty <= (p.min_stock || 0) ? 'destructive' : 'secondary'} className="text-xs">{p.qty} un.</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOrcamentos = () => (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Orçamentos ({quotes.length})</h3>
      </div>
      {quotes.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum orçamento</CardContent></Card>
      ) : quotes.map(q => (
        <Card key={q.id}>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">{q.title}</p>
                <p className="text-xs text-muted-foreground">{(q.clients as any)?.name || '-'} • {format(new Date(q.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary text-sm">R$ {Number(q.total).toFixed(2)}</p>
                <Badge variant={q.status === 'aprovado' ? 'default' : 'outline'} className="text-[10px]">{q.status}</Badge>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => exportOrcamentoPDF(q)}><Download className="w-3 h-3" /> PDF</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderOS = () => (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Ordens de Serviço ({serviceOrders.length})</h3>
      </div>
      {serviceOrders.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum Pedido</CardContent></Card>
      ) : serviceOrders.map(o => (
        <Card key={o.id}>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">#{String(o.order_number).padStart(4, '0')}</p>
                <p className="text-sm font-medium">{o.title}</p>
                <p className="text-xs text-muted-foreground">{(o.clients as any)?.name || '-'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary text-sm">R$ {Number(o.total).toFixed(2)}</p>
                <Badge variant={o.status === 'concluída' ? 'default' : 'outline'} className="text-[10px]">{o.status}</Badge>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => exportOSPDF(o)}><Download className="w-3 h-3" /> PDF</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // "Mais" panel items
  const maisItems = [
    { id: 'financeiro' as BetaView, icon: TrendingUp, label: 'Financeiro' },
    { id: 'impostos' as BetaView, icon: ClipboardList, label: 'Impostos' },
    { id: 'lembretes' as BetaView, icon: Bell, label: 'Lembretes' },
    { id: 'online-bookings' as BetaView, icon: Globe, label: 'Agend. Online' },
    { id: 'configuracoes' as BetaView, icon: Settings, label: 'Configurações' },
    { id: 'estoque' as BetaView, icon: Package, label: 'Estoque' },
    { id: 'orcamentos' as BetaView, icon: FileCheck, label: 'Orçamentos' },
    { id: 'os' as BetaView, icon: Wrench, label: 'Ordens Serv.' },
  ];

  const isMainView = ['home', 'agenda', 'pdv', 'cadastros'].includes(view);
  const isMaisView = !isMainView && view !== 'mais' && view !== 'novo-cliente';

  const viewTitles: Record<BetaView, string> = {
    home: 'Início', agenda: 'Agenda', pdv: 'PDV', cadastros: 'Cadastros', mais: 'Mais',
    financeiro: 'Financeiro', impostos: 'Impostos', lembretes: 'Lembretes',
    'online-bookings': 'Agendamento Online', configuracoes: 'Configurações',
    'novo-cliente': 'Novo Cliente', estoque: 'Estoque', orcamentos: 'Orçamentos', os: 'Ordens de Serviço',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isMainView && view !== 'mais' ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setView('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Wind className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold">{viewTitles[view]}</h1>
            <p className="text-[10px] text-muted-foreground">Sistema Simplificado</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Completo
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto pb-40">
        {view === 'home' && renderHome()}
        {view === 'agenda' && renderAgenda()}
        {view === 'pdv' && renderPDV()}
        {view === 'cadastros' && renderCadastros()}
        {view === 'financeiro' && renderFinanceiro()}
        {view === 'impostos' && renderImpostos()}
        {view === 'lembretes' && renderLembretes()}
        {view === 'online-bookings' && renderOnlineBookings()}
        {view === 'configuracoes' && renderConfiguracoes()}
        {view === 'novo-cliente' && renderNovoCliente()}
        {view === 'estoque' && renderEstoque()}
        {view === 'orcamentos' && renderOrcamentos()}
        {view === 'os' && renderOS()}
      </main>

      {maisOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMaisOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-[72px] left-0 right-0 bg-card border-t border-border rounded-t-2xl p-6 max-w-3xl mx-auto animate-in slide-in-from-bottom-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-4">
              {maisItems.map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setMaisOpen(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <item.icon className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4 h-9 text-xs" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>
              <ArrowLeft className="w-3 h-3 mr-1.5" /> Voltar ao Sistema Completo
            </Button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-30">
        <div className="max-w-3xl mx-auto flex justify-around py-2 px-2">
          {[
            { id: 'home' as BetaView, icon: Home, label: 'Início' },
            { id: 'agenda' as BetaView, icon: CalendarDays, label: 'Agenda' },
            { id: 'pdv' as BetaView, icon: ShoppingCart, label: 'PDV' },
            { id: 'cadastros' as BetaView, icon: Users, label: 'Cadastros' },
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setMaisOpen(false); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px] ${view === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <item.icon className={`w-5 h-5 ${view === item.id ? 'scale-110' : ''} transition-transform`} />
              <span className={`text-[10px] font-medium ${view === item.id ? 'text-primary' : ''}`}>{item.label}</span>
            </button>
          ))}
          <button onClick={() => setMaisOpen(!maisOpen)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px] ${maisOpen || isMaisView ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <MoreHorizontal className={`w-5 h-5 ${maisOpen ? 'scale-110' : ''} transition-transform`} />
            <span className={`text-[10px] font-medium ${maisOpen || isMaisView ? 'text-primary' : ''}`}>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
