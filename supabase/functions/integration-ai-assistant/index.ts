import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `Você é um assistente especialista em integrações de pagamento e webhooks para o sistema AC Service Pro.

Seu papel é ajudar o administrador a:
1. Configurar webhooks em plataformas de pagamento (GGCheckout, Hotmart, Kiwify, Cakto, Eduzz, Monetizze, PagSeguro, Mercado Pago, Stripe, Braip, Yampi, Pepper)
2. Testar integrações e diagnosticar problemas
3. Entender como o sistema processa pagamentos automaticamente
4. Configurar novas plataformas de checkout

COMO O SISTEMA FUNCIONA:
- O webhook recebe notificações de pagamento de qualquer plataforma
- Detecta automaticamente a plataforma pelo formato do payload
- Extrai email, valor e status do pagamento
- Busca o usuário pelo email no sistema
- Se valor ≤ R$50: ativa plano mensal (1 mês)
- Se valor > R$50: ativa plano anual (12 meses)
- Atualiza a assinatura do usuário para "aprovado" e "ativo"
- Gera notificação para o admin

URL DO WEBHOOK: https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/ggcheckout-webhook

EVENTOS RECONHECIDOS: pix_paid, card_paid, paid, approved, PURCHASE_APPROVED, order_paid, payment_approved, checkout.session.completed, payment_intent.succeeded, Finalizada

PLATAFORMAS SUPORTADAS COM GUIAS:
- GGCheckout: Configurações > Webhooks > Adicionar > Colar URL > Selecionar "Pagamento Aprovado"
- Hotmart: Ferramentas > Webhook (Hottok) > URL de notificação > Compra aprovada
- Kiwify: Configurações > Webhooks > Nova URL > "Compra Aprovada"
- Cakto: Configurações > Integrações > Webhook > Colar URL > Eventos de pagamento
- Eduzz: Configurações > Notificações > Postback URL > Status "Pago"
- Monetizze: Configurações > Postback > URL > "Compra Finalizada"
- Stripe: Developers > Webhooks > Add Endpoint > checkout.session.completed
- Mercado Pago: Configurações > Notificações IPN > URL > "Payments"
- PagSeguro: Vendas > Configurações > URL de notificação
- Braip: Configurações > Postback > URL > "Venda Aprovada"
- Yampi: Configurações > Webhooks > URL > Eventos de pedido
- Pepper: Mesmo do Hotmart > Ferramentas > Webhook

IMPORTANTE:
- Sempre responda em português brasileiro
- Seja direto e prático
- Forneça passos numerados quando explicar configurações
- Se o usuário perguntar sobre uma plataforma não suportada, explique que o webhook é universal e pode funcionar com qualquer plataforma que envie email e valor no payload
- Sugira testes sempre que possível`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { message, history } = await req.json();

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user', content: message },
    ];

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`AI Gateway error [${response.status}]: ${errorData}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';

    return new Response(
      JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
