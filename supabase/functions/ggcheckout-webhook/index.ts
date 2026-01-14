import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ler o body da requisição
    const bodyText = await req.text();
    
    // Se o body estiver vazio, retorna sucesso (teste de conexão)
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty body received - connection test successful');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook connection test successful',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse o JSON
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Body:', bodyText);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('GGCheckout webhook received:', JSON.stringify(payload, null, 2));

    // GGCheckout pode enviar diferentes estruturas de payload
    // Adaptar para os campos comuns da GGCheckout
    const event = payload.event || payload.type || payload.status || '';
    
    // Verificar se é um evento de pagamento aprovado
    // Eventos aceitos: pix_paid, card_paid, paid, approved, PAID, etc.
    const paidEvents = ['pix_paid', 'card_paid', 'paid', 'approved', 'PAID', 'APPROVED', 'Pix Paid', 'Card Paid'];
    const isPaidEvent = paidEvents.some(e => 
      event.toLowerCase().includes(e.toLowerCase().replace('_', '').replace(' ', ''))
    ) || payload.paid === true;

    if (!isPaidEvent) {
      console.log(`Event "${event}" is not a paid event, skipping activation`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${event} received but not processed (not a payment confirmation)` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair email - tentar várias estruturas possíveis da GGCheckout
    const email = 
      payload.email || 
      payload.customer?.email || 
      payload.buyer?.email || 
      payload.client?.email ||
      payload.data?.customer?.email ||
      payload.data?.email ||
      payload.payer?.email ||
      payload.customer_email ||
      payload.buyer_email;

    // Extrair valor - tentar várias estruturas
    let amount = 
      payload.amount || 
      payload.value || 
      payload.total || 
      payload.price ||
      payload.data?.amount ||
      payload.data?.value ||
      payload.transaction?.amount ||
      payload.order?.amount ||
      0;

    // Se o valor vier em centavos (ex: 3990 ao invés de 39.90), converter
    if (typeof amount === 'number' && amount > 1000) {
      amount = amount / 100;
    } else if (typeof amount === 'string') {
      // Limpar formatação brasileira (R$ 39,90 -> 39.90)
      amount = parseFloat(amount.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    }

    const transactionId = 
      payload.transaction_id || 
      payload.id || 
      payload.order_id ||
      payload.data?.id ||
      payload.reference ||
      `gg_${Date.now()}`;

    console.log(`Processing payment: email=${email}, amount=${amount}, event=${event}, transactionId=${transactionId}`);

    if (!email) {
      console.error('No email found in payload. Full payload:', JSON.stringify(payload));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email not found in payload',
          received_payload: payload 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar usuário pelo email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error finding user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log(`User not found for email: ${email}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not registered. Please sign up first.', 
          email,
          hint: 'O usuário precisa se cadastrar no sistema antes de efetuar o pagamento.'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar plano baseado no valor
    // R$ 39,90 (até 50) = mensal (1 mês)
    // Valor maior = anual (12 meses)
    const isMonthly = amount <= 50;
    const plan = isMonthly ? 'mensal' : 'anual';
    const durationMonths = isMonthly ? 1 : 12;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    console.log(`Activating subscription for user ${user.id} (${email}): plan=${plan}, amount=${amount}, duration=${durationMonths} months`);

    // Atualizar assinatura do usuário
    const { error: updateError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan: plan,
        status: 'aprovado',
        is_active: true,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error updating subscription', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Subscription activated successfully for ${email} - Plan: ${plan}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura ativada com sucesso!',
        data: {
          email,
          plan,
          plan_name: isMonthly ? 'Mensal' : 'Anual',
          amount,
          duration_months: durationMonths,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          transaction_id: transactionId
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
