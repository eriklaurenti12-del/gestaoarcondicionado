import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { format, addMonths, addYears, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { 
  FileText, Plus, Search, Trash2, RefreshCw, Download,
  Calendar, DollarSign, User, Building2, AlertTriangle, CheckCircle
} from 'lucide-react';

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

const ContractsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    intervalMonths: '6',
    monthlyValue: '',
    notes: ''
  });

  // Fetch contracts
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['maintenance-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_contracts')
        .select(`
          *,
          client:clients(id, name, telefone, email, address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Contract[];
    }
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients-for-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, telefone, email, address')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch company data
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

  // Create contract mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  // Delete contract mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_contracts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato excluído!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  // Renew contract mutation
  const renewMutation = useMutation({
    mutationFn: async (contract: Contract) => {
      const newEndDate = addYears(new Date(contract.end_date || new Date()), 1);
      const { error } = await supabase
        .from('maintenance_contracts')
        .update({
          end_date: format(newEndDate, 'yyyy-MM-dd'),
          status: 'ativo'
        })
        .eq('id', contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });
      toast.success('Contrato renovado por mais 1 ano!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      clientId: '',
      title: '',
      description: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      intervalMonths: '6',
      monthlyValue: '',
      notes: ''
    });
    setSelectedContract(null);
  };

  const generateContractPDF = (contract: Contract) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATO DE MANUTENÇÃO PREVENTIVA', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contrato Nº ${contract.contract_number}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Company Data (CONTRATADA)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATADA:', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    if (companyData) {
      doc.text(`Razão Social: ${companyData.company_name}`, 20, y);
      y += 6;
      doc.text(`CNPJ/CPF: ${companyData.cnpj_cpf}`, 20, y);
      y += 6;
      if (companyData.address) {
        doc.text(`Endereço: ${companyData.address}`, 20, y);
        y += 6;
      }
      if (companyData.whatsapp) {
        doc.text(`Telefone: ${companyData.whatsapp}`, 20, y);
        y += 6;
      }
      if (companyData.email) {
        doc.text(`Email: ${companyData.email}`, 20, y);
        y += 6;
      }
    } else {
      doc.text('(Dados da empresa não cadastrados)', 20, y);
      y += 6;
    }
    y += 10;

    // Client Data (CONTRATANTE)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATANTE:', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome/Razão Social: ${contract.client.name}`, 20, y);
    y += 6;
    if (contract.client.address) {
      doc.text(`Endereço: ${contract.client.address}`, 20, y);
      y += 6;
    }
    if (contract.client.telefone) {
      doc.text(`Telefone: ${contract.client.telefone}`, 20, y);
      y += 6;
    }
    if (contract.client.email) {
      doc.text(`Email: ${contract.client.email}`, 20, y);
      y += 6;
    }
    y += 10;

    // Contract Details
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OBJETO DO CONTRATO:', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Título: ${contract.title}`, 20, y);
    y += 6;
    if (contract.description) {
      const descLines = doc.splitTextToSize(`Descrição: ${contract.description}`, pageWidth - 40);
      doc.text(descLines, 20, y);
      y += descLines.length * 6;
    }
    y += 10;

    // Terms
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES:', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vigência: ${format(new Date(contract.start_date), 'dd/MM/yyyy')} a ${contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : 'Indeterminado'}`, 20, y);
    y += 6;
    doc.text(`Periodicidade das Limpezas: A cada ${contract.cleaning_interval_months} meses`, 20, y);
    y += 6;
    if (contract.monthly_value > 0) {
      doc.text(`Valor Mensal: R$ ${contract.monthly_value.toFixed(2)}`, 20, y);
      y += 6;
    }
    y += 10;

    if (contract.notes) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES:', 20, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(contract.notes, pageWidth - 40);
      doc.text(notesLines, 20, y);
      y += notesLines.length * 6 + 10;
    }

    // Signatures
    y += 20;
    doc.setFontSize(11);
    doc.text(`Local e Data: __________________________, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 20, y);
    y += 30;

    // Signature lines
    doc.line(20, y, 90, y);
    doc.line(pageWidth - 90, y, pageWidth - 20, y);
    y += 5;
    doc.text('CONTRATADA', 55, y, { align: 'center' });
    doc.text('CONTRATANTE', pageWidth - 55, y, { align: 'center' });

    doc.save(`Contrato_${contract.contract_number}_${contract.client.name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const getStatusBadge = (contract: Contract) => {
    const today = new Date();
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    
    if (contract.status === 'cancelado') {
      return <Badge variant="destructive">Cancelado</Badge>;
    }
    
    if (endDate) {
      const daysUntilEnd = differenceInDays(endDate, today);
      if (daysUntilEnd < 0) {
        return <Badge className="bg-red-100 text-red-700">Vencido</Badge>;
      }
      if (daysUntilEnd <= 30) {
        return <Badge className="bg-amber-100 text-amber-700">Vence em {daysUntilEnd}d</Badge>;
      }
    }
    
    return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
  };

  const filteredContracts = contracts?.filter(c =>
    c.client.name.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Stats
  const activeContracts = contracts?.filter(c => c.status === 'ativo').length || 0;
  const totalMonthlyValue = contracts?.reduce((sum, c) => sum + Number(c.monthly_value), 0) || 0;
  const expiringSoon = contracts?.filter(c => {
    if (!c.end_date) return false;
    return differenceInDays(new Date(c.end_date), new Date()) <= 30 && differenceInDays(new Date(c.end_date), new Date()) > 0;
  }).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{activeContracts}</p>
                <p className="text-xs text-muted-foreground">Contratos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">R$ {totalMonthlyValue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Receita Mensal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Vencem em 30 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Contratos de Manutenção
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contrato..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Contrato
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum contrato encontrado</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Contrato
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Valor/Mês</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-mono text-sm">
                        #{contract.contract_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {contract.client.name}
                        </div>
                      </TableCell>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(contract.start_date), 'dd/MM/yy')}</div>
                          <div className="text-muted-foreground">
                            até {contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yy') : 'Indeterm.'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{contract.cleaning_interval_months} meses</TableCell>
                      <TableCell>
                        {contract.monthly_value > 0 ? (
                          <span className="font-semibold text-green-600">
                            R$ {contract.monthly_value.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(contract)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateContractPDF(contract)}
                            title="Gerar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => renewMutation.mutate(contract)}
                            title="Renovar +1 ano"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Excluir este contrato?')) {
                                deleteMutation.mutate(contract.id);
                              }
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Create Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Novo Contrato de Manutenção
            </DialogTitle>
            <DialogDescription>
              Crie um contrato de manutenção periódica com o cliente
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div>
                <Label>Cliente *</Label>
                <Select 
                  value={formData.clientId} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, clientId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título do Contrato *</Label>
                <Input
                  placeholder="Ex: Manutenção Preventiva - Residência"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva os serviços incluídos no contrato..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Intervalo de Limpeza</Label>
                  <Select 
                    value={formData.intervalMonths} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, intervalMonths: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.monthlyValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyValue: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Condições especiais, horários preferidos, etc..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!formData.clientId || !formData.title || !formData.startDate) {
                  toast.error('Preencha os campos obrigatórios');
                  return;
                }
                createMutation.mutate(formData);
              }}
              disabled={createMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractsTab;