// Edge function: Assistente IA do Financeiro
// Recebe um snapshot do estado financeiro do usuário + mensagem e devolve resposta do AI Gateway.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `Você é o "Assistente Financeiro" do sistema Gestão AC Service Pro.
Você atende donos de empresas (eletrodomésticos / ar-condicionado) que NÃO são contadores — fale simples, direto, sem jargão.

REGRAS DE NEGÓCIO QUE VOCÊ CONHECE:
- Card "Contratos": só mostra mensalidades de contratos recorrentes ATIVOS (tabela maintenance_contracts → financial_records via reprocesso). NÃO inclui recebimentos manuais avulsos.
- Card "Serviços": serviços concluídos do mês (PDV + agendamentos + lançamentos categoria "Serviço").
- Card "Produtos": vendas do PDV cuja categoria é Produto/PDV/Venda.
- Card "Saldo em Caixa": Entradas - Saídas (não desconta impostos previstos).
- Saídas: financial_records type="saida" + fixed_expenses do mês.
- Deduplicação: existe trigger no banco que bloqueia entrada duplicada com mesmo (sale_id) ou (appointment_id + amount + categoria) — erro 23505 = bloqueado, não é bug.
- Lixeira local: exclusões vão para localStorage, com Undo (8s) e restauração 30 dias.

QUANDO O USUÁRIO PERGUNTAR "POR QUE O VALOR ESTÁ ERRADO":
1. Olhe o snapshot recebido (cards + lista de divergências detectadas).
2. Aponte EXATAMENTE qual lançamento ou regra explica a diferença.
3. Sugira a ação clara: "Clique em Reprocessar antigos", "Exclua o lançamento X", "Verifique a aba Conciliar", etc.

QUANDO HOUVER DIVERGÊNCIA AUTOMÁTICA (campo "issues"):
- Liste em bullet o que está fora e a correção sugerida.
- Se houver "fix": botão sugerido na UI ("Reprocessar contratos", "Sincronizar mês", "Abrir lixeira").

ESTILO:
- Português Brasil, máximo 150 palavras na resposta principal.
- Use bullets quando listar mais de 2 itens.
- Sempre termine com 1 ação prática que o usuário pode clicar agora.
- Nunca invente números: cite só o que está no snapshot.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurado');

    const { message, history, snapshot } = await req.json();

    const snapshotMsg = snapshot
      ? {
          role: 'system',
          content: `SNAPSHOT FINANCEIRO ATUAL DO USUÁRIO (mês ${snapshot.month || '—'}):\n` +
            `Cards:\n` +
            `- Serviços: R$ ${snapshot.cards?.servicos ?? 0}\n` +
            `- Produtos: R$ ${snapshot.cards?.produtos ?? 0}\n` +
            `- Contratos: R$ ${snapshot.cards?.contratos ?? 0}\n` +
            `- Gastos Rotas: R$ ${snapshot.cards?.gastosRotas ?? 0}\n` +
            `- Gastos Fixos: R$ ${snapshot.cards?.gastosFixos ?? 0}\n` +
            `- Saídas (saques): R$ ${snapshot.cards?.saques ?? 0}\n` +
            `- Reservas: R$ ${snapshot.cards?.reservas ?? 0}\n` +
            `- Saldo em Caixa: R$ ${snapshot.cards?.saldo ?? 0}\n` +
            `- Total Entradas: R$ ${snapshot.cards?.totalEntradas ?? 0}\n` +
            `- Total Despesas: R$ ${snapshot.cards?.totalDespesas ?? 0}\n` +
            `Contagens:\n` +
            `- Lançamentos do mês: ${snapshot.counts?.records ?? 0} (manuais ${snapshot.counts?.manual ?? 0}, automáticos ${snapshot.counts?.auto ?? 0})\n` +
            `- Vendas do mês: ${snapshot.counts?.sales ?? 0}\n` +
            `- Contratos ativos: ${snapshot.counts?.activeContracts ?? 0}\n` +
            `Divergências detectadas pelo cliente:\n` +
            (snapshot.issues?.length
              ? snapshot.issues.map((i: any) => `- ${i.label}${i.fix ? ` → ação sugerida: ${i.fix}` : ''}`).join('\n')
              : '- Nenhuma divergência automática detectada.'),
        }
      : null;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(snapshotMsg ? [snapshotMsg] : []),
      ...(history || []),
      { role: 'user', content: message || 'Faça um diagnóstico do meu mês e me diga o que corrigir.' },
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
