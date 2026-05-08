import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Send, Calendar, Printer, Eye, Edit, MapPin } from "lucide-react";
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
  clients?: { name: string; telefone: string | null; address: string | null } | null;
}

export default function QuotesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState<Quote | null>(null);
  const [scheduleQuote, setScheduleQuote] = useState<Quote | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  
  // New client creation
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  
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

  // AUTO-SAVE: Load from localStorage on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('quote_form_autosave');
    const savedItems = localStorage.getItem('quote_items_autosave');
    if (savedForm) setFormData(JSON.parse(savedForm));
    if (savedItems) setItems(JSON.parse(savedItems));
  }, []);

  // AUTO-SAVE: Save to localStorage on change
  useEffect(() => {
    if (!isDialogOpen) return; // Only save when editing
    localStorage.setItem('quote_form_autosave', JSON.stringify(formData));
    localStorage.setItem('quote_items_autosave', JSON.stringify(items));
  }, [formData, items, isDialogOpen]);

  const clearAutoSave = () => {
    localStorage.removeItem('quote_form_autosave');
    localStorage.removeItem('quote_items_autosave');
  };

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("quotes")
        .select(`*, clients(name, telefone, address)`)
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
      toast.success("Orçamento criado!");
      resetForm();
      clearAutoSave();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Edit quote mutation
  const updateQuote = useMutation({
    mutationFn: async () => {
      if (!editingQuoteId) throw new Error("ID do orçamento não encontrado");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const discountValue = (subtotal * formData.discount_percentage) / 100;
      const total = subtotal - discountValue;

      const { error } = await supabase.from("quotes").update({
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
      }).eq("id", editingQuoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento atualizado!");
      resetForm();
      clearAutoSave();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
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

  // Schedule appointment from quote
  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!scheduleQuote || !scheduleDate) throw new Error("Dados incompletos");
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase.from("appointments").insert({
        user_id: userData.user.id,
        client_id: scheduleQuote.client_id,
        appointment_date: scheduleDate,
        notes: `Orçamento #${scheduleQuote.quote_number}: ${scheduleQuote.title}\n[VALOR:${scheduleQuote.total}]\n${scheduleNotes}`,
        status: 'pendente'
      });

      if (error) throw error;

      // Update quote status to approved
      await supabase.from("quotes").update({ status: 'aprovado' }).eq("id", scheduleQuote.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado!");
      setScheduleQuote(null);
      setScheduleDate('');
      setScheduleNotes('');
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
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
    setIsCreatingNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
    setNewClientAddress("");
    setIsEditing(false);
    setEditingQuoteId(null);
  };
  
  const handleEditClick = (quote: Quote) => {
    setFormData({
      client_id: quote.client_id ? String(quote.client_id) : "",
      title: quote.title,
      description: quote.description || "",
      validity_days: quote.validity_days,
      notes: quote.notes || "",
      discount_percentage: quote.discount_percentage || 0,
    });
    setItems(quote.items as QuoteItem[]);
    setIsEditing(true);
    setEditingQuoteId(quote.id);
    setIsDialogOpen(true);
  };
  
  // Create new client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: { name: string; telefone: string; address: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      
      const { data, error } = await supabase
        .from('clients')
        .insert({ 
          user_id: userData.user.id, 
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setFormData(prev => ({ ...prev, client_id: String(data.id) }));
      setIsCreatingNewClient(false);
      toast.success(`Cliente ${data.name} cadastrado!`);
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar cliente: " + error.message);
    }
  });
  
  const handleCreateNewClient = () => {
    if (!newClientName.trim()) {
      toast.error("Digite o nome do cliente");
      return;
    }
    createClientMutation.mutate({
      name: newClientName.trim(),
      telefone: newClientPhone,
      address: newClientAddress
    });
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

    // Header with company info
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 45, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(companyData?.company_name || "AC Service Pro", 14, 18);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    if (companyData?.whatsapp) doc.text(`WhatsApp: ${companyData.whatsapp}`, 14, 26);
    if (companyData?.email) doc.text(`Email: ${companyData.email}`, 14, 32);
    if (companyData?.cnpj_cpf) doc.text(`CNPJ/CPF: ${companyData.cnpj_cpf}`, 14, 38);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`ORÇAMENTO Nº ${quote.quote_number}`, pageWidth - 14, 18, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 14, 26, { align: "right" });
    doc.text(`Validade: ${quote.validity_days} dias`, pageWidth - 14, 32, { align: "right" });

    // Client info
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(quote.clients?.name || "Não informado", 40, 55);
    
    if (quote.clients?.address) {
      doc.text(quote.clients.address, 40, 61);
    }

    // Title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(quote.title, 14, 75);
    
    if (quote.description) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(quote.description, 14, 82);
    }

    // Items table
    const tableData = (quote.items as QuoteItem[]).map((item) => [
      item.description,
      item.quantity.toString(),
      `R$ ${item.unit_price.toFixed(2)}`,
      `R$ ${item.total.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 90,
      head: [["Descrição", "Qtd", "Valor Unit.", "Total"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Subtotal: R$ ${quote.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" });
    
    if (quote.discount_percentage > 0) {
      doc.text(`Desconto (${quote.discount_percentage}%): -R$ ${quote.discount_value.toFixed(2)}`, pageWidth - 14, finalY + 6, { align: "right" });
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`TOTAL: R$ ${quote.total.toFixed(2)}`, pageWidth - 14, finalY + 16, { align: "right" });

    if (quote.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Observações:", 14, finalY + 30);
      doc.text(quote.notes, 14, finalY + 36);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 285, { align: "center" });

    doc.save(`orcamento-${quote.quote_number}.pdf`);
    toast.success("PDF gerado!");
  };

  const sendWhatsApp = (quote: Quote) => {
    if (!quote.clients?.telefone) {
      toast.error("Cliente sem telefone");
      return;
    }

    const phone = quote.clients.telefone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    
    const message = `Olá! Segue o orçamento Nº ${quote.quote_number}:\n\n` +
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
      `\n\n_${companyData?.company_name || "AC Service Pro"}_`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pendente: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
      aprovado: "bg-green-500/20 text-green-600 border-green-500/30",
      agendado: "bg-blue-500/20 text-blue-600 border-blue-500/30",
      concluido: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
      recusado: "bg-red-500/20 text-red-600 border-red-500/30",
      expirado: "bg-gray-500/20 text-gray-600 border-gray-500/30",
    };
    const labels: Record<string, string> = {
      pendente: "Pendente",
      aprovado: "Aprovado",
      agendado: "Agendado",
      concluido: "Concluído",
      recusado: "Recusado",
      expirado: "Expirado",
    };
    return <Badge className={styles[status] || styles.pendente}>{labels[status] || status}</Badge>;
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
                <DialogTitle>{isEditing ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Client Section with New Client Option */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Cliente</Label>
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
                        {createClientMutation.isPending ? "Cadastrando..." : "Cadastrar e Selecionar"}
                      </Button>
                    </div>
                  ) : (
                    <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name} {client.telefone && `- ${client.telefone}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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

                <div>
                  <Label>Título</Label>
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
                    <Label>Itens</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-1" /> Item
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
                        <div className="col-span-2 text-right font-medium text-sm">
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
                  <div className="text-right space-y-1 pt-4">
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
                    placeholder="Observações..."
                    rows={2}
                  />
                </div>

                <Button 
                  onClick={() => isEditing ? updateQuote.mutate() : createQuote.mutate()} 
                  disabled={!formData.title || items.every(i => !i.description) || createQuote.isPending || updateQuote.isPending}
                  className="w-full min-h-[44px]"
                >
                  {isEditing ? "Atualizar Orçamento" : "Salvar Orçamento"}
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
              Nenhum orçamento
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
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="agendado">Agendado</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                            <SelectItem value="recusado">Recusado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setViewQuote(quote)}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(quote)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setScheduleQuote(quote)}
                            title="Agendar"
                          >
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => generatePDF(quote)}
                            title="PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-green-600"
                            onClick={() => sendWhatsApp(quote)}
                            title="WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          {quote.clients?.address && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-blue-600"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(quote.clients!.address!)}`, '_blank')}
                              title="Ver no Mapa"
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* View Quote Dialog */}
      <Dialog open={!!viewQuote} onOpenChange={() => setViewQuote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Orçamento #{viewQuote?.quote_number}</DialogTitle>
          </DialogHeader>
          {viewQuote && (
            <div className="space-y-4">
              {/* Company Header */}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <h3 className="font-bold text-primary">{companyData?.company_name || "AC Service Pro"}</h3>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {companyData?.whatsapp && <p>WhatsApp: {companyData.whatsapp}</p>}
                  {companyData?.cnpj_cpf && <p>CNPJ/CPF: {companyData.cnpj_cpf}</p>}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <h3 className="font-bold">{viewQuote.title}</h3>
                {viewQuote.description && <p className="text-sm text-muted-foreground mt-1">{viewQuote.description}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewQuote.clients?.name || '-'}</p>
                  {viewQuote.clients?.telefone && (
                    <p className="text-xs text-muted-foreground">{viewQuote.clients.telefone}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">{format(new Date(viewQuote.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  <p className="text-xs text-muted-foreground">Validade: {viewQuote.validity_days} dias</p>
                </div>
              </div>

              <div className="border rounded-lg divide-y">
                {(viewQuote.items as QuoteItem[]).map((item, i) => (
                  <div key={i} className="p-2 flex justify-between text-sm">
                    <span>{item.description} x{item.quantity}</span>
                    <span className="font-medium">R$ {item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-right space-y-1">
                <p className="text-sm">Subtotal: R$ {viewQuote.subtotal.toFixed(2)}</p>
                {viewQuote.discount_percentage > 0 && (
                  <p className="text-sm text-green-600">Desconto: -{viewQuote.discount_percentage}%</p>
                )}
                <p className="text-lg font-bold">Total: R$ {viewQuote.total.toFixed(2)}</p>
              </div>

              {viewQuote.notes && (
                <div className="p-2 bg-muted/50 rounded text-sm">
                  <p className="text-muted-foreground">Obs:</p>
                  <p>{viewQuote.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-none text-green-600 border-green-600/30 hover:bg-green-50"
                onClick={() => viewQuote && sendWhatsApp(viewQuote)}
              >
                <Send className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => viewQuote && generatePDF(viewQuote)}
              >
                <Printer className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
            <Button 
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                if (viewQuote) {
                  setScheduleQuote(viewQuote);
                  setViewQuote(null);
                }
              }}
            >
              <Calendar className="w-4 h-4 mr-2" /> Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleQuote} onOpenChange={() => setScheduleQuote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Orçamento #{scheduleQuote?.quote_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{scheduleQuote?.title}</p>
              <p className="text-sm text-muted-foreground">Cliente: {scheduleQuote?.clients?.name || '-'}</p>
            </div>
            <div>
              <Label>Data e Hora</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleQuote(null)}>Cancelar</Button>
            <Button onClick={() => createAppointment.mutate()} disabled={!scheduleDate}>
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}