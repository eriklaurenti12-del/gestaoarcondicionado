import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { recordFinancialEntry } from '@/utils/financialHelpers';
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
import { Plus, Trash2, FileText, Send, Printer, Eye, PenTool, Wrench, Package, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  description: string | null;
  services: ServiceItem[];
  parts: ServiceItem[];
  services_total: number;
  parts_total: number;
  discount_percentage: number;
  discount_value: number;
  total: number;
  status: string;
  signature_data: string | null;
  signed_at: string | null;
  notes: string | null;
  quote_id: string | null;
  created_at: string;
  clients?: { name: string; telefone: string | null; address: string | null } | null;
}

export default function ServiceOrdersTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<ServiceOrder | null>(null);
  const [signatureOrder, setSignatureOrder] = useState<ServiceOrder | null>(null);
  const [scheduleOrder, setScheduleOrder] = useState<ServiceOrder | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // New client creation
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const [formData, setFormData] = useState({
    client_id: "",
    title: "",
    description: "",
    notes: "",
    discount_percentage: 0,
    vencimento_recorrencia: "nenhum",
    data_proximo_servico: "",
  });
  
  const [services, setServices] = useState<ServiceItem[]>([
    { description: "", quantity: 1, unit_price: 0, total: 0 }
  ]);
  const [parts, setParts] = useState<ServiceItem[]>([]);

  // Fetch service orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("service_orders")
        .select(`*, clients(name, telefone, address)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((o: any) => ({
        ...o,
        services: (o.services as unknown as ServiceItem[]) || [],
        parts: (o.parts as unknown as ServiceItem[]) || [],
      })) as ServiceOrder[];
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

  // Fetch products (services and parts)
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, type")
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

  const productServices = products?.filter(p => p.type === 'service') || [];
  const productParts = products?.filter(p => p.type === 'piece') || [];

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const servicesTotal = services.reduce((sum, item) => sum + item.total, 0);
      const partsTotal = parts.reduce((sum, item) => sum + item.total, 0);
      const subtotal = servicesTotal + partsTotal;
      const discountValue = (subtotal * formData.discount_percentage) / 100;
      const total = subtotal - discountValue;

      const { error } = await supabase.from("service_orders").insert([{
        user_id: userData.user.id,
        client_id: formData.client_id ? parseInt(formData.client_id) : null,
        title: formData.title,
        description: formData.description || null,
        services: JSON.parse(JSON.stringify(services.filter(s => s.description))),
        parts: JSON.parse(JSON.stringify(parts.filter(p => p.description))),
        services_total: servicesTotal,
        parts_total: partsTotal,
        discount_percentage: formData.discount_percentage,
        discount_value: discountValue,
        total,
        notes: formData.notes || null,
        status: "pendente",
        vencimento_recorrencia: formData.vencimento_recorrencia !== 'nenhum' ? formData.vencimento_recorrencia : null,
        data_proximo_servico: formData.data_proximo_servico || null,
      }]);

      if (error) throw error;

      // If there's a next service date, we can also create a 'futura' appointment
      if (formData.data_proximo_servico && formData.client_id) {
        await supabase.from("appointments").insert([{
          user_id: userData.user.id,
          client_id: parseInt(formData.client_id),
          appointment_date: formData.data_proximo_servico + 'T09:00:00',
          status: 'futura',
          notes: `Lembrete de Manutenção (${formData.vencimento_recorrencia})\nGerado a partir do Pedido de ${formData.title}`
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      toast.success("Pedido criado!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Update status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, order }: { id: string; status: string; order?: ServiceOrder }) => {
      const { error } = await supabase
        .from("service_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      if (status === 'concluido' && order) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await recordFinancialEntry({
            userId: userData.user.id,
            type: 'entrada',
            amount: Number(order.total),
            description: `Pedido Concluído #${order.order_number}: ${order.title}`,
            paymentMethod: 'Dinheiro', // Default
            category: 'Serviço',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-records"] });
      toast.success("Status atualizado!");
    },
  });

  // Save signature
  const saveSignature = useMutation({
    mutationFn: async ({ id, signatureData, order }: { id: string; signatureData: string; order?: ServiceOrder }) => {
      const { error } = await supabase
        .from("service_orders")
        .update({ 
          signature_data: signatureData, 
          signed_at: new Date().toISOString(),
          status: 'concluido'
        })
        .eq("id", id);
      if (error) throw error;

      if (order) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await recordFinancialEntry({
            userId: userData.user.id,
            type: 'entrada',
            amount: Number(order.total),
            description: `Pedido Concluído (Assinado) #${order.order_number}: ${order.title}`,
            paymentMethod: 'Dinheiro', // Default
            category: 'Serviço',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-records"] });
      toast.success("Assinatura salva!");
      setSignatureOrder(null);
    },
  });

  // Delete order
  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      toast.success("Pedido excluído!");
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: "",
      title: "",
      description: "",
      notes: "",
      discount_percentage: 0,
      vencimento_recorrencia: "nenhum",
      data_proximo_servico: "",
    });
    setServices([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
    setParts([]);
    setIsCreatingNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
    setNewClientAddress("");
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
  
  // Schedule appointment from Pedido
  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!scheduleOrder || !scheduleDate) throw new Error("Dados incompletos");
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const dateTimeObj = new Date(scheduleDate);
      const now = new Date();
      if (dateTimeObj <= now) {
        throw new Error("Não é possível agendar em datas/horários passados. Selecione um horário futuro.");
      }

      const { error } = await supabase.from("appointments").insert({
        user_id: userData.user.id,
        client_id: scheduleOrder.client_id,
        appointment_date: scheduleDate,
        notes: `Pedido #${scheduleOrder.order_number}: ${scheduleOrder.title}\nTotal: R$ ${scheduleOrder.total.toFixed(2)}\n${scheduleNotes}`,
        status: 'pendente'
      });

      if (error) throw error;

      // Add a financial record for the scheduled order using helper
      await recordFinancialEntry({
        userId: userData.user.id,
        type: 'entrada',
        amount: Number(scheduleOrder.total),
        description: `Pedido Agendado #${scheduleOrder.order_number}: ${scheduleOrder.title}`,
        paymentMethod: 'Dinheiro', // Default
        category: 'Serviço',
      });

      // Update order status to em_andamento
      await supabase.from("service_orders").update({ status: 'em_andamento' }).eq("id", scheduleOrder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado!");
      setScheduleOrder(null);
      setScheduleDate('');
      setScheduleNotes('');
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const addService = () => {
    setServices([...services, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const addPart = () => {
    setParts([...parts, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeService = (index: number) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: keyof ServiceItem, value: string | number) => {
    const newItems = [...services];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    setServices(newItems);
  };

  const updatePart = (index: number, field: keyof ServiceItem, value: string | number) => {
    const newItems = [...parts];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    setParts(newItems);
  };

  const selectProduct = (index: number, productId: string, type: 'service' | 'part') => {
    const product = products?.find(p => p.id === parseInt(productId));
    if (!product) return;
    
    if (type === 'service') {
      const newItems = [...services];
      newItems[index] = { 
        id: product.id,
        description: product.name, 
        quantity: 1, 
        unit_price: product.price, 
        total: product.price 
      };
      setServices(newItems);
    } else {
      const newItems = [...parts];
      newItems[index] = { 
        id: product.id,
        description: product.name, 
        quantity: 1, 
        unit_price: product.price, 
        total: product.price 
      };
      setParts(newItems);
    }
  };

  const calculateTotals = () => {
    const servicesTotal = services.reduce((sum, item) => sum + item.total, 0);
    const partsTotal = parts.reduce((sum, item) => sum + item.total, 0);
    const subtotal = servicesTotal + partsTotal;
    const discountValue = (subtotal * formData.discount_percentage) / 100;
    const total = subtotal - discountValue;
    return { servicesTotal, partsTotal, subtotal, discountValue, total };
  };

  // Canvas signature functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !signatureOrder) return;
    const signatureData = canvas.toDataURL('image/png');
    saveSignature.mutate({ id: signatureOrder.id, signatureData, order: signatureOrder });
  };

  const generatePDF = (order: ServiceOrder) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
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
    doc.text(`PEDIDO DE SERVIÇO Nº ${order.order_number}`, pageWidth - 14, 18, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 14, 26, { align: "right" });
    
    const statusText = order.status === 'concluido' ? 'CONCLUÍDO' : order.status.toUpperCase();
    doc.text(`Status: ${statusText}`, pageWidth - 14, 32, { align: "right" });

    // Client info
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(order.clients?.name || "Não informado", 40, 55);
    
    if (order.clients?.address) {
      doc.text(`Endereço: ${order.clients.address}`, 14, 61);
    }
    if (order.clients?.telefone) {
      doc.text(`Telefone: ${order.clients.telefone}`, 14, 67);
    }

    // Title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(order.title, 14, 80);
    
    if (order.description) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(order.description, 14, 87);
    }

    let currentY = 95;

    // Services table
    if (order.services.length > 0) {
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("SERVIÇOS", 14, currentY);
      
      const servicesData = order.services.map((item) => [
        item.description,
        item.quantity.toString(),
        `R$ ${item.unit_price.toFixed(2)}`,
        `R$ ${item.total.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [["Descrição", "Qtd", "Valor Unit.", "Total"]],
        body: servicesData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Parts table
    if (order.parts.length > 0) {
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("PEÇAS/PRODUTOS", 14, currentY);
      
      const partsData = order.parts.map((item) => [
        item.description,
        item.quantity.toString(),
        `R$ ${item.unit_price.toFixed(2)}`,
        `R$ ${item.total.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [["Descrição", "Qtd", "Valor Unit.", "Total"]],
        body: partsData,
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Totals
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Serviços: R$ ${order.services_total.toFixed(2)}`, pageWidth - 14, currentY, { align: "right" });
    doc.text(`Peças: R$ ${order.parts_total.toFixed(2)}`, pageWidth - 14, currentY + 6, { align: "right" });
    
    if (order.discount_percentage > 0) {
      doc.text(`Desconto (${order.discount_percentage}%): -R$ ${order.discount_value.toFixed(2)}`, pageWidth - 14, currentY + 12, { align: "right" });
      currentY += 6;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`TOTAL: R$ ${order.total.toFixed(2)}`, pageWidth - 14, currentY + 18, { align: "right" });

    currentY += 30;

    // Notes
    if (order.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Observações:", 14, currentY);
      doc.text(order.notes, 14, currentY + 6);
      currentY += 20;
    }

    // Signature
    if (order.signature_data) {
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text("Assinatura do Cliente:", 14, currentY);
      doc.addImage(order.signature_data, 'PNG', 14, currentY + 2, 60, 30);
      doc.setFontSize(8);
      doc.text(`Assinado em: ${format(new Date(order.signed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, currentY + 35);
    } else {
      // Signature line
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text("Assinatura do Cliente:", 14, currentY);
      doc.line(14, currentY + 20, 100, currentY + 20);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 285, { align: "center" });

    doc.save(`os-${order.order_number}.pdf`);
    toast.success("PDF gerado!");
  };

  const sendWhatsApp = (order: ServiceOrder) => {
    if (!order.clients?.telefone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }

    const phone = order.clients.telefone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    
    const message = `*PEDIDO DE SERVIÇO Nº ${order.order_number}*\n` +
      `_${companyData?.company_name || "AC Service Pro"}_\n\n` +
      `*${order.title}*\n` +
      `${order.description || ""}\n\n` +
      (order.services.length > 0 ? `*Serviços:*\n${order.services.map(s => 
        `• ${s.description}: ${s.quantity}x R$ ${s.unit_price.toFixed(2)} = R$ ${s.total.toFixed(2)}`
      ).join("\n")}\n\n` : "") +
      (order.parts.length > 0 ? `*Peças:*\n${order.parts.map(p => 
        `• ${p.description}: ${p.quantity}x R$ ${p.unit_price.toFixed(2)} = R$ ${p.total.toFixed(2)}`
      ).join("\n")}\n\n` : "") +
      `*Serviços:* R$ ${order.services_total.toFixed(2)}\n` +
      `*Peças:* R$ ${order.parts_total.toFixed(2)}\n` +
      (order.discount_percentage > 0 ? `*Desconto:* ${order.discount_percentage}%\n` : "") +
      `*TOTAL:* R$ ${order.total.toFixed(2)}\n\n` +
      `Status: ${order.status === 'concluido' ? '✅ Concluído' : '⏳ ' + order.status}` +
      (order.signed_at ? `\n✍️ Assinado em ${format(new Date(order.signed_at), "dd/MM/yyyy", { locale: ptBR })}` : "");

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pendente: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
      em_andamento: "bg-blue-500/20 text-blue-600 border-blue-500/30",
      concluido: "bg-green-500/20 text-green-600 border-green-500/30",
      cancelado: "bg-red-500/20 text-red-600 border-red-500/30",
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
            Pedidos de Serviço
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Pedido de Serviço</DialogTitle>
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
                  <Label>Título</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Manutenção Split 12000 BTUs"
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

                {/* Services Section */}
                <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Wrench className="w-4 h-4" />
                      Serviços
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addService}>
                      <Plus className="w-4 h-4 mr-1" /> Serviço
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {services.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <Select 
                          value={item.id?.toString() || ""} 
                          onValueChange={(v) => selectProduct(index, v, 'service')}
                        >
                          <SelectTrigger className="col-span-5 min-h-[44px]">
                            <SelectValue placeholder="Selecionar serviço" />
                          </SelectTrigger>
                          <SelectContent>
                            {productServices.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} - R$ {p.price.toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="col-span-2 min-h-[44px]"
                          type="number"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => updateService(index, "quantity", parseInt(e.target.value) || 0)}
                        />
                        <Input
                          className="col-span-2 min-h-[44px]"
                          type="number"
                          step="0.01"
                          placeholder="Valor"
                          value={item.unit_price}
                          onChange={(e) => updateService(index, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                        <div className="col-span-2 text-right font-medium text-sm">
                          R$ {item.total.toFixed(2)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => removeService(index)}
                          disabled={services.length === 1}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="text-right mt-2 font-medium text-blue-700 dark:text-blue-400">
                    Subtotal Serviços: R$ {totals.servicesTotal.toFixed(2)}
                  </div>
                </div>

                {/* Parts Section */}
                <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Package className="w-4 h-4" />
                      Peças/Produtos
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addPart}>
                      <Plus className="w-4 h-4 mr-1" /> Peça
                    </Button>
                  </div>
                  {parts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhuma peça adicionada</p>
                  ) : (
                    <div className="space-y-2">
                      {parts.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <Select 
                            value={item.id?.toString() || ""} 
                            onValueChange={(v) => selectProduct(index, v, 'part')}
                          >
                            <SelectTrigger className="col-span-5 min-h-[44px]">
                              <SelectValue placeholder="Selecionar peça" />
                            </SelectTrigger>
                            <SelectContent>
                              {productParts.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.name} - R$ {p.price.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="col-span-2 min-h-[44px]"
                            type="number"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) => updatePart(index, "quantity", parseInt(e.target.value) || 0)}
                          />
                          <Input
                            className="col-span-2 min-h-[44px]"
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={item.unit_price}
                            onChange={(e) => updatePart(index, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                          <div className="col-span-2 text-right font-medium text-sm">
                            R$ {item.total.toFixed(2)}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="col-span-1"
                            onClick={() => removePart(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {parts.length > 0 && (
                    <div className="text-right mt-2 font-medium text-green-700 dark:text-green-400">
                      Subtotal Peças: R$ {totals.partsTotal.toFixed(2)}
                    </div>
                  )}
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
                  onClick={() => createOrder.mutate()} 
                  disabled={!formData.title || services.every(s => !s.description)}
                  className="w-full min-h-[44px]"
                >
                  Criar Pedido
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : orders?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum Pedido
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
                  {orders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.title}</TableCell>
                      <TableCell>{order.clients?.name || "-"}</TableCell>
                      <TableCell className="font-medium">R$ {order.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value) => updateStatus.mutate({ id: order.id, status: value, order })}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pendente">Agendado</SelectItem>
                            <SelectItem value="em_andamento">Em Andamento</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setViewOrder(order)}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-blue-600"
                            onClick={() => setScheduleOrder(order)}
                            title="Agendar"
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setSignatureOrder(order)}
                            title="Assinar"
                          >
                            <PenTool className="w-4 h-4 text-purple-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => generatePDF(order)}
                            title="PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-green-600"
                            onClick={() => sendWhatsApp(order)}
                            title="WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => {
                              if (confirm("Excluir este Pedido?")) {
                                deleteOrder.mutate(order.id);
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

      {/* View Order Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido #{viewOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {viewOrder && (
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
                <h3 className="font-bold">{viewOrder.title}</h3>
                {viewOrder.description && <p className="text-sm text-muted-foreground mt-1">{viewOrder.description}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewOrder.clients?.name || '-'}</p>
                  {viewOrder.clients?.telefone && (
                    <p className="text-xs text-muted-foreground">{viewOrder.clients.telefone}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">{format(new Date(viewOrder.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  <p className="text-xs">{getStatusBadge(viewOrder.status)}</p>
                </div>
              </div>

              {viewOrder.services.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Serviços
                  </p>
                  <div className="border rounded-lg divide-y">
                    {viewOrder.services.map((item, i) => (
                      <div key={i} className="p-2 flex justify-between text-sm">
                        <span>{item.description} x{item.quantity}</span>
                        <span className="font-medium">R$ {item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewOrder.parts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Peças
                  </p>
                  <div className="border rounded-lg divide-y">
                    {viewOrder.parts.map((item, i) => (
                      <div key={i} className="p-2 flex justify-between text-sm">
                        <span>{item.description} x{item.quantity}</span>
                        <span className="font-medium">R$ {item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-right space-y-1">
                <p className="text-sm text-blue-600">Serviços: R$ {viewOrder.services_total.toFixed(2)}</p>
                <p className="text-sm text-green-600">Peças: R$ {viewOrder.parts_total.toFixed(2)}</p>
                {viewOrder.discount_percentage > 0 && (
                  <p className="text-sm text-orange-600">Desconto: -{viewOrder.discount_percentage}%</p>
                )}
                <p className="text-lg font-bold">Total: R$ {viewOrder.total.toFixed(2)}</p>
              </div>

              {viewOrder.signature_data && (
                <div className="p-2 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Assinatura:</p>
                  <img src={viewOrder.signature_data} alt="Assinatura" className="max-h-16" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Assinado em {format(new Date(viewOrder.signed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}

              {viewOrder.notes && (
                <div className="p-2 bg-muted/50 rounded text-sm">
                  <p className="text-muted-foreground">Obs:</p>
                  <p>{viewOrder.notes}</p>
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
                onClick={() => viewOrder && sendWhatsApp(viewOrder)}
              >
                <Send className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => viewOrder && generatePDF(viewOrder)}
              >
                <Printer className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
            {!viewOrder?.signature_data && (
              <Button 
                size="sm"
                variant="outline"
                className="w-full sm:w-auto text-blue-600 border-blue-600/30"
                onClick={() => {
                  if (viewOrder) {
                    setScheduleOrder(viewOrder);
                    setViewOrder(null);
                  }
                }}
              >
                <Calendar className="w-4 h-4 mr-2" /> Agendar
              </Button>
            )}
            {!viewOrder?.signature_data && (
              <Button 
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (viewOrder) {
                    setSignatureOrder(viewOrder);
                    setViewOrder(null);
                  }
                }}
              >
                <PenTool className="w-4 h-4 mr-2" /> Assinar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleOrder} onOpenChange={() => setScheduleOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Pedido #{scheduleOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{scheduleOrder?.title}</p>
              <p className="text-sm text-muted-foreground">Cliente: {scheduleOrder?.clients?.name || '-'}</p>
              <p className="font-bold mt-2">Total: R$ {scheduleOrder?.total.toFixed(2)}</p>
            </div>
            <div>
              <Label>Data e Hora *</Label>
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
            <Button variant="outline" onClick={() => setScheduleOrder(null)}>Cancelar</Button>
            <Button onClick={() => createAppointment.mutate()} disabled={!scheduleDate}>
              <Calendar className="w-4 h-4 mr-2" /> Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={!!signatureOrder} onOpenChange={() => setSignatureOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura Digital - Pedido #{signatureOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{signatureOrder?.title}</p>
              <p className="text-muted-foreground">Cliente: {signatureOrder?.clients?.name || '-'}</p>
              <p className="font-bold mt-2">Total: R$ {signatureOrder?.total.toFixed(2)}</p>
            </div>
            
            <div>
              <Label>Assinatura do Cliente</Label>
              <div className="border rounded-lg mt-2 bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={clearSignature}>
                Limpar
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOrder(null)}>Cancelar</Button>
            <Button onClick={confirmSignature}>
              <PenTool className="w-4 h-4 mr-2" /> Confirmar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
