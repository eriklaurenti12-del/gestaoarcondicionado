import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Search, PlusCircle, Calendar, Clock, Check, X, Phone, FileDown, List, CalendarRange, Send, FileText, MapPin, Navigation, ClipboardList, Receipt, History, Users } from "lucide-react";
import TabGuideCards from './TabGuideCards';
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CalendarAgenda from './CalendarAgenda';
import ScheduleBoard from './ScheduleBoard';
import RouteExpensesDialog from './RouteExpensesDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Appointment = {
  id: string;
  user_id: string;
  client_id: number | null;
  service_id: number | null;
  appointment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
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
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string>("");

  const getAppointmentPrice = (apt: any) => {
    if (apt.notes) {
      const match = apt.notes.match(/\[VALOR:([\d.]+)\]/);
      if (match) return Number(match[1]);
    }
    return Number(apt.products?.price) || 0;
  };
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
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

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({ 
    queryKey: ['appointments'], 
    queryFn: fetchAppointments 
  });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients });
  const { data: services } = useQuery({ queryKey: ['services-list'], queryFn: fetchServices });
  const { data: pendingQuotes } = useQuery({ queryKey: ['pending-quotes'], queryFn: fetchPendingQuotes });
  const { data: pendingOrders } = useQuery({ queryKey: ['pending-orders'], queryFn: fetchPendingOrders });
  
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
      toast({ title: "Sucesso!", description: "Agendamento criado." });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao criar agendamento.", description: error.message });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, appointment }: { id: string; status: string; appointment?: Appointment }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
      
      // If completing the appointment and has a service, register the sale AND financial record
      if (status === 'concluido' && appointment?.client_id) {
        const { data: { session } } = await supabase.auth.getSession();
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
          
          // Check if sale already exists for this appointment (avoid duplicates)
          const { data: existingSale } = await supabase
            .from('sales')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('client_id', appointment.client_id)
            .eq('sale_date', appointment.appointment_date)
            .maybeSingle();

          if (!existingSale) {
            await supabase.from('sales').insert({
              user_id: session.user.id,
              client_id: appointment.client_id,
              product_id: appointment.service_id || null, // Can be null now
              qty: 1,
              sale_price: salePrice,
              total_profit: profit,
              payment_method: 'Dinheiro' as const,
              sale_date: appointment.appointment_date // Keep consistent with appointment date
            });

            // Create financial record
            await supabase.from('financial_records').insert({
              user_id: session.user.id,
              type: 'entrada',
              amount: salePrice,
              description: `Serviço concluído: ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`,
              payment_method: 'Dinheiro',
              category: 'Serviço Agenda',
              record_date: new Date().toISOString()
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-financial'] });
      queryClient.invalidateQueries({ queryKey: ['financial-records'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
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

    const dateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    
    // ========== PAST DATE/TIME VALIDATION ==========
    const now = new Date();
    if (dateTime <= now) {
      toast({ variant: "destructive", title: "Horário inválido", description: "Não é possível agendar em datas/horários passados. Selecione um horário futuro." });
      return;
    }
    // ===============================================
    
    // ========== CONFLICT DETECTION ==========
    const selectedService = selectedServiceId ? services?.find(s => s.id === parseInt(selectedServiceId)) : null;
    const duration = (selectedService as any)?.service_duration || 60; // default 60 min
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

    const installmentAmount = selectedTotal / installments;
    
    addAppointmentMutation.mutate({
      user_id: userId,
      client_id: clientId,
      service_id: selectedServiceId ? parseInt(selectedServiceId) : null,
      appointment_date: dateTime.toISOString(),
      notes: fullNotes || null,
      status: 'agendado',
      payment_method: paymentMethod,
      installments: installments,
      first_due_date: firstDueDate || null,
      installment_amount: installmentAmount
    });
    
    // Update quote/order status to "agendado"
    if (sourceType === 'quote' && selectedQuoteId) {
      await supabase.from('quotes').update({ status: 'agendado' }).eq('id', selectedQuoteId);
      
      // Add a financial record for the scheduled quote
      if (selectedQuote) {
        await supabase.from('financial_records').insert({
          user_id: userId,
          type: 'entrada',
          amount: Number(selectedQuote.total),
          description: `Orçamento Agendado: ${selectedQuote.title}`,
          payment_method: paymentMethod,
          category: 'Orçamento Agendado',
          record_date: dateTime.toISOString()
        });
        queryClient.invalidateQueries({ queryKey: ['financial-records'] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['pending-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
    if (sourceType === 'order' && selectedOrderId) {
      await supabase.from('service_orders').update({ status: 'agendado' }).eq('id', selectedOrderId);
      
      // Add a financial record for the scheduled order
      if (selectedOrder) {
        await supabase.from('financial_records').insert({
          user_id: userId,
          type: 'entrada',
          amount: Number(selectedOrder.total),
          description: `Pedido Agendado: ${selectedOrder.title}`,
          payment_method: paymentMethod,
          category: 'Pedido Agendado',
          record_date: dateTime.toISOString()
        });
        queryClient.invalidateQueries({ queryKey: ['financial-records'] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
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
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      agendado: { variant: "secondary", label: "Agendado" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.agendado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getAppointmentPrice = (appointment: any) => {
    const match = appointment.notes?.match(/\[VALOR:(.+?)\]/);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      return isNaN(val) ? match[1] : `R$ ${val.toFixed(2)}`;
    }
    return appointment.products?.price ? `R$ ${Number(appointment.products.price).toFixed(2)}` : 'A combinar';
  };

  const handleWhatsApp = (phone: string | null | undefined, clientName: string, date: string) => {
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedDate = format(new Date(date), "dd/MM 'às' HH:mm", { locale: ptBR });
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
    const formattedDate = format(new Date(date), "HH:mm", { locale: ptBR });
    const message = `Olá ${clientName}! Estamos a caminho para o serviço agendado às ${formattedDate}. Aguarde nossa chegada! 🚗`;
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
    const serviceDate = format(new Date(appointment.appointment_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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
    const price = getAppointmentPrice(appointment);
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
        time: format(new Date(a.appointment_date), 'HH:mm'),
        clientName: a.clients?.name || 'Ocupado'
      }));
  };

  // Get minimum date for scheduling (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
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


  const sendToProvider = (appointment: Appointment) => {
    const match = appointment.notes?.match(/\[PRESTADOR:(.+?)\]/);
    const provName = match?.[1];
    if (!provName) {
      toast({ title: "Nenhum prestador vinculado", variant: "destructive" });
      return;
    }

    const provider = (providers as any[]).find(p => p.name === provName);
    if (!provider || !provider.phone) {
      toast({ title: "Telefone do prestador não encontrado", variant: "destructive" });
      return;
    }

    let message = `*🔧 NOVO SERVIÇO ATRIBUÍDO*\n\n`;
    message += `👤 *Cliente:* ${appointment.clients?.name || 'Não informado'}\n`;
    message += `📅 *Data/Hora:* ${format(new Date(appointment.appointment_date), "dd/MM 'às' HH:mm", { locale: ptBR })}\n`;
    message += `🛠️ *Serviço:* ${appointment.products?.name || 'Manutenção'}\n`;
    message += `📍 *Endereço:* ${appointment.clients?.address || 'Verificar cadastro'}\n`;
    
    if (appointment.clients?.address) {
      message += `🗺️ *Navegar:* https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.clients.address)}\n`;
    }
    
    if (appointment.notes) {
      const cleanNotes = appointment.notes.replace(/\[PRESTADOR:.+?\]\n?/, "");
      if (cleanNotes.trim()) message += `\n📝 *Obs:* ${cleanNotes.trim()}\n`;
    }
    
    message += `\n_Acesse o sistema para mais detalhes._`;

    const phone = provider.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
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
    doc.text(`Data: ${format(new Date(selectedDate + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}`, 14, 32);
    
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
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

    const scheduledAppointments = appointments?.filter(a => a.status !== 'cancelado') || [];
    const tableData = scheduledAppointments.map(a => [
      format(new Date(a.appointment_date), 'dd/MM/yyyy'),
      format(new Date(a.appointment_date), 'HH:mm'),
      a.clients?.name || '-',
      a.clients?.telefone || '-',
      a.products?.name || '-',
      a.status === 'agendado' ? 'Agendado' : a.status === 'confirmado' ? 'Confirmado' : 'Concluído'
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
    const today = format(new Date(), 'yyyy-MM-dd');
    
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
    doc.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), 14, 28);
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
        format(new Date(a.appointment_date), 'HH:mm'),
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
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 285, { align: 'center' });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-none min-h-[44px] px-4"
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button 
            variant={viewMode === 'board' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('board')}
            className="rounded-none min-h-[44px] px-4"
          >
            <Clock className="w-4 h-4 mr-2" />
            Horários
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="rounded-none min-h-[44px] px-4"
          >
            <CalendarRange className="w-4 h-4 mr-2" />
            Calendário
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowAddDialog(true)} className="min-h-[44px] flex-1 sm:flex-none">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
          <Button onClick={exportScheduledPDF} variant="outline" className="min-h-[44px]">
            <FileDown className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button onClick={exportRoutePDF} variant="outline" className="min-h-[44px] text-blue-600 border-blue-300 hover:bg-blue-50">
            <Navigation className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Rota do Dia</span>
            <span className="sm:hidden">Rota</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold">{todayAppointments}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Hoje</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-500">
              {appointments?.filter(a => a.status === 'agendado').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Agendados</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-green-500">
              {appointments?.filter(a => a.status === 'confirmado').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Confirmados</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              {appointments?.filter(a => a.status === 'concluido').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Concluídos</div>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agendamentos
              </span>
              <Button onClick={exportAvailableTimesPDF} size="sm" variant="outline" className="min-h-[44px]">
                <FileDown className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Horários Disponíveis</span>
                <span className="sm:hidden">Horários</span>
              </Button>
            </CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente ou serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 transition-all duration-200"/>
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="1">Janeiro</SelectItem>
                <SelectItem value="2">Fevereiro</SelectItem>
                <SelectItem value="3">Março</SelectItem>
                <SelectItem value="4">Abril</SelectItem>
                <SelectItem value="5">Maio</SelectItem>
                <SelectItem value="6">Junho</SelectItem>
                <SelectItem value="7">Julho</SelectItem>
                <SelectItem value="8">Agosto</SelectItem>
                <SelectItem value="9">Setembro</SelectItem>
                <SelectItem value="10">Outubro</SelectItem>
                <SelectItem value="11">Novembro</SelectItem>
                <SelectItem value="12">Dezembro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full sm:w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="agendado">Agendados</SelectItem>
                <SelectItem value="confirmado">Confirmados</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Data/Hora</TableHead>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px]">Serviço</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAppointments ? (
                  Array.from({length: 3}).map((_,i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                  ))
                ) : filteredAppointments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum agendamento encontrado</TableCell></TableRow>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        <div className="flex flex-col">
                          <span>{format(new Date(appointment.appointment_date), 'dd/MM/yyyy')}</span>
                          <span className="text-muted-foreground">{format(new Date(appointment.appointment_date), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm">{appointment.clients?.name || '-'}</span>
                          {appointment.clients?.telefone && (
                            <span className="text-xs text-muted-foreground">{appointment.clients.telefone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{appointment.products?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {appointment.clients?.telefone && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target"
                              onClick={() => handleWhatsApp(appointment.clients?.telefone, appointment.clients?.name || '', appointment.appointment_date)}
                              title="Chamar no WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-10 w-10 p-0 touch-target text-primary hover:bg-primary/10"
                            onClick={() => sendToProvider(appointment)}
                            title="Enviar para Prestador (WhatsApp)"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          {appointment.status === 'agendado' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'confirmado', appointment })}
                              title="Confirmar Agendamento"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-10 w-10 p-0 touch-target"
                            title="Editar Agendamento"
                            onClick={() => {
                              setEditingAppointment(appointment);
                              setEditDate(appointment.appointment_date.split('T')[0]);
                              setEditTime(format(new Date(appointment.appointment_date), 'HH:mm'));
                              setEditClientId(String(appointment.client_id || ""));
                              setEditServiceId(String(appointment.service_id || ""));
                              setEditClientName(appointment.clients?.name || "");
                              setEditClientAddress((appointment.clients as any)?.address || "");
                              
                              const priceMatch = appointment.notes?.match(/\[VALOR:([\d.]+)\]/);
                              setEditPrice(priceMatch ? priceMatch[1] : (appointment.products?.price ? String(appointment.products.price) : ""));
                              
                              // Extract provider from notes if possible
                              const match = appointment.notes?.match(/\[PRESTADOR:(.+?)\]/);
                              setEditProvider(match?.[1] || "");
                              
                              // Remove provider and valor tag for editing notes
                              let cleanNotes = appointment.notes?.replace(/\[PRESTADOR:.+?\]\n?/, "") || "";
                              cleanNotes = cleanNotes.replace(/\[VALOR:[\d.]+\]\n?/, "");
                              setEditNotes(cleanNotes);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {appointment.status === 'confirmado' && (
                            <>
                              {(appointment.clients as any)?.address && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-10 w-10 p-0 touch-target text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                  onClick={() => openGoogleMaps((appointment.clients as any)?.address)}
                                  title="Abrir no Google Maps"
                                >
                                  <Navigation className="w-4 h-4" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-10 w-10 p-0 touch-target text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                                onClick={() => sendOnMyWay(appointment.clients?.telefone, appointment.clients?.name || '', appointment.appointment_date)}
                                title="Avisar que está a caminho"
                              >
                                <MapPin className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="h-10 px-3 text-sm touch-target"
                                title="Concluir Serviço"
                                onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'concluido', appointment })}
                              >
                                Concluir
                              </Button>
                            </>
                          )}
                          {appointment.status === 'concluido' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-10 w-10 p-0 touch-target text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                                onClick={() => sendServiceReceipt(appointment)}
                                title="Enviar comprovante WhatsApp"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-10 w-10 p-0 touch-target text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                                onClick={() => {
                                  const providerMatch = appointment.notes?.match(/\[PRESTADOR:(.*?)\]/);
                                  setSelectedExpenseAppointment({
                                    id: appointment.id,
                                    provider: providerMatch ? providerMatch[1] : ''
                                  });
                                  setExpensesDialogOpen(true);
                                }}
                                title="Lançar Gastos da Rota"
                              >
                                <Receipt className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-10 w-10 p-0 touch-target text-primary hover:bg-primary/10"
                                onClick={() => generateServiceReceiptPDF(appointment)}
                                title="Gerar PDF do comprovante"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {appointment.status !== 'cancelado' && appointment.status !== 'concluido' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'cancelado', appointment })}
                              title="Cancelar Agendamento"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-10 w-10 p-0 touch-target text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm('Remover este agendamento?')) {
                                deleteAppointmentMutation.mutate(appointment.id);
                              }
                            }}
                            title="Excluir Agendamento"
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
        </CardContent>
        </Card>
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
          
          <div className="space-y-4">
            {/* Source Type Selection */}
            <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as 'quote' | 'order' | 'manual')} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="quote" className="flex items-center gap-1">
                  <Receipt className="w-4 h-4" />
                  <span className="hidden sm:inline">Orçamento</span>
                </TabsTrigger>
                <TabsTrigger value="order" className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Pedido</span>
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddAppointment} 
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
        </DialogContent>
      </Dialog>
      {/* Edit Appointment Dialog */}
      <Dialog open={!!editingAppointment} onOpenChange={(open) => !open && setEditingAppointment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere os detalhes do serviço para {editingAppointment?.clients?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>Novo Horário</Label>
                <Select value={editTime} onValueChange={setEditTime}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.filter(slot => !isTimePast(slot, editDate)).map((slot) => {
                      const isBooked = editDate ? getBookedTimes(editDate).includes(slot) : false;
                      // Don't mark the current slot as booked if it belongs to the appointment being edited
                      const isSameAsCurrent = editDate === format(new Date(editingAppointment?.appointment_date || ''), 'yyyy-MM-dd') && 
                                             slot === format(new Date(editingAppointment?.appointment_date || ''), 'HH:mm');
                      
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingAppointment(null)}>Cancelar</Button>
            <Button 
              disabled={updateAppointmentMutation.isPending || !editReason.trim()}
              onClick={() => {
                if (!editingAppointment) return;
                
                const newDateTimeObj = new Date(`${editDate}T${editTime}`);
                
                // ========== PAST DATE/TIME VALIDATION ==========
                const now = new Date();
                if (newDateTimeObj <= now) {
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
                
                const historyEntry = `\n[ALTERAÇÃO ${format(new Date(), 'dd/MM HH:mm')}] Motivo: ${editReason} | De: ${format(new Date(editingAppointment.appointment_date), 'dd/MM HH:mm')} Para: ${format(new Date(newDateTime), 'dd/MM HH:mm')}`;
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
    </div>
  );
};

export default AppointmentsTab;
