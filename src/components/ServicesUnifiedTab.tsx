import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { format, differenceInDays, addYears, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import {
  Plus, Search, FileText, Trash2, Download, Phone, RefreshCw,
  DollarSign, Users, Calendar, AlertTriangle, CheckCircle, Clock,
  Paperclip, Upload, XCircle, Info, Eye, ChevronLeft, ChevronRight,
  ScrollText, Building2, Snowflake, TrendingUp, BarChart3, Edit
} from 'lucide-react';
import TabGuideCards from './TabGuideCards';
import { recordFinancialEntry } from '@/utils/financialHelpers';

// ============================================================
// TYPES
// ============================================================

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
  created_at: string;
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

const fetchContracts = async (): Promise<Contract[]> => {
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(`*, client:clients(id, name, telefone, email, address)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Contract[];
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const ServicesUnifiedTab: React.FC = () => {
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [contractSearch, setContractSearch] = useState('');
  const [contractFilterStatus, setContractFilterStatus] = useState<string>('all');
  
  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Dialog states
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [viewContractDialog, setViewContractDialog] = useState<Contract | null>(null);
  const [terminationDialogOpen, setTerminationDialogOpen] = useState(false);
  const [terminationContract, setTerminationContract] = useState<Contract | null>(null);
  const [terminationType, setTerminationType] = useState<'quebra' | 'finalizacao'>('finalizacao');
  const [terminationReason, setTerminationReason] = useState('');
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachContract, setAttachContract] = useState<Contract | null>(null);
  const [attachType, setAttachType] = useState<'signed' | 'cancellation'>('signed');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);

  // Form state
  const [contractFormData, setContractFormData] = useState({
    clientId: '', title: '', description: '', 
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    intervalMonths: '6', monthlyValue: '', notes: '',
    serviceType: 'preventiva', equipmentCount: '1',
    responsibleName: '', responsibleCpf: '', responsiblePhone: '', responsibleRg: '',
    equipmentBrand: '', equipmentModel: '', equipmentBtus: '', equipmentLocation: '',
    serviceAddress: '', paymentMethod: 'mensal', contractType: 'residencial',
  });

  // ============ QUERIES ============
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['maintenance-contracts'],
    queryFn: fetchContracts
  });

  const { data: clients } = useQuery({
    queryKey: ['all-clients-unified'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, telefone, email, address').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: companyData } = useQuery({
    queryKey: ['company-data-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_data').select('*').single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  // ============ MUTATIONS ============
  const createContractMutation = useMutation({
    mutationFn: async (data: typeof contractFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      // Build enriched notes with all extra fields
      const extraData = {
        responsibleName: data.responsibleName, responsibleCpf: data.responsibleCpf,
        responsiblePhone: data.responsiblePhone, responsibleRg: data.responsibleRg,
        equipmentBrand: data.equipmentBrand, equipmentModel: data.equipmentModel,
        equipmentBtus: data.equipmentBtus, equipmentLocation: data.equipmentLocation,
        serviceAddress: data.serviceAddress, paymentMethod: data.paymentMethod,
        contractType: data.contractType, equipmentCount: data.equipmentCount,
        serviceType: data.serviceType,
      };
      const enrichedNotes = JSON.stringify({ userNotes: data.notes || '', ...extraData });
      const { error } = await supabase.from('maintenance_contracts').insert({
        user_id: user.id, client_id: parseInt(data.clientId),
        title: data.title, description: data.description || null,
        start_date: data.startDate, end_date: data.endDate || null,
        cleaning_interval_months: parseInt(data.intervalMonths),
        monthly_value: parseFloat(data.monthlyValue) || 0,
        notes: enrichedNotes
      });

      if (!error && parseFloat(data.monthlyValue) > 0) {
        await recordFinancialEntry({
          userId: user.id,
          type: 'entrada',
          amount: parseFloat(data.monthlyValue),
          description: `Primeira parcela - Contrato: ${data.title}`,
          paymentMethod: (data.paymentMethod === 'mensal' ? 'Dinheiro' : data.paymentMethod) as any,
          category: 'Serviço', // Or 'Contrato' if you want a specific category
          recordDate: new Date().toISOString()
        });
      }
      
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

  const updateContractMutation = useMutation({
    mutationFn: async (data: typeof contractFormData) => {
      if (!editingContractId) throw new Error('ID do contrato ausente');
      const extraData = {
        responsibleName: data.responsibleName, responsibleCpf: data.responsibleCpf,
        responsiblePhone: data.responsiblePhone, responsibleRg: data.responsibleRg,
        equipmentBrand: data.equipmentBrand, equipmentModel: data.equipmentModel,
        equipmentBtus: data.equipmentBtus, equipmentLocation: data.equipmentLocation,
        serviceAddress: data.serviceAddress, paymentMethod: data.paymentMethod,
        contractType: data.contractType, equipmentCount: data.equipmentCount,
        serviceType: data.serviceType,
      };
      const enrichedNotes = JSON.stringify({ userNotes: data.notes || '', ...extraData });
      const { error } = await supabase.from('maintenance_contracts').update({
        client_id: parseInt(data.clientId),
        title: data.title, description: data.description || null,
        start_date: data.startDate, end_date: data.endDate || null,
        cleaning_interval_months: parseInt(data.intervalMonths),
        monthly_value: parseFloat(data.monthlyValue) || 0,
        notes: enrichedNotes
      }).eq('id', editingContractId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato atualizado com sucesso!');
      setContractDialogOpen(false);
      resetContractForm();
    },
    onError: (error: any) => toast.error(error.message)
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato excluído!');
    }
  });

  const renewContractMutation = useMutation({
    mutationFn: async (contract: Contract) => {
      const newEndDate = addYears(new Date(contract.end_date || new Date()), 1);
      const { error } = await supabase.from('maintenance_contracts')
        .update({ end_date: format(newEndDate, 'yyyy-MM-dd'), status: 'ativo' })
        .eq('id', contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato renovado por mais 1 ano!');
    }
  });

  // ============ HELPERS ============
  const resetContractForm = () => {
    setContractFormData({
      clientId: '', title: '', description: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      intervalMonths: '6', monthlyValue: '', notes: '',
      serviceType: 'preventiva', equipmentCount: '1',
      responsibleName: '', responsibleCpf: '', responsiblePhone: '', responsibleRg: '',
      equipmentBrand: '', equipmentModel: '', equipmentBtus: '', equipmentLocation: '',
      serviceAddress: '', paymentMethod: 'mensal', contractType: 'residencial',
    });
    setIsEditingContract(false);
    setEditingContractId(null);
  };

  const handleEditContract = (contract: Contract) => {
    let extraData: any = {};
    let parsedNotes = contract.notes || '';
    if (contract.notes && contract.notes.startsWith('{')) {
      try {
        const parsed = JSON.parse(contract.notes);
        parsedNotes = parsed.userNotes || '';
        extraData = parsed;
      } catch (e) { }
    }

    setContractFormData({
      clientId: String(contract.client.id),
      title: contract.title,
      description: contract.description || '',
      startDate: contract.start_date.split('T')[0],
      endDate: contract.end_date ? contract.end_date.split('T')[0] : '',
      intervalMonths: String(contract.cleaning_interval_months),
      monthlyValue: String(contract.monthly_value),
      notes: parsedNotes,
      serviceType: extraData.serviceType || 'preventiva',
      equipmentCount: extraData.equipmentCount || '1',
      responsibleName: extraData.responsibleName || '',
      responsibleCpf: extraData.responsibleCpf || '',
      responsiblePhone: extraData.responsiblePhone || '',
      responsibleRg: extraData.responsibleRg || '',
      equipmentBrand: extraData.equipmentBrand || '',
      equipmentModel: extraData.equipmentModel || '',
      equipmentBtus: extraData.equipmentBtus || '',
      equipmentLocation: extraData.equipmentLocation || '',
      serviceAddress: extraData.serviceAddress || '',
      paymentMethod: extraData.paymentMethod || 'mensal',
      contractType: extraData.contractType || 'residencial',
    });
    setEditingContractId(contract.id);
    setIsEditingContract(true);
    setContractDialogOpen(true);
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
    return cleaned;
  };

  // ============ FILTERED DATA ============
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const filteredContracts = useMemo(() => {
    return contracts?.filter(c => {
      const matchesSearch = c.client.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(contractSearch.toLowerCase()) ||
        String(c.contract_number).includes(contractSearch);

      const today = new Date();
      const endDate = c.end_date ? new Date(c.end_date) : null;
      const daysUntilEnd = endDate ? differenceInDays(endDate, today) : null;

      let matchesStatus = true;
      if (contractFilterStatus === 'active') matchesStatus = c.status === 'ativo' && (daysUntilEnd === null || daysUntilEnd > 0);
      else if (contractFilterStatus === 'expiring') matchesStatus = daysUntilEnd !== null && daysUntilEnd <= 30 && daysUntilEnd > 0;
      else if (contractFilterStatus === 'expired') matchesStatus = daysUntilEnd !== null && daysUntilEnd < 0 && c.status !== 'cancelado';
      else if (contractFilterStatus === 'canceled') matchesStatus = c.status === 'cancelado';

      // Month filter - show contracts active during selected month
      const contractStart = new Date(c.start_date);
      const contractEnd = c.end_date ? new Date(c.end_date) : new Date('2099-12-31');
      const activeInMonth = contractStart <= monthEnd && contractEnd >= monthStart;

      return matchesSearch && matchesStatus && activeInMonth;
    }) || [];
  }, [contracts, contractSearch, contractFilterStatus, selectedMonth, monthStart, monthEnd]);

  // ============ STATS ============
  const allContracts = contracts || [];
  const today = new Date();
  const activeContracts = allContracts.filter(c => {
    if (c.status === 'cancelado') return false;
    const endDate = c.end_date ? new Date(c.end_date) : null;
    return !endDate || differenceInDays(endDate, today) > 0;
  });
  const expiringContracts = allContracts.filter(c => {
    const endDate = c.end_date ? new Date(c.end_date) : null;
    if (!endDate || c.status === 'cancelado') return false;
    const days = differenceInDays(endDate, today);
    return days > 0 && days <= 30;
  });
  const expiredContracts = allContracts.filter(c => {
    const endDate = c.end_date ? new Date(c.end_date) : null;
    return endDate && differenceInDays(endDate, today) < 0 && c.status !== 'cancelado';
  });
  const totalMonthlyRevenue = activeContracts.reduce((sum, c) => sum + Number(c.monthly_value), 0);
  const totalAnnualRevenue = totalMonthlyRevenue * 12;

  const getContractStatusBadge = (contract: Contract) => {
    if (contract.status === 'cancelado') return <Badge variant="destructive">Cancelado</Badge>;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    if (endDate) {
      const daysUntilEnd = differenceInDays(endDate, today);
      if (daysUntilEnd < 0) return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Vencido</Badge>;
      if (daysUntilEnd <= 30) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Vence em {daysUntilEnd}d</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Ativo</Badge>;
  };

  const getNextMaintenanceDate = (contract: Contract) => {
    const start = new Date(contract.start_date);
    const interval = contract.cleaning_interval_months;
    let next = new Date(start);
    while (next <= today) {
      next = addMonths(next, interval);
    }
    return next;
  };

  // ============ PDF GENERATION ============
  const generateContractPDF = (contract: Contract) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    doc.setDrawColor(0, 120, 200); doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y); y += 8;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 80, 160);
    doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text('MANUTENÇÃO PREVENTIVA E CORRETIVA DE AR CONDICIONADO', pageWidth / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(10);
    doc.text(`Contrato Nº ${String(contract.contract_number).padStart(4, '0')}`, pageWidth / 2, y, { align: 'center' }); y += 4;
    doc.line(margin, y, pageWidth - margin, y); y += 12;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('1. CONTRATADA', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    if (companyData) {
      doc.text(`Razão Social: ${companyData.company_name}`, margin + 5, y); y += 6;
      doc.text(`CNPJ/CPF: ${companyData.cnpj_cpf}`, margin + 5, y); y += 6;
      if (companyData.address) { doc.text(`Endereço: ${companyData.address}`, margin + 5, y); y += 6; }
      if (companyData.whatsapp) { doc.text(`WhatsApp: ${companyData.whatsapp}`, margin + 5, y); y += 6; }
    }
    y += 6;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('2. CONTRATANTE', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${contract.client.name}`, margin + 5, y); y += 6;
    if (contract.client.address) { doc.text(`Endereço: ${contract.client.address}`, margin + 5, y); y += 6; }
    if (contract.client.telefone) { doc.text(`Telefone: ${contract.client.telefone}`, margin + 5, y); y += 6; }
    y += 6;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('3. OBJETO', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const obj = `Prestação de serviços de manutenção preventiva e/ou corretiva em sistemas de ar condicionado.`;
    const objLines = doc.splitTextToSize(obj, pageWidth - 2 * margin - 10);
    doc.text(objLines, margin + 5, y); y += objLines.length * 5 + 4;
    doc.text(`• ${contract.title}`, margin + 5, y); y += 6;
    if (contract.description) {
      const dLines = doc.splitTextToSize(`• ${contract.description}`, pageWidth - 2 * margin - 10);
      doc.text(dLines, margin + 5, y); y += dLines.length * 5 + 2;
    }
    doc.text(`• Intervalo: A cada ${contract.cleaning_interval_months} meses`, margin + 5, y); y += 8;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('4. VIGÊNCIA', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Início: ${format(new Date(contract.start_date), 'dd/MM/yyyy')}`, margin + 5, y); y += 6;
    doc.text(`Término: ${contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : 'Indeterminado'}`, margin + 5, y); y += 8;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('5. VALORES', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    if (contract.monthly_value > 0) {
      doc.text(`Valor Mensal: R$ ${contract.monthly_value.toFixed(2)}`, margin + 5, y); y += 6;
      doc.text(`Valor Anual: R$ ${(contract.monthly_value * 12).toFixed(2)}`, margin + 5, y); y += 6;
    } else {
      doc.text('Valor: A combinar.', margin + 5, y); y += 6;
    }

    if (contract.notes) {
      y += 4;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('6. OBSERVAÇÕES', margin, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      const nLines = doc.splitTextToSize(contract.notes, pageWidth - 2 * margin - 10);
      doc.text(nLines, margin + 5, y); y += nLines.length * 5 + 4;
    }

    if (y > 230) { doc.addPage(); y = 20; }
    y = Math.max(y + 15, 240);
    doc.setFontSize(10); doc.setTextColor(100);
    const dataLocal = `${companyData?.address?.split(',')[0]?.split('-')[0]?.trim() || 'Local'}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    doc.text(dataLocal, pageWidth / 2, y, { align: 'center' }); y += 20;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y); y += 5;
    doc.setTextColor(0); doc.setFont('helvetica', 'bold');
    doc.text(companyData?.company_name || 'CONTRATADA', margin + 35, y, { align: 'center' });
    doc.text(contract.client.name, pageWidth - margin - 35, y, { align: 'center' });

    const pH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, pH - 10, { align: 'center' });

    doc.save(`Contrato_${String(contract.contract_number).padStart(4, '0')}_${contract.client.name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF gerado!');
  };

  const generateTerminationPDF = (contract: Contract, type: 'quebra' | 'finalizacao', reason: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    doc.setDrawColor(type === 'quebra' ? 200 : 0, type === 'quebra' ? 50 : 120, type === 'quebra' ? 50 : 200);
    doc.setLineWidth(0.8); doc.line(margin, y, pageWidth - margin, y); y += 8;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.setTextColor(type === 'quebra' ? 180 : 0, type === 'quebra' ? 0 : 80, type === 'quebra' ? 0 : 160);
    doc.text(type === 'quebra' ? 'TERMO DE RESCISÃO CONTRATUAL' : 'TERMO DE FINALIZAÇÃO DE CONTRATO', pageWidth / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Contrato Nº ${String(contract.contract_number).padStart(4, '0')}`, pageWidth / 2, y, { align: 'center' }); y += 4;
    doc.line(margin, y, pageWidth - margin, y); y += 12;

    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.text('CONTRATADA:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    if (companyData) { doc.text(`${companyData.company_name} - ${companyData.cnpj_cpf}`, margin + 5, y); y += 6; }
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.text('CONTRATANTE:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(contract.client.name, margin + 5, y); y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(type === 'quebra' ? 'MOTIVO DA RESCISÃO:' : 'MOTIVO DA FINALIZAÇÃO:', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const rText = reason || (type === 'quebra' ? 'Rescisão por iniciativa das partes.' : 'Cumprimento integral do prazo.');
    const rLines = doc.splitTextToSize(rText, pageWidth - 2 * margin - 10);
    doc.text(rLines, margin + 5, y); y += rLines.length * 5 + 8;
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, margin + 5, y); y += 20;

    if (y > 230) { doc.addPage(); y = 20; }
    y = Math.max(y, 220);
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(companyData?.company_name || 'CONTRATADA', margin + 35, y, { align: 'center' });
    doc.text(contract.client.name, pageWidth - margin - 35, y, { align: 'center' });

    doc.save(`${type === 'quebra' ? 'Rescisao' : 'Finalizacao'}_${String(contract.contract_number).padStart(4, '0')}.pdf`);
    toast.success('Documento gerado!');
  };

  const handleTerminateContract = () => {
    if (!terminationContract) return;
    generateTerminationPDF(terminationContract, terminationType, terminationReason);
    supabase.from('maintenance_contracts').update({ status: 'cancelado' }).eq('id', terminationContract.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] }));
    setTerminationDialogOpen(false);
    setTerminationContract(null);
    setTerminationReason('');
  };

  const navigateMonth = (dir: number) => {
    setSelectedMonth(prev => addMonths(prev, dir));
  };

  // ============ RENDER ============
  return (
    <div className="space-y-6 animate-fade-in">
      <TabGuideCards cards={[
        {
          icon: ScrollText,
          title: 'Contratos de Manutenção',
          badge: 'Recorrente',
          badgeColor: 'emerald',
          description: <>Cadastre contratos de <strong>manutenção preventiva</strong>. O sistema avisa automaticamente quando a próxima limpeza está chegando.</>,
        },
        {
          icon: Calendar,
          title: 'Manutenções Agendadas',
          badge: 'Preventivo',
          badgeColor: 'amber',
          description: <>Nunca perca um prazo. Manutenções preventivas <strong>geram receita recorrente</strong> e fidelizam clientes.</>,
        },
      ]} />
      {/* Alert for expiring */}
      {(expiringContracts.length > 0 || expiredContracts.length > 0) && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {expiredContracts.length > 0 && <span className="font-semibold">{expiredContracts.length} contrato(s) vencido(s). </span>}
            {expiringContracts.length > 0 && <span>{expiringContracts.length} contrato(s) vencendo em breve.</span>}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setContractFilterStatus('active')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900"><CheckCircle className="w-4 h-4 text-green-600" /></div>
              <div><p className="text-xl font-bold text-green-600">{activeContracts.length}</p><p className="text-[10px] text-muted-foreground">Ativos</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setContractFilterStatus('expiring')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900"><Clock className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-xl font-bold text-amber-600">{expiringContracts.length}</p><p className="text-[10px] text-muted-foreground">Vencendo</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setContractFilterStatus('expired')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              <div><p className="text-xl font-bold text-red-600">{expiredContracts.length}</p><p className="text-[10px] text-muted-foreground">Vencidos</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900"><ScrollText className="w-4 h-4 text-blue-600" /></div>
              <div><p className="text-xl font-bold text-blue-600">{allContracts.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-lg font-bold text-emerald-600">R${totalMonthlyRevenue.toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Receita/mês</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900"><TrendingUp className="w-4 h-4 text-purple-600" /></div>
              <div><p className="text-lg font-bold text-purple-600">R${totalAnnualRevenue.toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Receita/ano</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Navigator + Search + Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                Contratos de Manutenção
              </CardTitle>
              <Button onClick={() => setContractDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo Contrato
              </Button>
            </div>

            {/* Month navigator */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="font-semibold capitalize">{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</p>
                <p className="text-xs text-muted-foreground">{filteredContracts.length} contrato(s) vigente(s)</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente, título ou nº..." value={contractSearch} onChange={(e) => setContractSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={contractFilterStatus} onValueChange={setContractFilterStatus}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
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
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ScrollText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum contrato encontrado</p>
              <p className="text-sm mt-1">Crie um novo contrato para começar a gerenciar manutenções</p>
              <Button className="mt-4" onClick={() => setContractDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Criar Primeiro Contrato
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContracts.map(contract => {
                const endDate = contract.end_date ? new Date(contract.end_date) : null;
                const daysLeft = endDate ? differenceInDays(endDate, today) : null;
                const nextMaint = getNextMaintenanceDate(contract);
                const daysToMaint = differenceInDays(nextMaint, today);
                const totalMonths = contract.end_date ? differenceInDays(new Date(contract.end_date), new Date(contract.start_date)) / 30 : null;
                const elapsedMonths = differenceInDays(today, new Date(contract.start_date)) / 30;
                const progress = totalMonths ? Math.min(Math.max((elapsedMonths / totalMonths) * 100, 0), 100) : null;

                return (
                  <div key={contract.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                    contract.status === 'cancelado' ? 'border-border opacity-60' :
                    daysLeft !== null && daysLeft < 0 ? 'border-red-300 bg-red-50/50 dark:bg-red-950/10' :
                    daysLeft !== null && daysLeft <= 30 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' :
                    'border-border hover:border-primary/30'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">#{String(contract.contract_number).padStart(4, '0')}</span>
                          <span className="font-semibold">{contract.client.name}</span>
                          {getContractStatusBadge(contract)}
                        </div>
                        <p className="text-sm text-primary font-medium">{contract.title}</p>
                        {contract.description && <p className="text-xs text-muted-foreground line-clamp-1">{contract.description}</p>}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(contract.start_date), 'dd/MM/yy')} → {contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yy') : '∞'}
                          </span>
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            A cada {contract.cleaning_interval_months}m
                          </span>
                          {contract.monthly_value > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <DollarSign className="w-3 h-3" />
                              R$ {contract.monthly_value.toFixed(2)}/mês
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Snowflake className="w-3 h-3" />
                            Próx. manutenção: {format(nextMaint, 'dd/MM/yy')}
                            {daysToMaint <= 7 && daysToMaint >= 0 && <span className="text-amber-600 font-medium ml-1">({daysToMaint}d)</span>}
                            {daysToMaint < 0 && <span className="text-red-600 font-medium ml-1">(atrasada!)</span>}
                          </span>
                        </div>

                        {/* Progress bar */}
                        {progress !== null && contract.status !== 'cancelado' && (
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Progresso</span>
                              <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setViewContractDialog(contract)} title="Visualizar">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs text-blue-500" onClick={() => handleEditContract(contract)} title="Editar">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => generateContractPDF(contract)} title="PDF">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {contract.status !== 'cancelado' && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => renewContractMutation.mutate(contract)} title="Renovar">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-amber-600 border-amber-300" 
                              onClick={() => { setTerminationContract(contract); setTerminationDialogOpen(true); }} title="Encerrar">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-blue-600 border-blue-300"
                              onClick={() => { setAttachContract(contract); setAttachType('signed'); setAttachDialogOpen(true); }} title="Anexar">
                              <Paperclip className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {contract.client.telefone && (
                          <Button size="sm" variant="outline" className="h-8 text-xs text-green-600 border-green-300"
                            onClick={() => {
                              const phone = formatPhoneForWhatsApp(contract.client.telefone!);
                              const msg = encodeURIComponent(`Olá ${contract.client.name}! Referente ao contrato de manutenção "${contract.title}". Próxima manutenção prevista para ${format(nextMaint, 'dd/MM/yyyy')}.`);
                              window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                            }} title="WhatsApp">
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => {
                          if (window.confirm('Excluir contrato permanentemente?')) deleteContractMutation.mutate(contract.id);
                        }} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Contract Dialog */}
      <Dialog open={!!viewContractDialog} onOpenChange={() => setViewContractDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contrato #{viewContractDialog && String(viewContractDialog.contract_number).padStart(4, '0')}</DialogTitle>
          </DialogHeader>
          {viewContractDialog && (() => {
            let extraData: any = {};
            try { extraData = JSON.parse(viewContractDialog.notes || '{}'); } catch { extraData = { userNotes: viewContractDialog.notes }; }
            return (
            <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Cliente</Label><p className="font-medium">{viewContractDialog.client.name}</p></div>
                <div><Label className="text-xs text-muted-foreground">Status</Label><div className="mt-1">{getContractStatusBadge(viewContractDialog)}</div></div>
                <div><Label className="text-xs text-muted-foreground">Título</Label><p className="font-medium text-primary">{viewContractDialog.title}</p></div>
                <div><Label className="text-xs text-muted-foreground">Valor Mensal</Label><p className="font-medium text-emerald-600">R$ {viewContractDialog.monthly_value.toFixed(2)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Início</Label><p>{format(new Date(viewContractDialog.start_date), 'dd/MM/yyyy')}</p></div>
                <div><Label className="text-xs text-muted-foreground">Término</Label><p>{viewContractDialog.end_date ? format(new Date(viewContractDialog.end_date), 'dd/MM/yyyy') : 'Indeterminado'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Intervalo</Label><p>A cada {viewContractDialog.cleaning_interval_months} meses</p></div>
                <div><Label className="text-xs text-muted-foreground">Próx. Manutenção</Label><p>{format(getNextMaintenanceDate(viewContractDialog), 'dd/MM/yyyy')}</p></div>
              </div>

              {/* Responsável */}
              {(extraData.responsibleName || extraData.responsiblePhone) && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">👤 Responsável</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {extraData.responsibleName && <div><span className="text-muted-foreground text-xs">Nome:</span> <span className="font-medium">{extraData.responsibleName}</span></div>}
                    {extraData.responsiblePhone && <div><span className="text-muted-foreground text-xs">Telefone:</span> <span className="font-medium">{extraData.responsiblePhone}</span></div>}
                    {extraData.responsibleCpf && <div><span className="text-muted-foreground text-xs">CPF:</span> <span>{extraData.responsibleCpf}</span></div>}
                    {extraData.responsibleRg && <div><span className="text-muted-foreground text-xs">RG:</span> <span>{extraData.responsibleRg}</span></div>}
                  </div>
                </div>
              )}

              {/* Equipamento */}
              {(extraData.equipmentBrand || extraData.equipmentBtus) && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">❄️ Equipamento</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {extraData.equipmentBrand && <div><span className="text-muted-foreground text-xs">Marca:</span> <span className="font-medium">{extraData.equipmentBrand}</span></div>}
                    {extraData.equipmentModel && <div><span className="text-muted-foreground text-xs">Modelo:</span> <span>{extraData.equipmentModel}</span></div>}
                    {extraData.equipmentBtus && <div><span className="text-muted-foreground text-xs">BTUs:</span> <span>{extraData.equipmentBtus}</span></div>}
                    {extraData.equipmentLocation && <div><span className="text-muted-foreground text-xs">Local:</span> <span>{extraData.equipmentLocation}</span></div>}
                    {extraData.equipmentCount && <div><span className="text-muted-foreground text-xs">Qtd:</span> <span>{extraData.equipmentCount}</span></div>}
                  </div>
                </div>
              )}

              {/* Detalhes */}
              {(extraData.contractType || extraData.paymentMethod || extraData.serviceAddress) && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">📋 Detalhes</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {extraData.contractType && <div><span className="text-muted-foreground text-xs">Tipo:</span> <span className="capitalize">{extraData.contractType}</span></div>}
                    {extraData.paymentMethod && <div><span className="text-muted-foreground text-xs">Pagamento:</span> <span className="capitalize">{extraData.paymentMethod}</span></div>}
                    {extraData.serviceType && <div><span className="text-muted-foreground text-xs">Serviço:</span> <span className="capitalize">{extraData.serviceType}</span></div>}
                    {extraData.serviceAddress && <div className="col-span-2"><span className="text-muted-foreground text-xs">Endereço:</span> <span>{extraData.serviceAddress}</span></div>}
                  </div>
                </div>
              )}

              {viewContractDialog.description && (
                <div className="pt-2 border-t"><Label className="text-xs text-muted-foreground">Descrição</Label><p className="text-sm">{viewContractDialog.description}</p></div>
              )}
              {extraData.userNotes && (
                <div><Label className="text-xs text-muted-foreground">Observações</Label><p className="text-sm italic">{extraData.userNotes}</p></div>
              )}
              {viewContractDialog.client.address && (
                <div><Label className="text-xs text-muted-foreground">Endereço do Cliente</Label><p className="text-sm">{viewContractDialog.client.address}</p></div>
              )}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => { generateContractPDF(viewContractDialog); }}>
                  <Download className="w-4 h-4 mr-2" /> Baixar PDF
                </Button>
                {(extraData.responsiblePhone || viewContractDialog.client.telefone) && (
                  <Button variant="outline" className="text-green-600 border-green-300"
                    onClick={() => {
                      const phone = formatPhoneForWhatsApp(extraData.responsiblePhone || viewContractDialog.client.telefone!);
                      window.open(`https://wa.me/${phone}`, '_blank');
                    }}>
                    <Phone className="w-4 h-4 mr-2" /> WhatsApp
                  </Button>
                )}
              </div>
            </div>
            </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Contract Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEditingContract ? 'Editar Contrato' : 'Novo Contrato de Manutenção'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>Cliente *</Label>
              <Select value={contractFormData.clientId} onValueChange={(v) => setContractFormData(p => ({ ...p, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={contractFormData.title} onChange={(e) => setContractFormData(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Manutenção Preventiva Residencial" />
            </div>
            <div>
              <Label>Tipo de Serviço</Label>
              <Select value={contractFormData.serviceType} onValueChange={(v) => setContractFormData(p => ({ ...p, serviceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="ambas">Preventiva + Corretiva</SelectItem>
                  <SelectItem value="instalacao">Instalação + Manutenção</SelectItem>
                  <SelectItem value="limpeza">Limpeza Periódica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={contractFormData.startDate} onChange={(e) => {
                const newStart = e.target.value;
                const months = parseInt(contractFormData.intervalMonths);
                const newEnd = addMonths(new Date(newStart), months);
                setContractFormData(p => ({ ...p, startDate: newStart, endDate: format(newEnd, 'yyyy-MM-dd') }));
              }} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={contractFormData.endDate} onChange={(e) => setContractFormData(p => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Intervalo</Label>
                <Select value={contractFormData.intervalMonths} onValueChange={(v) => {
                  const months = parseInt(v);
                  const start = contractFormData.startDate ? new Date(contractFormData.startDate) : new Date();
                  const newEnd = addMonths(start, months);
                  setContractFormData(p => ({ ...p, intervalMonths: v, endDate: format(newEnd, 'yyyy-MM-dd') }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 mês</SelectItem><SelectItem value="2">2 meses</SelectItem>
                    <SelectItem value="3">3 meses</SelectItem><SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor/mês (R$)</Label><Input type="number" value={contractFormData.monthlyValue} onChange={(e) => setContractFormData(p => ({ ...p, monthlyValue: e.target.value }))} placeholder="0.00" /></div>
              <div><Label>Equipamentos</Label><Input type="number" value={contractFormData.equipmentCount} onChange={(e) => setContractFormData(p => ({ ...p, equipmentCount: e.target.value }))} /></div>
            </div>
            {/* Responsável / Contato */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">👤 Responsável / Contato</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome do Responsável</Label><Input value={contractFormData.responsibleName} onChange={(e) => setContractFormData(p => ({ ...p, responsibleName: e.target.value }))} placeholder="Com quem falou" /></div>
                <div><Label>Telefone</Label><Input value={contractFormData.responsiblePhone} onChange={(e) => setContractFormData(p => ({ ...p, responsiblePhone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
                <div><Label>CPF</Label><Input value={contractFormData.responsibleCpf} onChange={(e) => setContractFormData(p => ({ ...p, responsibleCpf: e.target.value }))} placeholder="000.000.000-00" /></div>
                <div><Label>RG</Label><Input value={contractFormData.responsibleRg} onChange={(e) => setContractFormData(p => ({ ...p, responsibleRg: e.target.value }))} placeholder="00.000.000-0" /></div>
              </div>
            </div>

            {/* Equipamento */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">❄️ Equipamento</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Marca</Label><Input value={contractFormData.equipmentBrand} onChange={(e) => setContractFormData(p => ({ ...p, equipmentBrand: e.target.value }))} placeholder="Ex: Samsung, LG, Springer" /></div>
                <div><Label>Modelo</Label><Input value={contractFormData.equipmentModel} onChange={(e) => setContractFormData(p => ({ ...p, equipmentModel: e.target.value }))} placeholder="Ex: Split Inverter" /></div>
                <div><Label>BTUs</Label><Input type="number" value={contractFormData.equipmentBtus} onChange={(e) => setContractFormData(p => ({ ...p, equipmentBtus: e.target.value }))} placeholder="Ex: 12000" /></div>
                <div><Label>Local do Equipamento</Label><Input value={contractFormData.equipmentLocation} onChange={(e) => setContractFormData(p => ({ ...p, equipmentLocation: e.target.value }))} placeholder="Ex: Sala, Quarto, Escritório" /></div>
              </div>
            </div>

            {/* Detalhes adicionais */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">📋 Detalhes do Contrato</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select value={contractFormData.contractType} onValueChange={(v) => setContractFormData(p => ({ ...p, contractType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residencial">🏠 Residencial</SelectItem>
                      <SelectItem value="comercial">🏢 Comercial</SelectItem>
                      <SelectItem value="industrial">🏭 Industrial</SelectItem>
                      <SelectItem value="condominio">🏗️ Condomínio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={contractFormData.paymentMethod} onValueChange={(v) => setContractFormData(p => ({ ...p, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                      <SelectItem value="avista">À Vista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Endereço do Serviço</Label><Input value={contractFormData.serviceAddress} onChange={(e) => setContractFormData(p => ({ ...p, serviceAddress: e.target.value }))} placeholder="Endereço completo onde será prestado o serviço" /></div>
              </div>
            </div>

            <div><Label>Descrição</Label><Textarea value={contractFormData.description} onChange={(e) => setContractFormData(p => ({ ...p, description: e.target.value }))} placeholder="Serviços inclusos, equipamentos, locais..." rows={3} /></div>
            <div><Label>Observações</Label><Textarea value={contractFormData.notes} onChange={(e) => setContractFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Cláusulas adicionais, condições especiais..." rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContractDialogOpen(false); resetContractForm(); }}>Cancelar</Button>
            <Button onClick={() => isEditingContract ? updateContractMutation.mutate(contractFormData) : createContractMutation.mutate(contractFormData)} disabled={!contractFormData.clientId || !contractFormData.title || createContractMutation.isPending || updateContractMutation.isPending}>
              {createContractMutation.isPending || updateContractMutation.isPending ? 'Salvando...' : isEditingContract ? 'Atualizar Contrato' : 'Criar Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Termination Dialog */}
      <Dialog open={terminationDialogOpen} onOpenChange={setTerminationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-amber-500" />Encerrar Contrato</DialogTitle>
            <DialogDescription>{terminationContract && `#${terminationContract.contract_number} - ${terminationContract.client.name}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={terminationType} onValueChange={(v: 'quebra' | 'finalizacao') => setTerminationType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="finalizacao">✅ Finalização</SelectItem>
                  <SelectItem value="quebra">❌ Rescisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Motivo</Label><Textarea value={terminationReason} onChange={e => setTerminationReason(e.target.value)} placeholder="Motivo..." rows={3} /></div>
            {terminationType === 'quebra' && (
              <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <AlertDescription className="text-red-700 text-sm">⚠️ A rescisão gera documento formal e cancela o contrato.</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminationDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTerminateContract} className={terminationType === 'quebra' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}>
              <Download className="w-4 h-4 mr-2" />Gerar e Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Dialog */}
      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {attachType === 'signed' ? <><Paperclip className="w-5 h-5 text-blue-500" />Anexar Assinado</> : <><XCircle className="w-5 h-5 text-red-500" />Anexar Cancelamento</>}
            </DialogTitle>
            <DialogDescription>{attachContract && `#${attachContract.contract_number} - ${attachContract.client.name}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Selecione o arquivo (PDF, imagem)</p>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
              {attachFile && <div className="mt-3 p-2 bg-muted/50 rounded flex items-center gap-2 justify-center"><Paperclip className="w-4 h-4" /><span className="text-sm">{attachFile.name}</span></div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAttachDialogOpen(false); setAttachFile(null); }}>Cancelar</Button>
            <Button disabled={!attachFile} onClick={async () => {
              if (!attachFile || !attachContract) return;
              try {
                const fileExt = attachFile.name.split('.').pop();
                const filePath = `contracts/${attachContract.id}/${attachType}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                  .from('service-photos')
                  .upload(filePath, attachFile, { upsert: true });
                if (uploadError) throw uploadError;
                
                // Save reference in contract notes
                const currentNotes = attachContract.notes || '{}';
                let parsed: any = {};
                try { parsed = JSON.parse(currentNotes); } catch { parsed = { userNotes: currentNotes }; }
                parsed[`${attachType}_file`] = filePath;
                parsed[`${attachType}_file_name`] = attachFile.name;
                parsed[`${attachType}_date`] = new Date().toISOString();
                
                await supabase.from('maintenance_contracts')
                  .update({ notes: JSON.stringify(parsed) })
                  .eq('id', attachContract.id);

                toast.success('Documento anexado com sucesso!');
                if (attachType === 'cancellation') {
                  await supabase.from('maintenance_contracts').update({ status: 'cancelado' }).eq('id', attachContract.id);
                  queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
                }
                queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
              } catch (err: any) { toast.error(`Erro ao anexar: ${err.message}`); }
              setAttachDialogOpen(false); setAttachFile(null);
            }}>
              <Upload className="w-4 h-4 mr-2" />Anexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesUnifiedTab;
