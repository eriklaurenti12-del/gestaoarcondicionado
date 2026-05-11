import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';

type HelpEntry = { title: string; intro?: string; items: { q: string; a: string }[] };

const HELP: Record<string, HelpEntry> = {
  dashboard: {
    title: 'Painel — Ajuda',
    intro: 'Visão geral do dia: agendamentos, vendas, alertas e atalhos rápidos.',
    items: [
      { q: 'O que vejo aqui', a: 'Resumo de hoje: atendimentos, faturamento, próximos compromissos e pendências.' },
      { q: 'Atalhos', a: 'Os cards do topo abrem direto a aba correspondente (Agenda, Financeiro, PDV, etc.).' },
      { q: 'Notificações (sino)', a: 'Mostra agendamentos online novos, lembretes e alertas em tempo real.' },
      { q: 'Números não batem', a: 'Vá em Financeiro → Sincronizar para reconciliar vendas e contratos do mês.' },
      { q: 'Instalar como app (PWA)', a: 'Use o botão "Instalar" no canto da tela para usar offline e receber notificações.' },
    ],
  },
  appointments: {
    title: 'Agenda — Ajuda',
    intro: 'Crie, edite e acompanhe atendimentos. Visões: Lista, Dia e Calendário.',
    items: [
      { q: 'Novo atendimento', a: 'Botão "Novo Agendamento" → escolha cliente, serviço, data e hora. Respeita horários da empresa.' },
      { q: 'Status', a: 'Pendente → Confirmado → Concluído. Concluir gera entrada no Financeiro.' },
      { q: 'Fotos antes/depois', a: 'Anexe imagens no atendimento — ficam no histórico do cliente e na O.S.' },
      { q: 'Rota do dia', a: 'Botão "Rota do Dia" gera PDF com endereços ordenados para usar no celular.' },
      { q: 'Editar / cancelar', a: 'Clique no card para editar ou mudar status. Cancelar libera o horário.' },
      { q: 'Agendamento online sumiu', a: 'Vá em Agendamento Online e clique Confirmar — ele entra automaticamente aqui.' },
    ],
  },
  'online-bookings': {
    title: 'Agendamento Online — Ajuda',
    intro: 'Receba pedidos pelo seu link público e aceite/recuse em 1 clique.',
    items: [
      { q: 'Como funciona', a: 'Cliente abre seu link, escolhe serviço/data/hora e envia. Aparece em "Solicitações para você responder".' },
      { q: 'Aceitar', a: 'Confirmar → o pedido sai da lista pendente e vai direto para sua Agenda. WhatsApp de confirmação é aberto.' },
      { q: 'Recusar', a: 'Recusar → cliente recebe mensagem no WhatsApp explicando.' },
      { q: 'Editar antes de aceitar', a: 'Botão Editar ajusta data/hora/serviço respeitando travas de horário/almoço/férias.' },
      { q: 'Compartilhar link', a: 'Copie o link no topo e envie por WhatsApp/Instagram.' },
      { q: 'Horários disponíveis', a: 'Configure em Empresa → Horário de Funcionamento (dias, almoço, férias, antecedência).' },
      { q: 'Som ao receber', a: 'Toca um beep quando chega novo pedido. Pode desativar no ícone do sino.' },
    ],
  },
  cadastros: {
    title: 'Clientes & Serviços — Ajuda',
    intro: 'Centro de cadastros: clientes, serviços e produtos usados em vendas/agenda.',
    items: [
      { q: 'Cliente x Empresa', a: 'Marque "É empresa" para usar CNPJ. Aniversário gera lembrete automático.' },
      { q: 'Endereço', a: 'Aparece na O.S., orçamento e na rota do dia.' },
      { q: 'Equipamentos do cliente', a: 'Cadastre marca, BTUs, instalação e garantia — facilita a manutenção preventiva.' },
      { q: 'Serviço x Produto', a: 'Serviço tem duração (min). Produto tem estoque (qty) e custo.' },
      { q: 'Preço e custo', a: 'Preço é o que cobra; custo é o que paga. Lucro é calculado automático.' },
      { q: 'Importar/Exportar', a: 'Use Backup para baixar/restaurar a base completa.' },
    ],
  },
  documents: {
    title: 'Orçamentos & O.S. — Ajuda',
    intro: 'Gere orçamentos e Ordens de Serviço profissionais em PDF.',
    items: [
      { q: 'Criar orçamento', a: 'Botão Novo → adicione itens, desconto e validade.' },
      { q: 'Enviar pro cliente', a: 'Gere PDF e envie por WhatsApp com 1 clique.' },
      { q: 'Aceito pelo cliente', a: 'Mude status para "Aceito" → vira O.S. e entra no Financeiro ao concluir.' },
      { q: 'Assinatura digital', a: 'O cliente assina na tela do celular; a assinatura fica salva no PDF.' },
      { q: 'Validade', a: 'Padrão 30 dias — pode ajustar por orçamento.' },
    ],
  },
  financeiro: {
    title: 'Financeiro — Ajuda',
    intro: 'Controle de entradas, saques, reservas, gastos fixos e impostos.',
    items: [
      { q: 'Saldo do mês', a: 'Entradas − Saques − Reservas − Gastos Fixos do mês selecionado.' },
      { q: 'Entrada', a: 'Receita (venda, serviço, contrato). Gerada automaticamente pelo PDV e Agenda.' },
      { q: 'Saque', a: 'Retirada para uso pessoal — sai do saldo.' },
      { q: 'Reserva', a: 'Valor "guardado" — sai do saldo disponível mas continua no patrimônio.' },
      { q: 'Gastos fixos', a: 'Aluguel, internet, salários. Marque "recorrente" para repetir todo mês.' },
      { q: 'Sincronizar', a: 'Atualiza vendas/contratos do mês e corrige órfãs/duplicatas automaticamente.' },
      { q: 'Conferência mensal', a: 'Marque "Bateu ✅" quando confere com o banco. Histórico fica gravado.' },
      { q: 'Resetar mês', a: 'Botão de reset apaga conferência local e recarrega do banco — útil em casos difíceis.' },
      { q: 'Extrato PDF', a: 'Exporta extrato detalhado do mês para contador ou banco.' },
    ],
  },
  services: {
    title: 'Manutenções & Contratos — Ajuda',
    intro: 'Contratos recorrentes e manutenções programadas (limpeza, troca de filtro).',
    items: [
      { q: 'Contrato', a: 'Valor mensal por cliente. Toda parcela vira entrada no Financeiro automaticamente.' },
      { q: 'Intervalo de limpeza', a: 'A cada X meses (padrão 6) o sistema gera manutenção programada.' },
      { q: 'Manutenção preventiva', a: 'Aparece no Dashboard e Lembretes quando se aproxima da data.' },
      { q: 'Concluir manutenção', a: 'Marque como concluída — gera próxima conforme o intervalo.' },
    ],
  },
  'btu-calculator': {
    title: 'Calculadora BTU — Ajuda',
    intro: 'Recomenda a potência ideal do ar-condicionado para um ambiente.',
    items: [
      { q: 'Como usar', a: 'Informe área (m²), pessoas, exposição ao sol e aparelhos eletrônicos.' },
      { q: 'Resultado', a: 'BTU recomendado já com margem técnica — use como orientação no orçamento.' },
      { q: 'Salvar no cliente', a: 'Cadastre o equipamento com o BTU calculado para histórico.' },
    ],
  },
  pdv: {
    title: 'PDV — Ajuda',
    intro: 'Venda no balcão: produtos + serviços com múltiplas formas de pagamento.',
    items: [
      { q: 'Adicionar item', a: 'Busque produto/serviço e clique. Pode mudar quantidade e preço na hora.' },
      { q: 'Multi-pagamento', a: 'Aceita PIX + Dinheiro + Cartão na mesma venda. Soma deve fechar o total.' },
      { q: 'Parcelado', a: 'Cartão de crédito permite parcelas — taxa configurável.' },
      { q: 'Vai pro Financeiro?', a: 'Sim — entrada é registrada na hora e estoque é descontado automaticamente.' },
      { q: 'Cliente vinculado', a: 'Vincule o cliente para histórico, contratos e lembretes.' },
    ],
  },
  impostos: {
    title: 'Impostos — Ajuda',
    intro: 'DAS/MEI, INSS, ISS, IRRF, FGTS e folha de pagamento.',
    items: [
      { q: 'Cadastrar mês', a: 'Selecione mês/ano → preencha valores → confirme. Vira gasto fixo do mês.' },
      { q: 'Folha de pagamento', a: 'Adicione funcionários com salário, INSS e FGTS — gera linha mensal.' },
      { q: 'XML de NF', a: 'Importe XMLs para somar receita de produtos/serviços automaticamente.' },
      { q: 'Custos de prestador', a: 'Some pagamentos a terceiros para abater na apuração.' },
    ],
  },
  'notifications-settings': {
    title: 'Notificações — Ajuda',
    intro: 'Controla sons, push e quais alertas você quer receber.',
    items: [
      { q: 'Permitir no navegador', a: 'Aceite a permissão para receber push em tempo real.' },
      { q: 'Som', a: 'Beep ao chegar novo agendamento online. Pode silenciar.' },
      { q: 'PWA', a: 'Instalando como app, as notificações funcionam com o navegador fechado.' },
    ],
  },
  lembretes: {
    title: 'Lembretes & Mensagens — Ajuda',
    intro: 'Mensagens automáticas: aniversário, retorno, manutenção, contrato vencendo.',
    items: [
      { q: 'Envia sozinho?', a: 'Gera o link de WhatsApp pronto com mensagem — você confirma e envia.' },
      { q: 'Modelos', a: 'Edite templates para combinar com o tom da sua empresa.' },
      { q: 'Aniversário', a: 'Dispara no dia, com cupom de desconto opcional.' },
      { q: 'Manutenção preventiva', a: 'Avisa 7 dias antes da próxima limpeza programada.' },
    ],
  },
  backup: {
    title: 'Backup — Ajuda',
    intro: 'Exportar e importar todos os dados do sistema.',
    items: [
      { q: 'Exportar tudo', a: 'Baixa JSON com clientes, serviços, vendas, contratos e financeiro.' },
      { q: 'Quando fazer', a: 'Antes de testes grandes, fim de mês ou troca de dispositivo.' },
      { q: 'Importar', a: 'Use apenas em ambiente novo/vazio — substitui dados existentes.' },
      { q: 'Onde fica salvo', a: 'O arquivo fica no seu dispositivo. Guarde em local seguro (Drive, e-mail).' },
    ],
  },
  company: {
    title: 'Empresa — Ajuda',
    intro: 'Dados da sua empresa e configuração do agendamento online.',
    items: [
      { q: 'Logo e dados', a: 'Aparecem em orçamentos, O.S., PDFs e no link público de agendamento.' },
      { q: 'WhatsApp / Instagram', a: 'Usados nos botões de contato e na página pública.' },
      { q: 'Horário de funcionamento', a: 'Dias da semana, hora de início/fim, almoço e antecedência mínima.' },
      { q: 'Férias / Folga', a: 'Cadastre datas em que não atende — agendamento online bloqueia automaticamente.' },
      { q: 'CNPJ/CPF', a: 'Aparece em orçamentos e NF. Pode deixar em branco se MEI sem CNPJ.' },
    ],
  },
  prestadores: {
    title: 'Prestadores — Ajuda',
    intro: 'Equipe que atende em campo: técnicos, ajudantes e parceiros.',
    items: [
      { q: 'Convidar', a: 'Gere um código de convite. O prestador entra pelo app com PIN/celular.' },
      { q: 'Permissões', a: 'Defina o que cada um vê (só agenda, ou também financeiro).' },
      { q: 'Salário / Vale', a: 'Cadastre — gera gasto fixo mensal automático no Financeiro.' },
      { q: 'Status online', a: 'Veja quem está online em tempo real para distribuir chamados.' },
    ],
  },
  historico: {
    title: 'Histórico Geral — Ajuda',
    intro: 'Linha do tempo unificada de tudo que aconteceu na empresa.',
    items: [
      { q: 'O que mostra', a: 'Agendamentos, vendas, contratos, recebimentos e ajustes — em ordem cronológica.' },
      { q: 'Filtros', a: 'Filtre por cliente, tipo de evento ou período para auditoria.' },
      { q: 'Exportar', a: 'Gere PDF do histórico do cliente para enviar junto da O.S.' },
    ],
  },
  funcionarios: {
    title: 'Funcionários — Ajuda',
    intro: 'Gestão de acessos e papéis dos colaboradores.',
    items: [
      { q: 'Papéis', a: 'Suporte (só atendimento), Sistema (operacional), Super Admin (tudo).' },
      { q: 'PIN de acesso', a: 'Cada funcionário tem um PIN curto para logar rápido no app.' },
      { q: 'Bloquear', a: 'Desative o funcionário para revogar o acesso sem apagar histórico.' },
    ],
  },
};

interface TabHelpButtonProps {
  tab: string;
}

export default function TabHelpButton({ tab }: TabHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const help = HELP[tab];
  if (!help) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
        title="Ajuda desta aba"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Ajuda</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {help.title}
            </DialogTitle>
            {help.intro && <DialogDescription>{help.intro}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto">
            {help.items.map((it, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-semibold text-foreground">{it.q}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.a}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
