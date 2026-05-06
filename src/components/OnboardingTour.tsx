import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, Users, Package, FileText, DollarSign, BarChart3, 
  Settings, Wind, Wrench, Receipt, ChevronRight, ChevronLeft, 
  CheckCircle, Sparkles, Target, Clock, Shield, Star
} from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  tip?: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Bem-vindo ao AC Service Pro! 🎉",
    description: "Seu sistema completo para gerenciar sua empresa de ar condicionado. Vamos fazer um tour rápido para você conhecer todas as funcionalidades.",
    icon: <Sparkles className="w-12 h-12 text-cyan-500" />,
    features: [
      "Sistema 100% online e seguro",
      "Funciona em celular, tablet e computador",
      "Dados sincronizados em tempo real",
      "Suporte via WhatsApp"
    ],
    tip: "Você pode acessar este tour novamente nas configurações!"
  },
  {
    title: "📅 Agendamentos",
    description: "Gerencie todos os seus atendimentos de forma visual e organizada. Nunca mais perca um serviço!",
    icon: <Calendar className="w-12 h-12 text-blue-500" />,
    features: [
      "Calendário visual com todos os atendimentos",
      "Arraste e solte para reagendar",
      "Status: Agendado, Em andamento, Concluído",
      "Adicione fotos antes e depois do serviço",
      "Vincule cliente e serviço automaticamente"
    ],
    tip: "Clique em um horário vazio para criar novo agendamento rapidamente!"
  },
  {
    title: "👥 Clientes",
    description: "Cadastre e gerencie todos os seus clientes com histórico completo de serviços.",
    icon: <Users className="w-12 h-12 text-green-500" />,
    features: [
      "Cadastro completo com CPF/CNPJ",
      "Histórico de todos os serviços",
      "Equipamentos cadastrados por cliente",
      "Envio de mensagens via WhatsApp",
      "Exportação para PDF"
    ],
    tip: "Use a busca para encontrar clientes rapidamente pelo nome ou telefone!"
  },
  {
    title: "❄️ Equipamentos do Cliente",
    description: "Cadastre os ar condicionados de cada cliente e acompanhe garantia e manutenções.",
    icon: <Wind className="w-12 h-12 text-cyan-400" />,
    features: [
      "Marca, modelo e BTUs",
      "Número de série e local de instalação",
      "Controle de garantia automático",
      "Próxima manutenção programada",
      "Alertas de manutenção atrasada"
    ],
    tip: "O sistema avisa automaticamente quando a garantia está para vencer!"
  },
  {
    title: "🔧 Manutenção Preventiva",
    description: "Agende limpezas e manutenções preventivas para fidelizar clientes.",
    icon: <Wrench className="w-12 h-12 text-orange-500" />,
    features: [
      "Agendamento por equipamento",
      "Intervalos de 3, 6 ou 12 meses",
      "Alertas visuais no Dashboard",
      "Histórico de manutenções realizadas",
      "Notificação de manutenções atrasadas"
    ],
    tip: "Manutenções preventivas aumentam a fidelização em até 70%!"
  },
  {
    title: "📦 Serviços e Produtos",
    description: "Cadastre seus serviços e produtos com controle de preços e estoque.",
    icon: <Package className="w-12 h-12 text-purple-500" />,
    features: [
      "Preço de custo e venda",
      "Cálculo automático de margem de lucro",
      "Controle de estoque com alertas",
      "Catálogo para clientes (sem custos)",
      "Código de barras para produtos"
    ],
    tip: "Exporte dois PDFs: um interno com custos e outro para enviar ao cliente!"
  },
  {
    title: "📋 Ordens de Serviço",
    description: "Crie ordens de serviço profissionais com assinatura digital do cliente.",
    icon: <FileText className="w-12 h-12 text-indigo-500" />,
    features: [
      "Geração automática de número",
      "Serviços e peças detalhados",
      "Desconto por percentual ou valor",
      "Assinatura digital do cliente",
      "Exportação em PDF profissional"
    ],
    tip: "A assinatura digital tem validade jurídica!"
  },
  {
    title: "💰 Financeiro",
    description: "Controle total das suas finanças: receitas, despesas e lucro real.",
    icon: <DollarSign className="w-12 h-12 text-emerald-500" />,
    features: [
      "Registro de entradas e saídas",
      "Parcelamentos e controle de parcelas",
      "Gastos fixos mensais",
      "Lucro por período",
      "Gráficos de evolução"
    ],
    tip: "Vincule gastos aos atendimentos para saber o lucro real de cada serviço!"
  },
  {
    title: "📊 Impostos e Contabilidade",
    description: "Organize seus dados para a contabilidade e calcule impostos.",
    icon: <Receipt className="w-12 h-12 text-red-500" />,
    features: [
      "Faturamento mensal automático",
      "Cálculo de DAS, INSS, FGTS",
      "Gastos com funcionários",
      "Relatório para contador em PDF",
      "Histórico por mês"
    ],
    tip: "Puxe os dados automaticamente das vendas e agendamentos!"
  },
  {
    title: "📈 Dashboard",
    description: "Visão geral do seu negócio com métricas importantes.",
    icon: <BarChart3 className="w-12 h-12 text-pink-500" />,
    features: [
      "Faturamento do mês",
      "Melhores clientes",
      "Serviços mais realizados",
      "Próximos agendamentos",
      "Alertas de manutenção"
    ],
    tip: "O Dashboard atualiza automaticamente conforme você trabalha!"
  },
  {
    title: "⚙️ Configurações",
    description: "Personalize o sistema com os dados da sua empresa.",
    icon: <Settings className="w-12 h-12 text-muted-foreground" />,
    features: [
      "Dados da empresa para documentos",
      "Logo e informações de contato",
      "Backup dos dados",
      "Tema claro/escuro",
      "Gerenciar assinatura"
    ],
    tip: "Preencha os dados da empresa para aparecerem nos orçamentos!"
  },
  {
    title: "📱 Instale o App!",
    description: "Instale o sistema no seu celular ou computador para acesso rápido sem abrir o navegador.",
    icon: <Star className="w-12 h-12 text-primary" />,
    features: [
      "Funciona offline para consultas rápidas",
      "Ícone direto na tela inicial",
      "Notificações de agendamentos no celular",
      "Atualizações automáticas",
      "Clique em 'Baixe nosso App' na barra lateral"
    ],
    tip: "No Android: Menu do navegador > 'Instalar app'. No iPhone: Compartilhar > 'Adicionar à Tela Inicial'."
  },
  {
    title: "🚀 Pronto para Começar!",
    description: "Você completou o tour! Agora é só começar a usar o sistema.",
    icon: <Target className="w-12 h-12 text-primary" />,
    features: [
      "✅ Cadastre seus primeiros clientes",
      "✅ Adicione seus serviços e produtos",
      "✅ Crie seu primeiro agendamento",
      "✅ Preencha os dados da empresa",
      "✅ Explore todas as funcionalidades!"
    ],
    tip: "Qualquer dúvida, use o botão de suporte no canto da tela!"
  }
];

interface OnboardingTourProps {
  open: boolean;
  onComplete: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ open, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header com progresso */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {currentStep + 1} de {steps.length}
            </Badge>
            {!isLastStep && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSkip}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                Pular tour
              </Button>
            )}
          </div>
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>

        {/* Conteúdo */}
        <div className={`p-6 transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
              {step.icon}
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <DialogDescription className="text-base mt-2">
                {step.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-4">
            {step.features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2 text-sm text-muted-foreground animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Dica */}
          {step.tip && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-amber-800 dark:text-amber-200">
                  <strong>Dica:</strong> {step.tip}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer com navegação */}
        <DialogFooter className="p-4 bg-muted/30 border-t">
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              onClick={handleNext}
              className="gap-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            >
              {isLastStep ? (
                <>
                  Começar a Usar
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTour;
