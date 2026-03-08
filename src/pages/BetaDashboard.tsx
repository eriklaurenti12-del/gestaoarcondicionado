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
  TrendingUp, Bell, Globe, Settings, X, RefreshCw
} from 'lucide-react';
import { format, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
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
  const [agendaTab, setAgendaTab] = useState<'lista' | 'calendario' | 'horarios'>('lista');
  const [agendaMonth, setAgendaMonth] = useState(new Date().getMonth());
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('todos');

  // Mais panel open state
  const [maisOpen, setMaisOpen] = useState(false);

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/'); return; }
    setUserId(session.user.id);
    setLoading(false);
    loadData(session.user.id);
  };

  const loadData = async (uid: string) => {
    const today = startOfDay(new Date()).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [aptsRes, allAptsRes, clientsRes, finRes, prodsRes, quotesRes, osRes] = await Promise.all([
      supabase.from('appointments').select('*, clients(name, telefone), products(name, price)').eq('user_id', uid).gte('appointment_date', today).order('appointment_date', { ascending: true }).limit(50),
      supabase.from('appointments').select('*, clients(name, telefone), products(name, price)').eq('user_id', uid).order('appointment_date', { ascending: false }).limit(200),
      supabase.from('clients').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
      supabase.from('financial_records').select('*').eq('user_id', uid).order('record_date', { ascending: false }).limit(30),
      supabase.from('products').select('*, suppliers(name)').eq('user_id', uid).order('name').limit(200),
      supabase.from('quotes').select('*, clients(name)').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('service_orders').select('*, clients(name)').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
    ]);
    if (aptsRes.data) setTodayAppointments(aptsRes.data);
    if (allAptsRes.data) setAllAppointments(allAptsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (finRes.data) setRecentFinancial(finRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
    if (quotesRes.data) setQuotes(quotesRes.data);
    if (osRes.data) setServiceOrders(osRes.data);
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
    toast({ title: `✅ Venda de R$ ${cartTotal.toFixed(2)} finalizada!` });
    setPdvCart([]); setPdvSelectedClient(null); setPdvDiscount(0); setPdvDiscountValue(0);
  };

  // PDF Exports
  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Agenda', 14, 20);
    autoTable(doc, { startY: 30, head: [['Data/Hora', 'Cliente', 'Serviço', 'Status']],
      body: todayAppointments.map(a => [format(new Date(a.appointment_date), 'dd/MM/yyyy HH:mm'), (a.clients as any)?.name || '-', (a.products as any)?.name || '-', a.status]),
    });
    doc.save('agenda.pdf'); toast({ title: '📄 PDF exportado!' });
  };

  const exportClientesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Clientes', 14, 20);
    autoTable(doc, { startY: 30, head: [['Nome', 'Telefone', 'Endereço']],
      body: clients.map(c => [c.name, c.telefone || '-', c.address || '-']),
    });
    doc.save('clientes.pdf'); toast({ title: '📄 PDF exportado!' });
  };

  const agendaStats = useMemo(() => {
    const total = allAppointments.length;
    const agendados = allAppointments.filter(a => a.status === 'agendado').length;
    const confirmados = allAppointments.filter(a => a.status === 'confirmado').length;
    const concluidos = allAppointments.filter(a => a.status === 'concluído').length;
    const cancelados = allAppointments.filter(a => a.status === 'cancelado').length;
    const faturamento = allAppointments.filter(a => a.status === 'concluído').reduce((s, a) => s + ((a.products as any)?.price || 0), 0);
    return { total, agendados, confirmados, concluidos, cancelados, faturamento };
  }, [allAppointments]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.telefone?.includes(searchQuery)
  );

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(pdvSearch.toLowerCase()));
  const pdvFilteredClients = clients.filter(c => c.name.toLowerCase().includes(pdvClientSearch.toLowerCase()));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Wind className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  const todayApts = allAppointments.filter(a => isToday(new Date(a.appointment_date)));
  const todayRevenue = todayApts.filter(a => a.status === 'concluído').reduce((s, a) => s + ((a.products as any)?.price || 0), 0);
  const monthRevenue = recentFinancial.filter(r => r.type === 'receita').reduce((s, r) => s + Number(r.amount), 0);

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
            <p className="text-2xl font-bold">R$ {monthRevenue.toFixed(0)}</p>
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('pdv')}>
          <ShoppingCart className="w-4 h-4" /> Nova Venda
        </Button>
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('agenda')}>
          <CalendarDays className="w-4 h-4" /> Agendar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('cadastros')}>
          <Users className="w-4 h-4" /> Cadastros
        </Button>
        <Button variant="outline" className="h-12 gap-2" onClick={() => setView('financeiro')}>
          <TrendingUp className="w-4 h-4" /> Financeiro
        </Button>
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
                  <Badge variant="outline" className="text-[10px]">{apt.status}</Badge>
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
        {[{ id: 'lista', icon: ClipboardList, label: 'Lista' }, { id: 'calendario', icon: CalendarDays, label: 'Calendário' }, { id: 'horarios', icon: Clock, label: 'Horários' }].map(t => (
          <button key={t.id} onClick={() => setAgendaTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${agendaTab === t.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { label: 'Total', value: agendaStats.total, color: 'text-foreground border-primary/30' },
          { label: 'Agendados', value: agendaStats.agendados, color: 'text-yellow-500 border-yellow-500/30' },
          { label: 'Confirmados', value: agendaStats.confirmados, color: 'text-blue-500 border-blue-500/30' },
          { label: 'Concluídos', value: agendaStats.concluidos, color: 'text-green-500 border-green-500/30' },
          { label: 'Cancelados', value: agendaStats.cancelados, color: 'text-red-500 border-red-500/30' },
          { label: 'Faturamento', value: `R$ ${agendaStats.faturamento.toFixed(0)}`, color: 'text-green-500 border-green-500/30' },
        ].map(s => (
          <Card key={s.label} className={`min-w-[100px] border ${s.color.split(' ')[1]}`}>
            <CardContent className="p-3">
              <p className={`text-lg font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5 bg-primary"><Plus className="w-3.5 h-3.5" /> Novo Agendamento</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportAgendaPDF}><Download className="w-3.5 h-3.5" /> PDF</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => loadData(userId)}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Appointments list */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4" />
            <span className="font-semibold text-sm">Agendamentos</span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou serviço..." className="pl-9 h-9" />
          </div>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">Nenhum agendamento encontrado</p>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map(apt => (
                <div key={apt.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{(apt.clients as any)?.name || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(apt.appointment_date), 'dd/MM/yyyy')} • {format(new Date(apt.appointment_date), 'HH:mm')}
                    </p>
                    <p className="text-xs text-muted-foreground">{(apt.products as any)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={apt.status === 'concluído' ? 'default' : apt.status === 'cancelado' ? 'destructive' : 'outline'} className="text-[10px]">
                      {apt.status}
                    </Badge>
                    {(apt.clients as any)?.telefone && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`https://wa.me/55${(apt.clients as any).telefone.replace(/\D/g, '')}`, '_blank')}>
                        <Phone className="w-3.5 h-3.5 text-green-500" />
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

  const renderPDV = () => (
    <div className="px-4 pt-4 space-y-3">
      {/* Tabs */}
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
          {/* Products */}
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
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-sm font-bold text-primary">R$ {Number(p.price).toFixed(2)}</p>
                    {p.type === 'piece' && <p className="text-[10px] text-muted-foreground">Rest.: {p.qty}</p>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Carrinho</h3>
              
              {/* Client mode */}
              <div className="flex gap-1 mb-3">
                {(['cadastrado', 'nome', 'consumidor'] as const).map(m => (
                  <Button key={m} size="sm" variant={pdvClientMode === m ? 'default' : 'outline'} className="flex-1 text-[10px] h-7 capitalize" onClick={() => setPdvClientMode(m)}>
                    {m === 'cadastrado' ? 'Cadastrado' : m === 'nome' ? 'Nome' : 'Consumidor'}
                  </Button>
                ))}
              </div>

              {pdvClientMode === 'cadastrado' && (
                <div className="relative mb-3">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={e => { const c = clients.find(cl => cl.id === Number(e.target.value)); setPdvSelectedClient(c); }}>
                    <option value="">Selecione cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Item avulso */}
              <Button variant="outline" size="sm" className="w-full mb-3 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Item Avulso / Rápido
              </Button>

              {/* Cart items */}
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

              {/* Discount */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Desc. %</label>
                  <Input type="number" min="0" max="100" value={pdvDiscount} onChange={e => setPdvDiscount(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Desc. R$</label>
                  <Input type="number" min="0" value={pdvDiscountValue} onChange={e => setPdvDiscountValue(Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>

              {/* Payment */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">Pagamentos</span>
                  <span className="text-[10px] text-muted-foreground">Restante: R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-1.5">
                  <select className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={pdvPayment} onChange={e => setPdvPayment(e.target.value as any)}>
                    <option>Dinheiro</option><option>PIX</option><option>Débito</option><option>Crédito</option>
                  </select>
                  <Input placeholder="Valor" className="flex-1 h-8 text-xs" />
                  <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700"><Plus className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {/* Total */}
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
          <CardContent className="p-6 text-center text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2" />
            <p>Histórico de vendas em breve</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCadastros = () => (
    <div className="px-4 pt-4 space-y-3">
      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/30">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-bold">Clientes</p>
              <Badge className="text-[9px] bg-red-500/20 text-red-400">Essencial</Badge>
              <p className="text-[10px] text-muted-foreground mt-0.5">Cadastre clientes com nome, telefone e aniversário.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Wrench className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-bold">Serviços & Produtos</p>
              <Badge className="text-[9px] bg-yellow-500/20 text-yellow-400">Catálogo</Badge>
              <p className="text-[10px] text-muted-foreground mt-0.5">Defina preços, custo e tempo de execução.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
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
              <h3 className="font-semibold text-sm">Gerenciar Clientes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="gap-1 text-xs h-8" onClick={() => setView('novo-cliente')}>
                  <Plus className="w-3 h-3" /> Novo Cliente
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={exportClientesPDF}>
                  <Download className="w-3 h-3" /> PDF
                </Button>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum cliente</p>
              ) : filteredClients.slice(0, 30).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{c.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.telefone || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.telefone && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')}>
                        <Phone className="w-3.5 h-3.5 text-green-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Serviços & Produtos</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {products.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.type === 'service' ? 'Serviço' : p.type === 'piece' ? `Peça • Est: ${p.qty}` : 'Produto'}</p>
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
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Receitas</p>
          <p className="text-xl font-bold text-green-500">R$ {recentFinancial.filter(r => r.type === 'receita').reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="text-xl font-bold text-destructive">R$ {recentFinancial.filter(r => r.type === 'despesa').reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}</p>
        </CardContent></Card>
      </div>
      {recentFinancial.map(rec => (
        <Card key={rec.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${rec.type === 'receita' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <DollarSign className={`w-4 h-4 ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm font-medium">{rec.description || rec.category || 'Registro'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(rec.record_date), 'dd/MM/yyyy')}</p>
              </div>
            </div>
            <p className={`font-bold text-sm ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`}>
              {rec.type === 'receita' ? '+' : '-'}R$ {Number(rec.amount).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderImpostos = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card><CardContent className="p-6 text-center">
        <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="font-semibold">Gestão de Impostos</p>
        <p className="text-xs text-muted-foreground">Controle DAS, ISS, INSS e IRPF</p>
        <Button className="mt-4" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>Acessar no Sistema Completo</Button>
      </CardContent></Card>
    </div>
  );

  const renderLembretes = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card><CardContent className="p-6 text-center">
        <Bell className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="font-semibold">Lembretes & Notificações</p>
        <p className="text-xs text-muted-foreground">Contratos vencendo, manutenções agendadas</p>
        <Button className="mt-4" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>Acessar no Sistema Completo</Button>
      </CardContent></Card>
    </div>
  );

  const renderOnlineBookings = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card><CardContent className="p-6 text-center">
        <Globe className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="font-semibold">Agendamento Online</p>
        <p className="text-xs text-muted-foreground">Link para clientes agendarem</p>
        <Button className="mt-4" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>Acessar no Sistema Completo</Button>
      </CardContent></Card>
    </div>
  );

  const renderConfiguracoes = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card><CardContent className="p-6 text-center">
        <Settings className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="font-semibold">Configurações</p>
        <p className="text-xs text-muted-foreground">Empresa, notificações, backup</p>
        <Button className="mt-4" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>Acessar no Sistema Completo</Button>
      </CardContent></Card>
    </div>
  );

  const renderEstoque = () => (
    <div className="px-4 pt-4 space-y-3">
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Estoque</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.filter(p => p.type === 'piece').map(p => (
              <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(p as any).suppliers?.name || '-'}</p>
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
      {quotes.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum orçamento</CardContent></Card>
      ) : quotes.map(q => (
        <Card key={q.id}>
          <CardContent className="p-3 flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">{q.title}</p>
              <p className="text-xs text-muted-foreground">{(q.clients as any)?.name || '-'} • {format(new Date(q.created_at), 'dd/MM/yyyy')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-primary text-sm">R$ {Number(q.total).toFixed(2)}</p>
              <Badge variant={q.status === 'aprovado' ? 'default' : 'outline'} className="text-[10px]">{q.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderOS = () => (
    <div className="px-4 pt-4 space-y-3">
      {serviceOrders.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma O.S.</CardContent></Card>
      ) : serviceOrders.map(o => (
        <Card key={o.id}>
          <CardContent className="p-3 flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground">#{String(o.order_number).padStart(4, '0')}</p>
              <p className="text-sm font-medium">{o.title}</p>
              <p className="text-xs text-muted-foreground">{(o.clients as any)?.name || '-'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-primary text-sm">R$ {Number(o.total).toFixed(2)}</p>
              <Badge variant={o.status === 'concluída' ? 'default' : 'outline'} className="text-[10px]">{o.status}</Badge>
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isMainView && view !== 'mais' ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => isMaisView ? setView('home') : setView('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Wind className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold">{viewTitles[view]}</h1>
            <p className="text-[10px] text-muted-foreground">Gestão de Ar Condicionado</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Content */}
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

      {/* "Mais" slide-up panel */}
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

            {/* Return to full system */}
            <Button variant="outline" size="sm" className="w-full mt-4 h-9 text-xs" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>
              <ArrowLeft className="w-3 h-3 mr-1.5" /> Voltar ao Sistema Completo
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation - 5 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-30">
        <div className="max-w-3xl mx-auto flex justify-around py-2 px-2">
          {[
            { id: 'home' as BetaView, icon: Home, label: 'Início' },
            { id: 'agenda' as BetaView, icon: CalendarDays, label: 'Agenda' },
            { id: 'pdv' as BetaView, icon: ShoppingCart, label: 'PDV' },
            { id: 'cadastros' as BetaView, icon: Users, label: 'Cadastros' },
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setMaisOpen(false); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px] ${
                view === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <item.icon className={`w-5 h-5 ${view === item.id ? 'scale-110' : ''} transition-transform`} />
              <span className={`text-[10px] font-medium ${view === item.id ? 'text-primary' : ''}`}>{item.label}</span>
            </button>
          ))}
          <button onClick={() => setMaisOpen(!maisOpen)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px] ${
              maisOpen || isMaisView ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <MoreHorizontal className={`w-5 h-5 ${maisOpen ? 'scale-110' : ''} transition-transform`} />
            <span className={`text-[10px] font-medium ${maisOpen || isMaisView ? 'text-primary' : ''}`}>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
