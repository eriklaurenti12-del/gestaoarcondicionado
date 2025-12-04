import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { FileDown, Save, Building2, Phone, Mail, MapPin, Clock, Instagram, Facebook, Globe } from "lucide-react";
import jsPDF from 'jspdf';
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CompanyDataTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [userId, setUserId] = useState<string>('');
  
  // Novos campos
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [website, setWebsite] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [closingHours, setClosingHours] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [description, setDescription] = useState('');
  const [specialties, setSpecialties] = useState('');

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
        description: "Dados do salão salvos com sucesso."
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
        description: "Preencha pelo menos CNPJ/CPF e Nome do Salão",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with gradient effect
    doc.setFillColor(147, 51, 234);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Gradient overlay
    doc.setFillColor(219, 39, 119);
    doc.rect(pageWidth / 2, 0, pageWidth / 2, 50, 'F');
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 25, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Cartão de Apresentação', pageWidth / 2, 35, { align: 'center' });
    
    // CNPJ/CPF badge
    doc.setFontSize(9);
    doc.text(`CNPJ/CPF: ${cnpjCpf}`, pageWidth / 2, 44, { align: 'center' });
    
    let y = 65;
    doc.setTextColor(60, 60, 60);
    
    // Contact Info Box
    if (whatsapp || phone || email) {
      doc.setFillColor(250, 245, 255);
      doc.roundedRect(14, y - 5, pageWidth - 28, 40, 3, 3, 'F');
      doc.setDrawColor(147, 51, 234);
      doc.roundedRect(14, y - 5, pageWidth - 28, 40, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(147, 51, 234);
      doc.text('📞 CONTATO', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      
      let contactY = y + 15;
      if (whatsapp) { doc.text(`WhatsApp: ${whatsapp}`, 20, contactY); contactY += 8; }
      if (phone) { doc.text(`Telefone: ${phone}`, 20, contactY); contactY += 8; }
      if (email) { doc.text(`Email: ${email}`, 20, contactY); }
      
      y += 50;
    }
    
    // Schedule Box
    if (openingHours || closingHours || workDays) {
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, y - 5, pageWidth - 28, 30, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(14, y - 5, pageWidth - 28, 30, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('🕐 HORÁRIO DE FUNCIONAMENTO', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(`${workDays || 'Seg - Sáb'} • ${openingHours || '09:00'} às ${closingHours || '19:00'}`, 20, y + 18);
      
      y += 40;
    }
    
    // Social Media Box
    if (instagram || facebook || website) {
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(14, y - 5, pageWidth - 28, 35, 3, 3, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.roundedRect(14, y - 5, pageWidth - 28, 35, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('🌐 REDES SOCIAIS', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      
      let socialY = y + 15;
      if (instagram) { doc.text(`Instagram: @${instagram}`, 20, socialY); socialY += 8; }
      if (facebook) { doc.text(`Facebook: ${facebook}`, 20, socialY); socialY += 8; }
      if (website) { doc.text(`Site: ${website}`, 20, socialY); }
      
      y += 45;
    }
    
    // Address Box
    if (address) {
      doc.setFillColor(254, 252, 232);
      doc.roundedRect(14, y - 5, pageWidth - 28, 35, 3, 3, 'F');
      doc.setDrawColor(234, 179, 8);
      doc.roundedRect(14, y - 5, pageWidth - 28, 35, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(161, 98, 7);
      doc.text('📍 LOCALIZAÇÃO', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      const splitAddress = doc.splitTextToSize(address, 170);
      doc.text(splitAddress, 20, y + 15);
      
      y += 45;
    }
    
    // Specialties Box
    if (specialties) {
      doc.setFillColor(253, 242, 248);
      doc.roundedRect(14, y - 5, pageWidth - 28, 30, 3, 3, 'F');
      doc.setDrawColor(236, 72, 153);
      doc.roundedRect(14, y - 5, pageWidth - 28, 30, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(236, 72, 153);
      doc.text('✨ ESPECIALIDADES', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      const splitSpecialties = doc.splitTextToSize(specialties, 170);
      doc.text(splitSpecialties, 20, y + 15);
      
      y += 40;
    }
    
    // Description Box
    if (description) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y - 5, pageWidth - 28, 45, 3, 3, 'F');
      doc.setDrawColor(100, 116, 139);
      doc.roundedRect(14, y - 5, pageWidth - 28, 45, 3, 3, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('📝 SOBRE NÓS', 20, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(description, 170);
      doc.text(splitDesc, 20, y + 15);
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} • Sistema Salão de Beleza`, pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`cartao-${companyName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    toast({
      title: "PDF Exportado!",
      description: "Cartão de apresentação salvo."
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Meu Salão</CardTitle>
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
          <h2 className="text-2xl font-bold">Meu Salão</h2>
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

      {/* Informações Básicas */}
      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Nome do Salão *</Label>
              <Input
                id="company"
                placeholder="Salão Beleza Total"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Salão</Label>
            <Textarea
              id="description"
              placeholder="Conte um pouco sobre seu salão, sua história, diferenciais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="transition-all focus:scale-[1.01] focus:shadow-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialties">Especialidades</Label>
            <Input
              id="specialties"
              placeholder="Ex: Cortes modernos, Coloração, Tratamentos capilares, Penteados para noivas..."
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              className="transition-all focus:scale-[1.02] focus:shadow-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1">
                <Phone className="w-4 h-4" /> WhatsApp
              </Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="w-4 h-4" /> Telefone Fixo
              </Label>
              <Input
                id="phone"
                placeholder="(00) 0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="w-4 h-4" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@meusalao.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5" />
            Redes Sociais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-1">
                <Instagram className="w-4 h-4" /> Instagram
              </Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                  @
                </span>
                <Input
                  id="instagram"
                  placeholder="meusalao"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="rounded-l-none transition-all focus:scale-[1.02] focus:shadow-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook" className="flex items-center gap-1">
                <Facebook className="w-4 h-4" /> Facebook
              </Label>
              <Input
                id="facebook"
                placeholder="facebook.com/meusalao"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-1">
                <Globe className="w-4 h-4" /> Site
              </Label>
              <Input
                id="website"
                placeholder="www.meusalao.com.br"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horário de Funcionamento */}
      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horário de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening">Abertura</Label>
              <Select value={openingHours} onValueChange={setOpeningHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Horário de abertura" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                      {`${i.toString().padStart(2, '0')}:00`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing">Fechamento</Label>
              <Select value={closingHours} onValueChange={setClosingHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Horário de fechamento" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                      {`${i.toString().padStart(2, '0')}:00`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workDays">Dias de Funcionamento</Label>
              <Input
                id="workDays"
                placeholder="Ex: Segunda a Sábado"
                value={workDays}
                onChange={(e) => setWorkDays(e.target.value)}
                className="transition-all focus:scale-[1.02] focus:shadow-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="hover-scale transition-all shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
