import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { User, Phone, Calendar, MapPin, FileText } from 'lucide-react';

const clientSchema = z.object({
  name: z.string().min(1, { message: 'O nome é obrigatório.' }),
  telefone: z.string().optional().nullable(),
  aniversario: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  preferences: z.string().optional().nullable(),
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
      preferences: '',
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        telefone: client.telefone || '',
        aniversario: client.aniversario || '',
        address: client.address || '',
        preferences: client.preferences || '',
      });
    }
  }, [client, form]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };
  
  const onSubmit = (data: ClientFormValues) => {
    onSave({
      ...data,
      aniversario: data.aniversario || null,
      telefone: data.telefone || null,
      address: data.address || null,
      preferences: data.preferences || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Editar Cliente
          </DialogTitle>
          <DialogDescription>
            Altere os dados do cliente e clique em salvar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    Nome Completo *
                  </FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telefone e Aniversário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      WhatsApp
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(00) 00000-0000" 
                        {...field} 
                        value={field.value || ''} 
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                        maxLength={15}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Para mensagens e lembretes
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
                    <FormLabel className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Aniversário
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Alerta 7 dias antes
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Endereço */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    Endereço Completo
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Rua, número, bairro, cidade - UF" 
                      {...field} 
                      value={field.value || ''} 
                      rows={2}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Usado para navegação
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observações */}
            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    Observações
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Preferências, equipamentos, informações..." 
                      {...field} 
                      value={field.value || ''} 
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;