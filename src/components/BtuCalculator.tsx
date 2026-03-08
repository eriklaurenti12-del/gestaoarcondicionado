import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, Users, Monitor, Sun, Plus, Trash2, FileDown, Snowflake, Zap, Square, Ruler, Info, Lightbulb } from "lucide-react";
import TabGuideCards from './TabGuideCards';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface ElectronicItem {
  id: string;
  name: string;
  qty: number;
  btus: number;
}

const defaultElectronics: { name: string; btus: number }[] = [
  { name: 'Computador/Notebook', btus: 600 },
  { name: 'TV até 32"', btus: 600 },
  { name: 'TV 40"-55"', btus: 800 },
  { name: 'TV 60"+', btus: 1000 },
  { name: 'Geladeira', btus: 300 },
  { name: 'Forno Elétrico/Microondas', btus: 3000 },
  { name: 'Impressora', btus: 400 },
  { name: 'Servidor/Rack', btus: 2000 },
  { name: 'Lâmpada Incandescente', btus: 150 },
  { name: 'Lâmpada LED', btus: 50 },
  { name: 'Projetor', btus: 800 },
  { name: 'Cafeteira', btus: 600 },
];

const BtuCalculator: React.FC = () => {
  const [roomWidth, setRoomWidth] = useState<number>(0);
  const [roomLength, setRoomLength] = useState<number>(0);
  const [ceilingHeight, setCeilingHeight] = useState<number>(2.7);
  const [people, setPeople] = useState<number>(1);
  const [sunExposure, setSunExposure] = useState<string>('medio');
  const [floorLevel, setFloorLevel] = useState<string>('terreo');
  const [electronics, setElectronics] = useState<ElectronicItem[]>([]);
  const [selectedElectronic, setSelectedElectronic] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showTips, setShowTips] = useState(false);

  // Company data from DB
  const [companyData, setCompanyData] = useState<any>(null);

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const { data } = await supabase.from('company_data').select('*').maybeSingle();
      if (data) setCompanyData(data);
    } catch {}
  };

  const area = useMemo(() => {
    return Math.round((roomWidth * roomLength) * 100) / 100;
  }, [roomWidth, roomLength]);

  const addElectronic = () => {
    if (!selectedElectronic) return;
    const item = defaultElectronics.find(e => e.name === selectedElectronic);
    if (!item) return;
    const existing = electronics.find(e => e.name === item.name);
    if (existing) {
      setElectronics(electronics.map(e => e.name === item.name ? { ...e, qty: e.qty + 1 } : e));
    } else {
      setElectronics([...electronics, { id: Date.now().toString(), name: item.name, qty: 1, btus: item.btus }]);
    }
    setSelectedElectronic('');
  };

  const removeElectronic = (id: string) => {
    setElectronics(electronics.filter(e => e.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    setElectronics(electronics.map(e => e.id === id ? { ...e, qty: Math.max(1, qty) } : e));
  };

  const calculation = useMemo(() => {
    let baseBtus = area * 600;
    if (ceilingHeight > 3) baseBtus *= 1.1;
    if (ceilingHeight > 3.5) baseBtus *= 1.15;
    const peopleBtus = people * 600;
    const electronicsBtus = electronics.reduce((sum, e) => sum + (e.btus * e.qty), 0);
    const sunMultiplier = sunExposure === 'pouco' ? 1 : sunExposure === 'medio' ? 1.1 : 1.2;
    const floorMultiplier = floorLevel === 'terreo' ? 1 : floorLevel === 'intermediario' ? 1.05 : 1.1;
    const totalBtus = Math.ceil((baseBtus + peopleBtus + electronicsBtus) * sunMultiplier * floorMultiplier);
    const models = [7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
    const recommended = models.find(m => m >= totalBtus) || models[models.length - 1];
    return { baseBtus, peopleBtus, electronicsBtus, totalBtus, recommended };
  }, [area, ceilingHeight, people, sunExposure, floorLevel, electronics]);

  const exportPDF = async () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    
    const companyName = companyData?.company_name || 'AC Service Pro';
    const companyCnpj = companyData?.cnpj_cpf || '';
    const companyWhatsapp = companyData?.whatsapp || '';
    const companyEmail = companyData?.email || '';
    const companyAddress = companyData?.address || '';

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pw, 50, 'F');
    
    let headerX = 15;

    // Try to load company logo from storage
    if (companyData?.logo_url) {
      try {
        const response = await fetch(companyData.logo_url);
        const blob = await response.blob();
        const reader = new FileReader();
        const logoData = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(logoData, 'PNG', 15, 8, 32, 32);
        headerX = 52;
      } catch {}
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, headerX, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('Cálculo de BTUs - Dimensionamento', headerX, 28);
    if (companyCnpj) doc.text(`CNPJ/CPF: ${companyCnpj}`, headerX, 35);
    if (companyWhatsapp) doc.text(`WhatsApp: ${companyWhatsapp}`, headerX, 42);

    let y = 60;
    doc.setTextColor(40, 40, 40);

    if (clientName || roomName) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados do Cliente', 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (clientName) { doc.text(`Cliente: ${clientName}`, 15, y); y += 6; }
      if (roomName) { doc.text(`Ambiente: ${roomName}`, 15, y); y += 6; }
      y += 6;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Parâmetros do Ambiente', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const params = [
      `Largura: ${roomWidth} m × Comprimento: ${roomLength} m`,
      `Área calculada: ${area} m²`,
      `Pé direito: ${ceilingHeight} m`,
      `Pessoas: ${people}`,
      `Exposição solar: ${sunExposure === 'pouco' ? 'Pouca' : sunExposure === 'medio' ? 'Média' : 'Muita'}`,
      `Andar: ${floorLevel === 'terreo' ? 'Térreo' : floorLevel === 'intermediario' ? 'Intermediário' : 'Último andar'}`,
    ];
    params.forEach(p => { doc.text(p, 15, y); y += 6; });
    y += 4;

    if (electronics.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Equipamentos Eletrônicos', 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      electronics.forEach(e => {
        doc.text(`${e.name} x${e.qty} = ${(e.btus * e.qty).toLocaleString()} BTUs`, 15, y);
        y += 6;
      });
      y += 4;
    }

    doc.setFillColor(240, 249, 255);
    doc.roundedRect(15, y, pw - 30, 45, 3, 3, 'F');
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 180);
    doc.text('RESULTADO', 15 + (pw - 30) / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(20);
    doc.text(`${calculation.totalBtus.toLocaleString()} BTUs`, 15 + (pw - 30) / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 0);
    doc.text(`Modelo recomendado: ${calculation.recommended.toLocaleString()} BTUs`, 15 + (pw - 30) / 2, y, { align: 'center' });

    // Footer with company info
    const pH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    const footerLines = [
      `${companyName}${companyCnpj ? ` | ${companyCnpj}` : ''}${companyWhatsapp ? ` | ${companyWhatsapp}` : ''}`,
      `${companyAddress || ''}${companyEmail ? ` | ${companyEmail}` : ''}`,
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`
    ];
    footerLines.forEach((line, i) => {
      if (line.trim()) doc.text(line, pw / 2, pH - 18 + (i * 5), { align: 'center' });
    });

    doc.save(`calculo-btus-${clientName || 'cliente'}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <TabGuideCards cards={[
        {
          icon: Thermometer,
          title: 'Cálculo de BTUs',
          badge: 'Técnico',
          badgeColor: 'cyan',
          description: <>Calcule a <strong>capacidade ideal</strong> do ar condicionado considerando área, pessoas e eletrônicos. Essencial para orçamentos precisos.</>,
        },
        {
          icon: FileDown,
          title: 'Laudo PDF',
          badge: 'Profissional',
          badgeColor: 'blue',
          description: <>Gere um <strong>laudo técnico em PDF</strong> com sua marca para entregar ao cliente. Demonstra profissionalismo e justifica o modelo recomendado.</>,
        },
      ]} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Thermometer className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Calculadora de BTUs</h2>
            <p className="text-sm text-muted-foreground">Dimensione o ar-condicionado ideal</p>
          </div>
        </div>
        <Button onClick={exportPDF} disabled={area === 0}>
          <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Cliente</Label>
                  <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Ambiente</Label>
                  <Input placeholder="Ex: Sala, Quarto, Escritório" value={roomName} onChange={e => setRoomName(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Square className="w-4 h-4" /> Ambiente
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowTips(!showTips)}>
                  <Lightbulb className="w-3 h-3" />
                  {showTips ? 'Ocultar dicas' : 'Como medir?'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showTips && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                    <p className="font-semibold">📏 Como medir o ambiente:</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      <li><strong>Largura:</strong> Meça a parede menor do cômodo.</li>
                      <li><strong>Comprimento:</strong> Meça a parede maior do cômodo.</li>
                      <li><strong>Pé direito:</strong> Meça do chão ao teto. O padrão é 2,70m.</li>
                      <li>Use uma <strong>trena</strong> ou fita métrica para maior precisão.</li>
                      <li>Se o ambiente for em <strong>L</strong>, divida em 2 retângulos e some as áreas.</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Ruler className="w-3 h-3" /> Largura (m)</Label>
                  <Input type="number" min={0} step={0.1} value={roomWidth || ''} onChange={e => setRoomWidth(Number(e.target.value))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Ruler className="w-3 h-3" /> Comprimento (m)</Label>
                  <Input type="number" min={0} step={0.1} value={roomLength || ''} onChange={e => setRoomLength(Number(e.target.value))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pé Direito (m)</Label>
                  <Input type="number" min={2} step={0.1} value={ceilingHeight} onChange={e => setCeilingHeight(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3" /> Pessoas</Label>
                  <Input type="number" min={0} value={people} onChange={e => setPeople(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Sun className="w-3 h-3" /> Sol</Label>
                  <Select value={sunExposure} onValueChange={setSunExposure}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pouco">Pouco sol</SelectItem>
                      <SelectItem value="medio">Sol médio</SelectItem>
                      <SelectItem value="muito">Muito sol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(roomWidth > 0 || roomLength > 0) && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <Square className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Área calculada: <span className="text-primary font-bold text-lg">{area} m²</span></p>
                    <p className="text-xs text-muted-foreground">{roomWidth}m × {roomLength}m = {area} m²</p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Andar</Label>
                <Select value={floorLevel} onValueChange={setFloorLevel}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="terreo">Térreo / Intermediário coberto</SelectItem>
                    <SelectItem value="intermediario">Andar intermediário</SelectItem>
                    <SelectItem value="ultimo">Último andar / Cobertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Eletrônicos no Ambiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Select value={selectedElectronic} onValueChange={setSelectedElectronic}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um equipamento" /></SelectTrigger>
                  <SelectContent>
                    {defaultElectronics.map(e => (
                      <SelectItem key={e.name} value={e.name}>{e.name} ({e.btus.toLocaleString()} BTUs)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addElectronic} disabled={!selectedElectronic} size="icon"><Plus className="w-4 h-4" /></Button>
              </div>
              {electronics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum eletrônico adicionado</p>
              ) : (
                <div className="space-y-2">
                  {electronics.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">{e.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} value={e.qty} onChange={ev => updateQty(e.id, Number(ev.target.value))} className="w-16 h-8 text-center text-sm" />
                        <Badge variant="outline" className="text-xs">{(e.btus * e.qty).toLocaleString()}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeElectronic(e.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Snowflake className="w-5 h-5" /> Resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 rounded-xl bg-background/80 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">BTUs Necessários</p>
                <p className="text-4xl font-bold text-primary">{area > 0 ? calculation.totalBtus.toLocaleString() : '---'}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground mb-1">Modelo Recomendado</p>
                <p className="text-2xl font-bold text-green-600">{area > 0 ? `${calculation.recommended.toLocaleString()} BTUs` : '---'}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Área</span><span>{calculation.baseBtus.toLocaleString()} BTUs</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pessoas ({people})</span><span>{calculation.peopleBtus.toLocaleString()} BTUs</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Eletrônicos</span><span>{calculation.electronicsBtus.toLocaleString()} BTUs</span></div>
              </div>

              {companyData && (
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{companyData.company_name}</p>
                  {companyData.whatsapp && <p>📱 {companyData.whatsapp}</p>}
                  {companyData.email && <p>✉️ {companyData.email}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BtuCalculator;
