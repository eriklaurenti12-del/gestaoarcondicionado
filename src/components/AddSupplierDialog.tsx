
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TablesInsert } from "@/integrations/supabase/types";

const supplierSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  contact: z.string().optional(),
  email: z.string().email("Formato de email inválido.").optional().or(z.literal('')),
});

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSupplier: (supplier: TablesInsert<'suppliers'>) => void;
  isPending: boolean;
}

const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({ open, onOpenChange, onAddSupplier, isPending }) => {
  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact: "",
      email: "",
    },
  });

  const onSubmit = (values: z.infer<typeof supplierSchema>) => {
    const supplierData: TablesInsert<'suppliers'> = {
      name: values.name,
      contact: values.contact || null,
      email: values.email || null,
    };
    onAddSupplier(supplierData);
    if (!isPending) {
        form.reset();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Novo Fornecedor</DialogTitle>
          <DialogDescription>
            Preencha as informações do novo fornecedor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Fornecedor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: EletroPeças" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contato (Telefone)</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="contato@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Adicionando..." : "Adicionar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSupplierDialog;
