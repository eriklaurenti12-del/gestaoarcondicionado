import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { 
  Bell, Send, MessageSquare, Clock, AlertTriangle, 
  Users, Calendar, RefreshCw, Search, CheckCircle, Mail,
  Snowflake, MapPin, DollarSign, Plus, User, History,
  FileText, Trash2, Download, Eye, Phone, Building2, ScrollText
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ServiceReminder {
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  serviceName: string;
  lastServiceDate: string;
  warrantyMonths: number;
  monthsSince: number;
  daysOverdue: number;
  status: 'due' | 'overdue' | 'upcoming';
}

interface ServiceHistory {
  id: string;
  clientId: number;
  clientName: string;
  clientAddress: string | null;
  clientPhone: string | null;
  serviceName: string;
  serviceDate: string;
  servicePrice: number;
  status: string;
  notes: string | null;
  nextMaintenanceDate: string | null;
  daysUntilMaintenance: number | null;
}

interface Contract {
  id: string;
  contract_number: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  cleaning_interval_months: number;
  monthly_value: number;
  status: string;
  notes: string | null;
  client: {
    id: number;
    name: string;
    telefone: string | null;
    email: string | null;
    address: string | null;
  };
}

// ============================================================
// DATA FETCHING
// ============================================================

const fetchServiceReminders = async (): Promise<ServiceReminder[]> => {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      clients(id, name, telefone, email),
      products(id, name, warranty_months)
    `)
    .eq('status', 'concluido')
    .order('appointment_date', { ascending: false });

  if (error) throw error;

  const clientServiceMap: { [key: string]: any } = {};
  
  (appointments || []).forEach((apt: any) => {
    if (!apt.clients || !apt.products) return;
    const key = `${apt.clients.id}-${apt.products.id}`;
    if (!clientServiceMap[key] || new Date(apt.appointment_date) > new Date(clientServiceMap[key].appointment_date)) {
      clientServiceMap[key] = apt;
    }
  });

  const today = new Date();
  const reminders: ServiceReminder[] = [];

  Object.values(clientServiceMap).forEach((apt: any) => {
    const warrantyMonths = apt.products.warranty_months || 6;
    const lastDate = new Date(apt.appointment_date);
    const monthsSince = differenceInMonths(today, lastDate);
    const nextDueDate = addMonths(lastDate, warrantyMonths);
    const daysOverdue = differenceInDays(today, nextDueDate);

    let status: 'due' | 'overdue' | 'upcoming' = 'upcoming';
    if (daysOverdue > 0) {
      status = 'overdue';
    } else if (daysOverdue >= -30) {
      status = 'due';
    }

    if (monthsSince >= warrantyMonths - 2) {
      reminders.push({
        clientId: apt.clients.id,
        clientName: apt.clients.name,
        clientPhone: apt.clients.telefone,
        clientEmail: apt.clients.email,
        serviceName: apt.products.name,
        lastServiceDate: apt.appointment_date,
        warrantyMonths,
        monthsSince,
        daysOverdue,
        status
      });
    }
  });

  return reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);
};

const fetchServicesHistory = async (): Promise<ServiceHistory[]> => {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      status,
      notes,
      clients(id, name, address, telefone),
      products(id, name, price)
    `)
    .eq('status', 'concluido')
    .order('appointment_date', { ascending: false });

  if (error) throw error;

  const { data: maintenances } = await supabase
    .from('scheduled_maintenance')
    .select('*')
    .eq('is_completed', false);

  const maintenanceMap = new Map(
    maintenances?.map(m => [`${m.client_id}`, m]) || []
  );

  const today = new Date();
  const result: ServiceHistory[] = [];

  (appointments || []).forEach((apt: any) => {
    if (!apt.clients || !apt.products) return;

    const maintenance = maintenanceMap.get(`${apt.clients.id}`);
    let nextDate = null;
    let daysUntil = null;

    if (maintenance) {
      nextDate = maintenance.scheduled_date;
      daysUntil = differenceInDays(new Date(maintenance.scheduled_date), today);
    }

    result.push({
      id: apt.id,
      clientId: apt.clients.id,
      clientName: apt.clients.name,
      clientAddress: apt.clients.address,
      clientPhone: apt.clients.telefone,
      serviceName: apt.products.name,
      serviceDate: apt.appointment_date,
      servicePrice: apt.products.price,
      status: apt.status,
      notes: apt.notes,
      nextMaintenanceDate: nextDate,
      daysUntilMaintenance: daysUntil
    });
  });

  return result;
};

const fetchContracts = async (): Promise<Contract[]> => {
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(`
      *,
      client:clients(id, name, telefone, email, address)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Contract[];
};

// ============================================================
// MAIN COMPONENT
// ============================================================

// Scheduled Maintenances Sub-component
const ScheduledMaintenancesSection: React.FC = () => {
  const queryClient = useQueryClient();
  
  const { data: scheduled, isLoading } = useQuery({
    queryKey: ['scheduled-maintenances-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_maintenance')
        .select('*, clients(name, telefone, address)')
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('scheduled_maintenance').update({
        is_completed: completed,
        completed_date: completed ? new Date().toISOString().split('T')[0] : null
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-maintenances-list'] });
      queryClient.invalidateQueries({ queryKey: ['service-reminders'] });
      toast.success('Manutenção atualizada!');
    }
  });

  const deleteMaintenance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_maintenance').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-maintenances-list'] });
      toast.success('Manutenção removida');
    }
  });

  const pending = scheduled?.filter(s => !s.is_completed) || [];
  const completed = scheduled?.filter(s => s.is_completed) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Manutenções Programadas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {pending.length} pendente(s) · {completed.length} concluída(s)
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : pending.length === 0 && completed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma manutenção programada</p>
            <p className="text-xs">Agende pelo Histórico ou Lembretes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Pendentes
                </h4>
                <div className="space-y-2">
                  {pending.map((m: any) => {
                    const daysUntil = differenceInDays(new Date(m.scheduled_date), new Date());
                    const isOverdue = daysUntil < 0;
                    return (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : daysUntil <= 7 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : 'border-border'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{m.clients?.name || 'Cliente'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(m.scheduled_date), "dd/MM/yyyy")} · {m.maintenance_type}
                            {m.interval_months && ` · A cada ${m.interval_months} meses`}
                          </p>
                          {m.clients?.address && (
                            <p className="text-xs text-muted-foreground truncate">{m.clients.address}</p>
                          )}
                          {m.notes && <p className="text-xs italic text-muted-foreground mt-1">"{m.notes}"</p>}
                        </div>
                        <Badge variant={isOverdue ? 'destructive' : daysUntil <= 7 ? 'secondary' : 'outline'} className="text-xs shrink-0">
                          {isOverdue ? `${Math.abs(daysUntil)}d atrasado` : daysUntil === 0 ? 'Hoje' : `${daysUntil}d`}
                        </Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                            onClick={() => toggleComplete.mutate({ id: m.id, completed: true })}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          {m.clients?.telefone && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => window.open(`https://wa.me/55${m.clients.telefone.replace(/\D/g, '')}`, '_blank')}>
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                            onClick={() => deleteMaintenance.mutate(m.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Concluídas
                </h4>
                <div className="space-y-2">
                  {completed.slice(0, 10).map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border opacity-60">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-through">{m.clients?.name || 'Cliente'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(m.scheduled_date), "dd/MM/yyyy")} · Concluído em {m.completed_date ? format(new Date(m.completed_date), "dd/MM/yyyy") : '-'}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => toggleComplete.mutate({ id: m.id, completed: false })}>
                        ↩️ Reabrir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ServicesUnifiedTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('reminders');

  // ============ REMINDERS STATE ============
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkType, setBulkType] = useState<'vacation' | 'holiday' | 'custom'>('vacation');
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [sendMethod, setSendMethod] = useState<'whatsapp' | 'email'>('whatsapp');

  // ============ HISTORY STATE ============
  const [historySearch, setHistorySearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceHistory | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('6');

  // ============ CONTRACTS STATE ============
  const [contractSearch, setContractSearch] = useState('');
  const [contractFilterStatus, setContractFilterStatus] = useState<string>('all');
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [viewContractDialogOpen, setViewContractDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [contractFormData, setContractFormData] = useState({
    clientId: '',
    title: '',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    intervalMonths: '6',
    monthlyValue: '',
    notes: '',
    serviceType: 'preventiva',
    equipmentCount: '1',
    responsibleName: '',
    responsibleCpf: '',
  });

  // ============ QUERIES ============
  const { data: reminders, isLoading: loadingReminders } = useQuery({
    queryKey: ['service-reminders'],
    queryFn: fetchServiceReminders
  });

  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['services-history'],
    queryFn: fetchServicesHistory
  });

  const { data: contracts, isLoading: loadingContracts } = useQuery({
    queryKey: ['maintenance-contracts'],
    queryFn: fetchContracts
  });

  const { data: clients } = useQuery({
    queryKey: ['all-clients-unified'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, telefone, email, address')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: companyData } = useQuery({
    queryKey: ['company-data-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_data')
        .select('*')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  // ============ MUTATIONS ============
  const scheduleMutation = useMutation({
    mutationFn: async ({ clientId, date, notes, interval }: { clientId: number; date: string; notes: string; interval: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: existing } = await supabase
        .from('scheduled_maintenance')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_completed', false)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('scheduled_maintenance')
          .update({ scheduled_date: date, notes, interval_months: interval })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scheduled_maintenance')
          .insert({
            user_id: user.id,
            client_id: clientId,
            scheduled_date: date,
            notes,
            interval_months: interval,
            maintenance_type: 'limpeza'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-history'] });
      queryClient.invalidateQueries({ queryKey: ['service-reminders'] });
      toast.success('Próxima manutenção agendada!');
      setScheduleDialogOpen(false);
      setSelectedService(null);
      setMaintenanceDate('');
      setMaintenanceNotes('');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: typeof contractFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('maintenance_contracts')
        .insert({
          user_id: user.id,
          client_id: parseInt(data.clientId),
          title: data.title,
          description: data.description || null,
          start_date: data.startDate,
          end_date: data.endDate || null,
          cleaning_interval_months: parseInt(data.intervalMonths),
          monthly_value: parseFloat(data.monthlyValue) || 0,
          notes: data.notes || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato criado com sucesso!');
      setContractDialogOpen(false);
      resetContractForm();
    },
    onError: (error: any) => toast.error(error.message)
  });

  const [terminationDialogOpen, setTerminationDialogOpen] = useState(false);
  const [terminationContract, setTerminationContract] = useState<Contract | null>(null);
  const [terminationType, setTerminationType] = useState<'quebra' | 'finalizacao'>('finalizacao');
  const [terminationReason, setTerminationReason] = useState('');

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato excluído!');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const generateTerminationPDF = (contract: Contract, type: 'quebra' | 'finalizacao', reason: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    doc.setDrawColor(type === 'quebra' ? 200 : 0, type === 'quebra' ? 50 : 120, type === 'quebra' ? 50 : 200);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(type === 'quebra' ? 180 : 0, type === 'quebra' ? 0 : 80, type === 'quebra' ? 0 : 160);
    const title = type === 'quebra' ? 'TERMO DE RESCISÃO CONTRATUAL' : 'TERMO DE FINALIZAÇÃO DE CONTRATO';
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Referente ao Contrato Nº ${String(contract.contract_number).padStart(4, '0')}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Partes
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATADA:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    if (companyData) {
      doc.text(`${companyData.company_name} - CNPJ/CPF: ${companyData.cnpj_cpf}`, margin + 5, y); y += 6;
      if (companyData.address) { doc.text(`Endereço: ${companyData.address}`, margin + 5, y); y += 6; }
    }
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATANTE:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`${contract.client.name}`, margin + 5, y); y += 6;
    if (contract.client.address) { doc.text(`Endereço: ${contract.client.address}`, margin + 5, y); y += 6; }
    if (contract.client.telefone) { doc.text(`Telefone: ${contract.client.telefone}`, margin + 5, y); y += 6; }
    y += 8;

    // Dados do contrato
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CONTRATO:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Título: ${contract.title}`, margin + 5, y); y += 6;
    doc.text(`Vigência: ${format(new Date(contract.start_date), 'dd/MM/yyyy')} a ${contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : 'Indeterminado'}`, margin + 5, y); y += 6;
    doc.text(`Valor Mensal: R$ ${contract.monthly_value.toFixed(2)}`, margin + 5, y); y += 6;
    doc.text(`Intervalo de Limpezas: A cada ${contract.cleaning_interval_months} meses`, margin + 5, y); y += 10;

    // Motivo
    doc.setFont('helvetica', 'bold');
    const motivoTitulo = type === 'quebra' ? 'MOTIVO DA RESCISÃO:' : 'MOTIVO DA FINALIZAÇÃO:';
    doc.text(motivoTitulo, margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const reasonText = reason || (type === 'quebra' 
      ? 'Rescisão contratual por iniciativa das partes, conforme condições estabelecidas no contrato original.' 
      : 'Contrato encerrado por cumprimento integral do prazo de vigência estabelecido.');
    const reasonLines = doc.splitTextToSize(reasonText, pageWidth - 2 * margin - 10);
    doc.text(reasonLines, margin + 5, y); y += reasonLines.length * 5 + 8;

    // Data
    doc.text(`Data de ${type === 'quebra' ? 'Rescisão' : 'Finalização'}: ${format(new Date(), 'dd/MM/yyyy')}`, margin + 5, y); y += 12;

    // Cláusula
    doc.setFont('helvetica', 'bold');
    doc.text('DISPOSIÇÕES FINAIS:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const clausula = type === 'quebra'
      ? 'As partes declaram que não possuem mais obrigações pendentes referentes ao contrato rescindido, ressalvadas eventuais obrigações financeiras já vencidas e não quitadas até a presente data.'
      : 'As partes declaram que o contrato foi integralmente cumprido, não restando obrigações pendentes entre as partes.';
    const clausulaLines = doc.splitTextToSize(clausula, pageWidth - 2 * margin - 10);
    doc.text(clausulaLines, margin + 5, y); y += clausulaLines.length * 5 + 20;

    // Assinaturas
    if (y > 230) { doc.addPage(); y = 20; }
    y = Math.max(y, 220);
    
    const dataLocal = `${companyData?.address?.split(',')[0]?.split('-')[0]?.trim() || 'Local'}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    doc.setTextColor(100, 100, 100);
    doc.text(dataLocal, pageWidth / 2, y, { align: 'center' });
    y += 20;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(companyData?.company_name || 'CONTRATADA', margin + 35, y, { align: 'center' });
    doc.text(contract.client.name, pageWidth - margin - 35, y, { align: 'center' });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    const typeLabel = type === 'quebra' ? 'Rescisao' : 'Finalizacao';
    doc.save(`${typeLabel}_Contrato_${String(contract.contract_number).padStart(4, '0')}_${contract.client.name.replace(/\s/g, '_')}.pdf`);
    toast.success(`Documento de ${type === 'quebra' ? 'rescisão' : 'finalização'} gerado!`);
  };

  const handleTerminateContract = () => {
    if (!terminationContract) return;
    generateTerminationPDF(terminationContract, terminationType, terminationReason);
    // Update contract status
    supabase.from('maintenance_contracts')
      .update({ status: 'cancelado' })
      .eq('id', terminationContract.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      });
    setTerminationDialogOpen(false);
    setTerminationContract(null);
    setTerminationReason('');
  };

  const renewContractMutation = useMutation({
    mutationFn: async (contract: Contract) => {
      const newEndDate = addYears(new Date(contract.end_date || new Date()), 1);
      const { error } = await supabase
        .from('maintenance_contracts')
        .update({ end_date: format(newEndDate, 'yyyy-MM-dd'), status: 'ativo' })
        .eq('id', contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato renovado por mais 1 ano!');
    },
    onError: (error: any) => toast.error(error.message)
  });

  // ============ HELPERS ============
  const resetContractForm = () => {
    setContractFormData({
      clientId: '',
      title: '',
      description: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      intervalMonths: '6',
      monthlyValue: '',
      notes: '',
      serviceType: 'preventiva',
      equipmentCount: '1',
      responsibleName: '',
      responsibleCpf: '',
    });
    setSelectedContract(null);
  };

  const clientsWithContact = useMemo(() => {
    if (sendMethod === 'whatsapp') {
      return clients?.filter(c => c.telefone) || [];
    }
    return clients?.filter(c => c.email) || [];
  }, [clients, sendMethod]);

  const filteredClientsForBulk = useMemo(() => {
    if (!clientSearch) return clientsWithContact;
    return clientsWithContact.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clientsWithContact, clientSearch]);

  const getSelectedClients = () => {
    if (selectAll) return clientsWithContact;
    return clientsWithContact.filter(c => selectedClientIds.includes(c.id));
  };

  // ============ FILTERED DATA ============
  const filteredServices = services?.filter(s => {
    const matchesSearch = s.clientName.toLowerCase().includes(historySearch.toLowerCase()) ||
      s.serviceName.toLowerCase().includes(historySearch.toLowerCase());
    const matchesClient = selectedClientId === 'all' || s.clientId.toString() === selectedClientId;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'overdue' && s.daysUntilMaintenance !== null && s.daysUntilMaintenance < 0) ||
      (filterStatus === 'upcoming' && s.daysUntilMaintenance !== null && s.daysUntilMaintenance >= 0 && s.daysUntilMaintenance <= 30) ||
      (filterStatus === 'scheduled' && s.daysUntilMaintenance !== null) ||
      (filterStatus === 'not-scheduled' && s.daysUntilMaintenance === null);
    return matchesSearch && matchesClient && matchesStatus;
  }) || [];

  const filteredContracts = contracts?.filter(c => {
    const matchesSearch = c.client.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(contractSearch.toLowerCase());
    
    if (contractFilterStatus === 'all') return matchesSearch;
    
    const today = new Date();
    const endDate = c.end_date ? new Date(c.end_date) : null;
    const daysUntilEnd = endDate ? differenceInDays(endDate, today) : null;
    
    if (contractFilterStatus === 'active') return matchesSearch && c.status === 'ativo' && (daysUntilEnd === null || daysUntilEnd > 0);
    if (contractFilterStatus === 'expiring') return matchesSearch && daysUntilEnd !== null && daysUntilEnd <= 30 && daysUntilEnd > 0;
    if (contractFilterStatus === 'expired') return matchesSearch && daysUntilEnd !== null && daysUntilEnd < 0;
    if (contractFilterStatus === 'canceled') return matchesSearch && c.status === 'cancelado';
    
    return matchesSearch;
  }) || [];

  // ============ STATS ============
  const overdueCount = reminders?.filter(r => r.status === 'overdue').length || 0;
  const dueCount = reminders?.filter(r => r.status === 'due').length || 0;
  const totalServices = services?.length || 0;
  const totalRevenue = services?.reduce((sum, s) => sum + Number(s.servicePrice), 0) || 0;
  const activeContracts = contracts?.filter(c => c.status === 'ativo').length || 0;
  const totalMonthlyValue = contracts?.reduce((sum, c) => sum + Number(c.monthly_value), 0) || 0;

  // ============ ACTIONS ============
  // ============ BRAZILIAN HOLIDAYS ============
  const getBrazilianHolidays = (year: number) => {
    // Calculate Easter (Computus algorithm)
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
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };
    
    return [
      { date: new Date(year, 0, 1), name: 'Ano Novo', emoji: '🎆' },
      { date: addDays(easter, -47), name: 'Carnaval', emoji: '🎭' },
      { date: addDays(easter, -46), name: 'Carnaval', emoji: '🎭' },
      { date: addDays(easter, -2), name: 'Sexta-feira Santa', emoji: '✝️' },
      { date: easter, name: 'Páscoa', emoji: '🐰' },
      { date: new Date(year, 3, 21), name: 'Tiradentes', emoji: '🏛️' },
      { date: new Date(year, 4, 1), name: 'Dia do Trabalho', emoji: '👷' },
      { date: addDays(easter, 60), name: 'Corpus Christi', emoji: '⛪' },
      { date: new Date(year, 8, 7), name: 'Independência do Brasil', emoji: '🇧🇷' },
      { date: new Date(year, 9, 12), name: 'Nossa Senhora Aparecida', emoji: '🙏' },
      { date: new Date(year, 10, 2), name: 'Finados', emoji: '🕯️' },
      { date: new Date(year, 10, 15), name: 'Proclamação da República', emoji: '🇧🇷' },
      { date: new Date(year, 11, 25), name: 'Natal', emoji: '🎄' },
    ];
  };

  const getNextHoliday = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const holidays = [...getBrazilianHolidays(currentYear), ...getBrazilianHolidays(currentYear + 1)];
    
    for (const holiday of holidays) {
      if (holiday.date >= today) {
        return holiday;
      }
    }
    return holidays[0];
  };

  const nextHoliday = getNextHoliday();

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    // Add country code if not present
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  };

  // ============ WHATSAPP & EMAIL FUNCTIONS ============
  const sendReminderWhatsApp = (reminder: ServiceReminder) => {
    if (!reminder.clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const phone = formatPhoneForWhatsApp(reminder.clientPhone);
    const message = encodeURIComponent(
      `Olá ${reminder.clientName}!\n\n` +
      `🔧 Passaram-se ${reminder.monthsSince} meses desde sua última manutenção de ${reminder.serviceName}.\n\n` +
      `✅ Recomendamos agendar uma nova manutenção para manter seu equipamento funcionando perfeitamente!\n\n` +
      `📞 Entre em contato para agendar.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    toast.success(`Mensagem enviada para ${reminder.clientName}`);
  };

  const sendMaintenanceReminder = (service: ServiceHistory) => {
    if (!service.clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const phone = formatPhoneForWhatsApp(service.clientPhone);
    const message = encodeURIComponent(
      `Olá ${service.clientName}! 🌬️\n\n` +
      `Está na hora de fazer a manutenção do seu ar condicionado!\n\n` +
      `📅 Último serviço: ${format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: ptBR })}\n` +
      `🔧 Serviço: ${service.serviceName}\n\n` +
      `Entre em contato para agendar sua limpeza! ❄️`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    toast.success('Mensagem enviada!');
  };

  const generateBulkMessage = (clientName: string) => {
    let message = bulkMessage;
    const today = new Date();
    
    if (!message || message.trim() === '') {
      if (bulkType === 'vacation') {
        const returnDate = format(addDays(today, 7), "dd 'de' MMMM", { locale: ptBR });
        message = `Olá ${clientName}! 🏖️\n\n` +
          `Informamos que estaremos em período de *férias* a partir de hoje, ${format(today, "dd 'de' MMMM", { locale: ptBR })}.\n\n` +
          `📅 Retornamos em: ${returnDate}\n\n` +
          `Agradecemos a compreensão e até breve! 😊\n\n` +
          `${companyData?.company_name || 'AC Service Pro'}`;
      } else if (bulkType === 'holiday') {
        const holiday = nextHoliday;
        const holidayDate = format(holiday.date, "dd 'de' MMMM", { locale: ptBR });
        message = `Olá ${clientName}! ${holiday.emoji}\n\n` +
          `Informamos que *não haverá expediente* no dia ${holidayDate} em comemoração ao *${holiday.name}*.\n\n` +
          `📅 Retornaremos normalmente no próximo dia útil.\n\n` +
          `Desejamos um ótimo feriado! 🎉\n\n` +
          `${companyData?.company_name || 'AC Service Pro'}`;
      }
    } else {
      message = message.replace(/{nome}/gi, clientName);
    }
    
    return message;
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const sendBulkMessage = () => {
    const targetClients = getSelectedClients();
    
    if (targetClients.length === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    if (sendMethod === 'whatsapp') {
      let successCount = 0;
      targetClients.forEach((client, index) => {
        setTimeout(() => {
          const phone = formatPhoneForWhatsApp(client.telefone!);
          const personalizedMessage = encodeURIComponent(generateBulkMessage(client.name));
          window.open(`https://wa.me/${phone}?text=${personalizedMessage}`, '_blank');
          successCount++;
          if (successCount === targetClients.length) {
            toast.success(`${successCount} mensagens preparadas!`);
          }
        }, index * 500);
      });
    } else {
      // Open Gmail with all emails
      const emails = targetClients.map(c => c.email).join(',');
      const subject = encodeURIComponent(
        bulkType === 'vacation' ? 'Aviso de Férias - ' + (companyData?.company_name || 'AC Service Pro') : 
        bulkType === 'holiday' ? `Aviso de Feriado: ${nextHoliday.name} - ${companyData?.company_name || 'AC Service Pro'}` : 
        'Comunicado - ' + (companyData?.company_name || 'AC Service Pro')
      );
      const body = encodeURIComponent(generateBulkMessage('Cliente'));
      
      // Open Gmail compose
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emails}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      toast.success(`Gmail aberto para ${targetClients.length} cliente(s)!`);
    }
  };

  const generateContractPDF = (contract: Contract) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // === HEADER ===
    doc.setDrawColor(0, 120, 200);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 80, 160);
    doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text('MANUTENÇÃO PREVENTIVA E CORRETIVA DE AR CONDICIONADO', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.text(`Contrato Nº ${String(contract.contract_number).padStart(4, '0')}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(0, 120, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // === CONTRATADA ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('1. CONTRATADA (Prestadora de Serviços)', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (companyData) {
      doc.text(`Razão Social: ${companyData.company_name}`, margin + 5, y); y += 6;
      doc.text(`CNPJ/CPF: ${companyData.cnpj_cpf}`, margin + 5, y); y += 6;
      if (companyData.address) { doc.text(`Endereço: ${companyData.address}`, margin + 5, y); y += 6; }
      if (companyData.email) { doc.text(`Email: ${companyData.email}`, margin + 5, y); y += 6; }
      if (companyData.whatsapp) { doc.text(`Telefone/WhatsApp: ${companyData.whatsapp}`, margin + 5, y); y += 6; }
    } else {
      doc.text('(Dados da empresa não cadastrados)', margin + 5, y); y += 6;
    }
    y += 6;

    // === CONTRATANTE ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. CONTRATANTE', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome/Razão Social: ${contract.client.name}`, margin + 5, y); y += 6;
    if (contract.client.address) { doc.text(`Endereço: ${contract.client.address}`, margin + 5, y); y += 6; }
    if (contract.client.telefone) { doc.text(`Telefone: ${contract.client.telefone}`, margin + 5, y); y += 6; }
    if (contract.client.email) { doc.text(`Email: ${contract.client.email}`, margin + 5, y); y += 6; }
    y += 6;

    // === OBJETO DO CONTRATO ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. OBJETO DO CONTRATO', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const objetoText = `O presente contrato tem por objeto a prestação de serviços de manutenção preventiva e/ou corretiva em sistemas de ar condicionado, conforme descrito abaixo:`;
    const objetoLines = doc.splitTextToSize(objetoText, pageWidth - 2 * margin - 10);
    doc.text(objetoLines, margin + 5, y); y += objetoLines.length * 5 + 4;
    
    doc.text(`• Título: ${contract.title}`, margin + 5, y); y += 6;
    if (contract.description) {
      const descLines = doc.splitTextToSize(`• Descrição: ${contract.description}`, pageWidth - 2 * margin - 10);
      doc.text(descLines, margin + 5, y); y += descLines.length * 5 + 2;
    }
    doc.text(`• Intervalo de manutenções: A cada ${contract.cleaning_interval_months} meses`, margin + 5, y); y += 6;
    y += 4;

    // === VIGÊNCIA ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('4. VIGÊNCIA', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Início: ${format(new Date(contract.start_date), 'dd/MM/yyyy')}`, margin + 5, y); y += 6;
    doc.text(`Data de Término: ${contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : 'Indeterminado'}`, margin + 5, y); y += 6;
    y += 4;

    // === VALORES ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('5. VALORES E CONDIÇÕES DE PAGAMENTO', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (contract.monthly_value > 0) {
      doc.text(`Valor Mensal: R$ ${contract.monthly_value.toFixed(2)}`, margin + 5, y); y += 6;
      const totalAnual = contract.monthly_value * 12;
      doc.text(`Valor Anual Estimado: R$ ${totalAnual.toFixed(2)}`, margin + 5, y); y += 6;
    } else {
      doc.text('Valor: A combinar conforme serviço executado.', margin + 5, y); y += 6;
    }
    y += 4;

    // === OBRIGAÇÕES ===
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('6. OBRIGAÇÕES DA CONTRATADA', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obrigacoes = [
      'Executar os serviços de manutenção preventiva nos prazos estabelecidos.',
      'Utilizar materiais e equipamentos adequados para a execução dos serviços.',
      'Fornecer relatório de cada manutenção realizada.',
      'Garantir a qualidade dos serviços pelo período de 90 (noventa) dias.',
    ];
    obrigacoes.forEach(o => {
      doc.text(`• ${o}`, margin + 5, y); y += 6;
    });
    y += 4;

    // === NOTAS ===
    if (contract.notes) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('7. OBSERVAÇÕES', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(contract.notes, pageWidth - 2 * margin - 10);
      doc.text(notesLines, margin + 5, y); y += notesLines.length * 5 + 4;
    }

    // === ASSINATURAS ===
    if (y > 230) { doc.addPage(); y = 20; }
    y = Math.max(y + 15, 240);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dataLocal = `${companyData?.address?.split(',')[0]?.split('-')[0]?.trim() || 'Local'}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    doc.text(dataLocal, pageWidth / 2, y, { align: 'center' });
    y += 20;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    
    // Left signature
    doc.line(margin, y, margin + 70, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(companyData?.company_name || 'CONTRATADA', margin + 35, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(companyData?.cnpj_cpf || '', margin + 35, y, { align: 'center' });
    
    // Right signature
    const rightX = pageWidth - margin - 70;
    doc.setLineWidth(0.5);
    doc.line(rightX, y - 10, pageWidth - margin, y - 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(contract.client.name, rightX + 35, y - 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('CONTRATANTE', rightX + 35, y, { align: 'center' });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | ${companyData?.company_name || 'AC Service Pro'}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`Contrato_${String(contract.contract_number).padStart(4, '0')}_${contract.client.name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF profissional gerado com sucesso!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Vencido</Badge>;
      case 'due':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Vence em breve</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Próximo</Badge>;
    }
  };

  const getContractStatusBadge = (contract: Contract) => {
    const today = new Date();
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    
    if (contract.status === 'cancelado') return <Badge variant="destructive">Cancelado</Badge>;
    if (endDate) {
      const daysUntilEnd = differenceInDays(endDate, today);
      if (daysUntilEnd < 0) return <Badge className="bg-red-100 text-red-700">Vencido</Badge>;
      if (daysUntilEnd <= 30) return <Badge className="bg-amber-100 text-amber-700">Vence em {daysUntilEnd}d</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
  };

  const getMaintenanceStatus = (daysUntil: number | null) => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) {
      return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Vencido ({Math.abs(daysUntil)}d)</Badge>;
    }
    if (daysUntil <= 30) {
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Em {daysUntil}d</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Em {daysUntil}d</Badge>;
  };

  const openScheduleDialog = (service: ServiceHistory) => {
    setSelectedService(service);
    const defaultDate = format(addMonths(new Date(service.serviceDate), 6), 'yyyy-MM-dd');
    setMaintenanceDate(defaultDate);
    setScheduleDialogOpen(true);
  };

  // ============ RENDER ============
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alert for overdue */}
      {overdueCount > 0 && (
        <Alert className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-700 dark:text-red-400">Atenção!</AlertTitle>
          <AlertDescription className="text-red-600/80">
            {overdueCount} manutenção(ões) vencida(s). Clientes aguardando limpeza.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-[10px] text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{dueCount}</p>
                <p className="text-[10px] text-muted-foreground">Próximas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900">
                <History className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{totalServices}</p>
                <p className="text-[10px] text-muted-foreground">Serviços</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">R${totalRevenue.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Receita</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-600">{activeContracts}</p>
                <p className="text-[10px] text-muted-foreground">Contratos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-200 dark:border-cyan-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900">
                <Users className="w-4 h-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-cyan-600">{clients?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground">Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="reminders" className="flex items-center gap-1 text-xs sm:text-sm px-2">
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Lembretes</span>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-1 text-xs sm:text-sm px-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Programadas</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm px-2">
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-1 text-xs sm:text-sm px-2">
            <ScrollText className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Contratos</span>
          </TabsTrigger>
        </TabsList>

        {/* REMINDERS TAB */}
        <TabsContent value="reminders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-primary" />
                Limpezas de Ar Condicionado Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReminders ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : reminders?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                  <Snowflake className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma limpeza pendente</p>
                  <p className="text-sm mt-1">Configure o prazo em meses nos serviços de AC</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Última</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reminders?.map((reminder, i) => (
                        <TableRow key={i} className={reminder.status === 'overdue' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <TableCell className="font-medium">{reminder.clientName}</TableCell>
                          <TableCell>{reminder.serviceName}</TableCell>
                          <TableCell>{format(new Date(reminder.lastServiceDate), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                          <TableCell>{reminder.warrantyMonths}m</TableCell>
                          <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => sendReminderWhatsApp(reminder)} disabled={!reminder.clientPhone} className="bg-green-600 hover:bg-green-700">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCHEDULED MAINTENANCES TAB */}
        <TabsContent value="scheduled" className="mt-6">
          <ScheduledMaintenancesSection />
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="w-5 h-5 text-primary" />
                    Histórico de Atendimentos
                  </CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="w-full sm:w-48">
                    <Label className="text-xs text-muted-foreground mb-1 block">Cliente</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent avoidCollisions={false}>
                        <SelectItem value="all">Todos</SelectItem>
                        {clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-48">
                    <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent avoidCollisions={false}>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="overdue">🔴 Vencidas</SelectItem>
                        <SelectItem value="upcoming">🟡 Próximas</SelectItem>
                        <SelectItem value="scheduled">🟢 Agendadas</SelectItem>
                        <SelectItem value="not-scheduled">⚪ Sem agendamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingServices ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum atendimento encontrado</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Próx. Manut.</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map(service => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.clientName}</TableCell>
                          <TableCell>{service.serviceName}</TableCell>
                          <TableCell>{format(new Date(service.serviceDate), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                          <TableCell>R$ {Number(service.servicePrice).toFixed(2)}</TableCell>
                          <TableCell>
                            {service.nextMaintenanceDate ? (
                              <div className="space-y-1">
                                <span className="text-sm">{format(new Date(service.nextMaintenanceDate), 'dd/MM/yy')}</span>
                                {getMaintenanceStatus(service.daysUntilMaintenance)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Não agendada</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openScheduleDialog(service)}><Calendar className="w-4 h-4" /></Button>
                              <Button size="sm" onClick={() => sendMaintenanceReminder(service)} disabled={!service.clientPhone} className="bg-green-600 hover:bg-green-700"><MessageSquare className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Contratos de Manutenção
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={contractSearch} onChange={(e) => setContractSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Button onClick={() => setContractDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="w-full sm:w-48">
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select value={contractFilterStatus} onValueChange={setContractFilterStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent avoidCollisions={false}>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">🟢 Ativos</SelectItem>
                      <SelectItem value="expiring">🟡 Vencendo</SelectItem>
                      <SelectItem value="expired">🔴 Vencidos</SelectItem>
                      <SelectItem value="canceled">⚫ Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingContracts ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredContracts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum contrato encontrado</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Vigência</TableHead>
                        <TableHead>Intervalo</TableHead>
                        <TableHead>Valor/mês</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map(contract => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono">#{contract.contract_number}</TableCell>
                          <TableCell className="font-medium">{contract.client.name}</TableCell>
                          <TableCell>{contract.title}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(contract.start_date), 'dd/MM/yy')} - {contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yy') : '∞'}
                          </TableCell>
                          <TableCell>{contract.cleaning_interval_months}m</TableCell>
                          <TableCell>R$ {contract.monthly_value.toFixed(2)}</TableCell>
                          <TableCell>{getContractStatusBadge(contract)}</TableCell>
                          <TableCell>
                          <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => generateContractPDF(contract)} title="Baixar contrato"><Download className="w-4 h-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => renewContractMutation.mutate(contract)} title="Renovar"><RefreshCw className="w-4 h-4" /></Button>
                              <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" 
                                onClick={() => { setTerminationContract(contract); setTerminationDialogOpen(true); }}
                                title="Encerrar/Rescindir">
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (window.confirm('Excluir contrato permanentemente?')) deleteContractMutation.mutate(contract.id);
                              }} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Próxima Manutenção</DialogTitle>
            <DialogDescription>
              {selectedService && `Cliente: ${selectedService.clientName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data da Próxima Manutenção</Label>
              <Input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} />
            </div>
            <div>
              <Label>Intervalo (meses)</Label>
              <Select value={intervalMonths} onValueChange={setIntervalMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent avoidCollisions={false}>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} placeholder="Anotações sobre a manutenção..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => selectedService && scheduleMutation.mutate({ clientId: selectedService.clientId, date: maintenanceDate, notes: maintenanceNotes, interval: parseInt(intervalMonths) })} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? 'Salvando...' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Contract Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Contrato de Manutenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>Cliente *</Label>
              <Select value={contractFormData.clientId} onValueChange={(v) => setContractFormData(p => ({ ...p, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent avoidCollisions={false}>
                  {clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={contractFormData.title} onChange={(e) => setContractFormData(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Contrato de Manutenção Residencial" />
            </div>
            <div>
              <Label>Tipo de Serviço</Label>
              <Select value={contractFormData.serviceType} onValueChange={(v) => setContractFormData(p => ({ ...p, serviceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent avoidCollisions={false}>
                  <SelectItem value="preventiva">Manutenção Preventiva</SelectItem>
                  <SelectItem value="corretiva">Manutenção Corretiva</SelectItem>
                  <SelectItem value="ambas">Preventiva + Corretiva</SelectItem>
                  <SelectItem value="instalacao">Instalação + Manutenção</SelectItem>
                  <SelectItem value="limpeza">Limpeza Periódica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={contractFormData.startDate} onChange={(e) => setContractFormData(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={contractFormData.endDate} onChange={(e) => setContractFormData(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Intervalo Limpezas</Label>
                <Select value={contractFormData.intervalMonths} onValueChange={(v) => setContractFormData(p => ({ ...p, intervalMonths: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent avoidCollisions={false}>
                    <SelectItem value="1">1 mês</SelectItem>
                    <SelectItem value="2">2 meses</SelectItem>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" value={contractFormData.monthlyValue} onChange={(e) => setContractFormData(p => ({ ...p, monthlyValue: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label>Qtd. Equipamentos</Label>
                <Input type="number" value={contractFormData.equipmentCount} onChange={(e) => setContractFormData(p => ({ ...p, equipmentCount: e.target.value }))} placeholder="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável (nome)</Label>
                <Input value={contractFormData.responsibleName} onChange={(e) => setContractFormData(p => ({ ...p, responsibleName: e.target.value }))} placeholder="Nome do responsável" />
              </div>
              <div>
                <Label>CPF do Responsável</Label>
                <Input value={contractFormData.responsibleCpf} onChange={(e) => setContractFormData(p => ({ ...p, responsibleCpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
            </div>
            <div>
              <Label>Descrição do Serviço</Label>
              <Textarea value={contractFormData.description} onChange={(e) => setContractFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descreva os serviços inclusos no contrato, equipamentos, locais..." rows={3} />
            </div>
            <div>
              <Label>Observações / Cláusulas Adicionais</Label>
              <Textarea value={contractFormData.notes} onChange={(e) => setContractFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionais, condições especiais, multas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContractDialogOpen(false); resetContractForm(); }}>Cancelar</Button>
            <Button onClick={() => createContractMutation.mutate(contractFormData)} disabled={!contractFormData.clientId || !contractFormData.title || createContractMutation.isPending}>
              {createContractMutation.isPending ? 'Salvando...' : 'Criar Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Termination Dialog */}
      <Dialog open={terminationDialogOpen} onOpenChange={setTerminationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Encerrar Contrato
            </DialogTitle>
            <DialogDescription>
              {terminationContract && `Contrato #${terminationContract.contract_number} - ${terminationContract.client.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Encerramento</Label>
              <Select value={terminationType} onValueChange={(v: 'quebra' | 'finalizacao') => setTerminationType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent avoidCollisions={false}>
                  <SelectItem value="finalizacao">✅ Finalização (cumprimento do prazo)</SelectItem>
                  <SelectItem value="quebra">❌ Rescisão (quebra de contrato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo / Observações</Label>
              <Textarea value={terminationReason} onChange={e => setTerminationReason(e.target.value)}
                placeholder={terminationType === 'quebra' 
                  ? "Descreva o motivo da rescisão contratual..." 
                  : "Observações sobre a finalização do contrato..."} 
                rows={3} />
            </div>
            {terminationType === 'quebra' && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-400 text-sm">
                  ⚠️ A rescisão contratual gera um documento formal. O contrato será marcado como cancelado.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminationDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTerminateContract}
              className={terminationType === 'quebra' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}>
              <Download className="w-4 h-4 mr-2" />
              Gerar Documento e Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesUnifiedTab;
