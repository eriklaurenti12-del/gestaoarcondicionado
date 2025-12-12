import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, ChevronUp, Lightbulb, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

export default function SupportButton() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const handleSupportClick = () => {
    const whatsappUrl = "https://wa.me/5516992600631?text=Olá%2C+vim+do+sistema+Gestão+de+Negócios+e+preciso+de+suporte";
    window.open(whatsappUrl, '_blank');
  };

  if (isCollapsed) {
    return (
      <Button
        onClick={() => setIsCollapsed(false)}
        size="icon"
        className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300 w-12 h-12"
        title="Expandir suporte"
      >
        <ChevronUp className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {/* Tips Popover */}
      <Popover open={showTips} onOpenChange={setShowTips}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-300"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Dicas
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-background border border-border shadow-xl" 
          side="top" 
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Melhorias Sugeridas
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {improvementTips.map((tip, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-xs font-medium text-primary mt-0.5">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tip}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              💡 Clique em "Suporte" para solicitar implementações
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Support Button with Collapse */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSupportClick}
          variant="outline"
          size="sm"
          className="rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300"
          title="Suporte via WhatsApp"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Suporte
        </Button>
        <Button
          onClick={() => setIsCollapsed(true)}
          size="icon"
          variant="ghost"
          className="rounded-full w-8 h-8 bg-muted/80 hover:bg-muted text-muted-foreground"
          title="Recolher"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
