import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RouteExpensesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  providerName?: string;
}

export default function RouteExpensesDialog({ isOpen, onOpenChange, appointmentId, providerName }: RouteExpensesDialogProps) {
  const queryClient = useQueryClient();
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');

  const registerExpensesMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];

      if (combustivel && parseFloat(combustivel) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          appointment_id: appointmentId,
          category: 'Combustível',
          amount: parseFloat(combustivel),
          expense_date: today,
          description: `Combustível Rota ${providerName ? '- ' + providerName : ''}`.trim(),
          helper_name: providerName || null,
        });
      }

      if (alimentacao && parseFloat(alimentacao) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          appointment_id: appointmentId,
          category: 'Alimentação',
          amount: parseFloat(alimentacao),
          expense_date: today,
          description: `Alimentação Rota ${providerName ? '- ' + providerName : ''}`.trim(),
          helper_name: providerName || null,
        });
      }

      if (expensesToInsert.length === 0) return;

      const { error } = await supabase.from('fixed_expenses').insert(expensesToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Gastos de rota registrados no financeiro!');
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      onOpenChange(false);
      setCombustivel('');
      setAlimentacao('');
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`)
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Gastos da Rota</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Combustível (R$)</Label>
            <Input 
              type="number" 
              placeholder="0.00" 
              value={combustivel} 
              onChange={e => setCombustivel(e.target.value)} 
              min="0" step="0.01" 
            />
          </div>
          <div className="space-y-2">
            <Label>Alimentação (R$)</Label>
            <Input 
              type="number" 
              placeholder="0.00" 
              value={alimentacao} 
              onChange={e => setAlimentacao(e.target.value)} 
              min="0" step="0.01" 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={() => registerExpensesMutation.mutate()}
            disabled={registerExpensesMutation.isPending || (!combustivel && !alimentacao)}
          >
            {registerExpensesMutation.isPending ? 'Salvando...' : 'Salvar Gastos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
