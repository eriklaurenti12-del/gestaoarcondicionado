import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, Loader2, BookOpen, BarChart3, Users, CalendarDays, 
  Wrench, ShoppingCart, Wallet, Settings, FileCheck, Globe,
  Thermometer, Database, Bell, Shield, Zap, Share2, Radar, Car, FileText
} from "lucide-react";
import jsPDF from 'jspdf';
import { AdminGuideCards } from "@/components/AdminGuideCards";
import { supabase } from "@/integrations/supabase/client";

const getSystemSections = (stats: any) => [
  {
    title: '1. PAINEL PRINCIPAL (Dashboard)',
    icon: BarChart3,
    steps: [
      'Ao entrar no sistema, você verá o Painel Principal com métricas em tempo real.',
      `Atualmente você tem ${stats.clients || 0} clientes, ${stats.products || 0} serviços/peças e ${stats.appointments || 0} agendamentos cadastrados.`,
      'Os cards mostram: total de clientes, agendamentos do dia, faturamento mensal e OS pendentes.',
      'Use os gráficos para acompanhar evolução de receita e serviços mês a mês.',
      'Clique em qualquer métrica para ir diretamente à seção correspondente.',
    ]
  },
  {
    title: '2. CADASTROS (Clientes e Fornecedores)',
    icon: Users,
    steps: [
      'Acesse "Cadastros" no menu lateral para gerenciar clientes e fornecedores.',
      'Para adicionar um cliente: clique em "+ Novo Cliente", preencha nome, telefone, email, endereço e CPF/CNPJ.',
      'Na aba de equipamentos do cliente, cadastre cada ar-condicionado com marca, modelo, BTUs e local de instalação.',
      'Use a busca rápida para encontrar clientes por nome, telefone ou email.',
      'Fornecedores: cadastre com dados de contato, CNPJ e condições de pagamento.',
    ]
  },
  {
    title: '3. AGENDA (Agendamentos)',
    icon: CalendarDays,
    steps: [
      'Acesse "Agenda" para ver todos os compromissos em formato calendário ou lista.',
      'Para agendar: clique no dia desejado ou use o botão "+ Novo Agendamento".',
      'Selecione o cliente, serviço, data/hora e adicione observações.',
      'Altere o status: Pendente → Em Andamento → Concluído → Cancelado.',
      'Anexe fotos do serviço (antes/depois) diretamente no agendamento.',
    ]
  },
  {
    title: '4. AGENDAMENTO ONLINE',
    icon: Globe,
    steps: [
      'Ative o agendamento online para que seus clientes marquem horários pela internet.',
      'Compartilhe o link público de agendamento via WhatsApp ou redes sociais.',
      'Os agendamentos aparecem automaticamente na sua agenda com status "Pendente".',
      'Confirme ou recuse cada solicitação recebida.',
    ]
  },
  {
    title: '5. ORÇAMENTOS E ORDENS DE SERVIÇO',
    icon: FileCheck,
    steps: [
      'Em "Orçamentos & O.S.", crie documentos profissionais para seus clientes.',
      `Você tem ${stats.quotes || 0} orçamentos e ${stats.orders || 0} ordens de serviço registradas.`,
      'Orçamento: adicione serviços, peças, quantidades e valores. O total é calculado automaticamente.',
      'Aplique descontos por porcentagem ou valor fixo.',
      'Converta um orçamento aprovado em Ordem de Serviço com um clique.',
      'Gere PDFs profissionais com dados da sua empresa e envie por WhatsApp.',
      'Colete assinatura digital do cliente na OS concluída.',
    ]
  },
  {
    title: '6. MANUTENÇÕES PREVENTIVAS',
    icon: Wrench,
    steps: [
      'Cadastre contratos de manutenção preventiva com intervalo em meses.',
      'O sistema gera alertas automáticos quando a próxima manutenção está chegando.',
      'Acompanhe o histórico de todas as manutenções realizadas por equipamento.',
      'Defina valores mensais do contrato e acompanhe a receita recorrente.',
    ]
  },
  {
    title: '7. MEDIÇÃO DE BTUs',
    icon: Thermometer,
    steps: [
      'Use a calculadora de BTUs para dimensionar o ar-condicionado ideal.',
      'Informe: área do ambiente, quantidade de pessoas, janelas, eletrônicos e exposição solar.',
      'O sistema calcula automaticamente a capacidade necessária em BTUs.',
      'Gere um relatório profissional para apresentar ao cliente.',
    ]
  },
  {
    title: '8. PDV / VENDAS',
    icon: ShoppingCart,
    steps: [
      'O PDV (Ponto de Venda) permite registrar vendas de produtos e peças.',
      'Selecione o cliente, adicione produtos ao carrinho, escolha forma de pagamento.',
      'Formas aceitas: Dinheiro, PIX, Débito e Crédito.',
      'Para crédito, defina o número de parcelas e o sistema calcula automaticamente.',
      'O estoque é atualizado automaticamente após cada venda.',
    ]
  },
  {
    title: '9. FINANCEIRO',
    icon: Wallet,
    steps: [
      'Acompanhe entradas e saídas em "Financeiro".',
      'Registre receitas e despesas manuais com categoria, data e forma de pagamento.',
      'Veja relatórios por período: diário, semanal, mensal ou personalizado.',
      'Controle parcelas a receber/pagar e marque como pagas.',
      'Acompanhe despesas fixas (aluguel, combustível, ajudante) separadamente.',
      'Gere relatórios financeiros em PDF para controle contábil.',
    ]
  },
  {
    title: '10. IMPOSTOS',
    icon: Wallet,
    steps: [
      'Registre receitas de serviços e produtos mês a mês.',
      'Informe gastos com material, combustível e equipamentos.',
      'O sistema calcula estimativas de DAS (MEI), ISS, INSS e IRRF.',
      'Se tem funcionários, registre salário, INSS e FGTS do empregado.',
    ]
  },
  {
    title: '11. MINHA EMPRESA',
    icon: Settings,
    steps: [
      'Em "Minha Empresa", cadastre os dados que aparecerão nos documentos.',
      'Preencha: nome da empresa, CNPJ/CPF, endereço, telefone e email.',
      'Faça upload do logotipo para usar em orçamentos e OS.',
      'Esses dados são usados automaticamente em todos os PDFs gerados.',
    ]
  },
  {
    title: '12. EQUIPE E PORTAL',
    icon: Shield,
    steps: [
      `Você tem ${stats.teamMembers || 0} membro(s) na equipe cadastrados.`,
      'Cadastre membros com nome, WhatsApp e PIN de 4 dígitos.',
      'Funções: Painel Admin (somente Dashboard), Suporte (Dashboard + Agenda + Cadastros), Sistema Completo.',
      'Membros acessam pelo link /portal com nome + PIN, sem precisar de email.',
      'O admin pode desativar membros a qualquer momento.',
    ]
  },
  {
    title: '13. NOTIFICAÇÕES',
    icon: Bell,
    steps: [
      'Configure alertas para parcelas vencendo, agendamentos do dia e manutenções.',
      'Ative/desative cada tipo de notificação individualmente.',
      'As notificações aparecem no sino 🔔 no topo do sistema.',
    ]
  },
  {
    title: '14. BACKUP',
    icon: Database,
    steps: [
      'Em "Backup", exporte todos os dados do sistema para segurança.',
      'Faça backup regularmente para não perder informações importantes.',
      'Os dados são exportados em formato que pode ser reimportado.',
    ]
  },
  {
    title: '15. LANDING PAGE & MARKETING',
    icon: Share2,
    steps: [
      'No painel admin, edite completamente sua landing page de vendas.',
      'Use a IA para gerar textos, FAQ, depoimentos e ofertas.',
      'Configure pixel do Facebook, Google e TikTok para anúncios.',
      'Links de checkout integrados com Kiwify, Hotmart ou outras plataformas.',
      'Ative o banner promocional e contagem regressiva.',
    ]
  },
  {
    title: '16. RADAR DE MANUTENÇÕES',
    icon: Radar,
    steps: [
      'O Radar de Manutenções monitora automaticamente todos os serviços concluídos.',
      'Ele calcula a data da próxima visita baseada no tempo de garantia cadastrado no serviço.',
      'Vencimentos próximos (15 dias) e serviços já vencidos são destacados no Dashboard.',
      'Use o botão "Avisar" para enviar uma mensagem automática via WhatsApp oferecendo a manutenção.',
    ]
  },
  {
    title: '17. GESTÃO DE EQUIPES E ROTAS',
    icon: Car,
    steps: [
      'Em "Prestadores", você pode organizar as rotas do dia para cada equipe.',
      'Selecione os serviços pendentes e atribua a um prestador específico.',
      'Lance gastos previstos (combustível, alimentação) para controlar o lucro da rota.',
      'Gere o link do Google Maps com todas as paradas do dia para o GPS do técnico.',
      'Monitore em tempo real quais serviços da rota já foram concluídos.',
    ]
  },
  {
    title: '18. RECIBOS E DOCUMENTOS',
    icon: FileText,
    steps: [
      'No Histórico Geral, agora você pode gerar um Recibo Profissional de cada serviço.',
      'O recibo inclui dados do cliente, serviço realizado, valor e data do próximo vencimento.',
      'Documentos como Orçamentos e O.S. podem ser salvos em PDF ou enviados por WhatsApp.',
      'Colete assinaturas digitais diretamente na tela do celular para maior segurança jurídica.',
    ]
  },
  {
    title: '19. SISTEMA SIMPLIFICADO (BETA)',
    icon: Zap,
    steps: [
      'Acesse o "Sistema Simplificado" para uma interface focada em uso móvel.',
      'Ideal para técnicos de campo que precisam apenas de Agenda, Clientes e Financeiro rápido.',
      'Alterne entre o modo completo e simplificado no menu lateral a qualquer momento.',
    ]
  },
];

export const AdminSystemGuideTab: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clients, products, appointments, quotes, orders, team] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        supabase.from('quotes').select('id', { count: 'exact', head: true }),
        supabase.from('service_orders').select('id', { count: 'exact', head: true }),
        supabase.from('team_members').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        clients: clients.count || 0,
        products: products.count || 0,
        appointments: appointments.count || 0,
        quotes: quotes.count || 0,
        orders: orders.count || 0,
        teamMembers: team.count || 0,
      });
    } catch {}
  };

  const systemSections = getSystemSections(stats);

  const generatePDF = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const addPage = () => { doc.addPage(); y = 20; };
      const checkPage = (needed: number) => { if (y + needed > 270) addPage(); };

      // Cover
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 297, 'F');
      doc.setTextColor(6, 182, 212);
      doc.setFontSize(28);
      doc.text('AC Service Pro', pageWidth / 2, 80, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(148, 163, 184);
      doc.text('Guia Completo do Sistema', pageWidth / 2, 95, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`${systemSections.length} seções • Manual Atualizado`, pageWidth / 2, 108, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 125, { align: 'center' });
      
      // Stats on cover
      doc.setTextColor(6, 182, 212);
      doc.setFontSize(10);
      doc.text(`📊 ${stats.clients || 0} Clientes | ${stats.products || 0} Serviços | ${stats.appointments || 0} Agendamentos`, pageWidth / 2, 145, { align: 'center' });

      // Table of contents
      addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 297, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.text('Índice', margin, y);
      y += 12;
      doc.setFontSize(10);
      systemSections.forEach((section) => {
        checkPage(8);
        doc.setTextColor(71, 85, 105);
        doc.text(section.title, margin, y);
        y += 7;
      });

      // Content
      systemSections.forEach((section) => {
        addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 297, 'F');

        doc.setFillColor(6, 182, 212);
        doc.rect(margin, y - 4, contentWidth, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(section.title, margin + 4, y + 3);
        y += 16;

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        section.steps.forEach((step, i) => {
          checkPage(14);
          doc.setTextColor(6, 182, 212);
          doc.text(`${i + 1}.`, margin, y);
          doc.setTextColor(51, 65, 85);
          const lines = doc.splitTextToSize(step, contentWidth - 12);
          doc.text(lines, margin + 8, y);
          y += lines.length * 5.5 + 4;
        });
      });

      checkPage(30);
      y += 10;
      doc.setFillColor(240, 249, 255);
      doc.rect(margin, y, contentWidth, 25, 'F');
      doc.setTextColor(6, 182, 212);
      doc.setFontSize(11);
      doc.text('Dúvidas? Entre em contato pelo WhatsApp!', margin + 4, y + 10);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text('Este guia foi gerado automaticamente pelo AC Service Pro.', margin + 4, y + 18);

      doc.save('Guia-Completo-AC-Service-Pro.pdf');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminGuideCards tab="system-guide" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Guia Completo do Sistema</h2>
            <p className="text-muted-foreground text-sm">
              {systemSections.length} seções • Atualizado automaticamente com seus dados
            </p>
          </div>
        </div>
        <Button onClick={generatePDF} disabled={generating} size="lg" className="gap-2">
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {generating ? 'Gerando PDF...' : 'Baixar PDF Completo'}
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Clientes', value: stats.clients },
          { label: 'Serviços', value: stats.products },
          { label: 'Agendamentos', value: stats.appointments },
          { label: 'Orçamentos', value: stats.quotes },
          { label: 'O.S.', value: stats.orders },
          { label: 'Equipe', value: stats.teamMembers },
        ].map(s => (
          <div key={s.label} className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold text-primary">{s.value ?? '...'}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        {systemSections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="outline" className="shrink-0 w-5 h-5 flex items-center justify-center text-[10px] p-0 mt-0.5">
                        {i + 1}
                      </Badge>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSystemGuideTab;
