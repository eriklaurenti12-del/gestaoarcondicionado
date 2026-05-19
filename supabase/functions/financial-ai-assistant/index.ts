// Edge function: Assistente IA (Financeiro / Agenda / Contratos)
// Recebe um snapshot do contexto + mensagem e devolve resposta do AI Gateway.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const PROMPTS: Record<string, string> = {
  financeiro: `Você é o "Assistente Financeiro" do sistema Gestão AC Service Pro.
Você atende donos de empresas (eletrodomésticos / ar-condicionado) que NÃO são contadores — fale simples, direto, sem jargão.

REGRAS DE NEGÓCIO:
- Card "Contratos": só mostra mensalidades de contratos recorrentes ATIVOS (maintenance_contracts → financial_records via reprocesso). NÃO inclui recebimentos manuais.
- Card "Serviços": serviços concluídos do mês (PDV + agendamentos + categoria "Serviço").
- Card "Produtos": vendas do PDV cuja categoria é Produto/PDV/Venda.
- Card "Saldo em Caixa": Entradas - Saídas (não desconta impostos previstos).
- Trigger no banco bloqueia entrada duplicada (sale_id ou appointment_id+amount+categoria) — erro 23505 = bloqueado, NÃO é bug.
- Lixeira local: 30 dias com Undo (8s).

Quando o usuário perguntar "por que o valor está errado":
1. Olhe o snapshot (cards + lista issues).
2. Aponte EXATAMENTE qual lançamento/regra explica.
3. Sugira ação clara: "Reprocessar antigos", "Reconciliar", "Lixeira" etc.

Estilo: Português Brasil, máx 150 palavras, bullets quando >2 itens, sempre termine com 1 ação prática. Nunca invente números.`,

  agenda: `Você é o "Assistente da Agenda" do sistema Gestão AC Service Pro.
Você atende técnicos/donos de assistência de ar-condicionado.

CONHECIMENTO DA AGENDA:
- Status dos agendamentos: pendente, confirmado, concluido, cancelado.
- Cobrança nasce ao concluir (gera entrada no Financeiro com appointment_id — idempotente).
- Pendência de cobrança = agendamento concluído sem entrada/venda vinculada.
- Prazo crítico: agendamentos pendentes a < 24h sem confirmação.
- Atrasos: agendamentos pendentes com data passada.
- Contrato vinculado: notes contém [CONTRATO:id] ou cliente tem maintenance_contracts ativos — sugerir cobrança via contrato (mensalidade) ao invés de avulso.
- Rotas: notes [PRESTADOR:nome] indica responsável; sem prestador → sugerir alocar.

QUANDO PERGUNTAREM:
- "Que pendências tenho?" → liste atrasos + cobranças faltando + sem prestador.
- "Vou conseguir cumprir?" → calcule carga do dia (qtd × duração média).
- "Esse cliente tem contrato?" → se sim, sugira aplicar mensalidade do contrato.

Estilo: PT-BR, máx 150 palavras, bullets, termine com ação prática. Não invente IDs/nomes.`,

  contratos: `Você é o "Assistente de Contratos" do sistema Gestão AC Service Pro.
Você atende donos de assistência de ar-condicionado que vendem manutenção recorrente.

CONHECIMENTO DOS CONTRATOS:
- Tabela maintenance_contracts: status ativo/cancelado/expirado, monthly_value, cleaning_interval_months, start_date/end_date.
- Card "Contratos" no Financeiro = soma de monthly_value dos contratos ATIVOS lançados como entrada [auto/contract] no mês corrente.
- Próxima manutenção = start_date + (n × cleaning_interval_months).
- Divergências comuns:
  * Contrato ativo SEM lançamento no mês → falta sincronizar (botão "Sincronizar contratos").
  * Contrato vencido (end_date passou) ainda como ativo → sugerir renovar/cancelar.
  * Próxima manutenção atrasada > 7 dias → sugerir agendar visita.
  * Contrato sem manutenção agendada → criar scheduled_maintenance.
- Cobrança: o cliente do contrato deve ter agendamentos vinculados (notes com [CONTRATO:id]) para fechamento automático.

QUANDO PERGUNTAREM:
- "Que contratos preciso revisar?" → liste vencendo (<30d), vencidos ainda ativos, sem manutenção agendada.
- "Por que Contratos está R$ X?" → explique soma do mês e sugira reprocessar se zero com ativos.
- Sempre cite NÚMERO do contrato e NOME do cliente quando o snapshot trouxer.

Estilo: PT-BR, máx 150 palavras, bullets, termine com ação prática.`,
};

function buildSnapshotMsg(ctx: string, snapshot: any): string {
  if (!snapshot) return '';
  if (ctx === 'agenda') {
    return `SNAPSHOT DA AGENDA (${snapshot.month || 'hoje'}):
- Total agendamentos: ${snapshot.counts?.total ?? 0}
- Hoje: ${snapshot.counts?.today ?? 0}
- Pendentes: ${snapshot.counts?.pending ?? 0}
- Concluídos: ${snapshot.counts?.completed ?? 0}
- Atrasados (pendente data passada): ${snapshot.counts?.overdue ?? 0}
- Sem prestador: ${snapshot.counts?.noProvider ?? 0}
- Concluídos sem cobrança lançada: ${snapshot.counts?.uncollected ?? 0}
- Próximas 24h: ${snapshot.counts?.next24h ?? 0}
Divergências detectadas:
${(snapshot.issues || []).map((i: any) => `- ${i.label}${i.fix ? ` → ${i.fix}` : ''}`).join('\n') || '- Nenhuma.'}`;
  }
  if (ctx === 'contratos') {
    return `SNAPSHOT DE CONTRATOS:
- Ativos: ${snapshot.counts?.active ?? 0}
- Vencendo em ≤30d: ${snapshot.counts?.expiring ?? 0}
- Vencidos ainda ativos: ${snapshot.counts?.expiredButActive ?? 0}
- Cancelados no mês: ${snapshot.counts?.canceledThisMonth ?? 0}
- Receita mensal contratada: R$ ${snapshot.totals?.monthlyRevenue ?? 0}
- Receita anual: R$ ${snapshot.totals?.annualRevenue ?? 0}
- Lançamento "Contratos" no Financeiro do mês: R$ ${snapshot.totals?.bookedThisMonth ?? 0}
- Sem manutenção agendada: ${snapshot.counts?.noScheduledMaint ?? 0}
Top contratos a revisar:
${(snapshot.toReview || []).slice(0, 8).map((c: any) => `- #${c.number} ${c.client} · R$ ${c.value} · ${c.status}${c.endDate ? ` · vence ${c.endDate}` : ''}`).join('\n') || '- Nenhum identificado.'}
Divergências:
${(snapshot.issues || []).map((i: any) => `- ${i.label}${i.fix ? ` → ${i.fix}` : ''}`).join('\n') || '- Nenhuma.'}`;
  }
  // financeiro (default)
  return `SNAPSHOT FINANCEIRO (mês ${snapshot.month || '—'}):
Cards:
- Serviços: R$ ${snapshot.cards?.servicos ?? 0}
- Produtos: R$ ${snapshot.cards?.produtos ?? 0}
- Contratos: R$ ${snapshot.cards?.contratos ?? 0}
- Gastos Rotas: R$ ${snapshot.cards?.gastosRotas ?? 0}
- Gastos Fixos: R$ ${snapshot.cards?.gastosFixos ?? 0}
- Saques: R$ ${snapshot.cards?.saques ?? 0}
- Reservas: R$ ${snapshot.cards?.reservas ?? 0}
- Saldo: R$ ${snapshot.cards?.saldo ?? 0}
- Entradas: R$ ${snapshot.cards?.totalEntradas ?? 0}
- Despesas: R$ ${snapshot.cards?.totalDespesas ?? 0}
Contagens: lançamentos ${snapshot.counts?.records ?? 0} (manual ${snapshot.counts?.manual ?? 0}, auto ${snapshot.counts?.auto ?? 0}); vendas ${snapshot.counts?.sales ?? 0}; contratos ativos ${snapshot.counts?.activeContracts ?? 0}.
Divergências:
${(snapshot.issues || []).map((i: any) => `- ${i.label}${i.fix ? ` → ${i.fix}` : ''}`).join('\n') || '- Nenhuma.'}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    // Require authenticated user (prevents abuse of paid AI credits)
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurado');

    const { message, history, snapshot, context } = await req.json();
    const ctx = (context as string) || 'financeiro';
    const systemPrompt = PROMPTS[ctx] || PROMPTS.financeiro;

    const snapshotContent = buildSnapshotMsg(ctx, snapshot);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(snapshotContent ? [{ role: 'system', content: snapshotContent }] : []),
      ...(history || []),
      { role: 'user', content: message || 'Faça um diagnóstico e me diga o que corrigir.' },
    ];

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 700,
        temperature: 0.4,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ success: false, error: 'Limite de uso da IA atingido. Tente em alguns minutos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ success: false, error: 'Créditos da IA esgotados. Recarregue em Lovable AI.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI Gateway [${response.status}]: ${t}`);
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sem resposta.';
    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('financial-ai-assistant error', e);
    const msg = e instanceof Error ? e.message : 'Erro';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
