import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { User, Phone, Calendar, MapPin, FileText, Mail, Building2, CreditCard } from 'lucide-react';

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
  const [email, setEmail] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [address, setAddress] = useState("");
  const [preferences, setPreferences] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [isCompany, setIsCompany] = useState(false);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (isCompany) {
      // CNPJ format: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 18);
    } else {
      // CPF format: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1-$2')
        .slice(0, 14);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfCnpj(formatCpfCnpj(e.target.value));
  };

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

      // Duplicate detection: same user, same name (case-insensitive) OR same phone (digits only)
      const phoneDigits = telefone.replace(/\D/g, '');
      const { data: existing } = await supabase
        .from('clients')
        .select('id, name, telefone')
        .eq('user_id', session.user.id);

      const duplicate = (existing || []).find(c => {
        const sameName = c.name?.trim().toLowerCase() === name.trim().toLowerCase();
        const samePhone = phoneDigits.length >= 8 && c.telefone && c.telefone.replace(/\D/g, '') === phoneDigits;
        return sameName || samePhone;
      });

      if (duplicate) {
        const reason = duplicate.name?.trim().toLowerCase() === name.trim().toLowerCase()
          ? `Já existe um cliente com o nome "${duplicate.name}".`
          : `Já existe um cliente com este WhatsApp (${duplicate.telefone}).`;
        const ok = window.confirm(`${reason}\n\nDeseja cadastrar mesmo assim como um novo cliente?`);
        if (!ok) {
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.from('clients').insert({
        name: name.trim(),
        telefone: telefone || null,
        email: email || null,
        aniversario: aniversario || null,
        address: address || null,
        preferences: preferences || null,
        cpf_cnpj: cpfCnpj || null,
        is_company: isCompany,
        user_id: session.user.id
      });

      if (error) throw error;

      toast({ title: "Cliente cadastrado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      queryClient.invalidateQueries({ queryKey: ['all-clients-reminders'] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setTelefone("");
    setEmail("");
    setAniversario("");
    setAddress("");
    setPreferences("");
    setCpfCnpj("");
    setIsCompany(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompany ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            {isCompany ? "Nova Empresa" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do {isCompany ? "empresa" : "cliente"}. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {/* Tipo: Pessoa Física ou Jurídica */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">É uma empresa?</Label>
                  <p className="text-xs text-muted-foreground">
                    {isCompany ? "Cadastro de Pessoa Jurídica (CNPJ)" : "Cadastro de Pessoa Física (CPF)"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isCompany}
                onCheckedChange={(checked) => {
                  setIsCompany(checked);
                  setCpfCnpj("");
                }}
              />
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="client-name" className="flex items-center gap-1.5">
                {isCompany ? <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                {isCompany ? "Razão Social / Nome Fantasia *" : "Nome Completo *"}
              </Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isCompany ? "Nome da empresa" : "Nome do cliente"}
                autoFocus
              />
            </div>

            {/* CPF ou CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="client-cpf-cnpj" className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                {isCompany ? "CNPJ" : "CPF"} (opcional)
              </Label>
              <Input
                id="client-cpf-cnpj"
                value={cpfCnpj}
                onChange={handleCpfCnpjChange}
                placeholder={isCompany ? "00.000.000/0000-00" : "000.000.000-00"}
                maxLength={isCompany ? 18 : 14}
              />
            </div>

            {/* Telefone e Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client-phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  WhatsApp
                </Label>
                <Input
                  id="client-phone"
                  value={telefone}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email" className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            {/* Aniversário */}
            <div className="space-y-2">
              <Label htmlFor="client-birthday" className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {isCompany ? "Data de Fundação" : "Aniversário"}
              </Label>
              <Input
                id="client-birthday"
                type="date"
                value={aniversario}
                onChange={(e) => setAniversario(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alerta automático 7 dias antes
              </p>
            </div>

            {/* Endereço */}
            <div className="space-y-2">
              <Label htmlFor="client-address" className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Endereço Completo
              </Label>
              <Textarea
                id="client-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, complemento, bairro, cidade - UF"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Usado para navegação no Google Maps
              </p>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="client-preferences" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Observações
              </Label>
              <Textarea
                id="client-preferences"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Preferências, equipamentos, informações importantes..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : `Salvar ${isCompany ? "Empresa" : "Cliente"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;