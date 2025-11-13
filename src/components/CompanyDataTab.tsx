import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { FileDown } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';

const fetchCompanyData = async (userId: string) => {
  const { data, error } = await supabase
    .from('company_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data as Tables<'company_data'> | null;
};

const CompanyDataTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");

  const [companyName, setCompanyName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company-data', userId],
    queryFn: () => fetchCompanyData(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (companyData) {
      setCompanyName(companyData.company_name || "");
      setCnpjCpf(companyData.cnpj_cpf || "");
      setEmail(companyData.email || "");
      setWhatsapp(companyData.whatsapp || "");
      setAddress(companyData.address || "");
    }
  }, [companyData]);

  const saveMutation = useMutation({
    mutationFn: async (data: TablesInsert<'company_data'> | TablesUpdate<'company_data'>) => {
      if (companyData?.id) {
        const { error } = await supabase
          .from('company_data')
          .update(data)
          .eq('id', companyData.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('company_data')
          .insert(data as TablesInsert<'company_data'>);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-data', userId] });
      toast({ title: "Sucesso!", description: "Dados da empresa salvos." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar dados.", description: error.message });
    }
  });

  const handleSave = () => {
    if (!companyName || !cnpjCpf) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome e CNPJ/CPF são obrigatórios." });
      return;
    }

    saveMutation.mutate({
      user_id: userId,
      company_name: companyName,
      cnpj_cpf: cnpjCpf,
      email,
      whatsapp,
      address,
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Dados da Empresa', 14, 22);
    
    doc.setFontSize(12);
    let y = 40;
    const lineHeight = 10;

    doc.text(`Nome/Razão Social: ${companyName}`, 14, y);
    y += lineHeight;
    doc.text(`CNPJ/CPF: ${cnpjCpf}`, 14, y);
    y += lineHeight;
    doc.text(`E-mail: ${email}`, 14, y);
    y += lineHeight;
    doc.text(`WhatsApp: ${whatsapp}`, 14, y);
    y += lineHeight;
    doc.text(`Endereço: ${address}`, 14, y);

    doc.save('dados-empresa.pdf');
    toast({ title: "PDF exportado!", description: "Dados da empresa salvos em PDF." });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Dados da Empresa
            <Button onClick={exportToPDF} size="sm" variant="outline" disabled={!companyName}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome/Razão Social *</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj-cpf">CNPJ/CPF *</Label>
              <Input
                id="cnpj-cpf"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
              />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar Dados"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyDataTab;
