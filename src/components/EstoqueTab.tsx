import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Search, Package, AlertTriangle, RefreshCw, MapPin, FileDown } from "lucide-react";
import { Tables } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Product = Tables<'products'>;

const EstoqueTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*, suppliers(name)').order('name');
      if (error) throw error;
      return data;
    }
  });

  const updateQtyMutation = useMutation({
    mutationFn: async ({ id, qty }: { id: number; qty: number }) => {
      const { error } = await supabase.from('products').update({ qty }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: "Estoque atualizado!" });
    }
  });

  const pieces = React.useMemo(() => {
    if (!products) return [];
    return products
      .filter((p: any) => p.type === 'piece')
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));
  }, [products, search]);

  const lowStockCount = pieces.filter((p: any) => p.qty <= (p.min_stock || 0)).length;
  const totalItems = pieces.reduce((sum: number, p: any) => sum + p.qty, 0);

  const exportStockPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Estoque', 14, 22);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Total itens: ${totalItems} | Alertas: ${lowStockCount}`, 14, 30);

    const tableData = pieces.map((p: any) => [
      p.name,
      p.qty,
      p.min_stock || '-',
      p.storage_location || '-',
      p.storage_shelf || '-',
      p.storage_section || '-',
      (p as any).suppliers?.name || '-',
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Produto', 'Qtd', 'Mín', 'Local', 'Prateleira', 'Seção', 'Fornecedor']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });
    doc.save('estoque.pdf');
    toast({ title: "PDF de estoque exportado!" });
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{pieces.length}</p>
            <p className="text-xs text-muted-foreground">Tipos de Peças</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-xs text-muted-foreground">Total em Estoque</p>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? 'border-orange-400' : ''}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <p className="text-2xl font-bold">{lowStockCount}</p>
            <p className="text-xs text-muted-foreground">Estoque Baixo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Controle de Estoque
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })}>
                <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
              </Button>
              <Button size="sm" variant="outline" onClick={exportStockPDF}>
                <FileDown className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar peça por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[700px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Mín</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : pieces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma peça em estoque
                      </TableCell>
                    </TableRow>
                  ) : pieces.map((product: any) => {
                    const isLow = product.qty <= (product.min_stock || 0);
                    return (
                      <TableRow key={product.id} className={isLow ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Package className="w-3 h-3" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.barcode && <p className="text-[10px] text-muted-foreground">{product.barcode}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isLow ? "destructive" : "secondary"} className="text-xs">
                            {product.qty}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {product.min_stock || '-'}
                        </TableCell>
                        <TableCell>
                          {product.storage_location || product.storage_shelf || product.storage_section ? (
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span>{[product.storage_location, product.storage_shelf, product.storage_section].filter(Boolean).join(' / ')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {product.suppliers?.name || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Input
                              type="number"
                              min="0"
                              defaultValue={product.qty}
                              className="h-7 w-16 text-xs text-center"
                              onBlur={(e) => {
                                const newQty = parseInt(e.target.value);
                                if (!isNaN(newQty) && newQty !== product.qty) {
                                  updateQtyMutation.mutate({ id: product.id, qty: newQty });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstoqueTab;
