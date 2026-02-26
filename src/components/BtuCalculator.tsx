import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, Users, Monitor, Sun, Plus, Trash2, FileDown, Snowflake, Zap, Square, Ruler, Info, Lightbulb } from "lucide-react";
import { toast } from 'sonner';
import jsPDF from 'jspdf';

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

  // Auto-calculate area
  const area = useMemo(() => {
    return Math.round((roomWidth * roomLength) * 100) / 100;
  }, [roomWidth, roomLength]);

  const addElectronic = () => {
    if (!selectedElectronic) return;
    const item = defaultElectronics.find(e => e.name === selectedElectronic);
    if (!item) return;
    
    const existing = electronics.find(e => e.name === item.name);
    if (existing) {
      setElectronics(electronics.map(e => 
        e.name === item.name ? { ...e, qty: e.qty + 1 } : e
      ));
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
    // Base: 600 BTUs per m²
    let baseBtus = area * 600;

    // Ceiling height adjustment
    if (ceilingHeight > 3) baseBtus *= 1.1;
    if (ceilingHeight > 3.5) baseBtus *= 1.15;

    // People: 600 BTUs per person
    const peopleBtus = people * 600;

    // Electronics
    const electronicsBtus = electronics.reduce((sum, e) => sum + (e.btus * e.qty), 0);

    // Sun exposure multiplier
    const sunMultiplier = sunExposure === 'pouco' ? 1 : sunExposure === 'medio' ? 1.1 : 1.2;

    // Floor level
    const floorMultiplier = floorLevel === 'terreo' ? 1 : floorLevel === 'intermediario' ? 1.05 : 1.1;

    const totalBtus = Math.ceil((baseBtus + peopleBtus + electronicsBtus) * sunMultiplier * floorMultiplier);

    // Recommend model
    const models = [7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
    const recommended = models.find(m => m >= totalBtus) || models[models.length - 1];

    return { baseBtus, peopleBtus, electronicsBtus, totalBtus, recommended };
  }, [area, ceilingHeight, people, sunExposure, floorLevel, electronics]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    
    const logo = localStorage.getItem('company_logo');
    const companyName = localStorage.getItem('company_name') || 'AC Service Pro';
    const companyCnpj = localStorage.getItem('company_cnpj') || '';

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pw, 45, 'F');
    
    let headerX = 15;
    if (logo) {
      try { doc.addImage(logo, 'PNG', 15, 8, 30, 30); headerX = 50; } catch {}
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

    let y = 55;
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

    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pw / 2, 285, { align: 'center' });

    doc.save(`calculo-btus-${clientName || 'cliente'}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
        {/* Left - Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client Info */}
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

          {/* Room Parameters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Square className="w-4 h-4" /> Ambiente
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 gap-1"
                  onClick={() => setShowTips(!showTips)}
                >
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
                      <li><strong>Largura:</strong> Meça a parede menor do cômodo (de ponta a ponta).</li>
                      <li><strong>Comprimento:</strong> Meça a parede maior do cômodo (de ponta a ponta).</li>
                      <li><strong>Pé direito:</strong> Meça do chão ao teto. O padrão é 2,70m.</li>
                      <li>Use uma <strong>trena</strong> ou fita métrica para maior precisão.</li>
                      <li>Se o ambiente for em <strong>L</strong>, divida em 2 retângulos e some as áreas.</li>
                      <li>Meça sempre em <strong>metros</strong> (ex: 3,5m = 3 metros e 50cm).</li>
                    </ul>
                    <p className="text-xs mt-2 italic">💡 O sistema calcula a área automaticamente: Largura × Comprimento</p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Largura (m)
                  </Label>
                  <Input 
                    type="number" 
                    min={0} 
                    step={0.1}
                    value={roomWidth || ''} 
                    onChange={e => setRoomWidth(Number(e.target.value))} 
                    placeholder="0" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Comprimento (m)
                  </Label>
                  <Input 
                    type="number" 
                    min={0} 
                    step={0.1}
                    value={roomLength || ''} 
                    onChange={e => setRoomLength(Number(e.target.value))} 
                    placeholder="0" 
                  />
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

              {/* Auto-calculated area display */}
              {(roomWidth > 0 || roomLength > 0) && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <Square className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      Área calculada: <span className="text-primary font-bold text-lg">{area} m²</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roomWidth}m × {roomLength}m = {area} m²
                    </p>
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

          {/* Electronics */}
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
                      <SelectItem key={e.name} value={e.name}>
                        {e.name} ({e.btus.toLocaleString()} BTUs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addElectronic} disabled={!selectedElectronic} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
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
                        <Input
                          type="number"
                          min={1}
                          value={e.qty}
                          onChange={ev => updateQty(e.id, Number(ev.target.value))}
                          className="w-16 h-8 text-center text-sm"
                        />
                        <span className="text-xs text-muted-foreground w-20 text-right">
                          {(e.btus * e.qty).toLocaleString()} BTUs
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeElectronic(e.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right - Result */}
        <div className="space-y-4">
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-primary" /> Resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">BTUs Necessários</p>
                <p className="text-4xl font-bold text-primary">{calculation.totalBtus.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">BTUs</p>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Modelo Recomendado</p>
                <p className="text-2xl font-bold text-green-600">{calculation.recommended.toLocaleString()}</p>
                <p className="text-xs text-green-600">BTUs</p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dimensões</span>
                  <span className="font-medium">{roomWidth}m × {roomLength}m</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Área ({area}m²)</span>
                  <span className="font-medium">{calculation.baseBtus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pessoas ({people})</span>
                  <span className="font-medium">{calculation.peopleBtus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Eletrônicos</span>
                  <span className="font-medium">{calculation.electronicsBtus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">{calculation.totalBtus.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Modelos Disponíveis:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000].map(m => (
                    <Badge key={m} variant={m === calculation.recommended ? 'default' : 'outline'} className="text-[10px]">
                      {(m / 1000).toFixed(0)}k
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BtuCalculator;
