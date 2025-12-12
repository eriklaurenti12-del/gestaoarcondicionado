import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, ChevronUp, Lightbulb, X, Send, AlertTriangle, Wrench, Snowflake, Activity, User, Image } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// AC Technical Tips Data
const acTipsData = {
  problemas: {
    title: "Problemas Comuns",
    icon: AlertTriangle,
    items: [
      {
        question: "Ar condicionado não gela",
        answer: "Verifique se o filtro está limpo, se o gás está no nível correto e se a unidade externa não está obstruída. Se persistir, pode haver vazamento de gás ou problema no compressor."
      },
      {
        question: "Equipamento fazendo muito barulho",
        answer: "Pode indicar peças soltas, motor do ventilador com defeito, ou necessidade de limpeza. Barulhos de água podem ser condensação normal, mas gotejamento interno precisa de atenção."
      },
      {
        question: "Vazamento de água",
        answer: "Geralmente causado por dreno entupido, bandeja de condensação suja, ou instalação incorreta. Limpe o dreno e verifique a inclinação da unidade interna."
      },
      {
        question: "Alto consumo de energia",
        answer: "Filtros sujos, gás insuficiente, ou aparelho subdimensionado para o ambiente. Manutenção regular e uso correto do termostato ajudam a economizar."
      },
      {
        question: "Odores desagradáveis",
        answer: "Indicam acúmulo de fungos e bactérias. Necessária higienização completa incluindo serpentina, turbina e bandeja de condensação."
      }
    ]
  },
  manutencao: {
    title: "Manutenção",
    icon: Wrench,
    items: [
      {
        question: "Com que frequência fazer manutenção preventiva?",
        answer: "Recomenda-se a cada 6 meses para residências e a cada 3 meses para uso comercial intenso. Filtros devem ser limpos mensalmente."
      },
      {
        question: "O que inclui a manutenção preventiva?",
        answer: "Limpeza de filtros, verificação de gás, limpeza da serpentina e turbina, verificação elétrica, limpeza do dreno e teste geral de funcionamento."
      },
      {
        question: "Quando fazer higienização?",
        answer: "A cada 12 meses ou quando houver odores, alergias frequentes, ou redução no desempenho do equipamento."
      },
      {
        question: "Manutenção corretiva vs preventiva",
        answer: "Preventiva evita problemas e prolonga a vida útil. Corretiva resolve problemas existentes. Investir em prevenção é mais econômico a longo prazo."
      }
    ]
  },
  instalacao: {
    title: "Instalação",
    icon: Snowflake,
    items: [
      {
        question: "Como escolher a potência ideal?",
        answer: "Calcule aproximadamente 600 BTUs por m² para ambientes normais. Considere incidência solar, número de pessoas e equipamentos eletrônicos."
      },
      {
        question: "Tempo de instalação",
        answer: "Instalação padrão leva de 2 a 4 horas. Pode variar conforme complexidade, distância entre unidades e necessidade de infraestrutura elétrica."
      },
      {
        question: "Preparação necessária para instalação",
        answer: "Ponto elétrico adequado (220V ou 127V conforme modelo), local para unidade externa com boa ventilação, e passagem para tubulação."
      },
      {
        question: "Garantia da instalação",
        answer: "Oferecemos garantia de 90 dias para o serviço de instalação. Problemas de fabricação seguem a garantia do fabricante."
      }
    ]
  },
  diagnostico: {
    title: "Diagnóstico Rápido",
    icon: Activity,
    items: [
      {
        question: "Sinais de Alerta",
        answer: "• Ar não sai frio mesmo ligado há tempo\n• Ruídos anormais durante funcionamento\n• Vazamentos ou goteiras\n• Odores desagradáveis\n• Aumento na conta de energia\n• Gelo na evaporadora"
      },
      {
        question: "Quando Chamar Técnico",
        answer: "• Problemas elétricos ou de alimentação\n• Vazamento de gás refrigerante\n• Compressor não funciona\n• Sensores com defeito\n• Qualquer dúvida sobre segurança\n• Manutenção além da limpeza básica"
      }
    ]
  }
};

const improvementTips = [
  "Adicionar fotos dos equipamentos dos clientes",
  "Criar checklist de manutenção preventiva",
  "Implementar controle de estoque com alertas",
  "Adicionar histórico de manutenções por equipamento",
  "Criar relatório de garantias a vencer",
  "Implementar agenda compartilhada entre técnicos",
  "Adicionar GPS e roteirização de visitas",
  "Criar módulo de contratos de manutenção",
  "Implementar avaliação de satisfação do cliente",
  "Adicionar catálogo de peças com fornecedores",
];

const fetchClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name, telefone').order('name');
  if (error) throw error;
  return data || [];
};

export default function SupportButton() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedTip, setSelectedTip] = useState<{ question: string; answer: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [attachImage, setAttachImage] = useState(false);
  const [sendMode, setSendMode] = useState<'client' | 'custom'>('client');
  const [customPhone, setCustomPhone] = useState("");
  const [customName, setCustomName] = useState("");

  const { data: clients } = useQuery({
    queryKey: ['clients-support'],
    queryFn: fetchClients
  });

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const handleSupportClick = () => {
    const whatsappUrl = "https://wa.me/5516992600631?text=Olá%2C+vim+do+sistema+Gestão+de+Negócios+e+preciso+de+suporte";
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const openSendDialog = (tip: { question: string; answer: string }) => {
    setSelectedTip(tip);
    setCustomMessage(`*${tip.question}*\n\n${tip.answer}`);
    setShowSendDialog(true);
  };

  const sendTipToClient = () => {
    let phone = "";
    let name = "";

    if (sendMode === 'client') {
      const client = clients?.find(c => c.id === parseInt(selectedClientId));
      if (!client || !client.telefone) {
        toast.error('Cliente não possui telefone cadastrado');
        return;
      }
      phone = client.telefone.replace(/\D/g, '');
      name = client.name;
    } else {
      // Custom phone number
      phone = customPhone.replace(/\D/g, '');
      if (phone.length < 10) {
        toast.error('Número de telefone inválido');
        return;
      }
      name = customName || 'Cliente';
    }

    let message = `Olá ${name}!\n\n${customMessage}`;
    
    if (attachImage) {
      message += "\n\n📸 *Veja a imagem em anexo para mais detalhes.*";
    }
    
    message += "\n\n_Enviado por AC Service Pro_";

    const encodedMessage = encodeURIComponent(message);
    // Use wa.me which works better across platforms
    const url = `https://wa.me/55${phone}?text=${encodedMessage}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    
    toast.success(`Dica enviada para ${name}!`);
    setShowSendDialog(false);
    resetSendForm();
  };

  const resetSendForm = () => {
    setSelectedClientId("");
    setCustomMessage("");
    setAttachImage(false);
    setCustomPhone("");
    setCustomName("");
    setSendMode('client');
  };

  if (isCollapsed) {
    return (
      <Button
        onClick={() => setIsCollapsed(false)}
        size="icon"
        className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300 w-10 h-10"
        title="Expandir suporte"
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {/* Tips Popover */}
        <Popover open={showTips} onOpenChange={setShowTips}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full shadow-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-300 h-8 text-xs px-3"
            >
              <Lightbulb className="w-3 h-3 mr-1" />
              Dicas AC
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[95vw] max-w-[500px] p-0 bg-background border border-border shadow-xl max-h-[80vh] overflow-hidden" 
            side="top" 
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-500" />
                  Dicas & FAQ - Ar Condicionado
                </h4>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setShowTips(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Tabs defaultValue="problemas" className="w-full">
                <TabsList className="grid w-full grid-cols-4 text-xs h-8">
                  <TabsTrigger value="problemas" className="text-xs px-1">Problemas</TabsTrigger>
                  <TabsTrigger value="manutencao" className="text-xs px-1">Manutenção</TabsTrigger>
                  <TabsTrigger value="instalacao" className="text-xs px-1">Instalação</TabsTrigger>
                  <TabsTrigger value="diagnostico" className="text-xs px-1">Diagnóstico</TabsTrigger>
                </TabsList>

                {Object.entries(acTipsData).map(([key, category]) => (
                  <TabsContent key={key} value={key} className="mt-3 max-h-[50vh] overflow-y-auto">
                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger className="text-sm text-left hover:no-underline py-2">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground">
                            <p className="whitespace-pre-line mb-2">{item.answer}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSendDialog(item)}
                              className="h-7 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Enviar para Cliente
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Improvement suggestions */}
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Sugestões de Melhorias
                </p>
                <div className="flex flex-wrap gap-1">
                  {improvementTips.slice(0, 5).map((tip, index) => (
                    <span 
                      key={index}
                      className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                    >
                      {tip}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  💡 Clique em "Suporte" para solicitar implementações
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Support Button with Collapse */}
        <div className="flex items-center gap-1">
          <Button
            onClick={handleSupportClick}
            variant="outline"
            size="sm"
            className="rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300 h-8 text-xs px-3"
            title="Suporte via WhatsApp"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            Suporte
          </Button>
          <Button
            onClick={() => setIsCollapsed(true)}
            size="icon"
            variant="ghost"
            className="rounded-full w-6 h-6 bg-muted/80 hover:bg-muted text-muted-foreground"
            title="Recolher"
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Send Tip to Client Dialog */}
      <Dialog open={showSendDialog} onOpenChange={(open) => { setShowSendDialog(open); if (!open) resetSendForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-green-600" />
              Enviar Dica via WhatsApp
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Send Mode Tabs */}
            <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as 'client' | 'custom')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="client">Cliente Cadastrado</TabsTrigger>
                <TabsTrigger value="custom">Número Avulso</TabsTrigger>
              </TabsList>

              <TabsContent value="client" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Selecionar Cliente
                  </Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.filter(c => c.telefone).map(client => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.name} - {client.telefone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Número de WhatsApp
                  </Label>
                  <Input
                    value={customPhone}
                    onChange={(e) => setCustomPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome (opcional)
                  </Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nome da pessoa"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className="text-sm"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="attach-image"
                checked={attachImage}
                onChange={(e) => setAttachImage(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="attach-image" className="text-sm flex items-center gap-2 cursor-pointer">
                <Image className="w-4 h-4" />
                Mencionar imagem em anexo
              </Label>
            </div>

            {attachImage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  📸 <strong>Dica:</strong> Após abrir o WhatsApp, anexe a foto manualmente antes de enviar a mensagem.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={sendTipToClient}
              disabled={sendMode === 'client' ? !selectedClientId : customPhone.replace(/\D/g, '').length < 10}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
