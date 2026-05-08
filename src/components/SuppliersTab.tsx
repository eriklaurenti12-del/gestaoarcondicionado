
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, FileDown, Edit, Eye, ChevronDown, ChevronUp, Package, MessageCircle, Send } from "lucide-react";
import AddSupplierDialog from './AddSupplierDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const fetchSuppliers = async () => {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchProductsBySupplier = async (supplierId: number) => {
  const { data, error } = await supabase.from('products').select('*').eq('supplier_id', supplierId).order('name');
  if (error) throw new Error(error.message);
  return data;
};

const addSupplier = async (supplier: any) => {
  const { error } = await supabase.from('suppliers').insert(supplier);
  if (error) throw new Error(error.message);
};

const updateSupplier = async ({ id, ...supplier }: any) => {
  const { error } = await supabase.from('suppliers').update(supplier).eq('id', id);
  if (error) throw new Error(error.message);
};

const deleteSupplier = async (supplierId: number) => {
  const { data: products } = await supabase.from('products').select('id').eq('supplier_id', supplierId).limit(1);
  if (products && products.length > 0) {
    throw new Error('Não é possível remover o fornecedor, pois ele está associado a um ou mais produtos.');
  }
  const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
  if (error) throw new Error(error.message);
};

const SuppliersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [viewSupplier, setViewSupplier] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>("");
  
  // WhatsApp send dialog
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsAppName, setWhatsAppName] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUserId();
  }, []);

  const { data: suppliers, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });

  const { data: expandedProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['supplier-products', expandedId],
    queryFn: () => fetchProductsBySupplier(expandedId!),
    enabled: !!expandedId,
  });

  const addMutation = useMutation({
    mutationFn: addSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: "Sucesso!", description: "Fornecedor adicionado." });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Erro", description: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: updateSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: "Sucesso!", description: "Fornecedor atualizado." });
      setEditSupplier(null);
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Erro", description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: "Sucesso!", description: "Fornecedor removido." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Erro", description: error.message }),
  });

  const handleDeleteSupplier = (supplierId: number) => {
    if (window.confirm("Tem certeza que deseja remover este fornecedor?")) {
      deleteMutation.mutate(supplierId);
    }
  };

  const generatePDFDoc = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Fornecedores', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    const tableData = suppliers?.map(s => [
      s.name,
      (s as any).contact_person || '-',
      s.contact || '-',
      s.email || '-',
      (s as any).cnpj_cpf || '-',
    ]) || [];
    autoTable(doc, {
      startY: 35,
      head: [['Nome', 'Contato (Pessoa)', 'Telefone', 'E-mail', 'CNPJ/CPF']],
      body: tableData,
    });
    return doc;
  };

  const exportToPDF = () => {
    const doc = generatePDFDoc();
    doc.save('fornecedores.pdf');
    toast({ title: "PDF exportado!" });
  };

  const handleSendWhatsApp = () => {
    const phone = whatsAppNumber.replace(/\D/g, '');
    if (!phone) {
      toast({ variant: "destructive", title: "Número obrigatório", description: "Informe o número de WhatsApp." });
      return;
    }
    
    // Generate PDF and save it first
    const doc = generatePDFDoc();
    doc.save('fornecedores.pdf');
    
    // Build WhatsApp message
    let message = `📋 *Relatório de Fornecedores*\n\n`;
    if (whatsAppName) message += `Para: ${whatsAppName}\n`;
    message += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    suppliers?.forEach((s: any) => {
      message += `▸ *${s.name}*`;
      if (s.contact_person) message += ` (${s.contact_person})`;
      if (s.contact) message += ` - ${s.contact}`;
      message += `\n`;
    });
    
    message += `\n_Total: ${suppliers?.length || 0} fornecedores_`;
    message += `\n\n⚠️ O PDF foi salvo no dispositivo. Anexe-o manualmente nesta conversa.`;

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    toast({ title: "WhatsApp aberto!", description: "Anexe o PDF salvo manualmente." });
    setShowWhatsAppDialog(false);
    setWhatsAppName("");
    setWhatsAppNumber("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6 overflow-visible">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>Fornecedores</span>
            <div className="flex gap-2">
              <Button onClick={exportToPDF} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={() => setShowWhatsAppDialog(true)} size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar WhatsApp
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Adicionar Fornecedor
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pessoa de Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : suppliers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum fornecedor cadastrado
                      </TableCell>
                    </TableRow>
                  ) : suppliers?.map((supplier: any) => (
                    <React.Fragment key={supplier.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}>
                        <TableCell>
                          {expandedId === supplier.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact_person || "-"}</TableCell>
                        <TableCell>{supplier.contact || "-"}</TableCell>
                        <TableCell>{supplier.email || "-"}</TableCell>
                        <TableCell>{supplier.cnpj_cpf || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => setViewSupplier(supplier)} title="Ver detalhes">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditSupplier(supplier)} title="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteSupplier(supplier.id)} disabled={deleteMutation.isPending} title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedId === supplier.id && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {supplier.address && (
                                  <div><span className="font-semibold text-muted-foreground">Endereço:</span> <span>{supplier.address}</span></div>
                                )}
                                {supplier.website && (
                                  <div><span className="font-semibold text-muted-foreground">Site:</span> <span>{supplier.website}</span></div>
                                )}
                                {supplier.payment_terms && (
                                  <div><span className="font-semibold text-muted-foreground">Pagamento:</span> <span>{supplier.payment_terms}</span></div>
                                )}
                                {supplier.notes && (
                                  <div className="col-span-2"><span className="font-semibold text-muted-foreground">Obs:</span> <span>{supplier.notes}</span></div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm flex items-center gap-1 mb-2">
                                  <Package className="w-4 h-4" /> Produtos deste Fornecedor
                                </h4>
                                {isLoadingProducts ? (
                                  <Skeleton className="h-8 w-full" />
                                ) : expandedProducts && expandedProducts.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Custo</TableHead>
                                        <TableHead>Preço Venda</TableHead>
                                        <TableHead>Estoque</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {expandedProducts.map((p: any) => (
                                        <TableRow key={p.id}>
                                          <TableCell className="font-medium">{p.name}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline">{p.type === 'service' ? 'Serviço' : 'Produto'}</Badge>
                                          </TableCell>
                                          <TableCell>{formatCurrency(p.cost_price)}</TableCell>
                                          <TableCell>{formatCurrency(p.price)}</TableCell>
                                          <TableCell>{p.qty}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Nenhum produto vinculado a este fornecedor.</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <AddSupplierDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddSupplier={(supplier) => addMutation.mutate(supplier)}
        isPending={addMutation.isPending}
        userId={userId}
      />

      {/* Edit Dialog */}
      {editSupplier && (
        <AddSupplierDialog
          open={!!editSupplier}
          onOpenChange={(open) => { if (!open) setEditSupplier(null); }}
          onAddSupplier={(supplier) => updateMutation.mutate({ id: editSupplier.id, ...supplier })}
          isPending={updateMutation.isPending}
          userId={userId}
          defaultValues={{
            name: editSupplier.name || "",
            contact_person: editSupplier.contact_person || "",
            contact: editSupplier.contact || "",
            email: editSupplier.email || "",
            cnpj_cpf: editSupplier.cnpj_cpf || "",
            address: editSupplier.address || "",
            website: editSupplier.website || "",
            payment_terms: editSupplier.payment_terms || "",
            notes: editSupplier.notes || "",
          }}
          isEdit
        />
      )}

      {/* View Details Dialog */}
      {viewSupplier && (
        <Dialog open={!!viewSupplier} onOpenChange={(open) => { if (!open) setViewSupplier(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewSupplier.name}</DialogTitle>
              <DialogDescription>Detalhes do fornecedor</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold text-muted-foreground">CNPJ/CPF:</span><br/>{viewSupplier.cnpj_cpf || "-"}</div>
                <div><span className="font-semibold text-muted-foreground">Pessoa de Contato:</span><br/>{viewSupplier.contact_person || "-"}</div>
                <div><span className="font-semibold text-muted-foreground">Telefone:</span><br/>{viewSupplier.contact || "-"}</div>
                <div><span className="font-semibold text-muted-foreground">Email:</span><br/>{viewSupplier.email || "-"}</div>
                <div><span className="font-semibold text-muted-foreground">Site:</span><br/>{viewSupplier.website || "-"}</div>
                <div><span className="font-semibold text-muted-foreground">Pagamento:</span><br/>{viewSupplier.payment_terms || "-"}</div>
              </div>
              <div><span className="font-semibold text-muted-foreground">Endereço:</span><br/>{viewSupplier.address || "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Observações:</span><br/>{viewSupplier.notes || "-"}</div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* WhatsApp Send Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Enviar Relatório via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Informe o número e nome do destinatário. O PDF será salvo e você poderá anexá-lo na conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Destinatário</Label>
              <Input
                value={whatsAppName}
                onChange={(e) => setWhatsAppName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label>Número WhatsApp *</Label>
              <Input
                value={whatsAppNumber}
                onChange={(e) => setWhatsAppNumber(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendWhatsApp} className="bg-green-600 hover:bg-green-700" disabled={!whatsAppNumber.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuppliersTab;
