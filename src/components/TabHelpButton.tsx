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
    intro: 'Visão geral do dia: agendamentos, vendas, alertas e atalhos.',
    items: [
      { q: 'Por que números não batem?', a: 'Vá em Financeiro → Sincronizar para reconciliar vendas e contratos.' },
      { q: 'Notificações', a: 'O sino no topo mostra agendamentos online, lembretes e alertas.' },
    ],
  },
  appointments: {
    title: 'Agenda — Ajuda',
    intro: 'Crie, edite e acompanhe atendimentos do dia.',
    items: [
      { q: 'Adicionar atendimento', a: 'Botão "Novo" → escolha cliente, serviço, data e hora.' },
      { q: 'Reordenar rota', a: 'Use "PDF Rota" para imprimir a ordem do dia.' },
      { q: 'Não aparece o agendamento online', a: 'Confirme na aba "Agendamento Online" — ao aceitar, entra aqui automaticamente.' },
    ],
  },
  'online-bookings': {
    title: 'Agendamento Online — Ajuda',
    intro: 'Receba pedidos pelo seu link e aceite/recuse em 1 clique.',
    items: [
      { q: 'Como funciona', a: 'Cliente abre seu link, escolhe serviço/data/hora e envia. Aparece em "Solicitações para você responder".' },
      { q: 'Aceitar', a: 'Clique em Confirmar — o pedido sai da lista pendente e vai direto para sua Agenda.' },
      { q: 'Recusar', a: 'Clique em Recusar — o cliente recebe mensagem no WhatsApp explicando.' },
      { q: 'Compartilhar link', a: 'Copie o link no topo e envie por WhatsApp/Instagram.' },
    ],
  },
  cadastros: {
    title: 'Clientes & Serviços — Ajuda',
    intro: 'Cadastre clientes, serviços e produtos usados nas vendas.',
    items: [
      { q: 'Cliente x Empresa', a: 'Marque "É empresa" para usar CNPJ. Aniversário envia lembrete automático.' },
      { q: 'Serviço x Produto', a: 'Serviço tem duração (minutos). Produto tem estoque (qty) e custo.' },
    ],
  },
  documents: {
    title: 'Orçamentos — Ajuda',
    intro: 'Gere orçamentos profissionais em PDF e envie ao cliente.',
    items: [
      { q: 'Aceito pelo cliente', a: 'Mude status para "Aceito" — vira Ordem de Serviço e entra no financeiro ao concluir.' },
      { q: 'Validade', a: 'Por padrão 30 dias — ajustável no orçamento.' },
    ],
  },
  financeiro: {
    title: 'Financeiro — Ajuda',
    intro: 'Controle de entradas, saques, reservas e gastos fixos.',
    items: [
      { q: 'Saldo do mês', a: 'Entradas − Saques − Reservas − Gastos Fixos do mês selecionado.' },
      { q: 'Sincronizar', a: 'Atualiza vendas/contratos do mês e corrige órfãs/duplicatas automaticamente.' },
      { q: 'Conferência mensal', a: 'Marque "Bateu ✅" quando confere com o banco. O histórico fica gravado.' },
    ],
  },
  services: {
    title: 'Manutenções & Contratos — Ajuda',
    intro: 'Contratos recorrentes e manutenções programadas (limpeza, troca de filtro).',
    items: [
      { q: 'Contrato gera receita?', a: 'Sim — toda mensalidade entra automaticamente em Financeiro.' },
      { q: 'Manutenção agendada', a: 'Dispara lembrete no intervalo definido (ex.: a cada 6 meses).' },
    ],
  },
  'btu-calculator': {
    title: 'Calculadora BTU — Ajuda',
    items: [
      { q: 'Como usar', a: 'Informe área, pessoas, sol e aparelhos. Recomendamos BTUs com margem técnica.' },
    ],
  },
  pdv: {
    title: 'PDV — Ajuda',
    intro: 'Venda balcão: produtos + serviços, várias formas de pagamento.',
    items: [
      { q: 'Multi-pagamento', a: 'Aceita PIX + Dinheiro + Cartão na mesma venda. Soma deve fechar o total.' },
      { q: 'Vai pro Financeiro?', a: 'Sim — entrada é registrada na hora.' },
    ],
  },
  impostos: {
    title: 'Impostos — Ajuda',
    intro: 'DAS/MEI, INSS, ISS e folha de pagamento simplificada.',
    items: [
      { q: 'Onde aparece o gasto', a: 'Vira gasto fixo do mês ao confirmar pagamento.' },
    ],
  },
  'notifications-settings': {
    title: 'Notificações — Ajuda',
    items: [
      { q: 'Sons e PWA', a: 'Permita notificações no navegador para receber agendamentos em tempo real.' },
    ],
  },
  lembretes: {
    title: 'Lembretes — Ajuda',
    intro: 'Mensagens automáticas: aniversário, retorno, manutenção.',
    items: [
      { q: 'Envia sozinho?', a: 'Gera o link de WhatsApp pronto — você confirma e envia.' },
    ],
  },
  backup: {
    title: 'Backup — Ajuda',
    items: [
      { q: 'Exportar tudo', a: 'Baixa JSON com clientes, serviços, vendas e financeiro.' },
      { q: 'Importar', a: 'Use só em ambiente novo — substitui dados existentes.' },
    ],
  },
  company: {
    title: 'Empresa — Ajuda',
    items: [
      { q: 'Horário de funcionamento', a: 'Define os horários do agendamento online (almoço, férias, dias da semana).' },
      { q: 'Logo e dados', a: 'Aparecem em orçamentos, OS e link público.' },
    ],
  },
  prestadores: {
    title: 'Prestadores — Ajuda',
    items: [
      { q: 'Convidar', a: 'Gere um código de convite. O prestador entra com PIN/celular.' },
      { q: 'Salário/Vale', a: 'Cadastre — gera gasto fixo mensal automático.' },
    ],
  },
  historico: {
    title: 'Histórico — Ajuda',
    items: [
      { q: 'O que mostra', a: 'Linha do tempo unificada de agendamentos, vendas e financeiro.' },
    ],
  },
  funcionarios: {
    title: 'Funcionários — Ajuda',
    items: [
      { q: 'Permissões', a: 'Defina quais abas cada papel acessa (suporte/sistema).' },
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
