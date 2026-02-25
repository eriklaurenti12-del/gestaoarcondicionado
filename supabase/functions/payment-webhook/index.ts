import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendNotification(supabase: any, type: string, email: string, phone: string | null, plan: string, amount: number, platform: string, username?: string) {
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
      title = `💰 Pagamento Confirmado! (${platform})`;
      message = `✅ *PAGAMENTO CONFIRMADO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n💳 Plano: ${plan}\n💵 Valor: R$ ${amount.toFixed(2)}\n🔌 Plataforma: ${platform}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}`;
      break;
    case 'payment_error':
      title = `❌ Erro no Pagamento (${platform})`;
      message = `❌ *ERRO NO PAGAMENTO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n🔌 Plataforma: ${platform}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}`;
      break;
    case 'pending_activation':
      title = `⏳ Ativação Pendente (${platform})`;
      message = `⏳ *ATIVAÇÃO PENDENTE*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n🔌 Plataforma: ${platform}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}\n\nUsuário aguardando aprovação.`;
      break;
    case 'new_user':
      title = `👤 Novo Usuário Cadastrado`;
      message = `👤 *NOVO USUÁRIO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}`;
      break;
    case 'access_granted':
      title = `✅ Acesso Liberado! (${platform})`;
      message = `✅ *ACESSO LIBERADO*\n\n📧 Email: ${email}\n📱 Tel: ${phone || 'Não informado'}\n💳 Plano: ${plan}\n🔌 Plataforma: ${platform}\n⏰ Data: ${new Date().toLocaleString('pt-BR')}`;
      break;
  }

  await supabase.from('admin_notifications').insert({
    type,
    title,
    message,
    user_email: email,
    user_phone: phone,
    metadata: { 
      plan, amount, platform, username,
      whatsapp_link: adminWhatsapp ? `https://wa.me/55${adminWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null 
    }
  });

  console.log(`📬 Notification saved: ${type} for ${email} via ${platform}`);
}

function detectPlatform(payload: any): string {
  // Hotmart / Pepper
  if (payload.hottok || payload.event?.startsWith?.('PURCHASE_')) return 'Hotmart';
  // Kiwify
  if (payload.event?.startsWith?.('order_') || payload.event?.startsWith?.('subscription_')) return 'Kiwify';
  // Stripe
  if (payload.type?.startsWith?.('checkout.session') || payload.type?.startsWith?.('payment_intent')) return 'Stripe';
  // Mercado Pago
  if (payload.action?.startsWith?.('payment.') || payload.live_mode !== undefined) return 'Mercado Pago';
  // Eduzz
  if (payload.trans_cod || payload.eduzz_id) return 'Eduzz';
  // Monetizze
  if (payload.chave_unica || payload.evento?.includes?.('Finalizada')) return 'Monetizze';
  // Yampi
  if (payload.event?.startsWith?.('order.') && payload.resource) return 'Yampi';
  // Braip
  if (payload.transaction_id?.startsWith?.('BR_') || payload.producer) return 'Braip';
  // Cakto
  if (payload.event?.startsWith?.('payment_') || payload.transaction_id?.startsWith?.('CK_')) return 'Cakto';
  // GGCheckout (default for Brazilian checkout)
  if (payload.event?.includes?.('pix_') || payload.event?.includes?.('card_')) return 'GGCheckout';
  // PagSeguro
  if (payload.notificationType || payload.notificationCode) return 'PagSeguro';
  
  return 'Desconhecida';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    
    if (!bodyText || bodyText.trim() === '') {
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook universal ativo - conexão OK', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const platform = detectPlatform(payload);
    console.log(`🔌 Webhook received from: ${platform}`, JSON.stringify(payload, null, 2));

    // Extract event
    const event = payload.event || payload.type || payload.status || payload.action || '';
    
    // Paid events detection
    const paidKeywords = ['paid', 'approved', 'completed', 'succeeded', 'finalizada', 'active', 'completed'];
    const isPaidEvent = paidKeywords.some(k => event.toLowerCase().includes(k)) || payload.paid === true;

    // Error events detection
    const errorKeywords = ['failed', 'declined', 'refused', 'error', 'cancelled', 'canceled', 'refunded', 'chargeback'];
    const isErrorEvent = errorKeywords.some(k => event.toLowerCase().includes(k));

    // Extract email from multiple possible structures
    const email = 
      payload.email || payload.customer?.email || payload.buyer?.email || payload.client?.email ||
      payload.data?.customer?.email || payload.data?.email || payload.payer?.email ||
      payload.customer_email || payload.buyer_email ||
      payload.data?.object?.customer_email || // Stripe
      payload.data?.buyer?.email || // Hotmart
      payload.data?.purchase?.buyer?.email; // Hotmart alt

    // Extract phone
    const phone = 
      payload.phone || payload.customer?.phone || payload.buyer?.phone || payload.client?.phone ||
      payload.data?.customer?.phone || payload.data?.phone || payload.customer_phone || payload.buyer_phone || null;

    // Extract amount
    let amount = 
      payload.amount || payload.value || payload.total || payload.price ||
      payload.data?.amount || payload.data?.value ||
      payload.data?.purchase?.price?.value || // Hotmart
      payload.data?.object?.amount_total || // Stripe (cents)
      payload.transaction?.amount || payload.order?.amount || 0;

    if (typeof amount === 'number' && amount > 1000) amount = amount / 100;
    else if (typeof amount === 'string') amount = parseFloat(amount.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

    const transactionId = 
      payload.transaction_id || payload.id || payload.order_id || payload.data?.id ||
      payload.reference || payload.trans_cod || payload.chave_unica || `wh_${Date.now()}`;

    console.log(`Processing: platform=${platform}, email=${email}, amount=${amount}, event=${event}, isPaid=${isPaidEvent}`);

    // Error event
    if (isErrorEvent && email) {
      await sendNotification(supabase, 'payment_error', email, phone, '', amount, platform);
      return new Response(
        JSON.stringify({ success: true, message: `Payment error from ${platform} - notification sent`, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isPaidEvent) {
      return new Response(
        JSON.stringify({ success: true, message: `Event "${event}" from ${platform} received but not a payment confirmation`, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email not found in payload', platform, received_payload: payload }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error finding user', platform }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      await sendNotification(supabase, 'pending_activation', email, phone, '', amount, platform);
      return new Response(
        JSON.stringify({ success: false, error: 'User not registered', email, platform, hint: 'O usuário precisa se cadastrar antes.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phone from profile if not in payload
    let userPhone = phone;
    if (!userPhone) {
      const { data: profile } = await supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle();
      userPhone = profile?.phone || null;
    }

    // Determine plan based on amount - configurable thresholds
    // Check admin_settings for custom price thresholds
    const { data: precosSettings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['preco_mensal', 'preco_anual']);
    
    const precoMensal = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_mensal')?.value || '50');
    const precoAnual = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_anual')?.value || '200');
    
    let plan = 'mensal';
    let planName = 'Mensal';
    let durationMonths = 1;
    
    if (amount >= precoAnual * 0.8) {
      plan = 'anual';
      planName = 'Anual';
      durationMonths = 12;
    } else {
      plan = 'mensal';
      planName = 'Mensal';
      durationMonths = 1;
    }
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    // Update subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan,
        status: 'aprovado',
        is_active: true,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }, { onConflict: 'user_id' });

    if (updateError) {
      await sendNotification(supabase, 'payment_error', email, userPhone, plan, amount, platform);
      return new Response(
        JSON.stringify({ success: false, error: 'Error updating subscription', platform, details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send success + access notifications
    await sendNotification(supabase, 'payment_success', email, userPhone, planName, amount, platform);
    await sendNotification(supabase, 'access_granted', email, userPhone, planName, amount, platform, user.email?.split('@')[0]);

    console.log(`✅ Subscription activated: ${email} via ${platform} - Plan: ${plan}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Assinatura ativada via ${platform}!`,
        platform,
        data: { email, plan, plan_name: planName, amount, duration_months: durationMonths, start_date: startDate.toISOString(), end_date: endDate.toISOString(), transaction_id: transactionId }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
