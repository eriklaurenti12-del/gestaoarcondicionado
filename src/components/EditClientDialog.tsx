import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';

const clientSchema = z.object({
  name: z.string().min(1, { message: 'O nome é obrigatório.' }),
  telefone: z.string().optional().nullable(),
  aniversario: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface EditClientDialogProps {
  client: Tables<'clients'>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: TablesUpdate<'clients'>) => void;
}

const EditClientDialog: React.FC<EditClientDialogProps> = ({ client, isOpen, onOpenChange, onSave }) => {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      telefone: '',
      aniversario: '',
      address: '',
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        telefone: client.telefone || '',
        aniversario: client.aniversario || '',
        address: (client as any).address || '',
      });
    }
  }, [client, form]);
  
  const onSubmit = (data: ClientFormValues) => {
    onSave({
      ...data,
      aniversario: data.aniversario || null,
      telefone: data.telefone || null,
      address: data.address || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Altere os dados do cliente. Clique em salvar para aplicar as mudanças.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp / Telefone</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(XX) XXXXX-XXXX" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Usado para enviar mensagens de aniversário e promoções
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aniversario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Aniversário</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Você receberá alertas 7 dias antes do aniversário
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Rua, número, bairro, cidade" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Usado para navegação e comprovantes
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
