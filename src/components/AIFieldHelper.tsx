import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle, Sparkles, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIFieldHelperProps {
  context: string;
  fieldName: string;
  onSuggestion?: (text: string) => void;
  compact?: boolean;
}

const quickHelp: Record<string, string> = {
  'titulo': '💡 Títulos curtos (5-8 palavras) com urgência convertem melhor. Ex: "Pare de Perder Dinheiro Agora"',
  'subtitulo': '💡 Complemente o título com benefício direto. Ex: "Sistema que organiza tudo no seu celular"',
  'descricao': '💡 Foque nas dores do cliente: anotar no papel, esquecer cobranças, não saber o lucro.',
  'badge': '💡 Use emojis + urgência: "🔥 Últimas vagas", "⚡ Oferta especial"',
  'cta': '💡 Botões com ação forte: "QUERO COMEÇAR AGORA", "PARAR DE PERDER DINHEIRO"',
  'faq': '💡 Responda objeções: preço, dificuldade, segurança, cancelamento.',
  'depoimento': '💡 Depoimentos reais com nome, cidade e resultado específico geram mais confiança.',
  'preco': '💡 Mostre o preço riscado original e destaque a economia. Preço anual com desconto converte mais.',
  'pixel': '💡 Cole apenas o ID do pixel (números). O código é gerado automaticamente.',
  'checkout': '💡 Se o link não funcionar, verifique: 1) Começa com https:// 2) Checkout está ativo 3) Link não expirou',
  'whatsapp': '💡 Use formato: https://wa.me/5511999999999 (sem espaços ou traços)',
  'cor': '💡 Cores complementares funcionam melhor. Botão CTA verde ou laranja se destaca em fundo escuro.',
  'video': '💡 Vídeos de vendas de 3-5 minutos convertem melhor. Use YouTube ou faça upload direto.',
  'notificacao': '💡 Notificações de compra geram prova social. Intervalo de 8-15 segundos é ideal.',
  'background': '💡 Imagens escuras com overlay funcionam melhor. Opacidade 60-80% mantém a legibilidade.',
  'oferta': '💡 Liste 4-6 benefícios. Comece com o mais impactante. Use ✓ ou ✅ para checkmarks.',
  'garantia': '💡 Garantia de 7 dias elimina objeção de risco. Mencione "100% do dinheiro de volta".',
  'banner': '💡 Banners com urgência (tempo limitado, poucas vagas) geram cliques. Cor vermelha chama atenção.',
  'default': '💡 Dica: textos curtos, diretos e com benefício claro convertem mais.',
};

const getHelpKey = (context: string, fieldName: string): string => {
  const combined = `${context} ${fieldName}`.toLowerCase();
  if (combined.includes('titulo') || combined.includes('title')) return 'titulo';
  if (combined.includes('subtitulo')) return 'subtitulo';
  if (combined.includes('descricao') || combined.includes('description')) return 'descricao';
  if (combined.includes('badge') || combined.includes('urgencia')) return 'badge';
  if (combined.includes('cta') || combined.includes('botao') || combined.includes('btn')) return 'cta';
  if (combined.includes('faq') || combined.includes('pergunta') || combined.includes('resposta')) return 'faq';
  if (combined.includes('depoimento') || combined.includes('testimonial')) return 'depoimento';
  if (combined.includes('preco') || combined.includes('price') || combined.includes('valor')) return 'preco';
  if (combined.includes('pixel')) return 'pixel';
  if (combined.includes('checkout') || combined.includes('link')) return 'checkout';
  if (combined.includes('whatsapp')) return 'whatsapp';
  if (combined.includes('cor') || combined.includes('color')) return 'cor';
  if (combined.includes('video') || combined.includes('vsl')) return 'video';
  if (combined.includes('notif')) return 'notificacao';
  if (combined.includes('background') || combined.includes('fundo') || combined.includes('imagem')) return 'background';
  if (combined.includes('oferta') || combined.includes('feature') || combined.includes('beneficio')) return 'oferta';
  if (combined.includes('garantia')) return 'garantia';
  if (combined.includes('banner')) return 'banner';
  return 'default';
};

export const AIFieldHelper: React.FC<AIFieldHelperProps> = ({ context, fieldName, onSuggestion, compact = true }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');

  const helpKey = getHelpKey(context, fieldName);
  const staticHelp = quickHelp[helpKey] || quickHelp.default;

  const askAI = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-ai-assistant', {
        body: { 
          message: `Me dê uma dica rápida e prática (máx 2 frases) sobre como preencher o campo "${fieldName}" na seção "${context}" de uma landing page de vendas para sistema de ar condicionado. Seja direto e dê um exemplo prático.`,
          history: []
        }
      });
      if (error) throw error;
      setAiTip(data?.reply || 'Sem resposta da IA.');
    } catch {
      setAiTip('Erro ao consultar IA. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center rounded-full w-5 h-5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ml-1" title="Ajuda">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{staticHelp}</p>
          
          {aiTip && (
            <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-foreground leading-relaxed">{aiTip}</p>
            </div>
          )}
          
          <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10" 
            onClick={askAI} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'Consultando...' : 'Pedir dica à IA'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AIFieldHelper;
