import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { FileDown, Save, Building2 } from "lucide-react";
import jsPDF from 'jspdf';
import { Skeleton } from "@/components/ui/skeleton";

const CompanyDataTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [userId, setUserId] = useState<string>('');

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company-data'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      
      setUserId(session.user.id);
      
      const { data, error } = await supabase
        .from('company_data' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setCnpjCpf((data as any).cnpj_cpf || '');
        setCompanyName((data as any).company_name || '');
        setWhatsapp((data as any).whatsapp || '');
        setEmail((data as any).email || '');
        setAddress((data as any).address || '');
      }
      
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!cnpjCpf || !companyName) {
        throw new Error('CNPJ/CPF e Nome da Empresa são obrigatórios');
      }

      if (companyData) {
        const { error } = await supabase
          .from('company_data' as any)
          .update({
            cnpj_cpf: cnpjCpf,
            company_name: companyName,
            whatsapp,
            email,
            address
          })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_data' as any)
          .insert([{
            user_id: userId,
            cnpj_cpf: cnpjCpf,
            company_name: companyName,
            whatsapp,
            email,
            address
          }]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-data'] });
      toast({
        title: "Sucesso!",
        description: "Dados da empresa salvos com sucesso."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const exportToPDF = () => {
    if (!cnpjCpf || !companyName) {
      toast({
        title: "Aviso",
        description: "Preencha pelo menos CNPJ/CPF e Nome da Empresa",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Dados da Empresa', 14, 22);
    
    doc.setFontSize(12);
    let y = 40;
    
    doc.text(`CNPJ/CPF: ${cnpjCpf}`, 14, y);
    y += 10;
    doc.text(`Nome da Empresa: ${companyName}`, 14, y);
    y += 10;
    
    if (whatsapp) {
      doc.text(`WhatsApp: ${whatsapp}`, 14, y);
      y += 10;
    }
    
    if (email) {
      doc.text(`Email: ${email}`, 14, y);
      y += 10;
    }
    
    if (address) {
      doc.text('Endereço:', 14, y);
      y += 7;
      const splitAddress = doc.splitTextToSize(address, 180);
      doc.text(splitAddress, 14, y);
    }
    
    doc.save(`dados-empresa-${new Date().toISOString().split('T')[0]}.pdf`);
    toast({
      title: "PDF Exportado!",
      description: "Dados da empresa salvos em PDF."
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Meus Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-2xl font-bold">Meus Dados</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="hover-scale">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={exportToPDF} variant="outline" className="hover-scale">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle>Informações da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ / CPF *</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Nome da Empresa *</Label>
              <Input
                id="company"
                placeholder="Minha Empresa LTDA"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço Completo</Label>
            <Textarea
              id="address"
              placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="transition-all focus:scale-[1.01] focus:shadow-lg"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyDataTab;
