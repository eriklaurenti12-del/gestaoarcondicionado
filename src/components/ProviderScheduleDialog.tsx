import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProviderScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
}

export default function ProviderScheduleDialog({ isOpen, onOpenChange, providerName }: ProviderScheduleDialogProps) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const { data: products } = useQuery({
    queryKey: ['services-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, price').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const formattedDate = `${appointmentDate}T${appointmentTime}:00`;

      const { error } = await supabase.from('appointments').insert({
        user_id: session.user.id,
        client_id: parseInt(clientId),
        service_id: parseInt(serviceId),
        appointment_date: formattedDate,
        status: 'agendado',
        notes: `[PRESTADOR:${providerName}]`
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Serviço agendado para o prestador!');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-for-providers'] });
      onOpenChange(false);
      setClientId('');
      setServiceId('');
      setAppointmentDate('');
      setAppointmentTime('');
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`)
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Serviço — {providerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
              <SelectContent>
                {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} - R$ {Number(p.price).toFixed(2)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={() => scheduleMutation.mutate()}
            disabled={!clientId || !serviceId || !appointmentDate || !appointmentTime || scheduleMutation.isPending}
          >
            {scheduleMutation.isPending ? 'Agendando...' : 'Confirmar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
