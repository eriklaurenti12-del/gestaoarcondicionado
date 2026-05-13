import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Search, PlusCircle, Calendar, Clock, Check, CheckCircle, X, Phone, FileDown, List, CalendarRange, Send, FileText, MapPin, Navigation, ClipboardList, Receipt, History, Users, Zap, Wallet, RefreshCw, Loader2, Sparkles } from "lucide-react";
import FinancialAIAssistant, { type AISnapshot } from './FinancialAIAssistant';
import TabGuideCards from './TabGuideCards';
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { format, addMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CalendarAgenda from './CalendarAgenda';
import ScheduleBoard from './ScheduleBoard';
import RouteExpensesDialog from './RouteExpensesDialog';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessHours } from "@/hooks/useBusinessHours";

type Appointment = {
  id: string;
  user_id: string;
  client_id: number | null;
  service_id: number | null;
  appointment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  location?: string | null;
  clients?: { name: string; telefone: string | null; address?: string | null } | null;
  products?: { name: string; price: number; service_duration?: number } | null;
};

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: number;
  client_id: number | null;
  title: string;
  total: number;
  status: string;
  created_at: string;
  clients?: { name: string; telefone: string | null; address: string | null } | null;
}

interface ServiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ServiceOrder {
  id: string;
  order_number: number;
  client_id: number | null;
  title: string;
  total: number;
  status: string;
  created_at: string;
  clients?: { name: string; telefone: string | null; address: string | null } | null;
}

const fetchAppointments = async (): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, clients(name, telefone, address), products(name, price, service_duration)`)
    .order('appointment_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Appointment[];
};

const fetchClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name, telefone, address').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchServices = async () => {
  const { data, error } = await supabase.from('products').select('id, name, price').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchPendingQuotes = async (): Promise<Quote[]> => {
  const { data, error } = await supabase
    .from('quotes')
    .select(`id, quote_number, client_id, title, total, status, created_at, clients(name, telefone, address)`)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Quote[];
};

const fetchPendingOrders = async (): Promise<ServiceOrder[]> => {
  const { data, error } = await supabase
    .from('service_orders')
    .select(`id, order_number, client_id, title, total, status, created_at, clients(name, telefone, address)`)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as ServiceOrder[];
};

const AppointmentsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { validateSlot } = useBusinessHours();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string>("");
  
  const safeIsToday = (date: any) => {
    try {
      if (!date) return false;
      return isToday(new Date(date));
    } catch {
      return false;
    }
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

  const getAppointmentPrice = (appointment: any): number => {
  if (!appointment) return 0;

  // 1) Tag explícita [VALOR:XXX.XX] (preferida — gravada na criação)
  if (appointment.notes) {
    const tag = appointment.notes.match(/\[VALOR:([\d.]+)\]/);
    if (tag) return parseFloat(tag[1]);

    // 2) Fallback retro-compatível: agendamentos antigos vindos de Orçamento/Pedido
    //    têm "Total: R$ 1.234,56" no texto livre. Extrai e usa esse valor.
    const tot = appointment.notes.match(/Total:\s*R\$\s*([\d.,]+)/i);
    if (tot) {
      const num = parseFloat(tot[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // 3) Último fallback: preço do produto/serviço cadastrado
  return Number(appointment.products?.price) || 0;
};
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [aiOpen, setAiOpen] = useState(false);
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'board'>('list');
  const [expensesDialogOpen, setExpensesDialogOpen] = useState(false);
  const [selectedExpenseAppointment, setSelectedExpenseAppointment] = useState<{id: string, provider: string}>({id: '', provider: ''});
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState<string>("Dinheiro");
  const [installments, setInstallments] = useState<number>(1);
  const [firstDueDate, setFirstDueDate] = useState<string>("");
  
  // Source selection - quote or service order
  const [sourceType, setSourceType] = useState<'quote' | 'order' | 'manual'>('quote');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  
  // New client creation (for manual mode)
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  
  // Provider selection
  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completionAppointment, setCompletionAppointment] = useState<Appointment | null>(null);
  const [completionPaymentMethod, setCompletionPaymentMethod] = useState<string>("Dinheiro");
  const [completionFeedback, setCompletionFeedback] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [convertContractAppointment, setConvertContractAppointment] = useState<Appointment | null>(null);

  // Edit state
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editServiceId, setEditServiceId] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientAddress, setEditClientAddress] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Fetch providers from admin_settings - Unified to avoid redeclaration
  const { data: providers = [] } = useQuery({
    queryKey: ['service-providers-unified'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'service_providers')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') return [];
      if (data?.value) {
        try { return JSON.parse(data.value); } catch { return []; }
      }
      return [];
    },
  });

  useEffect(() => {
    const getUserId = async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  // Auto-fill price based on provider's daily rate
  useEffect(() => {
    if (selectedProvider && selectedProvider !== '_none') {
      const provider = (providers as any[]).find(p => p.name === selectedProvider);
      if (provider?.daily_rate && provider.daily_rate > 0) {
        setCustomPrice(String(provider.daily_rate));
      }
    }
  }, [selectedProvider, providers]);

  // AUTO-SAVE: Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('appointment_form_autosave');
    if (saved) {
      const data = JSON.parse(saved);
      setSelectedClientId(data.clientId || "");
      setSelectedServiceId(data.serviceId || "");
      setAppointmentDate(data.date || "");
      setAppointmentTime(data.time || "");
      setNotes(data.notes || "");
    }
  }, []);

  // AUTO-SAVE: Save to localStorage on change
  useEffect(() => {
    const data = {
      clientId: selectedClientId,
      serviceId: selectedServiceId,
      date: appointmentDate,
      time: appointmentTime,
      notes: notes
    };
    localStorage.setItem('appointment_form_autosave', JSON.stringify(data));
  }, [selectedClientId, selectedServiceId, appointmentDate, appointmentTime, notes]);

  const clearAutoSave = () => {
    localStorage.removeItem('appointment_form_autosave');
  };

  const { data: pendingOrders } = useQuery({ queryKey: ['pending-orders'], queryFn: fetchPendingOrders });
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: fetchAppointments });
  const { data: clients = [] as any[] } = useQuery<any[]>({ queryKey: ['clients-list'], queryFn: fetchClients });
  const { data: services = [] as any[] } = useQuery<any[]>({ queryKey: ['products-list'], queryFn: fetchServices });
  const { data: pendingQuotes } = useQuery({ queryKey: ['pending-quotes'], queryFn: fetchPendingQuotes });

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel('appointments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        console.log('Realtime appointment change:', payload);
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const addAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { payment_method, installments: numInstallments, first_due_date, installment_amount, ...appointmentData } = data;
      
      // Insert appointment
      const { data: newAppointment, error } = await supabase.from('appointments').insert(appointmentData).select().single();
      if (error) throw error;
      
      // If there are installments > 1 and service selected, create installment records
      if (numInstallments > 1 && appointmentData.service_id && first_due_date) {
        const installmentRecords = [];
        const baseDate = new Date(first_due_date);
        
        for (let i = 0; i < numInstallments; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          
          installmentRecords.push({
            user_id: userId,
            appointment_id: newAppointment.id,
            installment_number: i + 1,
            total_installments: numInstallments,
            amount: installment_amount,
            due_date: dueDate.toISOString().split('T')[0],
            is_paid: false,
            payment_method: payment_method
          });
        }
        
        const { error: installmentError } = await supabase.from('installments').insert(installmentRecords);
        if (installmentError) console.error('Error creating installments:', installmentError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Agendamento criado." });
      resetForm();
      clearAutoSave();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao criar agendamento.", description: error.message });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, appointment, paymentMethod: pm }: { id: string; status: string; appointment?: Appointment; paymentMethod?: string }) => {
      const finalPm = pm || 'Dinheiro';

      // VALIDAÇÃO PRÉ-DB: bloqueia conclusão com preço 0 antes de gravar status
      if (status === 'concluido' && appointment?.client_id) {
        const preCheckPrice = getAppointmentPrice(appointment);
        if (preCheckPrice <= 0) {
          const notes = appointment.notes || '';
          const fromQuote = /Or[çc]amento\s*#\s*(\d+)/i.exec(notes)?.[1];
          const fromOrder = /(?:O\.?S\.?|Pedido|Ordem)\s*#?\s*(\d+)/i.exec(notes)?.[1];
          const origem = fromQuote
            ? `Orçamento #${fromQuote}`
            : fromOrder
              ? `Ordem #${fromOrder}`
              : 'cadastro do serviço (aba Serviços)';
          const err: any = new Error(
            `Valor R$ 0,00 detectado. Confira o preço em ${origem} antes de concluir — o lançamento no Financeiro foi bloqueado.`
          );
          err.code = 'PRICE_ZERO';
          err.targetTab = fromQuote || fromOrder ? 'documents' : 'services';
          err.targetLabel = fromQuote
            ? `Abrir Orçamento #${fromQuote}`
            : fromOrder
              ? `Abrir Ordem #${fromOrder}`
              : 'Abrir cadastro do Serviço';
          err.targetRef = fromQuote || fromOrder || appointment.service_id || null;
          throw err;
        }
      }

      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;

      // Reverse financial entries when leaving "concluido" (cancelled, edited back, etc.)
      if (status !== 'concluido') {
        await supabase.from('sales').delete()
          .eq('user_id', session.user.id)
          .eq('appointment_id', id);
        await supabase.from('financial_records').delete()
          .eq('user_id', session.user.id)
          .eq('appointment_id', id);
        return;
      }

      // Register sale + financial entry on completion
      if (status === 'concluido' && appointment?.client_id) {
        const salePrice = getAppointmentPrice(appointment);
        if (salePrice <= 0) return; // já validado acima; salva-guarda

        const { data: productData } = appointment.service_id ? await supabase
          .from('products')
          .select('cost_price')
          .eq('id', appointment.service_id)
          .maybeSingle() : { data: null };

        const actualCostPrice = productData?.cost_price || 0;
        const profit = salePrice - Number(actualCostPrice);

        // Idempotent: dedup by appointment_id
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('appointment_id', id)
          .maybeSingle();

        if (!existingSale) {
          await supabase.from('sales').insert({
            user_id: session.user.id,
            client_id: appointment.client_id,
            product_id: appointment.service_id || null,
            qty: 1,
            sale_price: salePrice,
            total_profit: profit,
            payment_method: finalPm as any,
            sale_date: appointment.appointment_date,
            appointment_id: id,
          } as any);
        } else {
          // Keep stored payment method aligned with the user's choice
          await supabase.from('sales').update({ payment_method: finalPm as any })
            .eq('id', existingSale.id);
        }

        const provName = appointment.notes?.match(/\[PRESTADOR:(.+?)\]/)?.[1];
        const finRes = await recordFinancialEntry({
          userId: session.user.id,
          type: 'entrada',
          amount: salePrice,
          description: `Serviço concluído: ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`,
          paymentMethod: finalPm,
          category: 'Serviço',
          providerName: provName,
          appointmentId: id,
          recordDate: appointment.appointment_date,
        });

        // Auditoria visível: devolve dados pra exibir no toast
        const monthLabel = format(new Date(appointment.appointment_date), "MMMM 'de' yyyy", { locale: ptBR });
        const completedAt = new Date();
        const userLabel = session.user.email?.split('@')[0] || session.user.email || 'usuário';
        return {
          audit: {
            amount: salePrice,
            month: monthLabel,
            recordId: (finRes?.data as any)?.id || null,
            skipped: !!finRes?.skipped,
            paymentMethod: finalPm,
            user: userLabel,
            email: session.user.email || '',
            at: completedAt.toISOString(),
            atLabel: format(completedAt, "dd/MM/yyyy 'às' HH:mm:ss"),
          },
        };
      }
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const previousAppointments = queryClient.getQueryData<Appointment[]>(['appointments']);
      if (previousAppointments) {
        queryClient.setQueryData<Appointment[]>(['appointments'], 
          previousAppointments.map(a => a.id === id ? { ...a, status } : a)
        );
      }
      return { previousAppointments };
    },
    onSuccess: (data: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-financial'] });
      queryClient.invalidateQueries({ queryKey: ['financial-records'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      try { window.dispatchEvent(new CustomEvent('financial-data-updated')); } catch {}

      const audit = data?.audit;
      if (audit) {
        const valorFmt = `R$ ${Number(audit.amount).toFixed(2).replace('.', ',')}`;
        const status = audit.skipped
          ? 'Lançamento já existia (não duplicou)'
          : `Lançamento criado no Financeiro (${audit.paymentMethod})`;
        const desc = `${valorFmt} • ${audit.month} • ${status} • Por ${audit.user} em ${audit.atLabel}`;
        // Log estruturado para auditoria local (devtools / replay)
        console.info('[audit:baixa]', { ...audit, appointmentId: vars?.id });
        toast({ title: '✅ Baixa concluída', description: desc });
      } else if (showCompletionDialog) {
        toast({ title: 'Serviço Concluído!', description: 'Feedback e próxima manutenção registrados.' });
      } else {
        toast({ title: 'Status atualizado!' });
      }
      if (showCompletionDialog) setShowCompletionDialog(false);
    },
    onError: (error: any, __, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments'], context.previousAppointments);
      }
      if (error?.code === 'PRICE_ZERO') {
        const targetTab = error.targetTab || 'services';
        const targetLabel = error.targetLabel || 'Abrir cadastro';
        const targetRef = error.targetRef;
        toast({
          variant: 'destructive',
          title: '⚠️ Valor zerado — confira a origem',
          description: error.message,
          action: (
            <ToastAction
              altText={targetLabel}
              onClick={() => {
                try {
                  if (targetRef) sessionStorage.setItem('focus_target_ref', String(targetRef));
                  window.dispatchEvent(new CustomEvent('app-navigate-tab', { detail: { tab: targetTab } }));
                } catch {}
              }}
            >
              {targetLabel}
            </ToastAction>
          ),
        });
        return;
      }
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (session) {
        // Cleanup linked financial entries before removing the appointment
        await supabase.from('sales').delete().eq('user_id', session.user.id).eq('appointment_id', id);
        await supabase.from('financial_records').delete().eq('user_id', session.user.id).eq('appointment_id', id);
      }
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: "Agendamento removido!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: { id: string; appointment_date: string; notes: string; client_id?: number; service_id?: number; client_name?: string; client_address?: string }) => {
      if (data.client_id && (data.client_name || data.client_address !== undefined)) {
        await supabase.from('clients').update({
          name: data.client_name,
          address: data.client_address
        }).eq('id', data.client_id);
      }

      const { error } = await supabase
        .from('appointments')
        .update({ 
          appointment_date: data.appointment_date,
          notes: data.notes,
          client_id: data.client_id,
          service_id: data.service_id
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: "Agendamento atualizado!", description: "As alterações foram salvas." });
      setEditingAppointment(null);
      setEditReason("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    }
  });

  const resetForm = () => {
    setSelectedClientId("");
    setSelectedServiceId("");
    setAppointmentDate("");
    setAppointmentTime("");
    setNotes("");
    setPaymentMethod("Dinheiro");
    setInstallments(1);
    setFirstDueDate("");
    setNewClientName("");
    setNewClientPhone("");
    setNewClientAddress("");
    setIsCreatingNewClient(false);
    setSourceType('quote');
    setSelectedQuoteId("");
    setSelectedOrderId("");
    setSelectedProvider("");
  };
  
  // Create new client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: { name: string; telefone: string; address: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({ 
          user_id: userId, 
          name: clientData.name, 
          telefone: clientData.telefone || null,
          address: clientData.address || null
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      setSelectedClientId(String(data.id));
      setIsCreatingNewClient(false);
      toast({ title: "Cliente cadastrado!", description: `${data.name} foi adicionado.` });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao cadastrar cliente", description: error.message });
    }
  });
  
  // Get selected quote or order details
  const selectedQuote = pendingQuotes?.find(q => q.id === selectedQuoteId);
  const selectedOrder = pendingOrders?.find(o => o.id === selectedOrderId);
  
  // Get total based on source
  const getSelectedTotal = () => {
    if (sourceType === 'quote' && selectedQuote) return selectedQuote.total;
    if (sourceType === 'order' && selectedOrder) return selectedOrder.total;
    if (sourceType === 'manual' && selectedServiceId) {
      const service = services?.find(s => s.id === parseInt(selectedServiceId));
      return service?.price || 0;
    }
    return 0;
  };
  
  const selectedTotal = getSelectedTotal();

  const handleAddAppointment = async () => {
    // Validate based on source type
    if (sourceType === 'quote' && !selectedQuoteId) {
      toast({ variant: "destructive", title: "Selecione um orçamento" });
      return;
    }
    if (sourceType === 'order' && !selectedOrderId) {
      toast({ variant: "destructive", title: "Selecione um Pedido" });
      return;
    }
    if (sourceType === 'manual' && !selectedClientId) {
      toast({ variant: "destructive", title: "Selecione um cliente" });
      return;
    }
    
    if (!appointmentDate || !appointmentTime) {
      toast({ variant: "destructive", title: "Data e horário são obrigatórios" });
      return;
    }

    const [y, m, d] = appointmentDate.split('-').map(Number);
    const [hh, mm] = appointmentTime.split(':').map(Number);
    const dateTime = new Date(y, m - 1, d, hh, mm);
    
    // ========== BUSINESS-HOURS / VACATION / PAST VALIDATION ==========
    const selectedService = selectedServiceId ? services?.find(s => s.id === parseInt(selectedServiceId)) : null;
    const duration = (selectedService as any)?.service_duration || 60; // exact cadastrado, sem arredondar
    const validationError = validateSlot(dateTime, { durationMinutes: duration });
    if (validationError) {
      toast({ variant: "destructive", title: "Horário inválido", description: validationError });
      return;
    }
    // ===============================================

    // ========== CONFLICT DETECTION ==========
    const newStart = dateTime.getTime();
    const newEnd = newStart + duration * 60 * 1000;
    
    const conflictingAppointments = appointments?.filter(a => {
      if (a.status === 'cancelado' || a.status === 'concluido') return false;
      const aptStart = new Date(a.appointment_date).getTime();
      const aptDuration = (a.products as any)?.service_duration || 60;
      const aptEnd = aptStart + aptDuration * 60 * 1000;
      return (newStart < aptEnd && newEnd > aptStart); // overlap
    }) || [];

    if (conflictingAppointments.length > 0) {
      const conflictNames = conflictingAppointments.map(a => 
        `${a.clients?.name || 'Cliente'} às ${format(new Date(a.appointment_date), 'HH:mm')}`
      ).join(', ');
      
      const confirmed = window.confirm(
        `⚠️ CONFLITO DE HORÁRIO!\n\nJá existem agendamentos nesse horário:\n${conflictNames}\n\nDeseja agendar mesmo assim?`
      );
      if (!confirmed) return;
    }
    // ========================================
    
    // Get client_id and notes based on source
    let clientId: number | null = null;
    let fullNotes = notes || "";
    
    if (sourceType === 'quote' && selectedQuote) {
      clientId = selectedQuote.client_id;
      fullNotes = `Orçamento #${selectedQuote.quote_number} - ${selectedQuote.title}\nTotal: R$ ${Number(selectedQuote.total).toFixed(2)}\n${notes || ""}`.trim();
    } else if (sourceType === 'order' && selectedOrder) {
      clientId = selectedOrder.client_id;
      fullNotes = `Pedido #${selectedOrder.order_number} - ${selectedOrder.title}\nTotal: R$ ${Number(selectedOrder.total).toFixed(2)}\n${notes || ""}`.trim();
    } else if (sourceType === 'manual') {
      clientId = parseInt(selectedClientId);
    }
    
    if (!clientId) {
      toast({ variant: "destructive", title: "Cliente não encontrado" });
      return;
    }
    
    // Add provider tag to notes
    if (selectedProvider && selectedProvider !== '_none') {
      fullNotes = `[PRESTADOR:${selectedProvider}]\n${fullNotes}`.trim();
    }
    
    // Add value tag — sempre que vier de orçamento/pedido OU se houver customPrice.
    // Isso garante que o card da agenda mostre o valor (não "A combinar") e que a
    // baixa lance o valor correto no Financeiro.
    let valueForTag: number | null = null;
    if (customPrice) {
      valueForTag = parseFloat(customPrice);
    } else if (sourceType === 'quote' && selectedQuote) {
      valueForTag = Number(selectedQuote.total) || null;
    } else if (sourceType === 'order' && selectedOrder) {
      valueForTag = Number(selectedOrder.total) || null;
    }
    if (valueForTag && valueForTag > 0) {
      fullNotes = `[VALOR:${valueForTag.toFixed(2)}]\n${fullNotes}`.trim();
    }

    const installmentAmount = selectedTotal / installments;
    
    addAppointmentMutation.mutate({
      user_id: userId,
      client_id: clientId,
      service_id: selectedServiceId ? parseInt(selectedServiceId) : null,
      appointment_date: dateTime.toISOString(),
      notes: fullNotes || null,
      status: 'pendente',
      payment_method: paymentMethod,
      installments: installments,
      first_due_date: firstDueDate || null,
      installment_amount: installmentAmount
    });
    
    // Update quote/order status to "pendente".
    // IMPORTANTE: NÃO criamos lançamento financeiro aqui. O lançamento é
    // criado APENAS quando o agendamento é concluído (vinculado via
    // appointment_id), evitando duplicação no Financeiro.
    if (sourceType === 'quote' && selectedQuoteId) {
      await supabase.from('quotes').update({ status: 'pendente' }).eq('id', selectedQuoteId);
      queryClient.invalidateQueries({ queryKey: ['pending-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
    if (sourceType === 'order' && selectedOrderId) {
      await supabase.from('service_orders').update({ status: 'pendente' }).eq('id', selectedOrderId);
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    }

    // 4. Autonomous Communication (WhatsApp Confirmation)
    const client = clients?.find(c => c.id === clientId);
    const clientName = client?.name || newClientName || "Cliente";
    const clientPhone = (client?.telefone || newClientPhone || "").replace(/\D/g, '');
    const formattedDate = format(dateTime, "dd/MM/yyyy 'às' HH:mm");
    
    if (clientPhone) {
      const confirmMsg = `Olá *${clientName}*! ❄️\n\nConfirmamos seu agendamento com a *AC Service Pro*:\n\n📅 *Data:* ${formattedDate}\n📍 *Endereço:* ${client?.address || newClientAddress || "Não informado"}\n\nQualquer dúvida, estamos à disposição!`;
      window.open(`https://wa.me/55${clientPhone}?text=${encodeURIComponent(confirmMsg)}`, '_blank');
    }
  };
  
  // Handle creating new client before scheduling
  const handleCreateNewClient = () => {
    if (!newClientName.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Digite o nome do cliente." });
      return;
    }
    createClientMutation.mutate({
      name: newClientName.trim(),
      telefone: newClientPhone,
      address: newClientAddress
    });
  };

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      const matchesSearch = a.clients?.name.toLowerCase().includes(search.toLowerCase()) || 
                           a.products?.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "todos" || a.status === filterStatus;
      
      // Filter by month/year
      const appointmentDateObj = new Date(a.appointment_date);
      const matchesMonth = filterMonth === "todos" || (appointmentDateObj.getMonth() + 1) === parseInt(filterMonth);
      const matchesYear = filterYear === "todos" || appointmentDateObj.getFullYear() === parseInt(filterYear);
      
      return (search === "" || matchesSearch) && matchesStatus && matchesMonth && matchesYear;
    });
  }, [appointments, search, filterStatus, filterMonth, filterYear]);

  // Get unique years from appointments
  const availableYears = useMemo(() => {
    if (!appointments) return [new Date().getFullYear()];
    const years = [...new Set(appointments.map(a => new Date(a.appointment_date).getFullYear()))];
    return years.sort((a, b) => b - a);
  }, [appointments]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pendente: { className: "bg-amber-500/10 text-amber-600 border-amber-200", label: "Pendente" },
      confirmado: { className: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Confirmado" },
      concluido: { className: "bg-green-500/10 text-green-600 border-green-200", label: "Concluído" },
      cancelado: { className: "bg-red-500/10 text-red-600 border-red-200", label: "Cancelado" },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant="outline" className={`font-bold uppercase tracking-tighter text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const getAppointmentPriceLabel = (appointment: any) => {
    const val = getAppointmentPrice(appointment);
    return val > 0 ? `R$ ${val.toFixed(2)}` : 'A combinar';
  };

  const handleWhatsApp = (phone: string | null | undefined, clientName: string, date: string) => {
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedDate = safeFormat(date, "dd/MM 'às' HH:mm", { locale: ptBR });
    const message = `Olá ${clientName}! Confirmando seu agendamento para ${formattedDate}. Podemos confirmar?`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Send "On my way" message
  const sendOnMyWay = (phone: string | null | undefined, clientName: string, date: string) => {
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedDate = safeFormat(date, "HH:mm", { locale: ptBR });
    const message = `Olá ${clientName}! Estamos a caminho para o serviço agendado às ${formattedDate}. Aguarde nossa chegada! 🚗`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Send service details to Provider
  const sendToProvider = (appointment: Appointment) => {
    const provName = appointment.notes?.match(/\[PRESTADOR:(.+?)\]/)?.[1];
    if (!provName) {
      toast({ variant: "destructive", title: "Nenhum prestador atribuído", description: "Edite o agendamento para escolher um prestador primeiro." });
      return;
    }

    const provider = providers.find((p: any) => p.name === provName);
    if (!provider?.phone) {
      toast({ variant: "destructive", title: "Telefone do prestador não encontrado" });
      return;
    }

    const cleanPhone = provider.phone.replace(/\D/g, '');
    const serviceDate = safeFormat(appointment.appointment_date, "dd/MM (EEEE) 'às' HH:mm", { locale: ptBR });
    
    let message = `🛠️ *NOVO SERVIÇO ATRIBUÍDO*\n\n` +
      `👤 *Cliente:* ${appointment.clients?.name || 'N/A'}\n` +
      `📅 *Data:* ${serviceDate}\n` +
      `🔧 *Serviço:* ${appointment.products?.name || 'N/A'}\n` +
      `📍 *Endereço:* ${appointment.clients?.address || 'Não informado'}\n`;
    
    if (appointment.clients?.address) {
      message += `🗺️ *Navegar:* https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.clients.address)}\n`;
    }

    message += `💰 *Valor:* ${getAppointmentPriceLabel(appointment)}\n\n`;
    
    if (appointment.notes) {
      const cleanNotes = appointment.notes.replace(/\[.*?\]/g, '').trim();
      if (cleanNotes) message += `📝 *Obs:* ${cleanNotes}\n\n`;
    }
    
    message += `Favor confirmar o recebimento! ✅`;

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Open Google Maps with client address
  const openGoogleMaps = (address: string | null | undefined) => {
    if (!address) {
      toast({ variant: "destructive", title: "Endereço não cadastrado", description: "Cadastre o endereço do cliente primeiro." });
      return;
    }
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  // Generate service receipt and send via WhatsApp
  const sendServiceReceipt = (appointment: Appointment) => {
    const phone = appointment.clients?.telefone;
    if (!phone) {
      toast({ variant: "destructive", title: "Cliente não possui telefone cadastrado" });
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const serviceDate = safeFormat(appointment.appointment_date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const serviceName = appointment.products?.name || 'Serviço';
    const servicePrice = getAppointmentPrice(appointment);
    
    const message = `✅ *COMPROVANTE DE SERVIÇO*\n\n` +
      `📋 *AC Service Pro*\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Cliente:* ${appointment.clients?.name || 'N/A'}\n` +
      `📅 *Data:* ${serviceDate}\n` +
      `🔧 *Serviço:* ${serviceName}\n` +
      `💰 *Valor:* ${servicePrice}\n` +
      `📌 *Status:* Concluído ✓\n\n` +
      (appointment.notes ? `📝 *Obs:* ${appointment.notes}\n\n` : '') +
      `━━━━━━━━━━━━━━━━\n` +
      `Agradecemos a preferência! 🙏\n` +
      `Em caso de dúvidas, entre em contato.`;
    
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Generate PDF receipt
  const generateServiceReceiptPDF = (appointment: Appointment) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(0, 150, 200);
    doc.rect(0, 0, pageWidth, 35, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROVANTE DE SERVIÇO", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text("AC Service Pro", pageWidth / 2, 25, { align: "center" });
    
    // Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    let y = 50;
    
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(appointment.clients?.name || 'N/A', 60, y);
    
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Telefone:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(appointment.clients?.telefone || 'N/A', 60, y);
    
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Data:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(appointment.appointment_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), 60, y);
    
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Serviço:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(appointment.products?.name || 'N/A', 60, y);
    
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Valor:", 20, y);
    doc.setFont("helvetica", "normal");
    const price = getAppointmentPriceLabel(appointment);
    doc.text(price, 60, y);
    
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Status:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 150, 0);
    doc.text("CONCLUÍDO", 60, y);
    
    if (appointment.notes) {
      y += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", 20, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.text(appointment.notes, 20, y);
    }
    
    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text("Documento gerado pelo sistema AC Service Pro", pageWidth / 2, 280, { align: "center" });
    doc.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageWidth / 2, 286, { align: "center" });
    
    doc.save(`comprovante-servico-${appointment.id.slice(0, 8)}.pdf`);
    toast({ title: "PDF do comprovante gerado!" });
  };

  const todayAppointments = useMemo(() => {
    if (!appointments) return 0;
    const today = new Date().toDateString();
    return appointments.filter(a => new Date(a.appointment_date).toDateString() === today && a.status !== 'cancelado').length;
  }, [appointments]);

  // Generate available time slots - 24 hours (every 30 min)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 0; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get booked times for a specific date with service duration
  const getBookedTimesWithDetails = (date: string) => {
    if (!appointments) return [];
    return appointments
      .filter(a => {
        const appointmentDateObj = new Date(a.appointment_date);
        return appointmentDateObj.toISOString().split('T')[0] === date && a.status !== 'cancelado';
      })
      .map(a => ({
        time: safeFormat(a.appointment_date, 'HH:mm'),
        clientName: a.clients?.name || 'Ocupado'
      }));
  };

  // Get minimum date for scheduling (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getEditMinDate = () => {
    const today = getMinDate();
    const currentDate = editingAppointment ? safeFormat(editingAppointment.appointment_date, 'yyyy-MM-dd') : today;
    return currentDate !== '-' && currentDate < today ? currentDate : today;
  };

  // Check if a time slot is in the past for today
  const isTimePast = (time: string, date: string) => {
    if (date !== getMinDate()) return false;
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    return slotTime <= now;
  };




  // Get booked times for a specific date (simple list)
  const getBookedTimes = (date: string) => {
    return getBookedTimesWithDetails(date).map(b => b.time);
  };

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clients || !clientSearch.trim()) return [];
    const term = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.telefone && c.telefone.includes(term))
    ).slice(0, 8);
  }, [clients, clientSearch]);

  // Export PDF with available times
  const exportAvailableTimesPDF = () => {
    const doc = new jsPDF();
    const selectedDate = appointmentDate || new Date().toISOString().split('T')[0];
    const bookedTimes = getBookedTimes(selectedDate);
    
    doc.setFontSize(18);
    doc.text('Horários Disponíveis', 14, 22);
    doc.setFontSize(12);
    doc.text(`Data: ${safeFormat(selectedDate + 'T12:00:00', 'dd/MM/yyyy (EEEE)', { locale: ptBR })}`, 14, 32);
    
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));
    const tableData = availableSlots.map(slot => [slot, '✅ Disponível']);

    autoTable(doc, {
      startY: 40,
      head: [['Horário', 'Status']],
      body: tableData,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [147, 51, 234] },
    });

    doc.save(`horarios-disponiveis-${selectedDate}.pdf`);
    toast({ title: "PDF exportado!", description: "Horários disponíveis salvos." });
  };

  // Export PDF with scheduled appointments
  const exportScheduledPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Agenda de Atendimentos', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${safeFormat(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

    const scheduledAppointments = appointments?.filter(a => a.status !== 'cancelado') || [];
    const tableData = scheduledAppointments.map(a => [
      safeFormat(a.appointment_date, 'dd/MM/yyyy'),
      safeFormat(a.appointment_date, 'HH:mm'),
      a.clients?.name || '-',
      a.clients?.telefone || '-',
      a.products?.name || '-',
      a.status === 'pendente' ? 'Agendado' : a.status === 'confirmado' ? 'Confirmado' : 'Concluído'
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Data', 'Hora', 'Cliente', 'Telefone', 'Serviço', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [147, 51, 234] },
    });

    doc.save('agenda-atendimentos.pdf');
    toast({ title: "PDF exportado!", description: "Agenda de atendimentos salva." });
  };

  // Export Route PDF - grouped by provider for today or selected date
  const exportRoutePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = safeFormat(new Date(), 'yyyy-MM-dd');
    
    const todayAppts = appointments?.filter(a => {
      const d = a.appointment_date.split('T')[0];
      return d === today && a.status !== 'cancelado' && a.status !== 'concluido';
    }).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()) || [];

    // Header
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rota do Dia', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(safeFormat(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), 14, 28);
    doc.setFontSize(9);
    doc.text(`${todayAppts.length} atendimento(s)`, 14, 35);

    if (todayAppts.length === 0) {
      doc.setTextColor(100);
      doc.setFontSize(14);
      doc.text('Nenhum atendimento agendado para hoje.', pageWidth / 2, 60, { align: 'center' });
      doc.save(`rota-${today}.pdf`);
      toast({ title: "PDF da rota exportado!" });
      return;
    }

    // Group by provider
    const byProvider: Record<string, typeof todayAppts> = {};
    todayAppts.forEach(a => {
      const match = a.notes?.match(/\[PRESTADOR:(.+?)\]/);
      const prov = match?.[1] || 'Sem Prestador';
      if (!byProvider[prov]) byProvider[prov] = [];
      byProvider[prov].push(a);
    });

    let y = 48;
    Object.entries(byProvider).forEach(([provName, appts]) => {
      if (y > 250) { doc.addPage(); y = 20; }
      
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(`📍 ${provName}`, 14, y);
      y += 2;

      const tableData = appts.map((a, i) => [
        `${i + 1}`,
        safeFormat(a.appointment_date, 'HH:mm'),
        a.clients?.name || '-',
        a.clients?.telefone || '-',
        a.clients?.address || 'Sem endereço',
        a.products?.name || 'Serviço',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Hora', 'Cliente', 'Telefone', 'Endereço', 'Serviço']],
        body: tableData,
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: { 4: { cellWidth: 50 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${safeFormat(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 285, { align: 'center' });

    doc.save(`rota-${today}.pdf`);
    toast({ title: "PDF da rota exportado!", description: "Rota do dia salva com sucesso." });
  };


  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <TabGuideCards cards={[
        {
          icon: Calendar,
          title: 'Agenda de Serviços',
          badge: 'Organização',
          badgeColor: 'blue',
          description: <>Agende atendimentos a partir de <strong>orçamentos aprovados</strong>. Controle horários e evite conflitos.</>,
        },
        {
          icon: ClipboardList,
          title: 'Acompanhamento',
          badge: 'Status',
          badgeColor: 'emerald',
          description: <>Acompanhe o <strong>status de cada serviço</strong> (agendado, em andamento, concluído). Envie lembretes via WhatsApp.</>,
        },
      ]} />
      {/* View Toggle + Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden w-full lg:w-auto">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-none min-h-[44px] px-3 flex-1 lg:flex-none"
            aria-label="Visualizar como lista"
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button 
            variant={viewMode === 'board' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('board')}
            className="rounded-none min-h-[44px] px-3 flex-1 lg:flex-none"
            aria-label="Visualizar agrupado por horários"
          >
            <Clock className="w-4 h-4 mr-2" />
            Horários
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="rounded-none min-h-[44px] px-3 flex-1 lg:flex-none whitespace-nowrap"
            aria-label="Visualizar em calendário mensal"
          >
            <CalendarRange className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Calendário</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Button onClick={() => setShowAddDialog(true)} className="min-h-[44px] flex-1 lg:flex-none" aria-label="Novo agendamento">
            <PlusCircle className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Novo Agendamento</span>
          </Button>
          <Button onClick={exportScheduledPDF} variant="outline" className="min-h-[44px] flex-1 lg:flex-none" aria-label="Exportar agendamentos em PDF">
            <FileDown className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Exportar PDF</span>
          </Button>
          <Button onClick={exportRoutePDF} variant="outline" className="min-h-[44px] flex-1 lg:flex-none text-blue-600 border-blue-300 hover:bg-blue-50" aria-label="Gerar rota do dia">
            <Navigation className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Rota do Dia</span>
          </Button>
          <Button onClick={() => setAiOpen(true)} disabled={aiOpen} variant="outline" className="min-h-[44px] flex-1 lg:flex-none text-purple-600 border-purple-300 hover:bg-purple-50 disabled:opacity-70" aria-label="Assistente IA da Agenda" aria-busy={aiOpen}>
            {aiOpen ? <Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 shrink-0" />}
            <span className="truncate">{aiOpen ? 'Abrindo...' : 'IA'}</span>
          </Button>
        </div>
      </div>

      {/* Decision Dashboard - Top level guidance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 bg-primary/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              PRÓXIMO SERVIÇO
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido' && a.status !== 'cancelado')[0] ? (
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-lg leading-tight truncate">
                      {appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido' && a.status !== 'cancelado')[0]?.clients?.name}
                    </p>
                    <p className="text-xs font-bold text-primary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {safeFormat(appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido' && a.status !== 'cancelado')[0]?.appointment_date, 'HH:mm')}
                    </p>
                  </div>
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none text-[10px] h-5 flex-shrink-0">HOJE</Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-8 text-[11px] font-bold" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido' && a.status !== 'cancelado')[0]?.clients?.address || '')}`, '_blank')}>
                    <Navigation className="w-3 h-3 mr-1" /> IR
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] font-bold" onClick={() => window.open(`https://wa.me/55${(appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'concluido' && a.status !== 'cancelado')[0]?.clients?.telefone || '').replace(/\D/g, '')}`, '_blank')}>
                    <Phone className="w-3 h-3 mr-1" /> WHATS
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground italic text-sm">
                Nenhum serviço pendente para hoje.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" />
              PROGRESSO DO DIA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-black">{appointments?.filter(a => safeIsToday(a.appointment_date) && a.status === 'concluido').length || 0}</span>
              <span className="text-xs text-muted-foreground">de {appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'cancelado').length || 0} agendados</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000" 
                style={{ width: `${((appointments?.filter(a => safeIsToday(a.appointment_date) && a.status === 'concluido').length || 0) / (appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'cancelado').length || 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm bg-muted/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              FATURAMENTO HOJE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <p className="text-2xl font-black text-green-600">
              R$ {appointments?.filter(a => safeIsToday(a.appointment_date) && (a.status === 'concluido' || a.status === 'concluido')).reduce((sum, a) => sum + getAppointmentPrice(a), 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Estimado total: R$ {appointments?.filter(a => safeIsToday(a.appointment_date) && a.status !== 'cancelado').reduce((sum, a) => sum + getAppointmentPrice(a), 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarAgenda className="animate-fade-in" />
      )}

      {/* Board View - Time Slots */}
      {viewMode === 'board' && (
        <ScheduleBoard />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="op-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                AGENDA OPERACIONAL
              </h2>
              <p className="text-xs text-slate-400 font-medium">Cadastre e confirme serviços para enviar à equipe externa</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowAddDialog(true)} className="op-btn-primary flex-1 sm:flex-initial">
                <PlusCircle className="w-4 h-4" />
                Novo Agendamento
              </Button>
              <Button onClick={exportAvailableTimesPDF} variant="outline" className="op-btn-secondary flex-1 sm:flex-initial">
                <FileDown className="w-4 h-4" />
                PDF Vagos
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative col-span-1 sm:col-span-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Buscar cliente..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="op-input pl-9 h-10"
                />
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="op-input h-10">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10 text-white">
                  <SelectItem value="todos">Todos os meses</SelectItem>
                  {Array.from({length: 12}).map((_, i) => (
                    <SelectItem key={i+1} value={String(i+1)}>{format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="op-input h-10">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10 text-white">
                  <SelectItem value="todos">Todos os anos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Status Filter Buttons - Visual and Fast */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-white/5">
              {[
                { id: 'todos', label: 'TODOS', color: 'bg-slate-500/10 text-slate-400 border-white/5' },
                { id: 'pendente', label: 'PENDENTES', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
                { id: 'confirmado', label: 'CONFIRMADOS', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
                { id: 'concluido', label: 'CONCLUÍDOS', color: 'bg-green-500/10 text-green-600 border-green-200' },
                { id: 'cancelado', label: 'CANCELADOS', color: 'bg-red-500/10 text-red-600 border-red-200' },
              ].map(status => (
                <button
                  key={status.id}
                  onClick={() => setFilterStatus(status.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all border whitespace-nowrap ${
                    filterStatus === status.id 
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                    : `${status.color} hover:border-white/20 opacity-70 hover:opacity-100`
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-white/5">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400">Data/Hora</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400">Cliente / Local</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400">Serviço</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Ações Operacionais</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isLoadingAppointments ? (
                  Array.from({length: 3}).map((_,i) => (
                    <TableRow key={i} className="border-white/5"><TableCell colSpan={5}><Skeleton className="h-10 w-full bg-white/5"/></TableCell></TableRow>
                  ))
                ) : filteredAppointments.length === 0 ? (
                  <TableRow className="border-white/5"><TableCell colSpan={5} className="text-center py-12 text-slate-500 text-sm italic">Nenhum agendamento encontrado</TableCell></TableRow>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-white font-black text-sm">{safeFormat(appointment.appointment_date, 'dd/MM/yyyy')}</span>
                          <span className="text-blue-500 font-bold text-xs">{safeFormat(appointment.appointment_date, 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">{appointment.clients?.name || '-'}</span>
                          {appointment.clients?.telefone && (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" /> {appointment.clients.telefone}
                            </span>
                          )}
                          {(appointment.clients as any)?.address && (
                            <span className="text-[9px] text-slate-500 truncate max-w-[150px]">{appointment.clients?.address}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-200 text-xs font-bold">{appointment.products?.name || 'Serviço'}</span>
                          <span className="text-green-500 text-[10px] font-black">{getAppointmentPriceLabel(appointment)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {getStatusBadge(appointment.status)}
                      </TableCell>
                      <TableCell className="py-4 text-right min-w-[280px]">
                        <div className="flex justify-end items-center gap-1.5 flex-nowrap whitespace-nowrap opacity-80 group-hover:opacity-100 transition-all">
                          {/* Confirm Button - Prioritized */}
                          {appointment.status === 'pendente' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 px-2.5 text-[10px] font-black uppercase whitespace-nowrap shrink-0 bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'confirmado', appointment })}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirmar
                            </Button>
                          )}
                          
                          {/* Send to Provider - The Architectural Link */}
                          {(appointment.status === 'confirmado' || appointment.status === 'pendente') && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 px-2.5 text-[10px] font-black uppercase whitespace-nowrap shrink-0 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500 hover:text-white"
                              onClick={() => {
                                sendToProvider(appointment);
                                if (appointment.status !== 'confirmado') {
                                  updateStatusMutation.mutate({ id: appointment.id, status: 'confirmado' });
                                }
                              }}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Enviar
                            </Button>
                          )}

                          {/* Quick Complete - 1 Click Concluir */}
                          {appointment.status === 'confirmado' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 px-2.5 text-[10px] font-black uppercase whitespace-nowrap shrink-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                              onClick={() => {
                                setCompletionAppointment(appointment);
                                setCompletionPaymentMethod('Dinheiro');
                                setShowCompletionDialog(true);
                              }}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Baixa
                            </Button>
                          )}

                          {/* Edit / View Details */}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                            aria-label="Editar / Ver detalhes do agendamento"
                            onClick={() => {
                              setEditingAppointment(appointment);
                              setEditDate(appointment.appointment_date.split('T')[0]);
                              setEditTime(safeFormat(appointment.appointment_date, 'HH:mm'));
                              setEditClientId(String(appointment.client_id || ""));
                              setEditServiceId(String(appointment.service_id || ""));
                              setEditClientName(appointment.clients?.name || "");
                              setEditClientAddress((appointment.clients as any)?.address || "");
                              
                              const priceMatch = appointment.notes?.match(/\[VALOR:([\d.]+)\]/);
                              setEditPrice(priceMatch ? priceMatch[1] : (appointment.products?.price ? String(appointment.products.price) : ""));
                              
                              const match = appointment.notes?.match(/\[PRESTADOR:(.+?)\]/);
                              setEditProvider(match?.[1] || "");
                              
                              let cleanNotes = appointment.notes?.replace(/\[PRESTADOR:.+?\]\n?/, "") || "";
                              cleanNotes = cleanNotes.replace(/\[VALOR:[\d.]+\]\n?/, "");
                              setEditNotes(cleanNotes);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>

                          {/* Delete */}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 w-9 p-0 text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
                            aria-label="Remover este agendamento"
                            onClick={() => {
                              if (window.confirm('Remover este agendamento?')) {
                                deleteAppointmentMutation.mutate(appointment.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      )}

      {/* Dialog Novo Agendamento */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Novo Agendamento Completo
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do agendamento com serviços inclusos
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleAddAppointment(); }} className="space-y-4">
            <div className="space-y-4">
            {/* Source Type Selection */}
            <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as 'quote' | 'order' | 'manual')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quote" className="flex items-center gap-1">
                  <Receipt className="w-4 h-4" />
                  <span className="hidden sm:inline">Orçamento</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-1">
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Manual</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="quote" className="mt-4">
                <div className="space-y-3 p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                  <Label className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Receipt className="w-4 h-4" />
                    Selecionar Orçamento Pendente
                  </Label>
                  {pendingQuotes && pendingQuotes.length > 0 ? (
                    <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione um orçamento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingQuotes.map((quote) => (
                          <SelectItem key={quote.id} value={quote.id}>
                            #{quote.quote_number} - {quote.title} ({quote.clients?.name || 'Sem cliente'}) - R$ {Number(quote.total).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum orçamento pendente disponível</p>
                  )}
                  {selectedQuote && (
                    <div className="mt-3 p-3 bg-background rounded border animate-fade-in">
                      <p className="font-medium">{selectedQuote.title}</p>
                      <p className="text-sm text-muted-foreground">Cliente: {selectedQuote.clients?.name || 'N/A'}</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Total: R$ {Number(selectedQuote.total).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              

              

              <TabsContent value="manual" className="mt-4">
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Cliente *</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsCreatingNewClient(!isCreatingNewClient)}
                      className="text-xs"
                    >
                      {isCreatingNewClient ? "Selecionar existente" : "+ Novo cliente"}
                    </Button>
                  </div>
                  
                  {isCreatingNewClient ? (
                    <div className="space-y-3 animate-fade-in">
                      <div>
                        <Label className="text-sm">Nome do cliente *</Label>
                        <Input 
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="Digite o nome completo"
                          className="min-h-[44px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Telefone</Label>
                          <Input 
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Endereço</Label>
                          <Input 
                            value={newClientAddress}
                            onChange={(e) => setNewClientAddress(e.target.value)}
                            placeholder="Endereço completo"
                            className="min-h-[44px]"
                          />
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        onClick={handleCreateNewClient}
                        disabled={!newClientName.trim() || createClientMutation.isPending}
                        className="w-full min-h-[44px]"
                      >
                        {createClientMutation.isPending ? "Cadastrando..." : "Cadastrar e Selecionar Cliente"}
                      </Button>
                    </div>
                  ) : (
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.name} {client.telefone && `- ${client.telefone}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* Service selection for manual mode */}
                  <div className="mt-3">
                    <Label className="text-sm">Serviço (opcional)</Label>
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione um serviço..." />
                      </SelectTrigger>
                      <SelectContent>
                        {services?.map((service) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            {service.name} - R$ {Number(service.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-3">
                    <Label className="text-sm">Preço Customizado (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={customPrice} 
                      onChange={(e) => setCustomPrice(e.target.value)} 
                      placeholder="Deixe em branco para usar o preço padrão"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="order" className="mt-4">
                <div className="space-y-3 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                  <Label className="font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <FileText className="w-4 h-4" />
                    Selecionar Pedido de Serviço
                  </Label>
                  {pendingOrders && pendingOrders.length > 0 ? (
                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione um pedido..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            #{order.order_number} - {order.title} ({order.clients?.name || 'Sem cliente'}) - R$ {Number(order.total).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum pedido pendente disponível</p>
                  )}
                  {selectedOrder && (
                    <div className="mt-3 p-3 bg-background rounded border animate-fade-in">
                      <p className="font-medium">{selectedOrder.title}</p>
                      <p className="text-sm text-muted-foreground">Cliente: {selectedOrder.clients?.name || 'N/A'}</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Total: R$ {Number(selectedOrder.total).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input 
                  type="date" 
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={appointmentDate} 
                  onChange={(e) => setAppointmentDate(e.target.value)} 
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.filter(slot => !isTimePast(slot, appointmentDate)).map((slot) => {
                      const isBooked = appointmentDate ? getBookedTimes(appointmentDate).includes(slot) : false;
                      return (
                        <SelectItem 
                          key={slot} 
                          value={slot}
                          disabled={isBooked}
                          className={isBooked ? "text-muted-foreground line-through" : ""}
                        >
                          {slot} {isBooked ? "(ocupado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Prestador (opcional)</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o prestador..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {(providers as any[]).filter((p: any) => p.active).map((p: any) => (
                    <SelectItem key={p.id} value={p.name}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name} — {p.specialty}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Observações adicionais..." 
                className="min-h-[44px]"
              />
            </div>

            {/* Payment Section - Only show if there's a total */}
            {selectedTotal > 0 && (
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-semibold text-muted-foreground mb-3 block">
                  Pagamento - Total: R$ {selectedTotal.toFixed(2)}
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                        <SelectItem value="PIX">📱 PIX</SelectItem>
                        <SelectItem value="Débito">💳 Débito</SelectItem>
                        <SelectItem value="Crédito">💳 Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={String(installments)} onValueChange={(v) => setInstallments(parseInt(v))}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Parcelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">À vista</SelectItem>
                        <SelectItem value="2">2x</SelectItem>
                        <SelectItem value="3">3x</SelectItem>
                        <SelectItem value="4">4x</SelectItem>
                        <SelectItem value="5">5x</SelectItem>
                        <SelectItem value="6">6x</SelectItem>
                        <SelectItem value="10">10x</SelectItem>
                        <SelectItem value="12">12x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {installments > 1 && (
                  <div className="space-y-2 mt-4 p-3 bg-muted/50 rounded-lg animate-fade-in">
                    <Label>Data do 1º Vencimento *</Label>
                    <Input 
                      type="date" 
                      value={firstDueDate} 
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      className="min-h-[44px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Valor por parcela: R$ {(selectedTotal / installments).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={
                addAppointmentMutation.isPending || 
                !appointmentDate || 
                !appointmentTime ||
                (sourceType === 'quote' && !selectedQuoteId) ||
                (sourceType === 'order' && !selectedOrderId) ||
                (sourceType === 'manual' && !selectedClientId && !isCreatingNewClient)
              }
              className="min-h-[44px]"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {addAppointmentMutation.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      {/* Edit Appointment Dialog */}
      <Dialog open={!!editingAppointment} onOpenChange={(open) => !open && setEditingAppointment(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 shrink-0 border-b">
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere os detalhes do serviço para {editingAppointment?.clients?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={editClientId} onValueChange={setEditClientId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={editServiceId} onValueChange={setEditServiceId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      {service.name} - R$ {Number(service.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input value={editClientName} onChange={e => setEditClientName(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={editClientAddress} onChange={e => setEditClientAddress(e.target.value)} className="min-h-[44px]" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preço Customizado (R$)</Label>
              <Input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Opcional. Substitui o valor do serviço." className="min-h-[44px]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nova Data</Label>
                <Input type="date" min={getEditMinDate()} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>Novo Horário</Label>
                <Select value={editTime} onValueChange={setEditTime}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.filter(slot => {
                      const isSameAsCurrent = editDate === safeFormat(editingAppointment?.appointment_date, 'yyyy-MM-dd') && 
                                             slot === safeFormat(editingAppointment?.appointment_date, 'HH:mm');
                      return !isTimePast(slot, editDate) || isSameAsCurrent || slot === editTime;
                    }).map((slot) => {
                      const isBooked = editDate ? getBookedTimes(editDate).includes(slot) : false;
                      // Don't mark the current slot as booked if it belongs to the appointment being edited
                      const isSameAsCurrent = editDate === safeFormat(editingAppointment?.appointment_date, 'yyyy-MM-dd') && 
                                             slot === safeFormat(editingAppointment?.appointment_date, 'HH:mm');
                      
                      return (
                        <SelectItem 
                          key={slot} 
                          value={slot}
                          disabled={isBooked && !isSameAsCurrent}
                          className={isBooked && !isSameAsCurrent ? "text-muted-foreground line-through" : ""}
                        >
                          {slot} {isBooked && !isSameAsCurrent ? "(ocupado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prestador Responsável</Label>
              <Select value={editProvider} onValueChange={setEditProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um prestador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (Remover)</SelectItem>
                  {providers.map((p: any) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações do Serviço</Label>
              <Input 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)} 
                placeholder="Detalhes técnicos ou pedidos do cliente..." 
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-amber-600 font-semibold flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Motivo da Alteração
              </Label>
              <Input 
                value={editReason} 
                onChange={(e) => setEditReason(e.target.value)} 
                placeholder="Ex: Cliente pediu para remarcar, peça em falta..." 
                className="border-amber-200 bg-amber-50/30"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Este motivo será registrado no histórico do agendamento.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 p-4 border-t bg-background shrink-0 sticky bottom-0">
            <Button variant="outline" onClick={() => setEditingAppointment(null)} className="min-h-[44px]">Cancelar</Button>
            <Button 
              className="min-h-[44px]"
              disabled={updateAppointmentMutation.isPending}
              onClick={() => {
                if (!editingAppointment) return;

                if (!editReason.trim()) {
                  toast({ variant: "destructive", title: "Motivo obrigatório", description: "Informe o motivo da alteração antes de salvar." });
                  return;
                }
                
                const [y, m, d] = editDate.split('-').map(Number);
                const [hh, mm] = editTime.split(':').map(Number);
                const newDateTimeObj = new Date(y, m - 1, d, hh, mm);
                const isSameDateTimeAsCurrent = editDate === safeFormat(editingAppointment.appointment_date, 'yyyy-MM-dd') &&
                  editTime === safeFormat(editingAppointment.appointment_date, 'HH:mm');
                
                // ========== PAST DATE/TIME VALIDATION ==========
                const now = new Date();
                if (!isSameDateTimeAsCurrent && newDateTimeObj <= now) {
                  toast({ variant: "destructive", title: "Horário inválido", description: "Não é possível agendar em datas/horários passados. Selecione um horário futuro." });
                  return;
                }
                // ===============================================

                const newDateTime = newDateTimeObj.toISOString();
                
                // Construct new notes with provider tag and history entry
                let newNotes = editNotes.trim();
                if (editProvider && editProvider !== '_none') {
                  newNotes = `[PRESTADOR:${editProvider}]\n${newNotes}`.trim();
                }
                if (editPrice) {
                  newNotes = `[VALOR:${editPrice}]\n${newNotes}`.trim();
                }
                
                const historyEntry = `\n[ALTERAÇÃO ${safeFormat(new Date(), 'dd/MM HH:mm')}] Motivo: ${editReason} | De: ${safeFormat(editingAppointment.appointment_date, 'dd/MM HH:mm')} Para: ${safeFormat(newDateTime, 'dd/MM HH:mm')}`;
                newNotes += historyEntry;

                updateAppointmentMutation.mutate({
                  id: editingAppointment.id,
                  appointment_date: newDateTime,
                  notes: newNotes,
                  client_id: editClientId ? parseInt(editClientId) : undefined,
                  service_id: editServiceId ? parseInt(editServiceId) : undefined,
                  client_name: editClientName,
                  client_address: editClientAddress
                });
              }}
            >
              {updateAppointmentMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RouteExpensesDialog
        isOpen={expensesDialogOpen}
        onOpenChange={setExpensesDialogOpen}
        appointmentId={selectedExpenseAppointment.id}
        providerName={selectedExpenseAppointment.provider}
      />
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Concluir Serviço
            </DialogTitle>
            <DialogDescription>
              Feedback rápido e agendamento da próxima manutenção.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feedback do Serviço (Opcional)</Label>
              <Textarea 
                placeholder="Ex: Ar-condicionado higienizado, filtros trocados..." 
                value={completionFeedback}
                onChange={(e) => setCompletionFeedback(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Sugestão de Próxima Manutenção
              </Label>
              <Input 
                type="date" 
                value={nextMaintenanceDate}
                onChange={(e) => setNextMaintenanceDate(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Baseado na periodicidade de {(completionAppointment?.products as any)?.warranty_months || 6} meses do serviço.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                💳 Forma de Pagamento
              </Label>
              <Select value={completionPaymentMethod} onValueChange={setCompletionPaymentMethod}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="PIX">📱 PIX</SelectItem>
                  <SelectItem value="Débito">💳 Débito</SelectItem>
                  <SelectItem value="Crédito">💳 Crédito</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Esta forma será gravada na venda e no Financeiro.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCompletionDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 font-bold gap-2"
              disabled={updateStatusMutation.isPending}
              onClick={async () => {
                if (!completionAppointment) return;
                
                const clientPhone = completionAppointment.clients?.telefone?.replace(/\D/g, '') || '';
                const clientName = completionAppointment.clients?.name || 'Cliente';
                
                // 1. Prepare Notes with Feedback
                const updatedNotes = completionFeedback 
                  ? `${completionAppointment.notes || ""}\n[FEEDBACK: ${completionFeedback}]`.trim() 
                  : completionAppointment.notes;

                // 2. Create Future Recurrence (180 days)
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 180);
                
                const recurrenceNote = `[RECORRÊNCIA AUTOMÁTICA] Referente ao serviço #${completionAppointment.id} concluído em ${new Date().toLocaleDateString()}`;
                
                await supabase.from('appointments').insert({
                  user_id: completionAppointment.user_id,
                  client_id: completionAppointment.client_id,
                  service_id: completionAppointment.service_id,
                  appointment_date: futureDate.toISOString(),
                  status: 'pendente', // Set as agendado but with a note for sales
                  notes: recurrenceNote,
                  location: completionAppointment.location
                });

                // 3. Update Current Status
                updateStatusMutation.mutate({ 
                  id: completionAppointment.id, 
                  status: 'concluido', 
                  appointment: { ...completionAppointment, notes: updatedNotes },
                  paymentMethod: completionPaymentMethod,
                });

                // 4. Autonomous Communication (Satisfaction Survey)
                const surveyMsg = `Olá *${clientName}*! ❄️\n\nFicamos felizes em concluir seu serviço. Poderia nos dar um feedback rápido? Sua opinião é muito importante para nós!\n\nNota de 0 a 10?\nQualquer observação?\n\nObrigado pela preferência!`;
                
                // 5. Generate Receipt PDF (Automatic Download)
                generateServiceReceiptPDF(completionAppointment);
                
                window.open(`https://wa.me/55${clientPhone}?text=${encodeURIComponent(surveyMsg)}`, '_blank');
                
                setShowCompletionDialog(false);
                toast({ 
                  title: "Serviço concluído", 
                  description: "Recibo gerado e Lembrete de 180 dias agendado!" 
                });
              }}
            >
              <CheckCircle className="w-4 h-4" />
              Concluir e Notificar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinancialAIAssistant
        open={aiOpen}
        onOpenChange={setAiOpen}
        context="agenda"
        placeholder="Ex: Quais agendamentos estão pendentes de cobrança? Quais foram concluídos sem lançamento?"
        buildSnapshot={async (): Promise<AISnapshot> => {
          const all = appointments || [];
          const now = new Date();
          const overdue = all.filter(a => a.status === 'pendente' && new Date(a.appointment_date) < now).length;
          const today = all.filter(a => isToday(new Date(a.appointment_date))).length;
          const concluded = all.filter(a => a.status === 'concluido');
          // checa pendência de cobrança: concluídos sem entrada financeira vinculada
          let unbilled = 0;
          if (userId && concluded.length > 0) {
            const ids = concluded.map(a => a.id);
            const { data: linked } = await supabase
              .from('financial_records')
              .select('appointment_id')
              .eq('user_id', userId)
              .in('appointment_id', ids);
            const linkedIds = new Set((linked || []).map((r: any) => r.appointment_id));
            unbilled = concluded.filter(a => !linkedIds.has(a.id)).length;
          }
          const issues: AISnapshot['issues'] = [];
          if (overdue > 0) issues.push({ id: 'overdue', label: `${overdue} agendamento(s) pendente(s) com data passada.`, severity: 'warn' });
          if (unbilled > 0) issues.push({ id: 'unbilled', label: `${unbilled} agendamento(s) concluído(s) sem cobrança lançada no Financeiro.`, severity: 'error' });
          return {
            headline: `${all.length} agendamento(s) total · ${today} hoje · ${overdue} atrasado(s) · ${unbilled} sem cobrança`,
            counts: { total: all.length, today, overdue, concluded: concluded.length, unbilled },
            issues,
          };
        }}
      />
    </div>
  );
};

export default AppointmentsTab;
