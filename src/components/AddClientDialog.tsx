import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from '@tanstack/react-query';

interface AddClientDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const AddClientDialog: React.FC<AddClientDialogProps> = ({ isOpen, onOpenChange }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aniversario, setAniversario] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: "destructive", title: "Sessão expirada" });
        return;
      }

      const { error } = await supabase.from('clients').insert({
        name: name.trim(),
        telefone: telefone || null,
        aniversario: aniversario || null,
        user_id: session.user.id
      });

      if (error) throw error;

      toast({ title: "Cliente cadastrado!" });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      setName("");
      setTelefone("");
      setAniversario("");
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nome *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              className="transition-all duration-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">WhatsApp</Label>
            <Input
              id="client-phone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="transition-all duration-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-birthday">Aniversário</Label>
            <Input
              id="client-birthday"
              type="date"
              value={aniversario}
              onChange={(e) => setAniversario(e.target.value)}
              className="transition-all duration-200"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="transition-all duration-200 hover:scale-[1.02]">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;
