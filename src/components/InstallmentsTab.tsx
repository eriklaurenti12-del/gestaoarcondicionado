import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CreditCard, Search, FileText, MessageCircle, Check, Calendar, DollarSign, Clock, AlertTriangle, CalendarPlus, CalendarMinus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { format, differenceInDays, addDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fetchInstallments = async () => {
  const { data, error } = await supabase
    .from('installments')
    .select('*, appointments(clients(name, telefone), products(name))')
    .order('due_date');

  if (error) throw error;
  return data || [];
};

const fetchClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name, telefone').order('name');
  if (error) throw error;
  return data;
};

const InstallmentsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [userId, setUserId] = useState<string>("");
  
  // Dialog states
  const [editingInstallment, setEditingInstallment] = useState<any>(null);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [dateDialogMode, setDateDialogMode] = useState<'extend' | 'early'>('extend');
  const [notes, setNotes] = useState('');
  
  // New installment (fiado) dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTotalAmount, setNewTotalAmount] = useState('');
  const [newNumInstallments, setNewNumInstallments] = useState('1');
  const [newFirstDueDate, setNewFirstDueDate] = useState('');

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUserId();
  }, []);

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['installments'],
    queryFn: fetchInstallments
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients
  });

  // Create new installment (fiado) mutation
  const createInstallmentMutation = useMutation({
    mutationFn: async () => {
      const total = parseFloat(newTotalAmount);
      const numInst = parseInt(newNumInstallments);
      const amount = total / numInst;
      const baseDate = new Date(newFirstDueDate);
      
      const installmentRecords = [];
      for (let i = 0; i < numInst; i++) {
        const dueDate = addMonths(baseDate, i);
        installmentRecords.push({
          user_id: userId,
          installment_number: i + 1,
          total_installments: numInst,
          amount,
          due_date: dueDate.toISOString().split('T')[0],
          is_paid: false,
          payment_method: 'Fiado',
          notes: newDescription || `Fiado - ${clients?.find(c => c.id === parseInt(newClientId))?.name || 'Cliente'}`
        });
      }
      
      const { error } = await supabase.from('installments').insert(installmentRecords);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      toast.success('Parcelas criadas com sucesso!');
      setShowNewDialog(false);
      resetNewForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar parcelas: ' + error.message);
    }
  });

  const resetNewForm = () => {
    setNewClientId('');
    setNewDescription('');
    setNewTotalAmount('');
    setNewNumInstallments('1');
    setNewFirstDueDate('');
  };

  // Delete installment mutation
  const deleteInstallmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('installments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      toast.success('Parcela removida!');
    }
  });

  const today = new Date();

  const processedInstallments = installments.map((inst: any) => {
    const dueDate = new Date(inst.due_date);
    const daysUntilDue = differenceInDays(dueDate, today);
    let status = 'normal';
    if (inst.is_paid) status = 'paid';
    else if (daysUntilDue < 0) status = 'overdue';
    else if (daysUntilDue <= 3) status = 'urgent';
    else if (daysUntilDue <= 7) status = 'warning';
    return { ...inst, daysUntilDue, status };
  });

  const filteredInstallments = processedInstallments.filter((inst: any) => {
    const clientName = inst.appointments?.clients?.name?.toLowerCase() || '';
    const matchesSearch = clientName.includes(search.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'pending' && !inst.is_paid) ||
      (filterStatus === 'paid' && inst.is_paid) ||
      (filterStatus === 'overdue' && inst.status === 'overdue');

    const dueDate = new Date(inst.due_date);
    const matchesMonth = filterMonth === 'all' || (dueDate.getMonth() + 1).toString() === filterMonth;
    const matchesYear = filterYear === 'all' || dueDate.getFullYear().toString() === filterYear;

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  const totalPending = filteredInstallments.filter((i: any) => !i.is_paid).reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalPaid = filteredInstallments.filter((i: any) => i.is_paid).reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalOverdue = filteredInstallments.filter((i: any) => i.status === 'overdue').reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  const handleMarkAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('installments')
      .update({ is_paid: true, paid_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao marcar como paga');
    } else {
      toast.success('Parcela marcada como paga!');
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  };

  const handleWhatsApp = (inst: any) => {
    const clientName = inst.appointments?.clients?.name || 'Cliente';
    const clientPhone = inst.appointments?.clients?.telefone?.replace(/\D/g, '') || '';
    if (!clientPhone) {
      toast.error('Cliente sem telefone cadastrado');
      return;
    }
    const message = `Olá ${clientName}, tudo bem? Passando para lembrar da parcela ${inst.installment_number}/${inst.total_installments} no valor de R$ ${Number(inst.amount).toFixed(2)} com vencimento em ${format(new Date(inst.due_date), 'dd/MM/yyyy')}.`;
    window.open(`https://wa.me/55${clientPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const openDateDialog = (inst: any, mode: 'extend' | 'early') => {
    setEditingInstallment(inst);
    setDateDialogMode(mode);
    setNewDueDate(new Date(inst.due_date));
    setNotes(inst.notes || '');
    setIsDateDialogOpen(true);
  };

  const handleUpdateDueDate = async () => {
    if (!editingInstallment || !newDueDate) return;

    const { error } = await supabase
      .from('installments')
      .update({ 
        due_date: newDueDate.toISOString().split('T')[0],
        notes: notes || null
      })
      .eq('id', editingInstallment.id);

    if (error) {
      toast.error('Erro ao atualizar data');
    } else {
      const action = dateDialogMode === 'extend' ? 'Prazo estendido' : 'Data antecipada';
      toast.success(`${action} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      setIsDateDialogOpen(false);
      setEditingInstallment(null);
    }
  };

  const handlePayEarly = async (inst: any) => {
    const { error } = await supabase
      .from('installments')
      .update({ 
        is_paid: true, 
        paid_date: new Date().toISOString().split('T')[0],
        notes: `Pagamento antecipado em ${format(new Date(), 'dd/MM/yyyy')}`
      })
      .eq('id', inst.id);

    if (error) {
      toast.error('Erro ao registrar pagamento');
    } else {
      toast.success('Pagamento antecipado registrado!');
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header gradient simulation
    doc.setFillColor(190, 60, 100);
    doc.rect(0, 0, 220, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PARCELAS', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 105, 32, { align: 'center' });

    // Summary cards
    let y = 55;
    doc.setTextColor(60, 60, 60);
    
    // Pending
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14, y, 55, 25, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('A RECEBER', 41.5, y + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(180, 100, 0);
    doc.text(`R$ ${totalPending.toFixed(2)}`, 41.5, y + 18, { align: 'center' });

    // Paid
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(77, y, 55, 25, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEBIDO', 104.5, y + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74);
    doc.text(`R$ ${totalPaid.toFixed(2)}`, 104.5, y + 18, { align: 'center' });

    // Overdue
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(140, y, 55, 25, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.text('VENCIDAS', 167.5, y + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text(`R$ ${totalOverdue.toFixed(2)}`, 167.5, y + 18, { align: 'center' });

    // Table
    const tableData = filteredInstallments.map((inst: any) => [
      inst.appointments?.clients?.name || '-',
      inst.appointments?.products?.name || '-',
      `${inst.installment_number}/${inst.total_installments}`,
      `R$ ${Number(inst.amount).toFixed(2)}`,
      format(new Date(inst.due_date), 'dd/MM/yyyy'),
      inst.is_paid ? 'PAGO' : inst.status === 'overdue' ? 'VENCIDA' : 'PENDENTE'
    ]);

    autoTable(doc, {
      startY: y + 35,
      head: [['Cliente', 'Serviço', 'Parcela', 'Valor', 'Vencimento', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [190, 60, 100], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        3: { halign: 'right' },
        5: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          const status = data.cell.raw;
          if (status === 'PAGO') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'VENCIDA') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [180, 100, 0];
          }
        }
      }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`parcelas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500 text-white">Pago</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500 text-white">Vencida</Badge>;
      case 'urgent':
        return <Badge className="bg-orange-500 text-white">Urgente</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 text-foreground">Atenção</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const months = [
    { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Parcelas
          </h2>
          <p className="text-muted-foreground text-sm">Gerencie todas as parcelas a receber</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Fiado
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">A Receber</p>
                <p className="text-xl font-bold text-yellow-600">R$ {totalPending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recebido</p>
                <p className="text-xl font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-xl font-bold text-red-600">R$ {totalOverdue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos meses</SelectItem>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos anos</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Serviço</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                  </TableRow>
                ) : filteredInstallments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma parcela encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstallments.map((inst: any) => (
                    <TableRow key={inst.id} className={
                      inst.status === 'overdue' ? 'bg-red-50 dark:bg-red-950/30' :
                      inst.status === 'urgent' ? 'bg-orange-50 dark:bg-orange-950/30' :
                      inst.status === 'paid' ? 'bg-green-50 dark:bg-green-950/30' : ''
                    }>
                      <TableCell>
                        <div className="font-medium">{inst.appointments?.clients?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {inst.appointments?.products?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {inst.appointments?.products?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{inst.installment_number}/{inst.total_installments}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          R$ {Number(inst.amount).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(new Date(inst.due_date), 'dd/MM/yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(inst.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleWhatsApp(inst)}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          
                          {!inst.is_paid && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Mais opções"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleMarkAsPaid(inst.id)}>
                                  <Check className="w-4 h-4 mr-2 text-green-600" />
                                  Marcar como Paga
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePayEarly(inst)}>
                                  <CalendarMinus className="w-4 h-4 mr-2 text-blue-600" />
                                  Pagar Antecipado
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openDateDialog(inst, 'extend')}>
                                  <CalendarPlus className="w-4 h-4 mr-2 text-orange-600" />
                                  Estender Prazo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDateDialog(inst, 'early')}>
                                  <Calendar className="w-4 h-4 mr-2 text-purple-600" />
                                  Alterar Vencimento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

      {/* Dialog para alterar data de vencimento */}
      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dateDialogMode === 'extend' ? (
                <>
                  <CalendarPlus className="w-5 h-5 text-orange-600" />
                  Estender Prazo
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Alterar Vencimento
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {editingInstallment && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{editingInstallment.appointments?.clients?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Parcela {editingInstallment.installment_number}/{editingInstallment.total_installments} • 
                  R$ {Number(editingInstallment.amount).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vencimento atual: {format(new Date(editingInstallment.due_date), 'dd/MM/yyyy')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nova data de vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newDueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {newDueDate ? format(newDueDate, "dd/MM/yyyy") : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={newDueDate}
                      onSelect={setNewDueDate}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {dateDialogMode === 'extend' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewDueDate(addDays(new Date(editingInstallment.due_date), 7))}
                  >
                    +7 dias
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewDueDate(addDays(new Date(editingInstallment.due_date), 15))}
                  >
                    +15 dias
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewDueDate(addDays(new Date(editingInstallment.due_date), 30))}
                  >
                    +30 dias
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Input
                  placeholder="Ex: Cliente pediu mais prazo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateDueDate} disabled={!newDueDate}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Installment (Fiado) Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Novo Fiado / Parcelamento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Compra de peças, Serviço de manutenção..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newTotalAmount}
                  onChange={(e) => setNewTotalAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nº Parcelas</Label>
                <Select value={newNumInstallments} onValueChange={setNewNumInstallments}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>1º Vencimento</Label>
              <Input
                type="date"
                value={newFirstDueDate}
                onChange={(e) => setNewFirstDueDate(e.target.value)}
              />
            </div>

            {newTotalAmount && newNumInstallments && (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Valor por parcela:</p>
                <p className="text-xl font-bold text-primary">
                  R$ {(parseFloat(newTotalAmount) / parseInt(newNumInstallments)).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewDialog(false); resetNewForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createInstallmentMutation.mutate()}
              disabled={!newClientId || !newTotalAmount || !newFirstDueDate || createInstallmentMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createInstallmentMutation.isPending ? 'Salvando...' : 'Criar Parcelas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstallmentsTab;
