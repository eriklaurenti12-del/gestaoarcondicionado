import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, Loader2, BookOpen, BarChart3, Users, CalendarDays,
  Wrench, ShoppingCart, Wallet, Settings, FileCheck, Globe,
  Thermometer, Database, Bell, Shield, Zap, Share2, Radar, Car, FileText,
  FileDown, Package, ClipboardList,
} from "lucide-react";
import jsPDF from 'jspdf';
import { AdminGuideCards } from "@/components/AdminGuideCards";
import { supabase } from "@/integrations/supabase/client";

// ----------------- Types -----------------
type MockupKind =
  | 'dashboard' | 'list' | 'calendar' | 'form' | 'kanban' | 'pdv'
  | 'finance' | 'taxes' | 'settings' | 'team' | 'notifications'
  | 'backup' | 'landing' | 'radar' | 'route' | 'receipt' | 'mobile'
  | 'online-booking' | 'btu' | 'maintenance' | 'quote';

interface Section {
  id: string;
  title: string;
  short: string;            // short title for buttons
  icon: any;
  // Color palette per section (RGB)
  accent: [number, number, number];
  bgTint: [number, number, number];
  intro: string;            // 1-2 line intro for the PDF
  steps: { title: string; text: string }[];
  tips?: string[];
  mockup: MockupKind;
}

// ----------------- Sections -----------------
const buildSections = (stats: any): Section[] => [
  {
    id: 'dashboard',
    title: '1. PAINEL PRINCIPAL (Dashboard)',
    short: 'Painel',
    icon: BarChart3,
    accent: [6, 182, 212],
    bgTint: [236, 254, 255],
    intro: 'Visão geral em tempo real do seu negócio: receita, agenda, vencimentos e alertas.',
    steps: [
      { title: 'Acesse o Painel', text: 'No menu lateral clique em "Painel". Os cards do topo mostram clientes, agendamentos do dia, faturamento do mês e OS pendentes.' },
      { title: 'Leia os números reais', text: `Hoje você tem ${stats.clients || 0} clientes, ${stats.products || 0} serviços/peças e ${stats.appointments || 0} agendamentos. Clique em qualquer card para ir direto à seção.` },
      { title: 'Use os gráficos', text: 'Os gráficos comparam receita e quantidade de serviços por mês. Use para identificar meses fortes/fracos e planejar campanhas.' },
      { title: 'Notificações no sino 🔔', text: 'No topo direito o sino mostra alertas: pagamentos recebidos, novos agendamentos online e parcelas vencendo.' },
      { title: 'Atalhos rápidos', text: 'Cards "Ações Rápidas" abrem em 1 clique: novo agendamento, novo orçamento, novo cliente e venda no PDV.' },
    ],
    tips: [
      'Olhe o painel pelo menos 1x ao dia logo cedo — ele resume o que precisa de atenção.',
      'Se um número parece errado, clique nele para ver a lista detalhada e identificar o registro.',
    ],
    mockup: 'dashboard',
  },
  {
    id: 'cadastros',
    title: '2. CADASTROS (Clientes e Fornecedores)',
    short: 'Cadastros',
    icon: Users,
    accent: [16, 185, 129],
    bgTint: [240, 253, 244],
    intro: 'Base de clientes, equipamentos e fornecedores — tudo o resto depende disso estar bem preenchido.',
    steps: [
      { title: 'Abra "Cadastros"', text: 'No menu lateral entre em "Cadastros". A primeira aba é Clientes, a segunda Fornecedores.' },
      { title: 'Novo cliente', text: 'Clique em "+ Novo Cliente" e preencha nome, telefone (com DDD), email, endereço completo e CPF/CNPJ. Marque "É empresa" para PJ.' },
      { title: 'Equipamentos do cliente', text: 'Dentro do cliente, aba "Equipamentos": cadastre cada ar com marca, modelo, BTUs, número de série e local instalado. Isso alimenta o radar de manutenção.' },
      { title: 'Busca e filtros', text: 'A busca aceita parte do nome, telefone ou email. Use também os filtros PF/PJ para listar separadamente.' },
      { title: 'Fornecedores', text: 'Cadastre fornecedores com CNPJ, contato e condições de pagamento — eles aparecem na compra de peças do estoque.' },
    ],
    tips: [
      'Telefone sempre com DDD: o WhatsApp e o portal só funcionam com 11 dígitos.',
      'Endereço completo facilita a rota do prestador no Google Maps.',
    ],
    mockup: 'list',
  },
  {
    id: 'agenda',
    title: '3. AGENDA (Agendamentos manuais)',
    short: 'Agenda',
    icon: CalendarDays,
    accent: [59, 130, 246],
    bgTint: [239, 246, 255],
    intro: 'Calendário de serviços — coração operacional do dia a dia.',
    steps: [
      { title: 'Modo calendário ou lista', text: 'No topo da Agenda alterne entre visualização calendário (mês/semana/dia) e lista cronológica.' },
      { title: 'Novo agendamento', text: 'Clique no horário desejado ou use "+ Novo". Selecione cliente já cadastrado, serviço, data, hora e observações.' },
      { title: 'Status do serviço', text: 'O fluxo é: Pendente → Em Andamento → Concluído (ou Cancelado). Mude o status arrastando ou pelo menu de cada agendamento.' },
      { title: 'Atribuir prestador', text: 'No agendamento, escolha o prestador responsável. O nome aparece colorido e entra na rota daquele técnico.' },
      { title: 'Fotos antes/depois', text: 'Anexe fotos diretamente no agendamento — ficam no histórico do cliente e podem ser enviadas no recibo.' },
    ],
    tips: [
      'Concluir o serviço gera automaticamente a entrada no Financeiro (sem duplicidade).',
      'Use cores diferentes por prestador para visualizar carga de trabalho de cada equipe.',
    ],
    mockup: 'calendar',
  },
  {
    id: 'agenda-online',
    title: '4. AGENDAMENTO ONLINE',
    short: 'Agenda Online',
    icon: Globe,
    accent: [14, 165, 233],
    bgTint: [240, 249, 255],
    intro: 'Página pública para o cliente marcar sozinho, com horários puxados em tempo real da sua empresa.',
    steps: [
      { title: 'Configure o horário 1x', text: 'Vá em "Agenda Online → Configuração". Defina dias da semana, horário de início/fim, almoço, tempo de cada slot e antecedência mínima/máxima.' },
      { title: 'Compartilhe o link público', text: 'Copie o link "Agendar Online" e cole no Instagram, WhatsApp e Google Meu Negócio. Cada empresa tem seu link único.' },
      { title: 'Cliente escolhe data e hora', text: 'O sistema bloqueia automaticamente: madrugada, dias desativados, almoço, horários ocupados e a janela de antecedência.' },
      { title: 'Você confirma ou recusa', text: 'Aparece em "Agendamentos Online" com nome e telefone. Botões "Confirmar" e "Recusar". Confirmando, vira agendamento normal e cai na rota do prestador.' },
      { title: 'Chamar o cliente', text: 'Botão "WhatsApp" abre conversa pronta com mensagem personalizada para confirmar detalhes.' },
    ],
    tips: [
      'Se aparecer erro ao agendar, configure primeiro a Agenda Online — o sistema avisa qual campo falta.',
      'Use auto-confirmar só se você consegue absorver toda demanda; caso contrário deixe manual.',
    ],
    mockup: 'online-booking',
  },
  {
    id: 'orcamentos',
    title: '5. ORÇAMENTOS',
    short: 'Orçamentos',
    icon: FileCheck,
    accent: [99, 102, 241],
    bgTint: [238, 242, 255],
    intro: `Orçamentos profissionais em PDF — você tem ${stats.quotes || 0} registrados.`,
    steps: [
      { title: 'Novo orçamento', text: 'Em "Orçamentos" clique em "+ Novo". Selecione o cliente e adicione itens (serviços + peças) com quantidade.' },
      { title: 'Descontos', text: 'Aplique desconto em % ou valor fixo. O total recalcula em tempo real.' },
      { title: 'Validade', text: 'Defina os dias de validade (padrão 30). Após esse prazo o orçamento aparece como "Vencido".' },
      { title: 'Gerar PDF', text: 'Botão "PDF" gera o documento com logo, dados da empresa, itens, total e dados do cliente.' },
      { title: 'Enviar por WhatsApp', text: 'Botão "WhatsApp" abre conversa com link/mensagem pronta. Marque como "Aprovado" quando o cliente confirmar.' },
    ],
    tips: ['Aprovar um orçamento permite convertê-lo em Ordem de Serviço com 1 clique.'],
    mockup: 'quote',
  },
  {
    id: 'manutencoes',
    title: '6. MANUTENÇÕES PREVENTIVAS',
    short: 'Manutenções',
    icon: Wrench,
    accent: [245, 158, 11],
    bgTint: [255, 251, 235],
    intro: 'Contratos recorrentes que geram receita previsível e fidelizam o cliente.',
    steps: [
      { title: 'Novo contrato', text: 'Em "Manutenções" clique em "+ Novo Contrato". Escolha cliente, equipamentos cobertos, valor mensal e intervalo (em meses).' },
      { title: 'Calendário automático', text: 'O sistema cria visitas programadas conforme o intervalo. Cada visita aparece no Radar e na Agenda no dia certo.' },
      { title: 'Marcar como executada', text: 'Quando concluir, marque a visita como executada. A próxima é gerada automaticamente.' },
      { title: 'Receita recorrente', text: 'O valor mensal entra no Financeiro como receita prevista — ajuda a planejar fluxo de caixa.' },
    ],
    mockup: 'maintenance',
  },
  {
    id: 'btu',
    title: '7. CALCULADORA DE BTUs',
    short: 'BTUs',
    icon: Thermometer,
    accent: [239, 68, 68],
    bgTint: [254, 242, 242],
    intro: 'Dimensiona o aparelho ideal para o ambiente — apresente como diferencial técnico.',
    steps: [
      { title: 'Dados do ambiente', text: 'Informe área (m²), pessoas, janelas, eletrônicos e exposição solar.' },
      { title: 'Cálculo automático', text: 'O sistema soma 600 BTU/m² + 600 por pessoa adicional + ajuste solar e retorna o BTU recomendado e o tipo de aparelho.' },
      { title: 'Gerar PDF técnico', text: 'Botão "PDF" cria um relatório com cálculo detalhado, recomendação e logo da empresa para entregar ao cliente.' },
    ],
    tips: ['Use no atendimento presencial: o cliente vê profissionalismo e fecha mais rápido.'],
    mockup: 'btu',
  },
  {
    id: 'pdv',
    title: '8. PDV / VENDAS',
    short: 'PDV',
    icon: ShoppingCart,
    accent: [168, 85, 247],
    bgTint: [250, 245, 255],
    intro: 'Ponto de venda integrado ao estoque e ao financeiro.',
    steps: [
      { title: 'Selecione cliente', text: 'Comece escolhendo o cliente (ou "Consumidor Final"). Sem cliente vinculado o sistema bloqueia parcelado.' },
      { title: 'Adicione itens', text: 'Busque produtos pelo nome ou código de barras. Cada item entra no carrinho com preço e quantidade ajustáveis.' },
      { title: 'Forma de pagamento', text: 'Dinheiro, PIX, Débito ou Crédito. Crédito permite parcelar — o sistema calcula taxa e cria as parcelas em "Parcelas a Receber".' },
      { title: 'Finalizar venda', text: 'Botão "Finalizar". Estoque é baixado, entrada no Financeiro é registrada e o recibo aparece para imprimir/enviar.' },
    ],
    tips: ['Sem produto cadastrado o PDV avisa: vá em Estoque primeiro para cadastrar.'],
    mockup: 'pdv',
  },
  {
    id: 'estoque',
    title: '9. ESTOQUE',
    short: 'Estoque',
    icon: Package,
    accent: [20, 184, 166],
    bgTint: [240, 253, 250],
    intro: 'Controle de peças e serviços com custo, preço e localização.',
    steps: [
      { title: 'Novo produto/serviço', text: 'Em "Estoque" → "+ Novo". Escolha "Peça" (com quantidade) ou "Serviço" (sem estoque, com duração).' },
      { title: 'Custo vs Preço', text: 'Preencha custo de aquisição e preço de venda. O lucro é calculado e aparece em relatórios.' },
      { title: 'Localização física', text: 'Use "Câmara/Prateleira" para encontrar peças rápido no depósito.' },
      { title: 'Estoque mínimo', text: 'Defina min_stock. Quando bater no mínimo o sistema avisa no Painel.' },
    ],
    mockup: 'list',
  },
  {
    id: 'financeiro',
    title: '10. FINANCEIRO',
    short: 'Financeiro',
    icon: Wallet,
    accent: [34, 197, 94],
    bgTint: [240, 253, 244],
    intro: 'Centro de receitas, despesas, parcelas e relatórios — sem duplicidades (anti-duplicação automática).',
    steps: [
      { title: 'Receitas e despesas', text: 'Use "+ Lançamento" para entradas/saídas manuais. O sistema bloqueia duplicidade exata em janela de 5 minutos.' },
      { title: 'Despesas fixas por prestador', text: 'Combustível e alimentação por dia podem ser lançados separados para cada prestador (helper_name). Aparece no relatório por equipe.' },
      { title: 'Parcelas a receber', text: 'Vendas parceladas no PDV aparecem aqui. Marque como paga ao receber — vai para o Financeiro automaticamente.' },
      { title: 'Filtros por período', text: 'Filtre por dia, semana, mês ou personalizado. Cards no topo mostram entradas, saídas, saldo e por categoria.' },
      { title: 'Relatórios e Conciliação', text: 'Aba "Relatórios" gera PDFs com tudo do período. Aba "Conciliação" detecta vendas órfãs ou registros duplicados e ajusta.' },
    ],
    tips: ['Se um valor parecer faltando, abra Conciliação — costuma ser categoria escrita diferente (Serviço vs Serviços).'],
    mockup: 'finance',
  },
  {
    id: 'impostos',
    title: '11. IMPOSTOS',
    short: 'Impostos',
    icon: ClipboardList,
    accent: [217, 70, 239],
    bgTint: [253, 244, 255],
    intro: 'Painel mensal com estimativa de DAS, ISS, INSS, IRRF e folha — pronto para entregar ao contador.',
    steps: [
      { title: 'Registro mensal', text: 'Para cada mês registre receita de serviços, receita de produtos e despesas (material, combustível, equipamento).' },
      { title: 'Folha de pagamento', text: 'Adicione cada funcionário com salário, INSS e FGTS. O total da folha entra no cálculo.' },
      { title: 'Estimativas', text: 'O sistema calcula DAS (MEI), ISS proporcional, INSS e IRRF — apenas estimativas; confirme com seu contador.' },
      { title: 'Importação de XML', text: 'Importe XMLs de NFS-e/NFE recebidos para somar automaticamente nas categorias.' },
    ],
    mockup: 'taxes',
  },
  {
    id: 'minha-empresa',
    title: '12. MINHA EMPRESA',
    short: 'Empresa',
    icon: Settings,
    accent: [100, 116, 139],
    bgTint: [248, 250, 252],
    intro: 'Dados que aparecem em todos os PDFs (orçamentos, recibos, OS).',
    steps: [
      { title: 'Dados cadastrais', text: 'Preencha razão social, CNPJ/CPF, endereço, telefone, email e Instagram.' },
      { title: 'Logo', text: 'Faça upload em PNG/JPG. Aparece no canto superior dos documentos.' },
      { title: 'WhatsApp Suporte', text: 'O número que aparecerá nos botões "WhatsApp" do sistema todo.' },
    ],
    tips: ['Sem dados cadastrados, os PDFs saem com "AC Service Pro" como padrão. Configure antes de gerar orçamentos reais.'],
    mockup: 'settings',
  },
  {
    id: 'equipe',
    title: '13. EQUIPE E PORTAL',
    short: 'Equipe',
    icon: Shield,
    accent: [236, 72, 153],
    bgTint: [253, 242, 248],
    intro: `Membros que acessam o sistema com PIN — você tem ${stats.teamMembers || 0} cadastrados.`,
    steps: [
      { title: 'Novo membro', text: 'Em "Equipe" → "+ Novo". Preencha nome, WhatsApp, função (Painel/Suporte/Sistema) e PIN de 4 dígitos.' },
      { title: 'Acesso /portal', text: 'O membro entra em /portal com nome + PIN. Não precisa de email/senha.' },
      { title: 'Permissões', text: 'Painel = só dashboard. Suporte = dashboard + agenda + cadastros. Sistema = tudo exceto admin.' },
      { title: 'Desativar', text: 'Clique no membro e desative quando alguém sair — o PIN para de funcionar imediatamente.' },
    ],
    mockup: 'team',
  },
  {
    id: 'notificacoes',
    title: '14. NOTIFICAÇÕES',
    short: 'Notificações',
    icon: Bell,
    accent: [251, 146, 60],
    bgTint: [255, 247, 237],
    intro: 'Alertas no sino 🔔: parcelas vencendo, agendamentos do dia, novos online e manutenções.',
    steps: [
      { title: 'Configurar tipos', text: 'Em "Configurações → Notificações", ative/desative cada tipo: parcelas, agendas, manutenções, online.' },
      { title: 'Sino do topo', text: 'Clique no sino para ver as não lidas. Cada item leva direto à origem.' },
      { title: 'Marcar como lida', text: 'Use "Marcar todas como lidas" para zerar o contador.' },
    ],
    mockup: 'notifications',
  },
  {
    id: 'backup',
    title: '15. BACKUP',
    short: 'Backup',
    icon: Database,
    accent: [71, 85, 105],
    bgTint: [241, 245, 249],
    intro: 'Exporte tudo periodicamente — sua segurança contra qualquer imprevisto.',
    steps: [
      { title: 'Exportar', text: 'Em "Backup" clique em "Exportar Dados". Gera um arquivo com clientes, agenda, financeiro, estoque.' },
      { title: 'Periodicidade', text: 'Faça pelo menos 1x por mês. Em meses de muita movimentação, semanal.' },
      { title: 'Onde guardar', text: 'Salve o arquivo em Google Drive/OneDrive — nunca apenas no celular.' },
    ],
    mockup: 'backup',
  },
  {
    id: 'landing',
    title: '16. LANDING PAGE & MARKETING',
    short: 'Landing',
    icon: Share2,
    accent: [217, 119, 6],
    bgTint: [255, 251, 235],
    intro: 'Editor completo da página pública sem precisar de programador.',
    steps: [
      { title: 'Templates', text: 'Escolha entre Persuasão, VSL, Minimalista ou Custom — base já otimizada para conversão.' },
      { title: 'Textos & Preços', text: 'Edite títulos, subtítulos, planos mensal/anual, valores e botões de checkout.' },
      { title: 'Cores & Fundo', text: 'Personalize paleta primária, secundária, fundo e botão CTA. Aplica em tempo real.' },
      { title: 'Pixel & Checkout', text: 'Adicione IDs do Facebook/Google/TikTok e cole links da Kiwify/Hotmart. Webhooks ativam o plano automaticamente.' },
      { title: 'Depoimentos & FAQ', text: 'Até 4 depoimentos com foto/vídeo e 6 perguntas frequentes para eliminar objeções.' },
    ],
    mockup: 'landing',
  },
  {
    id: 'radar',
    title: '17. RADAR DE MANUTENÇÕES',
    short: 'Radar',
    icon: Radar,
    accent: [16, 185, 129],
    bgTint: [240, 253, 244],
    intro: 'Detecta automaticamente serviços que precisam de retorno baseado na garantia do serviço cadastrado.',
    steps: [
      { title: 'Como funciona', text: 'Cada serviço tem garantia em meses. O radar monitora todos os concluídos e calcula a próxima visita.' },
      { title: 'Alertas no Painel', text: 'Vencimentos próximos (15 dias) e vencidos aparecem destacados no Painel.' },
      { title: 'Avisar cliente', text: 'Botão "Avisar" abre WhatsApp com mensagem pronta oferecendo a manutenção.' },
    ],
    mockup: 'radar',
  },
  {
    id: 'rotas',
    title: '18. PRESTADORES E ROTAS',
    short: 'Rotas',
    icon: Car,
    accent: [37, 99, 235],
    bgTint: [239, 246, 255],
    intro: 'Organização do dia por equipe + lançamento de gastos por prestador.',
    steps: [
      { title: 'Cadastrar prestador', text: 'Em "Prestadores" cadastre nome, telefone, especialidade, custo/hora e custo mensal recorrente.' },
      { title: 'Atribuir serviços', text: 'No agendamento escolha o prestador. Os serviços do dia aparecem agrupados na rota dele.' },
      { title: 'Gastos do dia', text: 'Combustível e alimentação podem ser lançados por dia para cada prestador. Aparecem separados no Financeiro.' },
      { title: 'Google Maps', text: 'Botão "Rota no Maps" gera link com todas as paradas do dia para o GPS do técnico.' },
      { title: 'Acompanhamento', text: 'Veja em tempo real quais paradas já foram concluídas pelo prestador.' },
    ],
    mockup: 'route',
  },
  {
    id: 'recibos',
    title: '19. RECIBOS E DOCUMENTOS',
    short: 'Recibos',
    icon: FileText,
    accent: [13, 148, 136],
    bgTint: [240, 253, 250],
    intro: 'Documentos profissionais com assinatura digital direto no celular.',
    steps: [
      { title: 'Recibo de serviço', text: 'No Histórico Geral, cada serviço concluído tem botão "Recibo PDF" — inclui cliente, serviço, valor, próximo vencimento.' },
      { title: 'Assinatura digital', text: 'No celular do cliente, deslize o dedo no campo "Assinatura". Fica gravada no PDF.' },
      { title: 'Enviar', text: 'Botão "WhatsApp" envia direto com mensagem pronta. Botão "Imprimir" abre versão para papel A4.' },
    ],
    mockup: 'receipt',
  },
  {
    id: 'beta',
    title: '20. SISTEMA SIMPLIFICADO (BETA)',
    short: 'Beta',
    icon: Zap,
    accent: [99, 102, 241],
    bgTint: [238, 242, 255],
    intro: 'Versão enxuta para técnico de campo usar no celular — só o essencial.',
    steps: [
      { title: 'Quando usar', text: 'Quando estiver na rua e só precisar consultar agenda, cliente ou registrar pagamento rápido.' },
      { title: 'Como acessar', text: 'No menu lateral troque para "Sistema Simplificado". Volta com 1 clique para o completo.' },
    ],
    mockup: 'mobile',
  },
];

// ----------------- Mockup drawer -----------------
const drawMockup = (
  doc: jsPDF, kind: MockupKind, x: number, y: number, w: number, h: number,
  accent: [number, number, number]
) => {
  // outer browser/phone frame
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, 'S');

  // top bar
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(x, y, w, 6, 3, 3, 'F');
  doc.setFillColor(239, 68, 68); doc.circle(x + 3, y + 3, 0.8, 'F');
  doc.setFillColor(245, 158, 11); doc.circle(x + 5.5, y + 3, 0.8, 'F');
  doc.setFillColor(34, 197, 94);  doc.circle(x + 8, y + 3, 0.8, 'F');

  const ix = x + 3, iy = y + 9, iw = w - 6, ih = h - 12;
  doc.setFillColor(...accent, 0.15 as any);
  // jsPDF doesn't support alpha on plain rects easily; use lighter shade by mixing.
  const lighten = (c: [number,number,number]) => [Math.round(c[0]*0.2+255*0.8), Math.round(c[1]*0.2+255*0.8), Math.round(c[2]*0.2+255*0.8)] as [number,number,number];
  const mid = (c: [number,number,number]) => [Math.round(c[0]*0.5+255*0.5), Math.round(c[1]*0.5+255*0.5), Math.round(c[2]*0.5+255*0.5)] as [number,number,number];
  const A = accent;
  const Ahalf = mid(accent);
  const Asoft = lighten(accent);

  switch (kind) {
    case 'dashboard': {
      // 4 KPI cards
      const cardW = (iw - 9) / 4;
      for (let i = 0; i < 4; i++) {
        doc.setFillColor(...Asoft);
        doc.roundedRect(ix + i * (cardW + 3), iy, cardW, 14, 1.5, 1.5, 'F');
        doc.setFillColor(...A);
        doc.rect(ix + i * (cardW + 3), iy, 1.2, 14, 'F');
      }
      // chart area
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ix, iy + 17, iw, ih - 17, 1.5, 1.5, 'F');
      doc.setDrawColor(...Ahalf); doc.setLineWidth(0.5);
      const baseY = iy + ih - 2;
      let lastX = ix + 3, lastY = baseY - 5;
      for (let i = 1; i < 12; i++) {
        const nx = ix + 3 + i * ((iw - 6) / 11);
        const ny = baseY - 4 - Math.random() * (ih - 24);
        doc.line(lastX, lastY, nx, ny);
        lastX = nx; lastY = ny;
      }
      break;
    }
    case 'list': {
      // search bar
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ix, iy, iw, 5, 1, 1, 'F');
      doc.setDrawColor(...Ahalf); doc.roundedRect(ix, iy, iw, 5, 1, 1, 'S');
      // rows
      for (let i = 0; i < 6; i++) {
        const ry = iy + 7 + i * 6;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix, ry, iw, 5, 1, 1, 'F');
        doc.setFillColor(...A); doc.circle(ix + 3, ry + 2.5, 1.5, 'F');
        doc.setFillColor(...Ahalf); doc.rect(ix + 6, ry + 1.5, iw * 0.4, 1, 'F');
        doc.setFillColor(226, 232, 240); doc.rect(ix + 6, ry + 3.2, iw * 0.25, 0.8, 'F');
      }
      break;
    }
    case 'calendar': {
      // header
      doc.setFillColor(...A);
      doc.roundedRect(ix, iy, iw, 5, 1, 1, 'F');
      // grid 7x4
      const cellW = iw / 7;
      const cellH = (ih - 7) / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 7; c++) {
          const cx = ix + c * cellW, cy = iy + 6 + r * cellH;
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
          doc.rect(cx, cy, cellW, cellH, 'S');
          if (Math.random() > 0.6) {
            doc.setFillColor(...Asoft);
            doc.roundedRect(cx + 1, cy + 1.5, cellW - 2, 2, 0.5, 0.5, 'F');
          }
        }
      }
      break;
    }
    case 'form': {
      for (let i = 0; i < 4; i++) {
        const fy = iy + i * 8;
        doc.setFillColor(226, 232, 240); doc.rect(ix, fy, 25, 1, 'F');
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix, fy + 2, iw, 5, 1, 1, 'F');
        doc.setDrawColor(...Ahalf); doc.roundedRect(ix, fy + 2, iw, 5, 1, 1, 'S');
      }
      doc.setFillColor(...A);
      doc.roundedRect(ix + iw - 28, iy + ih - 7, 28, 6, 1.5, 1.5, 'F');
      break;
    }
    case 'pdv': {
      // left: products grid
      const leftW = iw * 0.55;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        doc.setFillColor(...Asoft);
        doc.roundedRect(ix + c * (leftW / 3 + 1), iy + r * 11, leftW / 3 - 1, 10, 1, 1, 'F');
      }
      // right: cart
      const rx = ix + leftW + 4;
      const rw = iw - leftW - 4;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(rx, iy, rw, ih, 1.5, 1.5, 'F');
      doc.setDrawColor(...Ahalf); doc.roundedRect(rx, iy, rw, ih, 1.5, 1.5, 'S');
      for (let i = 0; i < 4; i++) {
        doc.setFillColor(...Ahalf); doc.rect(rx + 2, iy + 3 + i * 5, rw - 4, 0.8, 'F');
      }
      doc.setFillColor(...A);
      doc.roundedRect(rx + 2, iy + ih - 8, rw - 4, 6, 1, 1, 'F');
      break;
    }
    case 'finance': {
      // 3 KPIs
      ['#22c55e','#ef4444','#3b82f6'].forEach((_, i) => {
        const colors: [number,number,number][] = [[34,197,94],[239,68,68],[59,130,246]];
        doc.setFillColor(...colors[i]);
        doc.roundedRect(ix + i * (iw / 3 + 1), iy, iw / 3 - 2, 12, 1.5, 1.5, 'F');
      });
      // bars chart
      for (let i = 0; i < 8; i++) {
        const bh = 5 + Math.random() * (ih - 18);
        const bx = ix + i * ((iw) / 8) + 1;
        doc.setFillColor(...Ahalf);
        doc.rect(bx, iy + ih - bh, (iw / 8) - 2, bh, 'F');
      }
      break;
    }
    case 'taxes': {
      // table-like
      doc.setFillColor(...A);
      doc.rect(ix, iy, iw, 4, 'F');
      for (let r = 0; r < 6; r++) {
        const ry = iy + 5 + r * 5;
        doc.setFillColor(r % 2 ? 248 : 255, r % 2 ? 250 : 255, r % 2 ? 252 : 255);
        doc.rect(ix, ry, iw, 4.5, 'F');
        doc.setFillColor(...Ahalf); doc.rect(ix + 2, ry + 1.7, iw * 0.3, 1, 'F');
        doc.setFillColor(226, 232, 240); doc.rect(ix + iw * 0.4, ry + 1.7, iw * 0.5, 1, 'F');
      }
      break;
    }
    case 'settings': {
      // form with logo placeholder
      doc.setFillColor(...Asoft);
      doc.roundedRect(ix, iy, 24, 24, 2, 2, 'F');
      doc.setFillColor(...A); doc.circle(ix + 12, iy + 12, 4, 'F');
      for (let i = 0; i < 4; i++) {
        const fy = iy + i * 6;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix + 28, fy, iw - 28, 4.5, 1, 1, 'F');
        doc.setDrawColor(...Ahalf); doc.roundedRect(ix + 28, fy, iw - 28, 4.5, 1, 1, 'S');
      }
      break;
    }
    case 'team': {
      for (let i = 0; i < 3; i++) {
        const cy = iy + i * 11;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix, cy, iw, 9, 1.5, 1.5, 'F');
        doc.setDrawColor(...Ahalf); doc.roundedRect(ix, cy, iw, 9, 1.5, 1.5, 'S');
        doc.setFillColor(...A); doc.circle(ix + 5, cy + 4.5, 3, 'F');
        doc.setFillColor(...Ahalf); doc.rect(ix + 10, cy + 2.5, iw * 0.4, 1, 'F');
        doc.setFillColor(226, 232, 240); doc.rect(ix + 10, cy + 5, iw * 0.25, 0.8, 'F');
        // PIN dots
        for (let p = 0; p < 4; p++) doc.circle(ix + iw - 10 + p * 2, cy + 4.5, 0.7, 'F');
      }
      break;
    }
    case 'notifications': {
      doc.setFillColor(...A); doc.circle(ix + iw - 4, iy + 4, 2.5, 'F');
      for (let i = 0; i < 4; i++) {
        const ry = iy + 9 + i * 7;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix, ry, iw, 6, 1, 1, 'F');
        doc.setFillColor(...A); doc.rect(ix, ry, 1.2, 6, 'F');
        doc.setFillColor(...Ahalf); doc.rect(ix + 3, ry + 2, iw * 0.5, 1, 'F');
      }
      break;
    }
    case 'backup': {
      doc.setFillColor(...Asoft);
      doc.roundedRect(ix + iw / 2 - 18, iy + ih / 2 - 12, 36, 24, 2, 2, 'F');
      doc.setDrawColor(...A); doc.setLineWidth(0.8);
      doc.line(ix + iw / 2, iy + ih / 2 - 8, ix + iw / 2, iy + ih / 2 + 6);
      doc.line(ix + iw / 2 - 4, iy + ih / 2 + 2, ix + iw / 2, iy + ih / 2 + 6);
      doc.line(ix + iw / 2 + 4, iy + ih / 2 + 2, ix + iw / 2, iy + ih / 2 + 6);
      break;
    }
    case 'landing': {
      // hero
      doc.setFillColor(...A);
      doc.rect(ix, iy, iw, ih * 0.45, 'F');
      doc.setFillColor(...Asoft);
      doc.roundedRect(ix + iw / 2 - 12, iy + ih * 0.2, 24, 5, 1, 1, 'F');
      // pricing cards
      for (let i = 0; i < 3; i++) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ix + i * (iw / 3 + 1), iy + ih * 0.5, iw / 3 - 2, ih * 0.45, 2, 2, 'F');
        doc.setDrawColor(...Ahalf); doc.roundedRect(ix + i * (iw / 3 + 1), iy + ih * 0.5, iw / 3 - 2, ih * 0.45, 2, 2, 'S');
      }
      break;
    }
    case 'radar': {
      const cx = ix + iw / 2, cy = iy + ih / 2;
      for (let i = 1; i <= 4; i++) {
        doc.setDrawColor(...Ahalf); doc.setLineWidth(0.3);
        doc.circle(cx, cy, i * 6, 'S');
      }
      doc.setFillColor(...A); doc.circle(cx, cy, 2, 'F');
      // dots
      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 18;
        doc.setFillColor(...A);
        doc.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1, 'F');
      }
      break;
    }
    case 'route': {
      // map-like grid + path
      doc.setFillColor(255, 255, 255); doc.rect(ix, iy, iw, ih, 'F');
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      for (let i = 1; i < 6; i++) {
        doc.line(ix + i * (iw/6), iy, ix + i * (iw/6), iy + ih);
        doc.line(ix, iy + i * (ih/6), ix + iw, iy + i * (ih/6));
      }
      doc.setDrawColor(...A); doc.setLineWidth(1);
      doc.line(ix + 5, iy + ih - 5, ix + iw * 0.3, iy + ih * 0.5);
      doc.line(ix + iw * 0.3, iy + ih * 0.5, ix + iw * 0.65, iy + ih * 0.7);
      doc.line(ix + iw * 0.65, iy + ih * 0.7, ix + iw - 5, iy + 5);
      // pins
      [[5, ih - 5],[iw * 0.3, ih * 0.5],[iw * 0.65, ih * 0.7],[iw - 5, 5]].forEach(([px, py]) => {
        doc.setFillColor(...A); doc.circle(ix + (px as number), iy + (py as number), 1.8, 'F');
      });
      break;
    }
    case 'receipt': {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ix + 5, iy, iw - 10, ih, 1.5, 1.5, 'F');
      doc.setDrawColor(...Ahalf); doc.roundedRect(ix + 5, iy, iw - 10, ih, 1.5, 1.5, 'S');
      doc.setFillColor(...A); doc.rect(ix + 5, iy, iw - 10, 5, 'F');
      for (let i = 0; i < 5; i++) {
        doc.setFillColor(...Ahalf); doc.rect(ix + 8, iy + 8 + i * 4, iw * 0.6, 1, 'F');
      }
      // signature line
      doc.setDrawColor(...A); doc.setLineWidth(0.4);
      doc.line(ix + 8, iy + ih - 5, ix + iw - 13, iy + ih - 5);
      break;
    }
    case 'mobile': {
      const phoneW = 28, phoneH = ih - 4;
      const px = ix + iw / 2 - phoneW / 2;
      const py = iy + 2;
      doc.setFillColor(15, 23, 42); doc.roundedRect(px, py, phoneW, phoneH, 3, 3, 'F');
      doc.setFillColor(...A); doc.roundedRect(px + 2, py + 4, phoneW - 4, phoneH - 8, 1.5, 1.5, 'F');
      // app icons
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(px + 4 + c * 10, py + 8 + r * 9, 8, 6, 1, 1, 'F');
      }
      break;
    }
    case 'online-booking': {
      // header + calendar pills
      doc.setFillColor(...A); doc.rect(ix, iy, iw, 5, 'F');
      for (let i = 0; i < 7; i++) {
        doc.setFillColor(...Asoft);
        doc.roundedRect(ix + i * ((iw - 6) / 7) + 1, iy + 8, (iw - 6) / 7 - 2, 6, 1.5, 1.5, 'F');
      }
      // time slots grid
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const sx = ix + c * (iw / 5) + 1;
        const sy = iy + 17 + r * 6;
        doc.setFillColor(...A);
        doc.roundedRect(sx, sy, (iw / 5) - 2, 4.5, 1, 1, 'F');
      }
      break;
    }
    case 'btu': {
      // big number circle
      const cx = ix + iw / 2, cy = iy + ih / 2;
      doc.setFillColor(...Asoft); doc.circle(cx, cy, 14, 'F');
      doc.setFillColor(...A); doc.circle(cx, cy, 12, 'F');
      doc.setFontSize(14); doc.setTextColor(255,255,255);
      doc.text('12k', cx, cy + 2, { align: 'center' });
      // small inputs around
      [[ix + 4, iy + 4],[ix + iw - 28, iy + 4],[ix + 4, iy + ih - 8],[ix + iw - 28, iy + ih - 8]].forEach(([fx, fy]) => {
        doc.setFillColor(255,255,255);
        doc.roundedRect(fx as number, fy as number, 24, 4.5, 1, 1, 'F');
        doc.setDrawColor(...Ahalf); doc.roundedRect(fx as number, fy as number, 24, 4.5, 1, 1, 'S');
      });
      break;
    }
    case 'maintenance': {
      // timeline
      doc.setDrawColor(...Ahalf); doc.setLineWidth(0.6);
      doc.line(ix + 5, iy + ih / 2, ix + iw - 5, iy + ih / 2);
      for (let i = 0; i < 5; i++) {
        const px = ix + 5 + i * ((iw - 10) / 4);
        doc.setFillColor(...A); doc.circle(px, iy + ih / 2, 2.5, 'F');
        doc.setFillColor(...Asoft);
        doc.roundedRect(px - 8, iy + ih / 2 - 12, 16, 6, 1, 1, 'F');
      }
      break;
    }
    case 'quote': {
      // document
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ix + 8, iy, iw - 16, ih, 1.5, 1.5, 'F');
      doc.setDrawColor(...Ahalf); doc.roundedRect(ix + 8, iy, iw - 16, ih, 1.5, 1.5, 'S');
      doc.setFillColor(...A); doc.rect(ix + 8, iy, iw - 16, 6, 'F');
      // table rows
      for (let i = 0; i < 5; i++) {
        const ry = iy + 9 + i * 5;
        doc.setFillColor(i % 2 ? 248 : 255, i % 2 ? 250 : 255, i % 2 ? 252 : 255);
        doc.rect(ix + 10, ry, iw - 20, 4, 'F');
        doc.setFillColor(...Ahalf); doc.rect(ix + 11, ry + 1.5, iw * 0.3, 1, 'F');
        doc.setFillColor(...A); doc.rect(ix + iw - 22, ry + 1.5, 8, 1, 'F');
      }
      // total
      doc.setFillColor(...A);
      doc.roundedRect(ix + iw - 28, iy + ih - 7, 18, 5, 1, 1, 'F');
      break;
    }
  }
};

// ----------------- PDF generators -----------------
const pageW = 210, pageH = 297;
const margin = 18;
const contentW = pageW - margin * 2;

const drawCover = (doc: jsPDF, section: Section, companyName: string) => {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, pageH, 'F');
  // accent bar
  doc.setFillColor(...section.accent);
  doc.rect(0, 0, 14, pageH, 'F');
  // section number badge
  doc.setFillColor(...section.accent);
  doc.circle(pageW / 2, 70, 18, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(22);
  doc.text(section.title.split('.')[0], pageW / 2, 75, { align: 'center' });

  doc.setTextColor(241, 245, 249); doc.setFontSize(22);
  const titleClean = section.title.replace(/^\d+\.\s*/, '');
  doc.text(titleClean, pageW / 2, 110, { align: 'center', maxWidth: pageW - 50 });

  doc.setTextColor(148, 163, 184); doc.setFontSize(11);
  const intro = doc.splitTextToSize(section.intro, pageW - 60);
  doc.text(intro, pageW / 2, 130, { align: 'center' });

  doc.setTextColor(...section.accent); doc.setFontSize(9);
  doc.text(`Manual operacional • ${section.steps.length} passos`, pageW / 2, 250, { align: 'center' });
  doc.setTextColor(100, 116, 139);
  doc.text(companyName, pageW / 2, 258, { align: 'center' });
  doc.text(`Atualizado em ${new Date().toLocaleDateString('pt-BR')}`, pageW / 2, 264, { align: 'center' });
};

const drawSectionPages = (doc: jsPDF, section: Section, options?: { skipCover?: boolean }) => {
  if (!options?.skipCover) {
    doc.addPage();
    drawCover(doc, section, 'AC Service Pro');
  }

  // Page 2: mockup + intro
  doc.addPage();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(...section.bgTint); doc.rect(0, 0, pageW, 60, 'F');
  doc.setFillColor(...section.accent); doc.rect(0, 60, pageW, 1.5, 'F');

  doc.setTextColor(...section.accent); doc.setFontSize(9);
  doc.text(section.short.toUpperCase(), margin, 18);
  doc.setTextColor(15, 23, 42); doc.setFontSize(18);
  const titleClean = section.title.replace(/^\d+\.\s*/, '');
  doc.text(titleClean, margin, 30, { maxWidth: contentW });

  doc.setTextColor(71, 85, 105); doc.setFontSize(10);
  const introLines = doc.splitTextToSize(section.intro, contentW);
  doc.text(introLines, margin, 42);

  // Mockup "screenshot"
  drawMockup(doc, section.mockup, margin, 70, contentW, 90, section.accent);
  doc.setTextColor(148, 163, 184); doc.setFontSize(8);
  doc.text(`Figura: prévia visual da tela "${section.short}"`, margin, 165);

  // Steps preview (first 3)
  doc.setTextColor(15, 23, 42); doc.setFontSize(13);
  doc.text('Resumo do passo a passo', margin, 180);
  doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  section.steps.slice(0, 3).forEach((s, i) => {
    const y = 190 + i * 18;
    doc.setFillColor(...section.accent);
    doc.circle(margin + 3, y - 2, 3, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    doc.text(String(i + 1), margin + 3, y - 1, { align: 'center' });
    doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    doc.text(s.title, margin + 10, y - 1);
    doc.setTextColor(71, 85, 105); doc.setFontSize(9);
    const lines = doc.splitTextToSize(s.text, contentW - 12);
    doc.text(lines.slice(0, 2), margin + 10, y + 4);
  });

  // Page 3+: full steps
  doc.addPage();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, 'F');
  // header
  doc.setFillColor(...section.accent); doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(11);
  doc.text(`${titleClean.toUpperCase()} — PASSO A PASSO COMPLETO`, margin, 9);

  let y = 26;
  section.steps.forEach((s, i) => {
    const lines = doc.splitTextToSize(s.text, contentW - 20);
    const blockHeight = 12 + lines.length * 4.5 + 6;
    if (y + blockHeight > pageH - 20) {
      doc.addPage();
      doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, 'F');
      doc.setFillColor(...section.accent); doc.rect(0, 0, pageW, 14, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(11);
      doc.text(`${titleClean.toUpperCase()} — CONTINUAÇÃO`, margin, 9);
      y = 26;
    }
    // numbered marker
    doc.setFillColor(...section.accent);
    doc.roundedRect(margin, y, 10, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(11);
    doc.text(String(i + 1), margin + 5, y + 7, { align: 'center' });
    // title
    doc.setTextColor(15, 23, 42); doc.setFontSize(11);
    doc.text(s.title, margin + 14, y + 4);
    // text
    doc.setTextColor(71, 85, 105); doc.setFontSize(10);
    doc.text(lines, margin + 14, y + 10);
    y += blockHeight;
  });

  // Tips
  if (section.tips && section.tips.length) {
    if (y + 30 > pageH - 20) {
      doc.addPage();
      doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, 'F');
      y = 26;
    }
    y += 4;
    doc.setFillColor(...section.bgTint);
    doc.roundedRect(margin, y, contentW, 8 + section.tips.length * 8, 2, 2, 'F');
    doc.setTextColor(...section.accent); doc.setFontSize(11);
    doc.text('💡 Dicas de quem usa', margin + 4, y + 6);
    doc.setTextColor(51, 65, 85); doc.setFontSize(9);
    section.tips.forEach((t, i) => {
      const ts = doc.splitTextToSize(`• ${t}`, contentW - 8);
      doc.text(ts, margin + 4, y + 12 + i * 8);
    });
    y += 8 + section.tips.length * 8 + 6;
  }

  // Footer
  doc.setTextColor(148, 163, 184); doc.setFontSize(8);
  doc.text(`AC Service Pro • Manual ${section.short} • ${new Date().toLocaleDateString('pt-BR')}`, pageW / 2, pageH - 8, { align: 'center' });
};

const generateSinglePDF = (section: Section) => {
  const doc = new jsPDF();
  // remove the auto-added blank first page after writing cover
  drawCover(doc, section, 'AC Service Pro');
  drawSectionPages(doc, section, { skipCover: true });
  doc.save(`Manual-${section.short.replace(/\s+/g, '-')}.pdf`);
};

const generateMasterPDF = (sections: Section[], stats: any) => {
  const doc = new jsPDF();
  // Master cover
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(6, 182, 212); doc.rect(0, 0, pageW, 4, 'F');
  doc.setTextColor(6, 182, 212); doc.setFontSize(34);
  doc.text('AC Service Pro', pageW / 2, 90, { align: 'center' });
  doc.setTextColor(241, 245, 249); doc.setFontSize(16);
  doc.text('Manual Mestre Completo', pageW / 2, 105, { align: 'center' });
  doc.setTextColor(148, 163, 184); doc.setFontSize(10);
  doc.text(`${sections.length} módulos • ${sections.reduce((a, s) => a + s.steps.length, 0)} passos detalhados`, pageW / 2, 118, { align: 'center' });
  doc.text(`📊 ${stats.clients || 0} clientes • ${stats.products || 0} serviços • ${stats.appointments || 0} agendamentos`, pageW / 2, 130, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageW / 2, 270, { align: 'center' });

  // Index
  doc.addPage();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(15, 23, 42); doc.setFontSize(20);
  doc.text('Índice', margin, 30);
  doc.setFontSize(9);
  sections.forEach((s, i) => {
    const y = 45 + i * 8;
    doc.setFillColor(...s.accent); doc.circle(margin + 2, y - 1.2, 2.5, 'F');
    doc.setTextColor(15, 23, 42);
    doc.text(s.title, margin + 8, y);
  });

  sections.forEach(section => drawSectionPages(doc, section));
  doc.save('Manual-Mestre-AC-Service-Pro.pdf');
};

// ----------------- Component -----------------
export const AdminSystemGuideTab: React.FC = () => {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingMaster, setGeneratingMaster] = useState(false);
  const [stats, setStats] = useState<any>({});

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [clients, products, appointments, quotes, , team] = await Promise.all([
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
        teamMembers: team.count || 0,
      });
    } catch {}
  };

  const sections = buildSections(stats);

  const handleSingle = (s: Section) => {
    setGeneratingId(s.id);
    try { generateSinglePDF(s); } finally { setGeneratingId(null); }
  };

  const handleMaster = () => {
    setGeneratingMaster(true);
    try { generateMasterPDF(sections, stats); } finally { setGeneratingMaster(false); }
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
            <h2 className="text-xl font-bold">Manuais detalhados — um PDF por módulo</h2>
            <p className="text-muted-foreground text-sm">
              {sections.length} manuais visuais com prévia da tela e passo a passo profissional
            </p>
          </div>
        </div>
        <Button onClick={handleMaster} disabled={generatingMaster} size="lg" className="gap-2">
          {generatingMaster ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {generatingMaster ? 'Gerando manual mestre...' : 'Baixar Manual Mestre (todos)'}
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Clientes', value: stats.clients },
          { label: 'Serviços', value: stats.products },
          { label: 'Agendamentos', value: stats.appointments },
          { label: 'Orçamentos', value: stats.quotes },
          { label: 'Equipe', value: stats.teamMembers },
        ].map(s => (
          <div key={s.label} className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold text-primary">{s.value ?? '...'}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sections.map(section => {
          const Icon = section.icon;
          const rgb = `rgb(${section.accent.join(',')})`;
          const tint = `rgb(${section.bgTint.join(',')})`;
          const isLoading = generatingId === section.id;
          return (
            <Card key={section.id} className="overflow-hidden border-border/50">
              <div className="h-1.5" style={{ backgroundColor: rgb }} />
              <CardHeader className="pb-2" style={{ backgroundColor: tint }}>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: rgb }}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="flex-1 truncate">{section.title}</span>
                  <Badge variant="outline" className="text-[9px]" style={{ borderColor: rgb, color: rgb }}>
                    {section.steps.length} passos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{section.intro}</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  {section.steps.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: rgb }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1"><strong className="text-foreground">{s.title}.</strong> {s.text}</span>
                    </li>
                  ))}
                  {section.steps.length > 3 && (
                    <li className="text-[10px] italic pl-6">+ {section.steps.length - 3} passos no PDF…</li>
                  )}
                </ol>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSingle(section)}
                  disabled={isLoading || generatingMaster}
                  className="w-full gap-2"
                  style={{ borderColor: rgb, color: rgb }}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {isLoading ? 'Gerando…' : `Baixar PDF — ${section.short}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSystemGuideTab;
