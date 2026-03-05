import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBetaMode } from '@/contexts/BetaModeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, CalendarDays, Users, DollarSign, FileText, 
  Plus, Search, ArrowLeft, Moon, Sun, Zap, Clock, 
  Phone, Wallet, ShoppingCart, ClipboardList, Wind,
  Download, Keyboard, Minus, Trash2, Receipt
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type BetaView = 'home' | 'agenda' | 'clientes' | 'financeiro' | 'novo-cliente' | 'pdv';

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
  const [clients, setClients] = useState<any[]>([]);
  const [recentFinancial, setRecentFinancial] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
    const [aptsRes, clientsRes, finRes, prodsRes] = await Promise.all([
      supabase.from('appointments').select('*, clients(name, telefone), products(name)').eq('user_id', uid).gte('appointment_date', today).order('appointment_date', { ascending: true }).limit(20),
      supabase.from('clients').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
      supabase.from('financial_records').select('*').eq('user_id', uid).order('record_date', { ascending: false }).limit(10),
      supabase.from('products').select('*').eq('user_id', uid).order('name').limit(200),
    ]);
    if (aptsRes.data) setTodayAppointments(aptsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (finRes.data) setRecentFinancial(finRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
  };

  const addClient = async () => {
    if (!newClientName.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    const { error } = await supabase.from('clients').insert({ user_id: userId, name: newClientName, telefone: newClientPhone, address: newClientAddress });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Cliente cadastrado!' });
    setNewClientName(''); setNewClientPhone(''); setNewClientAddress('');
    setView('clientes');
    loadData(userId);
  };

  // PDV functions
  const addToCart = (product: any) => {
    setPdvCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    toast({ title: `➕ ${product.name}` });
  };

  const removeFromCart = (productId: number) => {
    setPdvCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const cartTotal = pdvCart.reduce((s, i) => s + i.product.price * i.qty, 0);

  const finalizePdvSale = async () => {
    if (pdvCart.length === 0) { toast({ title: 'Carrinho vazio', variant: 'destructive' }); return; }
    
    for (const item of pdvCart) {
      const { error } = await supabase.from('sales').insert({
        user_id: userId,
        product_id: item.product.id,
        client_id: pdvSelectedClient?.id || 1,
        qty: item.qty,
        sale_price: item.product.price,
        total_profit: (item.product.price - item.product.cost_price) * item.qty,
        payment_method: pdvPayment,
      });
      if (error) { toast({ title: 'Erro na venda', description: error.message, variant: 'destructive' }); return; }
    }
    
    toast({ title: `✅ Venda de R$ ${cartTotal.toFixed(2)} finalizada!` });
    setPdvCart([]);
    setPdvSelectedClient(null);
  };

  // PDF Exports
  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Agenda - Próximos Atendimentos', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Data/Hora', 'Cliente', 'Serviço', 'Status']],
      body: todayAppointments.map(a => [
        format(new Date(a.appointment_date), 'dd/MM/yyyy HH:mm'),
        (a.clients as any)?.name || '-',
        (a.products as any)?.name || '-',
        a.status
      ]),
    });
    doc.save('agenda.pdf');
    toast({ title: '📄 PDF da agenda baixado!' });
  };

  const exportClientesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Lista de Clientes', 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ${clients.length} clientes`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Nome', 'Telefone', 'Endereço']],
      body: clients.map(c => [c.name, c.telefone || '-', c.address || '-']),
    });
    doc.save('clientes.pdf');
    toast({ title: '📄 PDF de clientes baixado!' });
  };

  const exportFinanceiroPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório Financeiro', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Descrição', 'Tipo', 'Valor']],
      body: recentFinancial.map(r => [
        format(new Date(r.record_date), 'dd/MM/yyyy'),
        r.description || r.category || '-',
        r.type === 'receita' ? 'Receita' : 'Despesa',
        `R$ ${Number(r.amount).toFixed(2)}`
      ]),
    });
    doc.save('financeiro.pdf');
    toast({ title: '📄 PDF financeiro baixado!' });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      switch (e.key) {
        case 'F1': e.preventDefault(); setView('home'); break;
        case 'F2': e.preventDefault(); setView('pdv'); break;
        case 'F3': e.preventDefault(); setView('agenda'); break;
        case 'F4': e.preventDefault(); if (view === 'pdv') finalizePdvSale(); break;
        case 'F5': e.preventDefault(); {
          const methods: typeof pdvPayment[] = ['PIX', 'Dinheiro', 'Débito', 'Crédito'];
          const idx = methods.indexOf(pdvPayment);
          setPdvPayment(methods[(idx + 1) % methods.length]);
          toast({ title: `💳 ${methods[(idx + 1) % methods.length]}` });
        } break;
        case 'F8': e.preventDefault(); setPdvCart([]); toast({ title: '🗑️ Carrinho limpo' }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, pdvPayment, pdvCart]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.telefone?.includes(searchQuery)
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(pdvSearch.toLowerCase())
  );

  const pdvFilteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(pdvClientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Wind className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const todayApts = todayAppointments.filter(a => isToday(new Date(a.appointment_date)));
  const tomorrowApts = todayAppointments.filter(a => isTomorrow(new Date(a.appointment_date)));
  const totalReceitas = recentFinancial.filter(r => r.type === 'receita').reduce((s, r) => s + Number(r.amount), 0);

  const renderHome = () => (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('agenda')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10"><CalendarDays className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{todayApts.length}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('clientes')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10"><Users className="w-5 h-5 text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('financeiro')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-lg font-bold">R$ {totalReceitas.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Receitas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('pdv')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10"><ShoppingCart className="w-5 h-5 text-purple-500" /></div>
            <div>
              <p className="text-lg font-bold">PDV</p>
              <p className="text-xs text-muted-foreground">Venda Rápida</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      {todayApts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Agenda de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {todayApts.slice(0, 5).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${apt.status === 'concluído' ? 'bg-green-500' : apt.status === 'cancelado' ? 'bg-red-500' : 'bg-primary'}`} />
                  <div>
                    <p className="text-sm font-medium">{(apt.clients as any)?.name || 'Sem cliente'}</p>
                    <p className="text-xs text-muted-foreground">{(apt.products as any)?.name || 'Serviço'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {format(new Date(apt.appointment_date), 'HH:mm')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-2">
        <Button onClick={() => setView('novo-cliente')} className="h-12 justify-start gap-3" variant="outline">
          <Plus className="w-4 h-4" /> Cadastrar Novo Cliente
        </Button>
        <Button onClick={() => setView('pdv')} className="h-12 justify-start gap-3" variant="outline">
          <ShoppingCart className="w-4 h-4" /> Ponto de Venda Rápido
          <Badge variant="secondary" className="ml-auto text-[10px]">F2</Badge>
        </Button>
        <Button onClick={() => navigate('/dashboard')} className="h-12 justify-start gap-3" variant="outline">
          <ClipboardList className="w-4 h-4" /> Sistema Completo
        </Button>
      </div>

      {/* Keyboard hints for desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Keyboard className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Atalhos de Teclado</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F1</kbd> Início</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F2</kbd> PDV</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F3</kbd> Agenda</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F4</kbd> Finalizar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F5</kbd> Pagamento</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F8</kbd> Limpar</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPDV = () => (
    <div className="space-y-3">
      {/* Payment method quick switch */}
      <div className="flex gap-1.5">
        {(['PIX', 'Dinheiro', 'Débito', 'Crédito'] as const).map(m => (
          <Button key={m} size="sm" variant={pdvPayment === m ? 'default' : 'outline'} 
            className="flex-1 text-xs h-9" onClick={() => setPdvPayment(m)}>
            {m}
          </Button>
        ))}
      </div>

      {/* Client selector */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cliente (opcional)" value={pdvClientSearch} 
          onChange={e => { setPdvClientSearch(e.target.value); setPdvSelectedClient(null); }} className="pl-9 h-10" />
        {pdvClientSearch && !pdvSelectedClient && pdvFilteredClients.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
            {pdvFilteredClients.slice(0, 5).map(c => (
              <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border/30"
                onClick={() => { setPdvSelectedClient(c); setPdvClientSearch(c.name); }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produto/serviço..." value={pdvSearch} onChange={e => setPdvSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
        {filteredProducts.slice(0, 12).map(p => (
          <button key={p.id} onClick={() => addToCart(p)}
            className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-left transition-colors">
            <p className="text-xs font-medium truncate">{p.name}</p>
            <p className="text-sm font-bold text-primary">R$ {Number(p.price).toFixed(2)}</p>
          </button>
        ))}
      </div>

      {/* Cart */}
      {pdvCart.length > 0 && (
        <Card>
          <CardHeader className="pb-2 px-4 pt-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Carrinho</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setPdvCart([])}>
                <Trash2 className="w-3 h-3 mr-1" /> Limpar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {pdvCart.map(item => (
              <div key={item.product.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                    setPdvCart(prev => prev.map(i => i.product.id === item.product.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i));
                  }}><Minus className="w-3 h-3" /></Button>
                  <span className="font-medium">{item.qty}x</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                    setPdvCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, qty: i.qty + 1 } : i));
                  }}><Plus className="w-3 h-3" /></Button>
                  <span className="truncate text-xs">{item.product.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs">R$ {(item.product.price * item.qty).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="font-bold">Total:</span>
              <span className="text-lg font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
            </div>
            <Button className="w-full h-11 mt-2" onClick={finalizePdvSale}>
              <Receipt className="w-4 h-4 mr-2" /> Finalizar Venda ({pdvPayment})
              <Badge variant="secondary" className="ml-2 text-[10px] hidden md:inline-flex">F4</Badge>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Desktop shortcut bar */}
      <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2 justify-center flex-wrap">
        <span><kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono">F4</kbd> Finalizar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono">F5</kbd> Pagamento</span>
        <span><kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono">F8</kbd> Limpar</span>
      </div>
    </div>
  );

  const renderAgenda = () => (
    <div className="space-y-3">
      <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportAgendaPDF}>
        <Download className="w-4 h-4" /> Exportar Agenda PDF
      </Button>
      {todayAppointments.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum agendamento próximo</CardContent></Card>
      ) : (
        todayAppointments.map((apt) => (
          <Card key={apt.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isToday(new Date(apt.appointment_date)) ? 'bg-primary/10' : 'bg-muted'}`}>
                    <CalendarDays className={`w-4 h-4 ${isToday(new Date(apt.appointment_date)) ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{(apt.clients as any)?.name || 'Sem cliente'}</p>
                    <p className="text-xs text-muted-foreground">{(apt.products as any)?.name || ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(apt.appointment_date), "dd/MM • HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={apt.status === 'concluído' ? 'default' : 'outline'} className="text-[10px]">
                    {apt.status}
                  </Badge>
                  {(apt.clients as any)?.telefone && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`https://wa.me/55${(apt.clients as any).telefone.replace(/\D/g, '')}`, '_blank')}>
                      <Phone className="w-3.5 h-3.5 text-green-500" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderClientes = () => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button size="icon" variant="outline" onClick={exportClientesPDF}><Download className="w-4 h-4" /></Button>
        <Button size="icon" onClick={() => setView('novo-cliente')}><Plus className="w-4 h-4" /></Button>
      </div>
      {filteredClients.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum cliente encontrado</CardContent></Card>
      ) : (
        filteredClients.slice(0, 30).map((client) => (
          <Card key={client.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{client.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.telefone || 'Sem telefone'}</p>
                </div>
              </div>
              {client.telefone && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`https://wa.me/55${client.telefone.replace(/\D/g, '')}`, '_blank')}>
                  <Phone className="w-3.5 h-3.5 text-green-500" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderFinanceiro = () => (
    <div className="space-y-3">
      <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportFinanceiroPDF}>
        <Download className="w-4 h-4" /> Exportar Financeiro PDF
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Receitas Recentes</p>
          <p className="text-xl font-bold text-green-500">R$ {totalReceitas.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Despesas Recentes</p>
          <p className="text-xl font-bold text-destructive">R$ {recentFinancial.filter(r => r.type === 'despesa').reduce((s, r) => s + Number(r.amount), 0).toFixed(2)}</p>
        </CardContent></Card>
      </div>
      {recentFinancial.map((rec) => (
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

  const renderNovoCliente = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Novo Cliente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Nome completo *" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
          <Input placeholder="Telefone / WhatsApp" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
          <Input placeholder="Endereço" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} />
          <Button onClick={addClient} className="w-full h-11">
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Cliente
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const viewTitles: Record<BetaView, string> = {
    home: 'Início',
    agenda: 'Agenda',
    clientes: 'Clientes',
    financeiro: 'Financeiro',
    'novo-cliente': 'Novo Cliente',
    pdv: 'Ponto de Venda',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view !== 'home' ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setView('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold">{viewTitles[view]}</h1>
            <p className="text-[10px] text-muted-foreground">Sistema Beta</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 max-w-lg mx-auto pb-24">
        {view === 'home' && renderHome()}
        {view === 'agenda' && renderAgenda()}
        {view === 'clientes' && renderClientes()}
        {view === 'financeiro' && renderFinanceiro()}
        {view === 'novo-cliente' && renderNovoCliente()}
        {view === 'pdv' && renderPDV()}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-20">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {[
            { id: 'home' as BetaView, icon: BarChart3, label: 'Início' },
            { id: 'agenda' as BetaView, icon: CalendarDays, label: 'Agenda' },
            { id: 'pdv' as BetaView, icon: ShoppingCart, label: 'PDV' },
            { id: 'clientes' as BetaView, icon: Users, label: 'Clientes' },
            { id: 'financeiro' as BetaView, icon: Wallet, label: 'Financeiro' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                view === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${view === item.id ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Return to full system */}
        <div className="border-t border-border px-4 py-2">
          <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={() => { toggleBeta(); navigate('/dashboard'); }}>
            <ArrowLeft className="w-3 h-3 mr-1.5" /> Voltar ao Sistema Completo
          </Button>
        </div>
      </nav>
    </div>
  );
}
