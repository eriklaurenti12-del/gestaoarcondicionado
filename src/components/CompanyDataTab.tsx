import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { FileDown, Save, Building2, Phone, Mail, MapPin, Clock, Instagram, Facebook, Globe, Upload, X, Image } from "lucide-react";
import jsPDF from 'jspdf';
import { Skeleton } from "@/components/ui/skeleton";

const CompanyDataTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [website, setWebsite] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [closingHours, setClosingHours] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [description, setDescription] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [additionalEmail, setAdditionalEmail] = useState('');
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
        setInstagram((data as any).instagram || '');
        // Load logo from DB (cloud) instead of cross-user localStorage
        if ((data as any).logo_url) {
          try {
            const resp = await fetch((data as any).logo_url);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onload = (ev) => setLogoBase64(ev.target?.result as string);
            reader.readAsDataURL(blob);
          } catch {
            setLogoBase64('');
          }
        } else {
          setLogoBase64('');
        }
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
            address,
            instagram
          } as any)
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
            address,
            instagram
          } as any]);
        
        if (error) throw error;
      }

      // Salvar WhatsApp no perfil do usuário para aparecer no painel de membros
      if (whatsapp) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: whatsapp })
          .eq('user_id', userId);
        
        if (profileError) {
          console.error('Erro ao salvar telefone no perfil:', profileError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-data'] });
      queryClient.invalidateQueries({ queryKey: ['company-data-sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['system-branding'] });
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 2MB",
        variant: "destructive"
      });
      return;
    }

    // Get current user id directly
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      return;
    }
    
    // Read file as base64 for immediate preview + PDF export (in-memory only)
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoBase64(base64);
    };
    reader.readAsDataURL(file);
    
    // Upload to storage for public access
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${currentUserId}/logo.${ext}`;
      
      // Remove old logos
      await supabase.storage.from('company-logos').remove([
        `${currentUserId}/logo.png`, `${currentUserId}/logo.jpg`, 
        `${currentUserId}/logo.jpeg`, `${currentUserId}/logo.webp`
      ]);
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        // Add cache buster to URL
        const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        const { error: updateError } = await supabase
          .from('company_data' as any)
          .update({ logo_url: logoUrl })
          .eq('user_id', currentUserId);
        
        if (updateError) {
          console.error('Logo URL update error:', updateError);
          throw updateError;
        }
        
        queryClient.invalidateQueries({ queryKey: ['company-data'] });
        queryClient.invalidateQueries({ queryKey: ['company-data-sidebar'] });
      }
      
      toast({ title: "Logo carregado e salvo!" });
    } catch (err: any) {
      console.error('Logo upload error:', err);
      toast({ title: "Logo salvo localmente", description: "Erro ao enviar online: " + err.message });
    }
  };

  const removeLogo = async () => {
    setLogoBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Remove from storage and DB
    try {
      await supabase.storage.from('company-logos').remove([`${userId}/logo.png`, `${userId}/logo.jpg`, `${userId}/logo.jpeg`, `${userId}/logo.webp`]);
      await supabase.from('company_data' as any).update({ logo_url: null }).eq('user_id', userId);
      queryClient.invalidateQueries({ queryKey: ['company-data'] });
      queryClient.invalidateQueries({ queryKey: ['company-data-sidebar'] });
    } catch { /* ignore */ }
  };

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
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Clean header
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 55, 'F');
    
    let headerY = 20;
    
    // Add logo if exists
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 10, 35, 35);
        headerY = 20;
      } catch (e) {
        console.error('Erro ao adicionar logo:', e);
      }
    }
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const nameX = logoBase64 ? 55 : 15;
    doc.text(companyName, nameX, headerY);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('Serviços de Ar Condicionado', nameX, headerY + 8);
    
    // CNPJ/CPF
    doc.setFontSize(9);
    doc.text(`CNPJ/CPF: ${cnpjCpf}`, nameX, headerY + 16);
    
    let y = 70;
    doc.setTextColor(40, 40, 40);
    
    // Section helper
    const addSection = (title: string, icon: string, content: string[], startY: number) => {
      if (content.filter(c => c).length === 0) return startY;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(`${icon} ${title}`, 15, startY);
      
      doc.setDrawColor(229, 231, 235);
      doc.line(15, startY + 3, pageWidth - 15, startY + 3);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.setFontSize(10);
      
      let contentY = startY + 12;
      content.forEach(line => {
        if (line) {
          doc.text(line, 15, contentY);
          contentY += 7;
        }
      });
      
      return contentY + 8;
    };
    
    // Contact
    y = addSection('Contato', '📞', [
      whatsapp ? `WhatsApp: ${whatsapp}` : '',
      phone ? `Telefone: ${phone}` : '',
      email ? `Email: ${email}` : ''
    ], y);
    
    // Schedule
    if (openingHours || closingHours || workDays) {
      y = addSection('Horário de Atendimento', '🕐', [
        `${workDays || 'Segunda a Sábado'} • ${openingHours || '08:00'} às ${closingHours || '18:00'}`
      ], y);
    }
    
    // Social
    y = addSection('Redes Sociais', '🌐', [
      instagram ? `Instagram: @${instagram}` : '',
      facebook ? `Facebook: ${facebook}` : '',
      website ? `Site: ${website}` : ''
    ], y);
    
    // Address
    if (address) {
      y = addSection('Localização', '📍', [address], y);
    }
    
    // Services
    if (specialties) {
      y = addSection('Serviços', '❄️', [specialties], y);
    }
    
    // Description
    if (description) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text('📝 Sobre Nós', 15, y);
      
      doc.setDrawColor(229, 231, 235);
      doc.line(15, y + 3, pageWidth - 15, y + 3);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(description, pageWidth - 30);
      doc.text(splitDesc, 15, y + 12);
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`empresa-${companyName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Minha Empresa</h2>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Logo and Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Logo da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {logoBase64 ? (
                <div className="relative">
                  <img 
                    src={logoBase64} 
                    alt="Logo" 
                    className="w-full h-40 object-contain rounded-lg border bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removeLogo}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para enviar</span>
                  <span className="text-xs text-muted-foreground/60">PNG, JPG até 2MB</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Aparecerá no PDF e no agendamento online
              </p>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dias de Trabalho</Label>
                <Input
                  placeholder="Seg - Sáb"
                  value={workDays}
                  onChange={(e) => setWorkDays(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Abertura</Label>
                  <Input
                    type="time"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fechamento</Label>
                  <Input
                    type="time"
                    value={closingHours}
                    onChange={(e) => setClosingHours(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Empresa *</Label>
                  <Input
                    placeholder="AC Service Pro"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CNPJ / CPF *</Label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Serviços Oferecidos</Label>
                <Input
                  placeholder="Instalação, Manutenção, Limpeza, Carga de Gás..."
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  placeholder="Conte sobre sua empresa..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary WhatsApp */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">WhatsApp Principal</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              {/* Additional WhatsApps */}
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp Adicional</Label>
                <Input
                  placeholder="(00) 00000-0000 (opcional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {/* Primary Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email Principal</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {/* Additional Email */}
              <div className="space-y-1.5">
                <Label className="text-xs">Email Adicional</Label>
                <Input
                  type="email"
                  placeholder="financeiro@empresa.com (opcional)"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Redes Sociais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> Instagram
                  </Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                      @
                    </span>
                    <Input
                      placeholder="usuario"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Facebook className="w-3 h-3" /> Facebook
                  </Label>
                  <Input
                    placeholder="facebook.com/pagina"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Site
                  </Label>
                  <Input
                    placeholder="www.site.com.br"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label className="text-xs">Endereço Completo</Label>
                <Input
                  placeholder="Rua, Número, Bairro - Cidade/UF"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyDataTab;