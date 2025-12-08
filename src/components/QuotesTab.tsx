import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Send, Eye, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  description: string | null;
  items: QuoteItem[];
  subtotal: number;
  discount_percentage: number;
  discount_value: number;
  total: number;
  validity_days: number;
  status: string;
  notes: string | null;
  created_at: string;
  clients?: { name: string; telefone: string | null } | null;
}

export default function QuotesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [formData, setFormData] = useState({
    client_id: "",
    title: "",
    description: "",
    validity_days: 30,
    notes: "",
    discount_percentage: 0,
  });
  const [items, setItems] = useState<QuoteItem[]>([
    { description: "", quantity: 1, unit_price: 0, total: 0 }
  ]);

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("quotes")
        .select(`*, clients(name, telefone)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((q) => ({
        ...q,
        items: (q.items as unknown as QuoteItem[]) || [],
      })) as Quote[];
    },
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, telefone")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch company data
  const { data: companyData } = useQuery({
    queryKey: ["company-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_data")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Create quote mutation
  const createQuote = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const discountValue = (subtotal * formData.discount_percentage) / 100;
      const total = subtotal - discountValue;

      const { error } = await supabase.from("quotes").insert([{
        user_id: userData.user.id,
        client_id: formData.client_id ? parseInt(formData.client_id) : null,
        title: formData.title,
        description: formData.description || null,
        items: JSON.parse(JSON.stringify(items)),
        subtotal,
        discount_percentage: formData.discount_percentage,
        discount_value: discountValue,
        total,
        validity_days: formData.validity_days,
        notes: formData.notes || null,
        status: "pendente",
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento criado com sucesso!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao criar orçamento: " + error.message);
    },
  });

  // Update quote status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Status atualizado!");
    },
  });

  // Delete quote
  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído!");
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: "",
      title: "",
      description: "",
      validity_days: 30,
      notes: "",
      discount_percentage: 0,
    });
    setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "unit_price") {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discountValue = (subtotal * formData.discount_percentage) / 100;
    const total = subtotal - discountValue;
    return { subtotal, discountValue, total };
  };

  const generatePDF = (quote: Quote) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(0, 150, 200);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(companyData?.company_name || "AC Service Pro", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (companyData?.whatsapp) doc.text(`WhatsApp: ${companyData.whatsapp}`, 14, 30);
    if (companyData?.email) doc.text(`Email: ${companyData.email}`, 14, 36);

    doc.text(`Orçamento Nº ${quote.quote_number}`, pageWidth - 14, 20, { align: "right" });
    doc.text(`Data: ${format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 14, 30, { align: "right" });

    // Client info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(quote.clients?.name || "Não informado", 40, 55);

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(quote.title, 14, 70);
    
    if (quote.description) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(quote.description, 14, 78);
    }

    // Items table
    const tableData = (quote.items as QuoteItem[]).map((item) => [
      item.description,
      item.quantity.toString(),
      `R$ ${item.unit_price.toFixed(2)}`,
      `R$ ${item.total.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["Descrição", "Qtd", "Valor Unit.", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [0, 150, 200] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(11);
    doc.text(`Subtotal: R$ ${quote.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" });
    
    if (quote.discount_percentage > 0) {
      doc.text(`Desconto (${quote.discount_percentage}%): -R$ ${quote.discount_value.toFixed(2)}`, pageWidth - 14, finalY + 7, { align: "right" });
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`TOTAL: R$ ${quote.total.toFixed(2)}`, pageWidth - 14, finalY + 18, { align: "right" });

    // Validity
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Validade: ${quote.validity_days} dias`, 14, finalY + 30);

    if (quote.notes) {
      doc.text("Observações:", 14, finalY + 40);
      doc.text(quote.notes, 14, finalY + 47);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text("Este orçamento foi gerado pelo sistema AC Service Pro", pageWidth / 2, 285, { align: "center" });

    doc.save(`orcamento-${quote.quote_number}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  const sendWhatsApp = (quote: Quote) => {
    if (!quote.clients?.telefone) {
      toast.error("Cliente não possui telefone cadastrado");
      return;
    }

    const phone = quote.clients.telefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá! Segue o orçamento Nº ${quote.quote_number}:\n\n` +
      `*${quote.title}*\n` +
      `${quote.description || ""}\n\n` +
      `*Itens:*\n` +
      (quote.items as QuoteItem[]).map(item => 
        `• ${item.description}: ${item.quantity}x R$ ${item.unit_price.toFixed(2)} = R$ ${item.total.toFixed(2)}`
      ).join("\n") +
      `\n\n*Subtotal:* R$ ${quote.subtotal.toFixed(2)}` +
      (quote.discount_percentage > 0 ? `\n*Desconto:* ${quote.discount_percentage}%` : "") +
      `\n*TOTAL:* R$ ${quote.total.toFixed(2)}` +
      `\n\nValidade: ${quote.validity_days} dias` +
      `\n\n_${companyData?.company_name || "AC Service Pro"}_`
    );

    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pendente: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
      aprovado: "bg-green-500/20 text-green-600 border-green-500/30",
      recusado: "bg-red-500/20 text-red-600 border-red-500/30",
      expirado: "bg-gray-500/20 text-gray-600 border-gray-500/30",
    };
    return <Badge className={styles[status] || styles.pendente}>{status}</Badge>;
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Orçamentos
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Novo Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Orçamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente</Label>
                    <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Validade (dias)</Label>
                    <Input
                      type="number"
                      value={formData.validity_days}
                      onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 30 })}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <Label>Título do Orçamento</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Instalação de Split 12000 BTUs"
                    className="min-h-[44px]"
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes do serviço..."
                    rows={2}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Itens do Orçamento</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                          className="col-span-5 min-h-[44px]"
                          placeholder="Descrição"
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                        />
                        <Input
                          className="col-span-2 min-h-[44px]"
                          type="number"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                        />
                        <Input
                          className="col-span-2 min-h-[44px]"
                          type="number"
                          step="0.01"
                          placeholder="Valor"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                        <div className="col-span-2 text-right font-medium">
                          R$ {item.total.toFixed(2)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Desconto (%)</Label>
                    <Input
                      type="number"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">Subtotal: R$ {totals.subtotal.toFixed(2)}</div>
                    {formData.discount_percentage > 0 && (
                      <div className="text-sm text-muted-foreground">Desconto: -R$ {totals.discountValue.toFixed(2)}</div>
                    )}
                    <div className="text-lg font-bold text-primary">Total: R$ {totals.total.toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações adicionais..."
                    rows={2}
                  />
                </div>

                <Button 
                  onClick={() => createQuote.mutate()} 
                  disabled={!formData.title || items.every(i => !i.description)}
                  className="w-full min-h-[44px]"
                >
                  Criar Orçamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : quotes?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum orçamento cadastrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes?.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number}</TableCell>
                      <TableCell>{quote.title}</TableCell>
                      <TableCell>{quote.clients?.name || "-"}</TableCell>
                      <TableCell className="font-medium">R$ {quote.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Select
                          value={quote.status}
                          onValueChange={(value) => updateStatus.mutate({ id: quote.id, status: value })}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="recusado">Recusado</SelectItem>
                            <SelectItem value="expirado">Expirado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => generatePDF(quote)}
                            title="Gerar PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-green-600"
                            onClick={() => sendWhatsApp(quote)}
                            title="Enviar WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => {
                              if (confirm("Excluir este orçamento?")) {
                                deleteQuote.mutate(quote.id);
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
