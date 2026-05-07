
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const supplierSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  contact_person: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email("Formato de email inválido.").optional().or(z.literal('')),
  cnpj_cpf: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSupplier: (supplier: any) => void;
  isPending: boolean;
  userId: string;
  defaultValues?: Partial<SupplierFormValues>;
  isEdit?: boolean;
}

const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({ open, onOpenChange, onAddSupplier, isPending, userId, defaultValues, isEdit }) => {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact_person: "",
      contact: "",
      email: "",
      cnpj_cpf: "",
      address: "",
      website: "",
      payment_terms: "",
      notes: "",
      ...defaultValues,
    },
  });

  React.useEffect(() => {
    if (open && defaultValues) {
      form.reset({ name: "", contact_person: "", contact: "", email: "", cnpj_cpf: "", address: "", website: "", payment_terms: "", notes: "", ...defaultValues });
    } else if (open && !defaultValues) {
      form.reset({ name: "", contact_person: "", contact: "", email: "", cnpj_cpf: "", address: "", website: "", payment_terms: "", notes: "" });
    }
  }, [open, defaultValues]);

  const onSubmit = (values: SupplierFormValues) => {
    const supplierData = {
      name: values.name,
      contact: values.contact || null,
      email: values.email || null,
      contact_person: values.contact_person || null,
      cnpj_cpf: values.cnpj_cpf || null,
      address: values.address || null,
      website: values.website || null,
      payment_terms: values.payment_terms || null,
      notes: values.notes || null,
      user_id: userId,
    };
    onAddSupplier(supplierData);
    if (!isPending) {
      form.reset();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Fornecedor" : "Adicionar Novo Fornecedor"}</DialogTitle>
          <DialogDescription>
            Preencha as informações completas do fornecedor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: EletroPeças LTDA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cnpj_cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0001-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pessoa de Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do vendedor / representante" {...field} />
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
                    <FormLabel>Telefone / WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site / Loja Online</FormLabel>
                    <FormControl>
                      <Input placeholder="www.fornecedor.com.br" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, bairro, cidade - UF" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condições de Pagamento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 30/60/90 dias, PIX à vista, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotações sobre o fornecedor..." className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSupplierDialog;
