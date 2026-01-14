import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para enviar notificação no WhatsApp (abre link no navegador do admin)
async function sendWhatsAppNotification(supabase: any, type: string, email: string, phone: string | null, plan: string, amount: number) {
  // Buscar WhatsApp do admin nas configurações
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'whatsapp_suporte')
    .maybeSingle();

  const adminWhatsapp = settings?.value || '';
  
  let message = '';
  let title = '';
  
  switch (type) {
    case 'payment_success':
      title = '💰 Pagamento Confirmado!';
      message = `✅ *PAGAMENTO CONFIRMADO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n💳 Plano: ${plan}\n💵 Valor: R$ ${amount.toFixed(2)}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}`;
      break;
    case 'payment_error':
      title = '❌ Erro no Pagamento';
      message = `❌ *ERRO NO PAGAMENTO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}\n\nVerifique o painel para mais detalhes.`;
      break;
    case 'pending_activation':
      title = '⏳ Ativação Pendente';
      message = `⏳ *ATIVAÇÃO PENDENTE*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n⏰ Cadastrado em: ${new Date().toLocaleString('pt-BR')}\n\nUsuário aguardando aprovação.`;
      break;
  }

  // Salvar notificação no banco
  await supabase.from('admin_notifications').insert({
    type,
    title,
    message,
    user_email: email,
    user_phone: phone,
    metadata: { plan, amount, whatsapp_link: adminWhatsapp ? `https://wa.me/55${adminWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null }
  });

  console.log(`📬 Notification saved: ${type} for ${email}`);
}

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

    // Verificar eventos de erro
    const errorEvents = ['failed', 'declined', 'refused', 'error', 'cancelled', 'canceled'];
    const isErrorEvent = errorEvents.some(e => event.toLowerCase().includes(e.toLowerCase()));

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

    // Extrair telefone
    const phone = 
      payload.phone || 
      payload.customer?.phone || 
      payload.buyer?.phone || 
      payload.client?.phone ||
      payload.data?.customer?.phone ||
      payload.data?.phone ||
      payload.customer_phone ||
      payload.buyer_phone ||
      null;

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

    console.log(`Processing payment: email=${email}, phone=${phone}, amount=${amount}, event=${event}, transactionId=${transactionId}`);

    // Se for evento de erro, notificar e retornar
    if (isErrorEvent && email) {
      await sendWhatsAppNotification(supabase, 'payment_error', email, phone, '', amount);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Payment error event received and notification sent` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log(`User not found for email: ${email}`);
      // Notificar sobre usuário não encontrado
      await sendWhatsAppNotification(supabase, 'pending_activation', email, phone, '', amount);
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

    // Buscar telefone do usuário se não veio no payload
    let userPhone = phone;
    if (!userPhone) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      userPhone = profile?.phone || null;
    }

    // Determinar plano baseado no valor
    // R$ 39,90 (até 50) = mensal (1 mês)
    // Valor maior = anual (12 meses)
    const isMonthly = amount <= 50;
    const plan = isMonthly ? 'mensal' : 'anual';
    const planName = isMonthly ? 'Mensal' : 'Anual';
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
      await sendWhatsAppNotification(supabase, 'payment_error', email, userPhone, plan, amount);
      return new Response(
        JSON.stringify({ success: false, error: 'Error updating subscription', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar notificação de sucesso
    await sendWhatsAppNotification(supabase, 'payment_success', email, userPhone, planName, amount);

    console.log(`✅ Subscription activated successfully for ${email} - Plan: ${plan}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura ativada com sucesso!',
        data: {
          email,
          plan,
          plan_name: planName,
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
