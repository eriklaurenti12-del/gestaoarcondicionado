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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  BarChart3, CalendarDays, Users, DollarSign, FileText, 
  Plus, Search, ArrowLeft, Moon, Sun, Zap, Clock, 
  Phone, Wallet, ShoppingCart, ClipboardList, Wind,
  Download, Trash2, Receipt, Package,
  Wrench, FileCheck, Thermometer, Home, MoreHorizontal,
  TrendingUp, Bell, Globe, Settings, X, RefreshCw,
  Check, MapPin, Navigation, ChevronLeft, ChevronRight, Briefcase, LayoutDashboard, History, Map, UserPlus
} from 'lucide-react';
import { format, isToday, startOfDay, isSameDay, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import LembretesTab from '@/components/LembretesTab';
import ImpostosTab from '@/components/ImpostosTab';
import OnlineBookingsTab from '@/components/OnlineBookingsTab';
import CompanyDataTab from '@/components/CompanyDataTab';
import ServiceProvidersTab from '@/components/ServiceProvidersTab';
import HistoricoGeralTab from '@/components/HistoricoGeralTab';
import { forceUpdateApp } from '@/lib/updateApp';

type BetaView = 'home' | 'agenda' | 'pdv' | 'cadastros' | 'mais' | 'financeiro' | 'impostos' | 'lembretes' | 'online-bookings' | 'configuracoes' | 'novo-cliente' | 'estoque' | 'orcamentos' | 'os' | 'prestadores' | 'historico';

const safeIsToday = (date: any) => {
  try {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return isToday(d);
  } catch {
    return false;
  }
};

export default function BetaDashboard() {
  const navigate = useNavigate();
  const { toggleBeta } = useBetaMode();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [view, setView] = useState<BetaView>('home');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentFinancial, setRecentFinancial] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/'); return; }
    setUserId(session.user.id);
    setLoading(false);
    loadData(session.user.id);
  };

  const loadData = async (uid: string) => {
    const [allAptsRes, clientsRes, finRes, prodsRes, salesRes, expensesRes] = await Promise.all([
      supabase.from('appointments').select('*, clients(name, telefone, address), products(name, price, service_duration, cost_price)').eq('user_id', uid).order('appointment_date', { ascending: false }).limit(500),
      supabase.from('clients').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
      supabase.from('financial_records').select('*').eq('user_id', uid).order('record_date', { ascending: false }).limit(100),
      supabase.from('products').select('*, suppliers(name)').eq('user_id', uid).order('name').limit(500),
      supabase.from('sales').select('*, clients(name), products(name)').eq('user_id', uid).order('sale_date', { ascending: false }).limit(100),
      supabase.from('fixed_expenses').select('*').eq('user_id', uid).order('expense_date', { ascending: false }).limit(100),
    ]);
    if (allAptsRes.data) setAllAppointments(allAptsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (finRes.data) setRecentFinancial(finRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (expensesRes.data) setFixedExpenses(expensesRes.data);
  };

  const monthPrefix = format(new Date(), 'yyyy-MM');
  const monthReceitas = recentFinancial.filter(r => r.type === 'entrada' && r.record_date?.substring(0, 7) === monthPrefix).reduce((s, r) => s + Number(r.amount), 0);
  const monthDespesas = recentFinancial.filter(r => r.type === 'saida' && r.record_date?.substring(0, 7) === monthPrefix).reduce((s, r) => s + Number(r.amount), 0);
  const monthExpenses = fixedExpenses.filter(e => e.expense_date?.substring(0, 7) === monthPrefix).reduce((s, e) => s + Number(e.amount), 0);
  const totalNetProfit = monthReceitas - monthDespesas - monthExpenses;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0B1120]"><Wind className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  const renderHome = () => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Premium Header/Cockpit */}
      <div className="op-card bg-gradient-to-br from-primary to-blue-900 border-none relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-white/60 uppercase tracking-[0.3em]">Cockpit Operacional</h2>
            <Badge className="bg-white/10 text-white border-white/20 font-black text-[10px] uppercase">Lucro Real Mês</Badge>
          </div>
          <div className="flex items-baseline gap-3">
            <p className="text-5xl font-black text-white tracking-tighter">R$ {totalNetProfit.toFixed(2)}</p>
            <span className="text-primary-foreground/60 font-bold text-sm">Líquido</span>
          </div>
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[10px] font-black text-white/80 uppercase">R$ {monthReceitas.toFixed(0)} Entrada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] font-black text-white/80 uppercase">R$ {(monthDespesas + monthExpenses).toFixed(0)} Gasto</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { id: 'agenda', label: 'Agenda', icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { id: 'prestadores', label: 'Equipe', icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { id: 'financeiro', label: 'Financeiro', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
          { id: 'historico', label: 'Histórico', icon: History, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map((item: any) => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id)}
            className="op-card hover:border-primary/40 transition-all text-center p-6 space-y-3 group"
          >
            <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center mx-auto group-hover:scale-110 transition-transform`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'pdv', label: 'PDV', icon: ShoppingCart },
          { id: 'cadastros', label: 'Clientes', icon: UserPlus },
          { id: 'mais', label: 'Gestão', icon: LayoutDashboard },
        ].map((item: any) => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id)}
            className="op-card p-4 text-center hover:bg-white/5"
          >
            <item.icon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Proximo Serviço - Smart Card */}
      <div className="op-card border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Próxima Parada Operacional</h3>
          </div>
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">CAMPO</Badge>
        </div>
        
        {allAppointments.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido').length > 0 ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-lg font-black text-white uppercase truncate">{allAppointments.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido')[0].clients?.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-black text-sm">{format(new Date(allAppointments.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido')[0].appointment_date), 'HH:mm')}</span>
                <span className="text-slate-500 font-bold text-xs truncate max-w-[150px]">{allAppointments.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido')[0].clients?.address}</span>
              </div>
            </div>
            <Button size="icon" className="h-12 w-12 rounded-2xl bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={() => setView('prestadores')}>
              <Navigation className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <p className="text-center py-4 text-xs font-bold text-slate-600 uppercase tracking-widest">Nenhuma visita pendente para agora</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans selection:bg-primary/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-black text-white text-lg">H</div>
          <span className="font-black text-white text-sm tracking-tighter uppercase">HVAC Control <span className="text-primary">PRO</span></span>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white relative">
            <Bell className="w-5 h-5" />
            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0B1120]" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-primary">EL</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'home' && renderHome()}
        {view === 'prestadores' && <ServiceProvidersTab />}
        {view === 'historico' && <HistoricoGeralTab />}
        {view === 'agenda' && <div className="op-card p-24 text-center">Módulo de Agenda - Em breve</div>}
        {/* Placeholder for other views - Integrated via Components */}
        {view !== 'home' && view !== 'prestadores' && view !== 'historico' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
             <Button variant="ghost" onClick={() => setView('home')} className="mb-6 gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-white">
                <ArrowLeft className="w-4 h-4" /> VOLTAR AO INÍCIO
             </Button>
             <div className="op-card py-20 text-center">
                <Wrench className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                <p className="text-lg font-black uppercase tracking-widest text-slate-400">Módulo em Integração</p>
                <p className="text-xs font-bold uppercase text-slate-600 mt-1">Este componente está sendo migrado para o novo padrão Premium</p>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-16 bg-[#111827]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl z-50 flex items-center justify-around px-4">
        {[
          { id: 'home', icon: Home, label: 'Início' },
          { id: 'agenda', icon: CalendarDays, label: 'Agenda' },
          { id: 'prestadores', icon: MapPin, label: 'Equipe' },
          { id: 'historico', icon: History, label: 'Histórico' },
          { id: 'mais', icon: MoreHorizontal, label: 'Mais' },
        ].map((item: any) => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${view === item.id ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
