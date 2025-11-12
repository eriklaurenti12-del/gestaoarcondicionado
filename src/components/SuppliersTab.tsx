
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import AddSupplierDialog from './AddSupplierDialog';
import { TablesInsert } from '@/integrations/supabase/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";

const fetchSuppliers = async () => {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) {
    console.error('Error fetching suppliers:', error);
    throw new Error(error.message);
  }
  return data;
};

const addSupplier = async (supplier: TablesInsert<'suppliers'>) => {
  const { error } = await supabase.from('suppliers').insert(supplier);
  if (error) {
    console.error('Error adding supplier:', error);
    throw new Error(error.message);
  }
};

const deleteSupplier = async (supplierId: number) => {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .eq('supplier_id', supplierId)
    .limit(1);

  if (productsError) {
    console.error('Error checking products for supplier:', productsError);
    throw new Error(productsError.message);
  }

  if (products.length > 0) {
    throw new Error('Não é possível remover o fornecedor, pois ele está associado a um ou mais produtos.');
  }

  const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
  if (error) {
    console.error('Error deleting supplier:', error);
    throw new Error(error.message);
  }
};

const SuppliersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: suppliers, isLoading, isError, error } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });

  const addMutation = useMutation({
    mutationFn: addSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: "Sucesso!", description: "Fornecedor adicionado." });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar fornecedor.",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: "Sucesso!", description: "Fornecedor removido." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover fornecedor.",
        description: error.message,
      });
    },
  });

  const handleDeleteSupplier = (supplierId: number) => {
    if (window.confirm("Tem certeza que deseja remover este fornecedor?")) {
      deleteMutation.mutate(supplierId);
    }
  };

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Fornecedores
            <Button onClick={() => setIsAddDialogOpen(true)}>
              Adicionar Fornecedor
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Button size="sm" variant="outline" disabled><Trash2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))
              ) : suppliers?.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contact || "N/A"}</TableCell>
                  <TableCell>{supplier.email || "N/A"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSupplier(supplier.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddSupplierDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddSupplier={(supplier) => addMutation.mutate(supplier)}
        isPending={addMutation.isPending}
      />
    </div>
  );
};

export default SuppliersTab;
