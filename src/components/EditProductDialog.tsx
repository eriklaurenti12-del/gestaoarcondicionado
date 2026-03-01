import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { Wrench, Package, DollarSign, MapPin, Clock } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.string().min(1),
  price: z.coerce.number().min(0, 'Preço inválido'),
  cost_price: z.coerce.number().min(0, 'Custo inválido'),
  qty: z.coerce.number().min(0).default(1),
  min_stock: z.coerce.number().min(0).default(5),
  barcode: z.string().optional().nullable(),
  service_duration: z.coerce.number().min(0).optional().nullable(),
  supplier_id: z.string().optional().nullable(),
  storage_location: z.string().optional().nullable(),
  storage_shelf: z.string().optional().nullable(),
  storage_section: z.string().optional().nullable(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface EditProductDialogProps {
  product: Tables<'products'>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TablesUpdate<'products'>) => void;
}

const EditProductDialog: React.FC<EditProductDialogProps> = ({ product, isOpen, onOpenChange, onSave }) => {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {},
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const watchType = form.watch('type');
  const isService = watchType === 'service';

  useEffect(() => {
    if (product && isOpen) {
      form.reset({
        name: product.name,
        type: product.type || 'service',
        price: Number(product.price),
        cost_price: Number(product.cost_price),
        qty: product.qty,
        min_stock: product.min_stock || 5,
        barcode: product.barcode || '',
        service_duration: product.service_duration || 60,
        supplier_id: product.supplier_id ? String(product.supplier_id) : 'none',
        storage_location: product.storage_location || '',
        storage_shelf: product.storage_shelf || '',
        storage_section: product.storage_section || '',
      });
    }
  }, [product, isOpen, form]);

  const onSubmit = (data: ProductFormValues) => {
    const update: TablesUpdate<'products'> = {
      name: data.name,
      type: data.type,
      price: data.price,
      cost_price: data.cost_price,
      qty: isService ? 999 : data.qty,
      min_stock: isService ? 0 : data.min_stock,
      barcode: data.barcode || null,
      service_duration: isService ? (data.service_duration || 60) : null,
      supplier_id: data.supplier_id && data.supplier_id !== 'none' ? parseInt(data.supplier_id) : null,
      storage_location: data.storage_location || null,
      storage_shelf: data.storage_shelf || null,
      storage_section: data.storage_section || null,
    };
    onSave(update);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Editar Item
          </DialogTitle>
          <DialogDescription>Altere os dados do serviço ou produto.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="service">🔧 Prestação de Serviço</SelectItem>
                    <SelectItem value="piece">🛒 Venda / Comércio</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Nome */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Código */}
            <FormField control={form.control} name="barcode" render={({ field }) => (
              <FormItem>
                <FormLabel>Código (Opcional)</FormLabel>
                <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Preço e Custo */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cost_price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Custo (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Preço Final (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Duração (serviço) */}
            {isService && (
              <FormField control={form.control} name="service_duration" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duração (min)</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value || 60} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Estoque (peça) */}
            {!isService && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="qty" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Quantidade</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="min_stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* Fornecedor */}
            <FormField control={form.control} name="supplier_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliers?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Local */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Local de Armazenamento</p>
              <div className="grid grid-cols-3 gap-2">
                <FormField control={form.control} name="storage_location" render={({ field }) => (
                  <FormItem>
                    <FormControl><Input placeholder="Local" {...field} value={field.value || ''} className="h-8 text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="storage_shelf" render={({ field }) => (
                  <FormItem>
                    <FormControl><Input placeholder="Prateleira" {...field} value={field.value || ''} className="h-8 text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="storage_section" render={({ field }) => (
                  <FormItem>
                    <FormControl><Input placeholder="Seção" {...field} value={field.value || ''} className="h-8 text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
