
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Scissors, Users, TrendingUp, AlertTriangle, CalendarDays, CalendarCheck, Clock, Download, Bell, BellRing, Gift } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, isToday, startOfWeek, endOfWeek, addDays, isSameDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fetchDashboardData = async () => {
    const productsPromise = supabase.from('products').select('*');
    const clientsPromise = supabase.from('clients').select('*');
    const salesPromise = supabase.from('sales').select('sale_price, qty, total_profit');
    const appointmentsPromise = supabase.from('appointments').select('*, clients(name), products(name)');

    const [{ data: products, error: pError }, { data: clients, error: cError }, { data: sales, error: sError }, { data: appointments, error: aError }] = await Promise.all([productsPromise, clientsPromise, salesPromise, appointmentsPromise]);

    if (pError || cError || sError || aError) {
        console.error(pError || cError || sError || aError);
        throw new Error("Failed to fetch dashboard data");
    }

    const lowStockProducts = products!.filter(p => p.qty <= (p.min_stock || 0));
    const totalSales = sales!.reduce((sum, s) => sum + (Number(s.sale_price) * s.qty), 0);
    const totalProfit = sales!.reduce((sum, s) => sum + Number(s.total_profit), 0);
    const totalItems = sales!.reduce((sum, s) => sum + s.qty, 0);
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Appointment statistics
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

    const todayAppointments = appointments!.filter(a => isToday(new Date(a.appointment_date)));
    const weekAppointments = appointments!.filter(a => {
        const date = new Date(a.appointment_date);
        return date >= weekStart && date <= weekEnd;
    });

    const confirmedToday = todayAppointments.filter(a => a.status === 'confirmado').length;
    const scheduledToday = todayAppointments.filter(a => a.status === 'agendado').length;
    const completedToday = todayAppointments.filter(a => a.status === 'concluído').length;

    // Birthday reminders
    const upcomingBirthdays = clients!.filter(client => {
        if (!client.aniversario) return false;
        const birthday = new Date(client.aniversario);
        const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        const daysUntil = differenceInDays(thisYearBirthday, today);
        return daysUntil >= 0 && daysUntil <= 7;
    }).map(client => {
        const birthday = new Date(client.aniversario!);
        const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        const daysUntil = differenceInDays(thisYearBirthday, today);
        return { ...client, daysUntil };
    });

    return {
        servicesCount: products!.length,
        clientsCount: clients!.length,
        lowStockProducts,
        salesReport: { totalSales, totalItems, totalProfit, profitMargin },
        appointmentStats: {
            today: todayAppointments.length,
            week: weekAppointments.length,
            confirmedToday,
            scheduledToday,
            completedToday,
            todayAppointments,
            weekAppointments
        },
        upcomingBirthdays
    };
};

const Dashboard: React.FC = () => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // Check notification permission
        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }

        // PWA install prompt
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
                new Notification('Salão de Beleza', {
                    body: 'Notificações ativadas com sucesso!',
                    icon: '/icon-192x192.png'
                });
            } else {
                toast.error('Permissão negada para notificações');
            }
        }
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['dashboard'],
        queryFn: fetchDashboardData
    });

    if (isLoading) return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
    if (isError) return <div>Error loading dashboard: {(error as Error).message}</div>

    const { servicesCount, clientsCount, lowStockProducts, salesReport, appointmentStats, upcomingBirthdays } = data!;

    return (
    <div className="space-y-6">
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

      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">Alerta de Estoque Baixo!</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {lowStockProducts.length} produto(s) com estoque baixo: {lowStockProducts.map(p => p.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Birthday Reminders */}
      {upcomingBirthdays.length > 0 && (
        <Alert className="border-pink-200 bg-pink-50 dark:border-pink-800 dark:bg-pink-950">
          <Gift className="h-4 w-4 text-pink-600" />
          <AlertTitle className="text-pink-800 dark:text-pink-200">🎂 Aniversariantes Próximos!</AlertTitle>
          <AlertDescription className="text-pink-700 dark:text-pink-300">
            {upcomingBirthdays.map((c, i) => (
              <span key={c.id}>
                {c.name} ({c.daysUntil === 0 ? 'HOJE!' : `em ${c.daysUntil} dia(s)`})
                {i < upcomingBirthdays.length - 1 ? ', ' : ''}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Appointment Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Hoje</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{appointmentStats.today}</div>
            <p className="text-xs text-muted-foreground mt-1">agendamentos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Semana</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-600">{appointmentStats.week}</div>
            <p className="text-xs text-muted-foreground mt-1">agendamentos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Confirmados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{appointmentStats.confirmedToday}</div>
            <p className="text-xs text-muted-foreground mt-1">para hoje</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Pendentes</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600">{appointmentStats.scheduledToday}</div>
            <p className="text-xs text-muted-foreground mt-1">aguardando</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5" />Serviços & Produtos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{servicesCount}</div>
            <p className="text-sm text-muted-foreground">{lowStockProducts.length} com estoque baixo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Total de Clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{clientsCount}</div>
            <p className="text-sm text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Faturamento</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">R$ {salesReport.totalSales.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Em {salesReport.totalItems} atendimentos</p>
             <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lucro Total</span>
                    <span className="font-bold text-blue-600">R$ {salesReport.totalProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Margem de Lucro</span>
                    <span className="font-bold">{salesReport.profitMargin.toFixed(2)}%</span>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments List */}
      {appointmentStats.todayAppointments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />Agendamentos de Hoje</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {appointmentStats.todayAppointments.map((apt: any) => (
                <div key={apt.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">{apt.clients?.name || 'Cliente'}</span>
                    <span className="text-muted-foreground mx-2">•</span>
                    <span className="text-sm text-muted-foreground">{apt.products?.name || 'Serviço'}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-primary">
                      {format(new Date(apt.appointment_date), 'HH:mm')}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                      apt.status === 'confirmado' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      apt.status === 'concluído' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
          <CardHeader><CardTitle>Produtos com Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((product, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-orange-600 font-semibold">{product.qty} restantes</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

export default Dashboard;
