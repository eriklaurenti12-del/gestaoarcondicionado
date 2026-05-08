import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wind, Users, TrendingUp, AlertTriangle, CalendarDays, CalendarCheck, Clock, Download, Bell, BellRing, CreditCard, Wrench, Thermometer, DollarSign, Trophy, Star, Package, Fuel, FileText, ClipboardList, Shield, CheckCircle, Gift, Phone, MessageSquare, Send, Play, X, Navigation, MapPin, User, Trash2, Radar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, isToday, startOfWeek, endOfWeek, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubscription } from './SubscriptionGate';
import DummyDataSeeder from './DummyDataSeeder';

// Brazilian holidays for the current year
const getBrazilianHolidays = (year: number) => {
  // Easter calculation (Meeus algorithm)
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, day);

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  return [
    { date: new Date(year, 0, 1), name: '🎆 Confraternização Universal' },
    { date: addDays(easter, -47), name: '🎭 Carnaval' },
    { date: addDays(easter, -46), name: '🎭 Carnaval' },
    { date: addDays(easter, -2), name: '✝️ Sexta-feira Santa' },
    { date: easter, name: '✝️ Páscoa' },
    { date: new Date(year, 3, 21), name: '🏗️ Tiradentes' },
    { date: new Date(year, 4, 1), name: '👷 Dia do Trabalho' },
    { date: addDays(easter, 60), name: '✝️ Corpus Christi' },
    { date: new Date(year, 8, 7), name: '🇧🇷 Independência do Brasil' },
    { date: new Date(year, 9, 12), name: '🙏 Nossa Sra. Aparecida' },
    { date: new Date(year, 10, 2), name: '🕊️ Finados' },
    { date: new Date(year, 10, 15), name: '🇧🇷 Proclamação da República' },
    { date: new Date(year, 10, 20), name: '🧑🏿 Consciência Negra' },
    { date: new Date(year, 11, 25), name: '🎄 Natal' },
  ];
};

const getAppointmentPrice = (apt: any) => {
  if (apt.notes) {
    const match = apt.notes.match(/\[VALOR:([\d.]+)\]/);
    if (match) return Number(match[1]);
  }
  return Number(apt.products?.price) || 0;
};

const safeFormat = (date: any, formatStr: string, options?: any) => {
  try {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr, options);
  } catch {
    return '-';
  }
};

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

const safeDifferenceInDays = (date1: any, date2: any) => {
  try {
    if (!date1 || !date2) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return differenceInDays(d1, d2);
  } catch {
    return 0;
  }
};

const fetchDashboardData = async () => {
  try {
    const productsPromise = supabase.from('products').select('*').limit(1000);
    const clientsPromise = supabase.from('clients').select('*').limit(1000);
    const salesPromise = supabase.from('sales').select('*, clients(name), products(name)').order('sale_date', { ascending: false }).limit(500);
    const appointmentsPromise = supabase.from('appointments').select('*, clients(name, telefone, address), products(name, price, cost_price)').order('appointment_date', { ascending: false }).limit(500);
    const installmentsPromise = supabase.from('installments').select('*, appointments(clients(name, telefone))').eq('is_paid', false).order('due_date').limit(200);
    const fixedExpensesPromise = supabase.from('fixed_expenses').select('*').order('expense_date', { ascending: false }).limit(500);
    const quotesPromise = supabase.from('quotes').select('*, clients(name)').in('status', ['pendente', 'enviado']).order('created_at', { ascending: false }).limit(200);
    const serviceOrdersPromise = supabase.from('service_orders').select('*, clients(name)').in('status', ['pendente', 'pendente']).order('created_at', { ascending: false }).limit(200);
    const scheduledMaintenancePromise = supabase.from('scheduled_maintenance').select('*, clients(name, telefone)').eq('is_completed', false).order('created_at', { ascending: false }).limit(100);

    const [{ data: products, error: pError }, { data: clients, error: cError }, { data: sales, error: sError }, { data: appointments, error: aError }, { data: installments, error: iError }, { data: fixedExpenses, error: feError }, { data: quotes, error: qError }, { data: serviceOrders, error: soError }, { data: scheduledMaintenance, error: smError }] = await Promise.all([productsPromise, clientsPromise, salesPromise, appointmentsPromise, installmentsPromise, fixedExpensesPromise, quotesPromise, serviceOrdersPromise, scheduledMaintenancePromise]);

    if (pError || cError || sError || aError || iError || feError || qError || soError || smError) {
        const firstError = pError || cError || sError || aError || iError || feError || qError || soError || smError;
        console.error('Dashboard fetch error:', firstError);
        throw new Error(firstError?.message || "Failed to fetch dashboard data");
    }

    const scheduledMaintenanceList = scheduledMaintenance || [];

    const productsList = products || [];
    const clientsList = clients || [];
    const salesList = sales || [];
    const appointmentsList = appointments || [];
    const installmentsList = installments || [];
    const fixedExpensesList = fixedExpenses || [];
    const quotesList = quotes || [];
    const serviceOrdersList = serviceOrders || [];
    const lowStockProducts = productsList.filter(p => p.qty <= (p.min_stock || 0) && p.qty < 999);

    // Expected revenue from scheduled/confirmed appointments (not yet concluded)
    const expectedRevenue = appointmentsList
      .filter(a => (a.status === 'pendente' || a.status === 'confirmado'))
      .reduce((sum, a) => sum + getAppointmentPrice(a), 0);
    // Filter sales for CURRENT MONTH only
    const now = new Date();
    const currentMonthPrefix = safeFormat(now, 'yyyy-MM');
    const currentMonthSales = salesList.filter(s => {
      try { return s.sale_date?.substring(0, 7) === currentMonthPrefix; } catch { return false; }
    });
    
    // Also count revenue from confirmed appointments that may not have sale records
    const confirmedAppointmentsThisMonth = appointmentsList.filter((a: any) => {
      try {
        return a.appointment_date?.substring(0, 7) === currentMonthPrefix && 
               (a.status === 'concluido' || a.status === 'concluido' || a.status === 'confirmado');
      } catch { return false; }
    });
    
    // Revenue from sales
    const salesRevenue = currentMonthSales.reduce((sum, s) => sum + (Number(s.sale_price) * s.qty), 0);
    
    // Revenue from confirmed appointments without matching sales (legacy bookings)
    const salesProductIds = new Set(currentMonthSales.map(s => s.product_id));
    const appointmentRevenue = confirmedAppointmentsThisMonth
      .filter((a: any) => !salesProductIds.has(a.service_id))
      .reduce((sum: number, a: any) => sum + getAppointmentPrice(a), 0);
    
    const totalSales = salesRevenue + appointmentRevenue;
    const totalProfit = currentMonthSales.reduce((sum, s) => sum + Number(s.total_profit), 0) + 
      confirmedAppointmentsThisMonth
        .filter((a: any) => a.service_id && !salesProductIds.has(a.service_id))
        .reduce((sum: number, a: any) => sum + ((Number(a.products?.price) || 0) - (Number(a.products?.cost_price) || 0)), 0);
    const totalItems = currentMonthSales.reduce((sum, s) => sum + s.qty, 0) + 
      confirmedAppointmentsThisMonth.filter((a: any) => a.service_id && !salesProductIds.has(a.service_id)).length;
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Previous month for variation
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = safeFormat(prevMonth, 'yyyy-MM');
    const prevMonthSales = salesList.filter(s => {
      try { return s.sale_date?.startsWith(prevMonthPrefix); } catch { return false; }
    });
    const prevMonthTotal = prevMonthSales.reduce((sum, s) => sum + (Number(s.sale_price) * s.qty), 0);
    const monthVariation = prevMonthTotal > 0 ? ((totalSales - prevMonthTotal) / prevMonthTotal) * 100 : totalSales > 0 ? 100 : 0;

    // Best month of the year
    const yearMonths: { [key: string]: number } = {};
    for (let m = 0; m < 12; m++) {
      const mk = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
      yearMonths[mk] = 0;
    }
    salesList.forEach(s => {
      try {
        const mk = s.sale_date?.substring(0, 7);
        if (mk && mk.startsWith(String(now.getFullYear())) && yearMonths[mk] !== undefined) {
          yearMonths[mk] += Number(s.sale_price) * s.qty;
        }
      } catch {}
    });
    const bestMonthEntry = Object.entries(yearMonths).sort((a, b) => b[1] - a[1])[0];
    const bestMonth = bestMonthEntry && bestMonthEntry[1] > 0 ? { month: bestMonthEntry[0], value: bestMonthEntry[1] } : null;

    const today = now;
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

    const todayAppointments = appointmentsList.filter(a => {
      const status = (a.status || '').toLowerCase();
      const isCompleted = status === 'concluido' || status === 'concluido';
      return safeIsToday(a.appointment_date) && !isCompleted;
    });
    const weekAppointments = appointmentsList.filter(a => {
        const date = new Date(a.appointment_date);
        return date >= weekStart && date <= weekEnd;
    });

    const confirmedToday = todayAppointments.filter(a => a.status === 'confirmado').length;
    const scheduledToday = todayAppointments.filter(a => a.status === 'pendente').length;
    const completedToday = appointmentsList.filter(a => {
        const status = (a.status || '').toLowerCase();
        return safeIsToday(a.appointment_date) && (status === 'concluido' || status === 'concluido');
    }).length;

    const pendingInstallments = installmentsList.map((inst: any) => {
        const daysUntilDue = safeDifferenceInDays(inst.due_date, today);
        let status = 'normal';
        if (daysUntilDue < 0) status = 'overdue';
        else if (daysUntilDue <= 3) status = 'urgent';
        else if (daysUntilDue <= 7) status = 'warning';
        return { ...inst, daysUntilDue, status };
    });

    const totalPendingAmount = pendingInstallments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

    // Calculate today's fixed expenses
    const todayStr = safeFormat(today, 'yyyy-MM-dd');
    const todayExpenses = fixedExpensesList.filter(e => e.expense_date === todayStr);
    const todayExpensesTotal = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate monthly expenses
    const currentMonth = safeFormat(today, 'yyyy-MM');
    const monthlyExpenses = fixedExpensesList.filter(e => e.expense_date.startsWith(currentMonth));
    const monthlyExpensesTotal = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Expenses by category for today
    const expensesByCategory: { [key: string]: number } = {};
    todayExpenses.forEach(e => {
      if (!expensesByCategory[e.category]) {
        expensesByCategory[e.category] = 0;
      }
      expensesByCategory[e.category] += Number(e.amount);
    });

    // Calculate top clients by revenue
    const clientRevenue: { [key: string]: { name: string; revenue: number; count: number } } = {};
    salesList.forEach((sale: any) => {
      const clientName = sale.clients?.name || 'Desconhecido';
      if (!clientRevenue[clientName]) {
        clientRevenue[clientName] = { name: clientName, revenue: 0, count: 0 };
      }
      clientRevenue[clientName].revenue += Number(sale.sale_price) * sale.qty;
      clientRevenue[clientName].count += sale.qty;
    });
    const topClients = Object.values(clientRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Calculate top services
    const serviceCount: { [key: string]: { name: string; count: number; revenue: number } } = {};
    appointmentsList.filter(a => a.status === 'concluido').forEach((apt: any) => {
      const name = apt.products?.name || 'Serviço';
      if (!serviceCount[name]) {
        serviceCount[name] = { name, count: 0, revenue: 0 };
      }
      serviceCount[name].count += 1;
    });
    salesList.forEach((sale: any) => {
      const name = sale.products?.name || 'Produto';
      if (!serviceCount[name]) {
        serviceCount[name] = { name, count: 0, revenue: 0 };
      }
      serviceCount[name].count += sale.qty;
      serviceCount[name].revenue += Number(sale.sale_price) * sale.qty;
    });
    const topServices = Object.values(serviceCount).sort((a, b) => b.count - a.count).slice(0, 5);

    // Calculate top products (pieces only)
    const pieceProducts = productsList.filter(p => p.qty < 999);
    const topProducts = pieceProducts
      .map(p => {
        const salesCount = salesList.filter((s: any) => s.products?.name === p.name).reduce((sum, s) => sum + s.qty, 0);
        return { name: p.name, count: salesCount, stock: p.qty };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Process scheduled maintenances
    const pendingMaintenances = scheduledMaintenanceList.map((m: any) => {
      const daysUntil = safeDifferenceInDays(m.scheduled_date, today);
      let status = 'normal';
      if (daysUntil < 0) status = 'overdue';
      else if (daysUntil === 0) status = 'today';
      else if (daysUntil <= 7) status = 'urgent';
      else if (daysUntil <= 30) status = 'warning';
      return { ...m, daysUntil, status };
    }).sort((a: any, b: any) => a.daysUntil - b.daysUntil);

    const overdueMaintenances = pendingMaintenances.filter((m: any) => m.status === 'overdue');
    const todayMaintenances = pendingMaintenances.filter((m: any) => m.status === 'today');
    const upcomingMaintenances = pendingMaintenances.filter((m: any) => m.status === 'urgent' || m.status === 'warning');

    // Birthday notifications
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const birthdayClients = clientsList
      .filter((c: any) => {
        if (!c.aniversario) return false;
        const bday = new Date(c.aniversario);
        return bday.getMonth() === todayMonth && bday.getDate() === todayDay;
      })
      .map((c: any) => {
        const bday = new Date(c.aniversario);
        const age = today.getFullYear() - bday.getFullYear();
        return { ...c, age };
      });

    const upcomingBirthdays = clientsList
      .filter((c: any) => {
        if (!c.aniversario) return false;
        const bday = new Date(c.aniversario);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const diff = safeDifferenceInDays(thisYearBday, today);
        return diff > 0 && diff <= 7;
      })
      .map((c: any) => {
        const bday = new Date(c.aniversario);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const daysUntil = safeDifferenceInDays(thisYearBday, today);
        const age = today.getFullYear() - bday.getFullYear();
        return { ...c, daysUntil, age };
      })
      .sort((a: any, b: any) => a.daysUntil - b.daysUntil);

    // Maintenance Radar: Completed services that will need renewal soon
    const maintenanceRadar = appointmentsList
      .filter(a => (a.status === 'concluido' || a.status === 'concluido') && (a.products as any)?.warranty_months)
      .map(a => {
        const doneDate = new Date(a.appointment_date);
        const nextDate = addMonths(doneDate, (a.products as any).warranty_months);
        const daysUntil = safeDifferenceInDays(nextDate, today);
        return {
          ...a,
          nextDate,
          daysUntil,
          isExpired: daysUntil < 0,
          isUrgent: daysUntil >= 0 && daysUntil <= 15
        };
      })
      .filter(a => a.daysUntil <= 30 && a.daysUntil > -60) // Show from 30 days before until 60 days after
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Overdue appointments (agendado but past date)
    const overdueAppointments = appointmentsList
      .filter(a => a.status === 'pendente' && new Date(a.appointment_date) < today)
      .map((a: any) => ({
        ...a,
        daysOverdue: safeDifferenceInDays(today, a.appointment_date)
      }))
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    return {
        servicesCount: productsList.length,
        clientsCount: clientsList.length,
        lowStockProducts,
        salesReport: { totalSales, totalItems, totalProfit, profitMargin, monthVariation, prevMonthTotal, bestMonth, expectedRevenue },
        appointmentStats: {
            today: todayAppointments.length,
            week: weekAppointments.length,
            confirmedToday,
            scheduledToday,
            completedToday,
            todayAppointments,
            weekAppointments
        },
        pendingInstallments,
        totalPendingAmount,
        topClients,
        topServices,
        topProducts,
        todayExpenses,
        todayExpensesTotal,
        monthlyExpensesTotal,
        expensesByCategory,
        pendingQuotes: quotesList,
        pendingServiceOrders: serviceOrdersList,
        pendingMaintenances,
        overdueMaintenances,
        todayMaintenances,
        upcomingMaintenances,
        birthdayClients,
        upcomingBirthdays,
        clientsList,
        overdueAppointments,
        maintenanceRadar
    };
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    throw error;
  }
};

const RaffleWinsBanner: React.FC = () => {
  const [wins, setWins] = useState<any[]>([]);

  useEffect(() => {
    const loadWins = async () => {
      try {
        const { data } = await supabase.from('raffle_history').select('*').order('created_at', { ascending: false }).limit(5);
        if (data && data.length > 0) setWins(data);
      } catch (error) {
        console.error('Error loading raffle wins:', error);
      }
    };
    loadWins();

    // Listen for new wins in realtime
    const channel = supabase.channel('raffle-wins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raffle_history' }, (payload) => {
        setWins(prev => [payload.new as any, ...prev].slice(0, 5));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (wins.length === 0) return null;

  return (
    <Card className="border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl" />
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Gift className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-amber-300">🎉 Sorteio!</h3>
        </div>
        {wins.map((win) => (
          <div key={win.id} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-white">Prêmio: {win.prize}</p>
                <p className="text-xs text-gray-400">
                  {new Date(win.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {win.is_claimed ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Resgatado</Badge>
              ) : (
                <a href="https://wa.me/5516992600631?text=Olá%20Erik,%20ganhei%20o%20sorteio%20e%20quero%20resgatar%20meu%20prêmio!" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs">
                    <Phone className="w-3 h-3 mr-1" /> Resgatar
                  </Button>
                </a>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

interface DashboardProps {
  onNavigateToTab?: (tab: string) => void;
  isSuperAdmin?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToTab, isSuperAdmin = false }) => {
    const subscriptionData = useSubscription();
    const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [decisionDialog, setDecisionDialog] = useState<{ open: boolean; appointment: any | null }>({ open: false, appointment: null });
    const [userName, setUserName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [checkoutLinks, setCheckoutLinks] = useState<{ mensal: string; anual: string }>({ mensal: '', anual: '' });
    const today = new Date();
    const currentMonth = safeFormat(today, 'MMMM', { locale: ptBR });
    const currentDate = safeFormat(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    useEffect(() => {
      const loadUserData = async () => {
        try {
          const { data: authData } = await supabase.auth.getUser(); const user = authData?.user;
          if (user) {
            const [{ data: profile }, { data: company }, { data: settings }] = await Promise.all([
              supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle(),
              supabase.from('company_data').select('company_name').eq('user_id', user.id).maybeSingle(),
              supabase.from('admin_settings').select('key, value').in('key', ['checkout_mensal', 'checkout_anual']),
            ]);
            if (profile?.username) setUserName(profile.username);
            if (company?.company_name) setCompanyName(company.company_name);
            if (settings) {
              const links = { mensal: '', anual: '' };
              settings.forEach((s: any) => {
                if (s.key === 'checkout_mensal' && s.value) links.mensal = s.value;
                if (s.key === 'checkout_anual' && s.value) links.anual = s.value;
              });
              setCheckoutLinks(links);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };
      loadUserData();
    }, []);

    useEffect(() => {
        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            const dismissed = localStorage.getItem('dashboard-pwa-dismissed');
            if (!dismissed) {
                setShowInstallBanner(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowInstallBanner(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            toast.success('App instalado com sucesso!');
            setShowInstallBanner(false);
            localStorage.setItem('dashboard-pwa-dismissed', 'true');
        }
        setDeferredPrompt(null);
    };

    const requestNotifications = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                setNotificationsEnabled(true);
                toast.success('Notificações ativadas! Você receberá lembretes.');
                new Notification('AC Service Pro', {
                    body: 'Notificações ativadas com sucesso!',
                    icon: '/icon-192x192.png'
                });
            } else {
                toast.error('Permissão negada para notificações');
            }
        }
    };

    const updateAppointmentStatus = useMutation({
      mutationFn: async ({ id, status, appointment }: { id: string; status: string; appointment?: any }) => {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
        if (error) throw error;

        // Financial integration logic (matches AppointmentsTab)
        if (status === 'concluido' && appointment?.client_id) {
          const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
          if (session) {
            const salePrice = getAppointmentPrice(appointment);
            if (salePrice <= 0) return; // Skip if no value found

            const { data: productData } = appointment.service_id ? await supabase
              .from('products')
              .select('cost_price')
              .eq('id', appointment.service_id)
              .maybeSingle() : { data: null };
            
            const actualCostPrice = productData?.cost_price || 0;
            const profit = salePrice - Number(actualCostPrice);
            
            // Check if sale already exists
            const { data: existingSale } = await supabase
              .from('sales')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('client_id', appointment.client_id)
              .eq('product_id', appointment.service_id)
              .eq('sale_date', appointment.appointment_date)
              .maybeSingle();

            if (!existingSale) {
              await supabase.from('sales').insert({
                user_id: session.user.id,
                client_id: appointment.client_id,
                product_id: appointment.service_id,
                qty: 1,
                sale_price: salePrice,
                total_profit: profit,
                payment_method: 'Dinheiro',
                sale_date: appointment.appointment_date
              });

              await supabase.from('financial_records').insert({
                user_id: session.user.id,
                type: 'entrada',
                amount: salePrice,
                description: `Serviço concluído (Dash): ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`,
                payment_method: 'Dinheiro',
                category: 'Serviço Agenda',
                record_date: new Date().toISOString()
              });
            }
          }
        }
      },
      onSuccess: (_, { status }) => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        const labels: Record<string, string> = {
          pendente: '📅 Reaberto',
          confirmado: '✓ Confirmado',
          concluido: '✅ Concluído',
          cancelado: '❌ Cancelado',
        };
        toast.success(labels[status] || 'Status atualizado');
        setDecisionDialog({ open: false, appointment: null });
      }
    });

    const deleteAppointmentMutation = useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        toast.success('Agendamento removido');
      }
    });

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['dashboard'],
        queryFn: fetchDashboardData
    });

    if (isLoading || !data) return (
      <div className="space-y-6 animate-blur-in">
        <Skeleton className="h-16 w-full rounded-xl shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full rounded-xl shimmer" />
          <Skeleton className="h-32 w-full rounded-xl shimmer" />
          <Skeleton className="h-32 w-full rounded-xl shimmer" />
        </div>
      </div>
    );
    if (isError) return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
        <div className="text-center space-y-3 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Erro ao carregar o Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {(error as Error)?.message || 'Não foi possível carregar os dados. Verifique sua conexão com a internet e tente novamente.'}
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
          className="gap-2"
          size="lg"
        >
          <Wind className="w-4 h-4" />
          Tentar Novamente
        </Button>
      </div>
    );

  const { 
      servicesCount = 0, 
      clientsCount = 0, 
      lowStockProducts = [], 
      salesReport = { totalSales: 0, totalItems: 0, totalProfit: 0, profitMargin: 0, monthVariation: 0, prevMonthTotal: 0, bestMonth: null as any, expectedRevenue: 0 }, 
      appointmentStats = { today: 0, week: 0, confirmedToday: 0, scheduledToday: 0, completedToday: 0, todayAppointments: [], weekAppointments: [] }, 
      pendingInstallments = [],
      totalPendingAmount = 0,
      topClients = [],
      topServices = [],
      topProducts = [],
      todayExpenses = [],
        todayExpensesTotal = 0,
        monthlyExpensesTotal = 0,
        expensesByCategory = {},
        pendingQuotes = [],
        pendingServiceOrders = [],
        overdueMaintenances = [],
        todayMaintenances = [],
        upcomingMaintenances = [],
        birthdayClients = [],
        upcomingBirthdays = [],
        overdueAppointments = [],
    } = data;

    // Calculate trial progress percentage for visual indicator
    const trialProgressPercent = subscriptionData?.isTrial && subscriptionData?.hoursRemaining !== null 
      ? Math.max(0, Math.min(100, (subscriptionData.hoursRemaining / 24) * 100))
      : 0;

    // Calculate days remaining for all plan types
    const planDaysRemaining = (() => {
      if (!subscriptionData?.subscription) return null;
      const sub = subscriptionData.subscription;
      if (sub.plan === 'vitalicio') return null;
      if (sub.end_date) {
        return Math.max(0, safeDifferenceInDays(sub.end_date, new Date()));
      }
      return subscriptionData.daysRemaining;
    })();

    const planTotalDays = (() => {
      if (!subscriptionData?.subscription) return 365;
      const sub = subscriptionData.subscription;
      if (sub.start_date && sub.end_date) {
        return Math.max(1, safeDifferenceInDays(sub.end_date, sub.start_date));
      }
      if (sub.plan === 'anual') return 365;
      if (sub.plan === 'trimestral') return 90;
      return 30;
    })();

    const planProgressPercent = planDaysRemaining !== null 
      ? Math.max(0, Math.min(100, (planDaysRemaining / planTotalDays) * 100))
      : 100;

    const isExpiringSoon30 = planDaysRemaining !== null && planDaysRemaining <= 30 && planDaysRemaining > 0;
    const formatEndDate = subscriptionData?.subscription?.end_date 
      ? safeFormat(subscriptionData.subscription.end_date, 'dd/MM/yyyy')
      : null;

    return (
    <div className="space-y-6 animate-blur-in">
      {/* Welcome Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 neon-border overflow-hidden animate-slide-down">
        <CardContent className="p-4 sm:p-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-accent/[0.03] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 relative">
            <div>
              {companyName && (
                <p className="text-xs font-semibold gradient-text mb-1">🏢 {companyName}</p>
              )}
              <h2 className="text-xl sm:text-2xl font-bold">
                👋 Seja bem-vindo, {userName || 'Profissional'}!
              </h2>
              {!companyName && (
                <p className="text-xs text-amber-500 mt-1">⚠️ Cadastre o nome da sua empresa em "Minha Empresa" para aparecer aqui</p>
              )}
              <p className="text-sm text-muted-foreground capitalize mt-1">
                📅 {currentDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                {currentMonth}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {safeFormat(today, 'yyyy')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Simulation & Reset Tool — apenas Super Admin */}
      {isSuperAdmin && <DummyDataSeeder />}
      
      {/* Central de Comandos Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
        <Button 
          variant="outline" 
          onClick={() => onNavigateToTab?.('appointments')}
          className="h-20 flex flex-col items-center justify-center gap-2 premium-card hover:bg-primary/5 hover:border-primary/50 transition-all border-dashed"
        >
          <CalendarDays className="w-6 h-6 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Agenda</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onNavigateToTab?.('pdv')}
          className="h-20 flex flex-col items-center justify-center gap-2 premium-card hover:bg-emerald-500/5 hover:border-emerald-500/50 transition-all border-dashed"
        >
          <CreditCard className="w-6 h-6 text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Novo PDV</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onNavigateToTab?.('providers')}
          className="h-20 flex flex-col items-center justify-center gap-2 premium-card hover:bg-blue-500/5 hover:border-blue-500/50 transition-all border-dashed"
        >
          <Navigation className="w-6 h-6 text-blue-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Rotas Técnicas</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onNavigateToTab?.('financeiro')}
          className="h-20 flex flex-col items-center justify-center gap-2 premium-card hover:bg-amber-500/5 hover:border-amber-500/50 transition-all border-dashed"
        >
          <TrendingUp className="w-6 h-6 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Financeiro</span>
        </Button>
      </div>

      {/* License/Subscription Status Card */}
      {subscriptionData && (
        <Card className={`border-2 ${
          subscriptionData.isTrial 
            ? 'border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10' 
            : (isExpiringSoon30 || subscriptionData.isExpiringSoon)
              ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10'
              : subscriptionData.subscription?.plan === 'vitalicio'
                ? 'border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10'
                : 'border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5'
        }`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    subscriptionData.isTrial ? 'bg-cyan-500/20' :
                    (isExpiringSoon30 || subscriptionData.isExpiringSoon) ? 'bg-amber-500/20' :
                    subscriptionData.subscription?.plan === 'vitalicio' ? 'bg-green-500/20' : 'bg-primary/10'
                  }`}>
                    {subscriptionData.subscription?.plan === 'vitalicio' ? (
                      <Trophy className="w-5 h-5 text-green-500" />
                    ) : subscriptionData.isTrial ? (
                      <Clock className="w-5 h-5 text-cyan-500 animate-pulse" />
                    ) : (isExpiringSoon30 || subscriptionData.isExpiringSoon) ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {subscriptionData.isTrial 
                          ? '⏰ Período de Teste' 
                          : subscriptionData.subscription?.plan === 'vitalicio'
                            ? '👑 Plano vitalício'
                            : `👑 Plano ${subscriptionData.subscription?.plan || 'ativo'}`
                        }
                      </h3>
                      <Badge className={`text-[10px] font-bold ${
                        subscriptionData.isTrial ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' :
                        subscriptionData.subscription?.plan === 'vitalicio' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        (isExpiringSoon30 || subscriptionData.isExpiringSoon) ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {subscriptionData.subscription?.plan?.toUpperCase() || 'TRIAL'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subscriptionData.isTrial && subscriptionData.hoursRemaining !== null
                        ? `Restam ${subscriptionData.hoursRemaining} hora${subscriptionData.hoursRemaining !== 1 ? 's' : ''} de teste`
                        : subscriptionData.subscription?.plan === 'vitalicio'
                          ? '✅ Acesso ilimitado ao sistema'
                          : formatEndDate && planDaysRemaining !== null
                            ? `Válido até ${formatEndDate} • ${planDaysRemaining} dia${planDaysRemaining !== 1 ? 's' : ''} restante${planDaysRemaining !== 1 ? 's' : ''}`
                            : '✅ Licença ativa'
                      }
                    </p>
                  </div>
                </div>
                {/* Payment buttons when expiring */}
                {(subscriptionData.isTrial || isExpiringSoon30 || subscriptionData.isExpiringSoon) && (
                  <div className="flex flex-wrap gap-2">
                    {checkoutLinks.mensal && (
                      <a href={checkoutLinks.mensal} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                          <CreditCard className="w-3.5 h-3.5 mr-1" />
                          Mensal
                        </Button>
                      </a>
                    )}
                    {checkoutLinks.anual && (
                      <a href={checkoutLinks.anual} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 text-white">
                          <Star className="w-3.5 h-3.5 mr-1" />
                          Anual
                        </Button>
                      </a>
                    )}
                    {!checkoutLinks.mensal && !checkoutLinks.anual && (
                      <a
                        href="https://wa.me/5516992600631?text=Olá%20Erik,%20quero%20ativar/renovar%20minha%20licença%20AC%20Service%20Pro"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs">
                          📱 Ativar Licença
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>
              
              {/* Progress bar for ALL plan types */}
              {subscriptionData.isTrial && subscriptionData.hoursRemaining !== null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tempo restante do trial</span>
                    <span className={`font-bold ${
                      subscriptionData.hoursRemaining <= 6 ? 'text-red-500 animate-pulse' :
                      subscriptionData.hoursRemaining <= 12 ? 'text-amber-500' :
                      'text-cyan-500'
                    }`}>
                      {subscriptionData.hoursRemaining}h
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        subscriptionData.hoursRemaining <= 6 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        subscriptionData.hoursRemaining <= 12 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                        'bg-gradient-to-r from-cyan-400 to-blue-500'
                      }`}
                      style={{ width: `${trialProgressPercent}%` }}
                    />
                  </div>
                </div>
              ) : planDaysRemaining !== null && subscriptionData.subscription?.plan !== 'vitalicio' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        planDaysRemaining <= 7 ? 'bg-red-500 animate-pulse' :
                        planDaysRemaining <= 30 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`} />
                      <span className="text-muted-foreground">{planDaysRemaining} dia{planDaysRemaining !== 1 ? 's' : ''} restante{planDaysRemaining !== 1 ? 's' : ''}</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        planDaysRemaining <= 7 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        planDaysRemaining <= 30 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                        'bg-gradient-to-r from-green-400 to-emerald-500'
                      }`}
                      style={{ width: `${planProgressPercent}%` }}
                    />
                  </div>
                </div>
              ) : subscriptionData.subscription?.plan === 'vitalicio' ? (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="font-medium">Acesso vitalício — sem data de expiração</span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raffle Wins Banner */}
      <RaffleWinsBanner />

      {/* CRITICAL: Overdue Appointments Alert */}
      {overdueAppointments.length > 0 && (
        <Card className="border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 to-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-red-600 dark:text-red-400">⚠️ {overdueAppointments.length} Serviço(s) em Aberto!</h3>
                <p className="text-xs text-muted-foreground">Agendamentos passados não concluídos. Atualize o status!</p>
              </div>
            </div>
            <div className="space-y-2">
              {overdueAppointments.slice(0, 5).map((apt: any) => (
                <div 
                  key={apt.id} 
                  className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Clock className="w-4 h-4 text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{apt.clients?.name || 'Cliente'} - {apt.products?.name || 'Serviço'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.appointment_date), 'dd/MM/yyyy HH:mm')} • Há {apt.daysOverdue} dia(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <Button 
                      size="sm"
                      className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'concluido' })}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Feito
                    </Button>
                    <Button 
                      size="sm"
                      variant="destructive"
                      className="h-8 px-2 text-xs"
                      onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'cancelado' })}
                    >
                      <X className="w-3 h-3 mr-1" /> Não feito
                    </Button>
                    <Button 
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('Remover este agendamento permanentemente?')) {
                          deleteAppointmentMutation.mutate(apt.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Maintenances Alert */}
      {overdueMaintenances.length > 0 && (
        <Card className="border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-amber-500/20">
                <Wrench className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-amber-600 dark:text-amber-400">🔧 {overdueMaintenances.length} Manutenção(ões) Vencida(s)!</h3>
                <p className="text-xs text-muted-foreground">Manutenções que já passaram da data programada</p>
              </div>
            </div>
            <div className="space-y-2">
              {overdueMaintenances.slice(0, 5).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{m.clients?.name || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">Vencida há {Math.abs(m.daysUntil)} dias • {m.maintenance_type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* App Installation & Notifications */}
      {(showInstallBanner || !notificationsEnabled) && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Configure seu App</h3>
                  <p className="text-xs text-muted-foreground">Instale e ative notificações para não perder nada</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {showInstallBanner && deferredPrompt && (
                  <Button size="sm" onClick={handleInstall} className="bg-green-600 hover:bg-green-700">
                    <Download className="w-4 h-4 mr-1" />
                    Instalar App
                  </Button>
                )}
                {!notificationsEnabled && (
                  <Button size="sm" variant="outline" onClick={requestNotifications}>
                    <BellRing className="w-4 h-4 mr-1" />
                    Ativar Notificações
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Alerts (consolidated) */}
      {todayMaintenances.length > 0 && (
        <Alert className="border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950">
          <CalendarCheck className="h-4 w-4 text-cyan-600" />
          <AlertTitle className="text-cyan-800 dark:text-cyan-200">🧹 Limpezas Agendadas para Hoje!</AlertTitle>
          <AlertDescription className="text-cyan-700 dark:text-cyan-300">
            {todayMaintenances.length} cliente(s): {todayMaintenances.map((m: any) => m.clients?.name || 'Cliente').join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {overdueMaintenances.length > 0 && (
        <Alert className="border-red-400 bg-red-50 dark:border-red-900 dark:bg-red-950/40 animate-pulse-subtle">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-red-200">⚠️ Manutenções Vencidas!</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300 flex justify-between items-center">
            <span>Você tem {overdueMaintenances.length} cliente(s) com manutenção em atraso.</span>
            <Button size="sm" variant="outline" className="h-7 text-xs bg-white/50" onClick={() => onNavigateToTab?.('historico')}>
              Ver Clientes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">Alerta de Estoque Baixo!</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {lowStockProducts.length} peça(s)/material(is) com estoque baixo: {lowStockProducts.map(p => p.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Installments Alert */}
      {pendingInstallments.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CreditCard className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-red-200">💰 Parcelas a Receber</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            Você tem {pendingInstallments.length} parcela(s) pendente(s) totalizando R$ {totalPendingAmount.toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Quotes Alert */}
      {pendingQuotes.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">📋 Orçamentos Pendentes</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            Você tem {pendingQuotes.length} orçamento(s) aguardando aprovação
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Service Orders Alert */}
      {pendingServiceOrders.length > 0 && (
        <Alert className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
          <ClipboardList className="h-4 w-4 text-purple-600" />
          <AlertTitle className="text-purple-800 dark:text-purple-200">🔧 Ordens de Serviço Pendentes</AlertTitle>
          <AlertDescription className="text-purple-700 dark:text-purple-300">
            Você tem {pendingServiceOrders.length} ordem(s) de serviço pendente(s)
          </AlertDescription>
        </Alert>
      )}

      {/* Appointment Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-stagger">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab?.('agenda')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigateToTab?.('agenda')}
          aria-label={`Atendimentos de hoje: ${appointmentStats.today}. Clique para abrir a Agenda.`}
          title="Atendimentos de hoje — clique para abrir a Agenda"
          className="stat-card premium-card border-blue-500/30 card-gradient-blue animate-slide-up group cursor-pointer hover:scale-[1.02] hover:border-blue-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-container p-1.5 rounded-lg bg-blue-500/10">
                <CalendarDays className="w-4 h-4 text-blue-600 animate-float" />
              </div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Hoje</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 animate-count-up">{appointmentStats.today}</div>
            <p className="text-xs text-muted-foreground mt-1">atendimentos hoje</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab?.('agenda')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigateToTab?.('agenda')}
          aria-label={`Atendimentos da semana: ${appointmentStats.week}. Clique para abrir a Agenda.`}
          title="Atendimentos previstos para os próximos 7 dias"
          className="stat-card premium-card border-purple-500/30 card-gradient-purple animate-slide-up group cursor-pointer hover:scale-[1.02] hover:border-purple-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 [animation-delay:100ms]"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-container p-1.5 rounded-lg bg-purple-500/10">
                <CalendarCheck className="w-4 h-4 text-purple-600 animate-float" />
              </div>
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Semana</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 animate-count-up">{appointmentStats.week}</div>
            <p className="text-xs text-muted-foreground mt-1">próximos 7 dias</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab?.('agenda')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigateToTab?.('agenda')}
          aria-label={`Confirmados para hoje: ${appointmentStats.confirmedToday}. Clique para abrir a Agenda.`}
          title="Serviços confirmados para hoje (cliente já confirmou presença)"
          className="stat-card premium-card border-green-500/30 card-gradient-green animate-slide-up group cursor-pointer hover:scale-[1.02] hover:border-green-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 [animation-delay:200ms]"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-container p-1.5 rounded-lg bg-green-500/10">
                <CalendarCheck className="w-4 h-4 text-green-600 animate-float" />
              </div>
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Confirmados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600 animate-count-up">{appointmentStats.confirmedToday}</div>
            <p className="text-xs text-muted-foreground mt-1">para hoje</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab?.('agenda')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigateToTab?.('agenda')}
          aria-label={`Aguardando confirmação: ${appointmentStats.scheduledToday}. Clique para abrir a Agenda.`}
          title="Aguardando confirmação do cliente para hoje"
          className="stat-card premium-card border-amber-500/30 card-gradient-amber animate-slide-up group cursor-pointer hover:scale-[1.02] hover:border-amber-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 [animation-delay:300ms]"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-container p-1.5 rounded-lg bg-amber-500/10">
                <Clock className="w-4 h-4 text-amber-600 animate-float" />
              </div>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Aguardando</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 animate-count-up">{appointmentStats.scheduledToday}</div>
            <p className="text-xs text-muted-foreground mt-1">confirmação do cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access & Holidays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick Access to Open Services */}
        {overdueAppointments.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Acesso Rápido - Serviços em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueAppointments.slice(0, 4).map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                    <span className="font-medium truncate">{apt.clients?.name || 'Cliente'}</span>
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {apt.daysOverdue}d
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                      onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'concluido' })}>
                      ✓ Feito
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]"
                      onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'cancelado' })}>
                      ✗ Não
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Brazilian Holidays with WhatsApp */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Próximos Feriados 🇧🇷
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const now = new Date();
              const holidays = getBrazilianHolidays(now.getFullYear());
              const nextYearHolidays = getBrazilianHolidays(now.getFullYear() + 1);
              let upcoming = holidays
                .filter(h => h.date >= now || (h.date.toDateString() === now.toDateString()))
                .slice(0, 5);
              
              if (upcoming.length < 5) {
                upcoming = [...upcoming, ...nextYearHolidays.slice(0, 5 - upcoming.length)];
              }
              
              return upcoming.map((h, i) => {
                const days = differenceInDays(h.date, now);
                const isHolidayToday = h.date.toDateString() === now.toDateString();
                const holidayMsg = `Olá! 😊\n\nLembrando que ${format(h.date, "dd/MM (EEEE)", { locale: ptBR })} é feriado: ${h.name.replace(/[^\w\sáéíóúãõâêîôûàèìòùçÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ]/g, '').trim()}.\n\nNosso atendimento pode ter horário diferenciado. Qualquer dúvida entre em contato!\n\n${companyName || 'Equipe'}`;

                return (
                  <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-sm gap-2 ${isHolidayToday ? 'bg-primary/10 border border-primary/30 animate-pulse' : 'bg-muted/50'}`}>
                    <span className={`flex-1 ${isHolidayToday ? 'font-bold' : ''}`}>{h.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{format(h.date, 'dd/MM')}</span>
                      {isHolidayToday ? (
                        <Badge className="text-[10px]">HOJE</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{days}d</Badge>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-green-600 hover:text-green-500 hover:bg-green-500/10"
                        title="Avisar clientes sobre feriado"
                        onClick={() => {
                          // Open WhatsApp with holiday message (user picks contact)
                          window.open(`https://wa.me/?text=${encodeURIComponent(holidayMsg)}`, '_blank');
                        }}
                      >
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-stagger">
        <Card className="stat-card premium-card border-primary/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-primary"><div className="icon-container p-1.5 rounded-lg bg-primary/10"><Wrench className="w-5 h-5" /></div>Serviços Cadastrados</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold animate-count-up">{servicesCount}</div>
            <p className="text-sm text-muted-foreground">{lowStockProducts.length} peça(s) com estoque baixo</p>
          </CardContent>
        </Card>
        <Card className="stat-card premium-card border-primary/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-primary"><div className="icon-container p-1.5 rounded-lg bg-primary/10"><Users className="w-5 h-5" /></div>Total de Clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold animate-count-up">{clientsCount}</div>
            <p className="text-sm text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card className="stat-card premium-card border-green-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-green-600"><div className="icon-container p-1.5 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5" /></div>Faturamento do Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600 animate-count-up">R$ {salesReport.totalSales.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Em {salesReport.totalItems} serviços este mês</p>
            
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg animate-pulse-subtle">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Receita Prevista</span>
                </div>
                <span className="font-bold text-amber-700 dark:text-amber-300">R$ {salesReport.expectedRevenue.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-amber-600 mt-1">Serviços confirmados aguardando conclusão</p>
            </div>

             <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lucro do Mês</span>
                    <span className="font-bold gradient-text">R$ {salesReport.totalProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Margem de Lucro</span>
                    <span className="font-bold">{salesReport.profitMargin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mês Anterior</span>
                    <span className="font-medium">R$ {(salesReport.prevMonthTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Variação</span>
                    <span className={`font-bold ${(salesReport.monthVariation || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {(salesReport.monthVariation || 0) >= 0 ? '+' : ''}{(salesReport.monthVariation || 0).toFixed(1)}%
                    </span>
                </div>
            </div>
            {salesReport.bestMonth && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Melhor mês do ano: {format(new Date(salesReport.bestMonth.month + '-01'), 'MMMM', { locale: ptBR })} — R$ {salesReport.bestMonth.value.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Today's Fixed Expenses */}
        <Card className="stat-card bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200/50 dark:border-red-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <div className="icon-container p-1.5 rounded-lg bg-red-500/10"><Fuel className="w-5 h-5" /></div>
              Gastos do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-red-600 animate-count-up">R$ {todayExpensesTotal.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Hoje ({todayExpenses.length} lançamento{todayExpenses.length !== 1 ? 's' : ''})</p>
            {Object.keys(expensesByCategory).length > 0 && (
              <div className="mt-3 space-y-1">
                {Object.entries(expensesByCategory).map(([category, amount]) => (
                  <div key={category} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground capitalize">{category}</span>
                    <span className="font-medium text-red-600">R$ {(amount as number).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Gastos do mês</span>
                <span className="font-bold text-red-600">R$ {monthlyExpensesTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments List */}
      {appointmentStats.todayAppointments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />Serviços Rápidos - Hoje</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointmentStats.todayAppointments.map((apt: any) => {
                const isPast = new Date(apt.appointment_date) < new Date();
                const isPending = apt.status === 'pendente' || apt.status === 'confirmado';
                const isDone = apt.status === 'concluido';
                const isCancelled = apt.status === 'cancelado';

                return (
                  <Card key={apt.id} className={`border ${
                    isDone ? 'border-blue-500/30 bg-blue-500/5' :
                    isCancelled ? 'border-red-500/30 bg-red-500/5 opacity-60' :
                    isPast && isPending ? 'border-primary/50 bg-primary/5' :
                    'border-border'
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-primary font-semibold">
                          <Clock className="w-4 h-4" />
                          {format(new Date(apt.appointment_date), 'HH:mm')}
                        </div>
                        <Badge variant={
                          apt.status === 'confirmado' ? 'default' :
                          apt.status === 'concluido' ? 'outline' :
                          apt.status === 'cancelado' ? 'destructive' : 'secondary'
                        } className="text-xs">
                          {apt.status === 'pendente' ? 'Pendente' :
                           apt.status === 'confirmado' ? 'Confirmado' :
                           apt.status === 'concluido' ? 'Concluído' :
                           apt.status === 'cancelado' ? 'Cancelado' : apt.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{apt.clients?.name || 'Cliente'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Wrench className="w-3 h-3" />
                          <span>{apt.products?.name || 'Serviço'}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="flex gap-1.5 mt-3 pt-2 border-t">
                          {apt.status !== 'confirmado' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 flex-1 border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              onClick={() => {
                                updateAppointmentStatus.mutate({ id: apt.id, status: 'confirmado', appointment: apt });
                              }}
                            >
                              <Play className="w-3 h-3 mr-1" /> Confirmar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1 border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={() => {
                              if (onNavigateToTab) onNavigateToTab('agenda');
                              // This will depend on how the child tab is handled, but at least we navigate there
                            }}
                          >
                            <FileText className="w-3 h-3 mr-1" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1 border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => {
                              updateAppointmentStatus.mutate({ id: apt.id, status: 'concluido', appointment: apt });
                            }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => {
                              updateAppointmentStatus.mutate({ id: apt.id, status: 'cancelado', appointment: apt });
                            }}
                          >
                            <X className="w-3 h-3 mr-1" /> Cancelar
                          </Button>
                        </div>
                      )}
                      {(isDone || isCancelled) && (
                        <div className="flex gap-1.5 mt-3 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 flex-1"
                            onClick={() => {
                              updateAppointmentStatus.mutate({ id: apt.id, status: 'pendente', appointment: apt });
                            }}
                          >
                            ↩️ Reabrir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (window.confirm('Remover este agendamento permanentemente?')) {
                                deleteAppointmentMutation.mutate(apt.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Excluir
                          </Button>
                        </div>
                      )}

                      {/* Navigation + Contact */}
                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        {apt.clients?.address && (
                          <div className="flex gap-1 flex-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] h-7 flex-1 text-blue-600 hover:bg-blue-50"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.clients.address)}`, '_blank')}
                            >
                              <Navigation className="w-3 h-3 mr-1" /> Maps
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] h-7 flex-1 text-orange-600 hover:bg-orange-50"
                              onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(apt.clients.address)}`, '_blank')}
                            >
                              <MapPin className="w-3 h-3 mr-1" /> Waze
                            </Button>
                          </div>
                        )}
                        {apt.clients?.telefone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[10px] h-7 px-2 text-green-600 hover:bg-green-50"
                            onClick={() => window.open(`https://wa.me/55${apt.clients.telefone.replace(/\D/g, '')}`, '_blank')}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Installments List */}
      {pendingInstallments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Parcelas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInstallments.slice(0, 5).map((inst: any) => (
                <div 
                  key={inst.id} 
                  className={`flex justify-between items-center p-3 rounded-lg ${
                    inst.status === 'overdue' ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' :
                    inst.status === 'urgent' ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800' :
                    'bg-muted/50'
                  }`}
                >
                  <div>
                    <span className="font-medium">
                      {inst.appointments?.clients?.name || `Parcela ${inst.installment_number}/${inst.total_installments}`}
                    </span>
                    <span className="text-muted-foreground mx-2">•</span>
                    <span className="text-sm text-muted-foreground">
                      Vence: {format(new Date(inst.due_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className={`font-semibold ${
                      inst.status === 'overdue' ? 'text-red-600' :
                      inst.status === 'urgent' ? 'text-orange-600' :
                      'text-primary'
                    }`}>
                      R$ {Number(inst.amount).toFixed(2)}
                    </span>
                    {inst.status === 'overdue' && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        Atrasada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Radar Card */}
      {data.maintenanceRadar && data.maintenanceRadar.length > 0 && (
        <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Radar className="w-5 h-5 animate-pulse" />
                Radar de Manutenções (Vencimentos)
              </CardTitle>
              <Badge variant="outline" className="border-blue-200 text-blue-700">
                {data.maintenanceRadar.length} oportunitade(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.maintenanceRadar.slice(0, 5).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${m.isExpired ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{m.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">{m.products?.name}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${m.isExpired ? 'text-red-500' : 'text-blue-600'}`}>
                      {m.isExpired ? `VENCIDO HÁ ${Math.abs(m.daysUntil)} DIAS` : `VENCE EM ${m.daysUntil} DIAS (${format(m.nextDate, 'dd/MM')})`}
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px] border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => {
                    const clean = m.clients?.telefone?.replace(/\D/g, '');
                    const msg = `Olá ${m.clients?.name}! 😊\n\nNotamos que a manutenção do seu equipamento (${m.products?.name}) está ${m.isExpired ? 'vencida' : 'próxima do vencimento'}.\n\nGostaria de agendar uma revisão para garantir o bom funcionamento?\n\nEquipe ${companyName || 'AC Service Pro'}`;
                    window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                >
                  <Send className="w-3 h-3 mr-1" /> Avisar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Birthday Alerts */}
      {birthdayClients.length > 0 && (
        <Alert className="border-pink-300 bg-pink-50 dark:border-pink-800 dark:bg-pink-950">
          <Gift className="h-4 w-4 text-pink-600" />
          <AlertTitle className="text-pink-800 dark:text-pink-200">🎂 Aniversariante(s) do Dia!</AlertTitle>
          <AlertDescription className="text-pink-700 dark:text-pink-300">
            <div className="space-y-2 mt-2">
              {birthdayClients.map((client: any) => (
                <div key={client.id} className="flex items-center justify-between">
                  <span className="font-medium">{client.name} faz <strong>{client.age} anos</strong> hoje! 🎉</span>
                  {client.telefone && (
                    <Button size="sm" variant="outline" className="h-7 text-green-600 border-green-300"
                      onClick={() => {
                        const clean = client.telefone.replace(/\D/g, '');
                        const name = companyName || 'AC Service Pro';
                        const msg = `Olá ${client.name}! 🎂🎉\n\nParabéns pelo seu aniversário! Desejamos muitas felicidades e sucesso!\n\nUm abraço da equipe ${name}! ❤️`;
                        window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}>
                      <Phone className="w-3 h-3 mr-1" /> Parabenizar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {upcomingBirthdays.length > 0 && (
        <Alert className="border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-800 dark:bg-fuchsia-950">
          <Gift className="h-4 w-4 text-fuchsia-600" />
          <AlertTitle className="text-fuchsia-800 dark:text-fuchsia-200">🎁 Aniversários Próximos (7 dias)</AlertTitle>
          <AlertDescription className="text-fuchsia-700 dark:text-fuchsia-300">
            <div className="space-y-2 mt-2">
              {upcomingBirthdays.slice(0, 5).map((client: any) => (
                <div key={client.id} className="flex items-center justify-between">
                  <span className="text-sm">{client.name} em {client.daysUntil} dia(s) ({client.age} anos)</span>
                  {client.telefone && (
                    <Button size="sm" variant="outline" className="h-6 text-xs text-green-600 border-green-300"
                      onClick={() => {
                        const clean = client.telefone.replace(/\D/g, '');
                        const name = companyName || 'AC Service Pro';
                        const msg = `Olá ${client.name}! 🎂\n\nSeu aniversário está chegando! A equipe ${name} deseja tudo de melhor! 🎉`;
                        window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}>
                      <Send className="w-3 h-3 mr-1" /> Enviar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Top Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Melhores Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClients.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum dado</p>
            ) : (
              topClients.map((client: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted'}`}>
                      {i + 1}
                    </span>
                    <span className="truncate max-w-[100px]">{client.name}</span>
                  </span>
                  <span className="font-semibold text-green-600">R$ {client.revenue.toFixed(0)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-500" />
              Serviços Mais Realizados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topServices.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum dado</p>
            ) : (
              topServices.map((service: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px]">{service.name}</span>
                  <span className="font-semibold">{service.count}x</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              Peças Mais Vendidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum dado</p>
            ) : (
              topProducts.map((product: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px]">{product.name}</span>
                  <span className="font-semibold">{product.count}x</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
