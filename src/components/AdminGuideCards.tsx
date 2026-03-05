import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Bell, Zap, Webhook, Megaphone, Share2, Gift, Menu, 
  Settings2, Target, Palette, MessageSquare, DollarSign, Video,
  HelpCircle, ImagePlus, Star, Clock, Layout, Shield,
  Monitor, UserPlus, Link2, Sparkles
} from "lucide-react";

interface AdminGuideProps {
  tab: string;
}

const guideData: Record<string, { icon: any; title: string; badge: string; color: string; description: string }[]> = {
  team: [
    { icon: Users, title: 'Equipe', badge: 'GESTÃO', color: 'cyan', description: 'Gerencie membros da equipe, defina funções (Admin, Sistema, Suporte) e controle o acesso via PIN ao portal de equipe.' },
    { icon: Shield, title: 'Convites', badge: 'SEGURANÇA', color: 'emerald', description: 'Gere códigos de convite únicos para adicionar novos membros. Cada código é de uso único e pode ser revogado.' },
  ],
  users: [
    { icon: UserPlus, title: 'Usuários Cadastrados', badge: 'MEMBROS', color: 'blue', description: 'Veja todos os usuários registrados, seus planos, status de pagamento e informações de contato.' },
    { icon: Monitor, title: 'Gerenciamento', badge: 'ADMIN', color: 'purple', description: 'Ative/desative assinaturas, altere planos, bloqueie ou exclua usuários diretamente daqui.' },
  ],
  notifications: [
    { icon: Bell, title: 'Central de Notificações', badge: 'TEMPO REAL', color: 'green', description: 'Receba alertas em tempo real de novos cadastros, pagamentos e atividades dos usuários no sistema.' },
    { icon: MessageSquare, title: 'Ações Rápidas', badge: 'CONTATO', color: 'amber', description: 'Envie mensagens via WhatsApp direto da notificação, marque como lida ou exclua notificações antigas.' },
  ],
  integrations: [
    { icon: Zap, title: 'Integrações de Pagamento', badge: 'WEBHOOK', color: 'amber', description: 'Configure webhooks para receber notificações automáticas de pagamento de plataformas como Kiwify, Hotmart, etc.' },
    { icon: Shield, title: 'Testes & Validação', badge: 'DEBUG', color: 'emerald', description: 'Teste suas integrações com payloads simulados para garantir que tudo funciona antes de ir ao ar.' },
  ],
  n8n: [
    { icon: Webhook, title: 'Automações n8n', badge: 'AVANÇADO', color: 'purple', description: 'Configure webhooks para n8n/Zapier e automatize envio de emails, mensagens WhatsApp e notificações personalizadas.' },
    { icon: Zap, title: 'Gatilhos', badge: 'EVENTOS', color: 'cyan', description: 'Defina gatilhos para novos cadastros, pagamentos aprovados ou ações manuais que disparam suas automações.' },
  ],
  landing: [
    { icon: Layout, title: 'Templates', badge: 'DESIGN', color: 'cyan', description: 'Escolha entre 4 templates de landing page: Persuasão, VSL, Minimalista ou Custom. Cada um otimizado para conversão.' },
    { icon: Megaphone, title: 'Editor Completo', badge: 'TUDO EM 1', color: 'amber', description: 'Edite textos, preços, cores, FAQ, depoimentos, vídeos, notificações, pixels e fundos — tudo pelo painel sem código.' },
  ],
  'landing-textos': [
    { icon: Megaphone, title: 'Textos & Copy', badge: 'PERSUASÃO', color: 'blue', description: 'Edite títulos, subtítulos, descrições e badges de urgência. Textos otimizados para conversão com gatilhos mentais.' },
  ],
  'landing-precos': [
    { icon: DollarSign, title: 'Preços & Ofertas', badge: 'VENDAS', color: 'green', description: 'Configure valores dos planos mensal e anual, economia, preço original riscado e textos dos botões de checkout.' },
  ],
  'landing-cores': [
    { icon: Palette, title: 'Cores & Visual', badge: 'DESIGN', color: 'purple', description: 'Personalize a paleta de cores: primária, secundária, destaque, fundo e botão CTA. Todas as cores se aplicam em tempo real.' },
  ],
  'landing-depoimentos': [
    { icon: Star, title: 'Depoimentos', badge: 'PROVA SOCIAL', color: 'amber', description: 'Adicione até 4 depoimentos com nome, cargo, texto, foto e vídeo. Depoimentos reais aumentam a confiança e conversão.' },
  ],
  'landing-faq': [
    { icon: HelpCircle, title: 'Perguntas Frequentes', badge: 'FAQ', color: 'cyan', description: 'Configure até 6 perguntas e respostas. Elimine objeções dos visitantes e aumente a taxa de conversão.' },
  ],
  'landing-video': [
    { icon: Video, title: 'Vídeo de Vendas (VSL)', badge: 'CONVERSÃO', color: 'rose', description: 'Adicione um vídeo de vendas (YouTube, Vimeo ou upload). Opcionalmente trave a navegação até o visitante assistir.' },
  ],
  'landing-notificacoes': [
    { icon: Bell, title: 'Notificações de Compra', badge: 'SOCIAL PROOF', color: 'green', description: 'Configure notificações simuladas de compra com nomes, cidades e ações personalizáveis. Inclui som customizável.' },
  ],
  'landing-pixel': [
    { icon: Target, title: 'Pixels de Rastreamento', badge: 'ADS', color: 'blue', description: 'Adicione IDs do Facebook Pixel, Google Ads e TikTok Pixel. O código é gerado automaticamente para copiar e usar nos seus anúncios.' },
  ],
  'landing-background': [
    { icon: ImagePlus, title: 'Fundos & Efeitos', badge: 'VISUAL', color: 'purple', description: 'Faça upload de imagens de fundo, escolha efeitos visuais (grade, pontos, gradiente), ajuste cores e opacidade de cada seção.' },
  ],
  'landing-extras': [
    { icon: Clock, title: 'Countdown & Extras', badge: 'URGÊNCIA', color: 'orange', description: 'Configure contador regressivo, prova social (qtd técnicos, nota) e dias de garantia para criar urgência e confiança.' },
  ],
  share: [
    { icon: Link2, title: 'Links do Sistema', badge: 'COMPARTILHAR', color: 'cyan', description: 'Copie e compartilhe os links da landing page, login e cadastro. Use em redes sociais, WhatsApp e anúncios.' },
  ],
  raffle: [
    { icon: Gift, title: 'Sorteio de Prêmios', badge: 'ENGAJAMENTO', color: 'amber', description: 'Sorteie prêmios entre os membros ativos. Ideal para fidelizar clientes e premiar assinantes com meses grátis ou brindes.' },
    { icon: Users, title: 'Histórico', badge: 'REGISTRO', color: 'emerald', description: 'Acompanhe o histórico de todos os sorteios realizados, ganhadores e status de resgate do prêmio.' },
  ],
  'sidebar-config': [
    { icon: Menu, title: 'Configuração do Menu', badge: 'LAYOUT', color: 'purple', description: 'Reorganize a ordem das seções e itens do menu lateral. Arraste e solte para personalizar a navegação dos usuários.' },
  ],
  settings: [
    { icon: Settings2, title: 'Configurações Gerais', badge: 'SISTEMA', color: 'cyan', description: 'Configure links de checkout (Kiwify/Hotmart), WhatsApp de suporte e data da promoção para o countdown.' },
    { icon: DollarSign, title: 'Links de Pagamento', badge: 'CHECKOUT', color: 'green', description: 'Cole os links de checkout dos planos mensal e anual. Os botões da landing page redirecionarão automaticamente.' },
  ],
  checkout: [
    { icon: Link2, title: 'Checkout Externo', badge: 'PAGAMENTO', color: 'green', description: 'Cole links da Kiwify/Hotmart aqui OU nas Configurações de Checkout. O sistema usa automaticamente o link disponível.' },
    { icon: Sparkles, title: 'Ativação Automática', badge: 'WEBHOOK', color: 'cyan', description: 'Configure o webhook da sua plataforma para ativar a assinatura automaticamente após o pagamento ser confirmado.' },
  ],
  'system-guide': [
    { icon: HelpCircle, title: 'Manual do Sistema', badge: 'PDF', color: 'blue', description: 'Gere um PDF completo com passo a passo de todas as funcionalidades do sistema para impressão ou compartilhamento.' },
  ],
};

const colorMap: Record<string, { bg: string; text: string; badgeBorder: string; badgeText: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', badgeBorder: 'border-blue-500/30', badgeText: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', badgeBorder: 'border-emerald-500/30', badgeText: 'text-emerald-600' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', badgeBorder: 'border-amber-500/30', badgeText: 'text-amber-600' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', badgeBorder: 'border-cyan-500/30', badgeText: 'text-cyan-600' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', badgeBorder: 'border-purple-500/30', badgeText: 'text-purple-600' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', badgeBorder: 'border-rose-500/30', badgeText: 'text-rose-600' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', badgeBorder: 'border-orange-500/30', badgeText: 'text-orange-600' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500', badgeBorder: 'border-green-500/30', badgeText: 'text-green-600' },
};

export const AdminGuideCards: React.FC<AdminGuideProps> = ({ tab }) => {
  const cards = guideData[tab];
  if (!cards || cards.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 ${cards.length > 1 ? 'md:grid-cols-2' : ''} gap-3 mb-4`}>
      {cards.map((card, idx) => {
        const colors = colorMap[card.color] || colorMap.blue;
        const Icon = card.icon;
        return (
          <Card key={idx} className="border border-border/50 bg-muted/30">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${colors.bg} shrink-0`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-xs">{card.title}</h3>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${colors.badgeBorder} ${colors.badgeText}`}>
                      {card.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{card.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminGuideCards;
