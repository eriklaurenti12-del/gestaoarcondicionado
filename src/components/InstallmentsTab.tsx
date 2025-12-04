import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Search, FileText, MessageCircle, Check, Filter, Calendar, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const InstallmentsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['installments'],
    queryFn: fetchInstallments
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
        <Button onClick={exportToPDF} className="bg-primary hover:bg-primary/90">
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkAsPaid(inst.id)}
                              className="h-8 w-8 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
                              title="Marcar como paga"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
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
    </div>
  );
};

export default InstallmentsTab;
