import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, Loader2, DollarSign, CreditCard, Banknote, QrCode } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialRecord {
  id: string;
  type: "entrada" | "saque" | "reserva";
  amount: number;
  description: string | null;
  payment_method: string | null;
  installments: number | null;
  category: string | null;
  record_date: string;
}

export default function FinanceiroTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  
  const [formData, setFormData] = useState({
    type: "entrada" as "entrada" | "saque" | "reserva",
    amount: "",
    description: "",
    payment_method: "Dinheiro",
    installments: "1",
    category: "",
  });

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth]);

  const fetchRecords = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("record_date", startDate)
      .lte("record_date", endDate)
      .order("record_date", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar registros", variant: "destructive" });
    } else {
      setRecords((data as FinancialRecord[]) || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("financial_records").insert({
      user_id: session.user.id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description || null,
      payment_method: formData.payment_method,
      installments: parseInt(formData.installments) || 1,
      category: formData.category || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar registro", variant: "destructive" });
    } else {
      toast({ title: "Registro salvo com sucesso!" });
      setDialogOpen(false);
      setFormData({
        type: "entrada",
        amount: "",
        description: "",
        payment_method: "Dinheiro",
        installments: "1",
        category: "",
      });
      fetchRecords();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Registro excluído!" });
      fetchRecords();
    }
  };

  const totalEntradas = records.filter(r => r.type === "entrada").reduce((acc, r) => acc + Number(r.amount), 0);
  const totalSaques = records.filter(r => r.type === "saque").reduce((acc, r) => acc + Number(r.amount), 0);
  const totalReservas = records.filter(r => r.type === "reserva").reduce((acc, r) => acc + Number(r.amount), 0);
  const saldoDisponivel = totalEntradas - totalSaques - totalReservas;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "entrada": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "saque": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "reserva": return <Wallet className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const getPaymentIcon = (method: string | null) => {
    switch (method) {
      case "Dinheiro": return <Banknote className="h-4 w-4" />;
      case "PIX": return <QrCode className="h-4 w-4" />;
      case "Débito": case "Crédito": return <CreditCard className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Controle Financeiro</h2>
          <p className="text-muted-foreground">Gerencie suas entradas, saques e reservas</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-auto"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent">
                <Plus className="h-4 w-4 mr-2" /> Novo Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Registro Financeiro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (Ganho)</SelectItem>
                      <SelectItem value="saque">Saque (Retirada)</SelectItem>
                      <SelectItem value="reserva">Reserva (Guardado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descrição do registro"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Débito">Débito</SelectItem>
                      <SelectItem value="Crédito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === "Crédito" && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={formData.installments} onValueChange={(v) => setFormData({ ...formData, installments: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x {n === 1 ? "(à vista)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Categoria (opcional)</Label>
                  <Input
                    placeholder="Ex: Serviço, Produto, Despesa"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Registro"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Entradas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              R$ {totalEntradas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Saques do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">
              R$ {totalSaques.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">
              R$ {totalReservas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Saldo Disponível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${saldoDisponivel >= 0 ? "text-primary" : "text-red-500"}`}>
              R$ {saldoDisponivel.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro encontrado para este mês</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(record.type)}
                          <span className="capitalize">{record.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{record.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentIcon(record.payment_method)}
                          {record.payment_method || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.installments && record.installments > 1 ? `${record.installments}x` : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        record.type === "entrada" ? "text-green-500" : 
                        record.type === "saque" ? "text-red-500" : "text-blue-500"
                      }`}>
                        R$ {Number(record.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.record_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
