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
  if (payload.secret || payload.event?.includes?.('purchase_approved') || payload.event?.includes?.('purchase_refused') ||
      payload.event?.startsWith?.('payment_') || payload.transaction_id?.startsWith?.('CK_') ||
      payload.transaction_id?.startsWith?.('CAKTO_') ||
      (payload.data?.product && payload.data?.customer && payload.data?.offer)) return 'Cakto';
  if (payload.hottok || payload.event?.startsWith?.('PURCHASE_')) return 'Hotmart';
  if (payload.event?.startsWith?.('order_') || payload.event?.startsWith?.('subscription_')) return 'Kiwify';
  if (payload.type?.startsWith?.('checkout.session') || payload.type?.startsWith?.('payment_intent')) return 'Stripe';
  if (payload.action?.startsWith?.('payment.') || payload.live_mode !== undefined) return 'Mercado Pago';
  if (payload.trans_cod || payload.eduzz_id) return 'Eduzz';
  if (payload.chave_unica || payload.evento?.includes?.('Finalizada')) return 'Monetizze';
  if (payload.event?.startsWith?.('order.') && payload.resource) return 'Yampi';
  if (payload.transaction_id?.startsWith?.('BR_') || payload.producer) return 'Braip';
  if (payload.event?.includes?.('pix_') || payload.event?.includes?.('card_')) return 'GGCheckout';
  if (payload.notificationType || payload.notificationCode) return 'PagSeguro';
  
  return 'Desconhecida';
}

async function logWebhook(supabase: any, data: {
  platform: string; event_type?: string; email?: string; amount?: number;
  plan_detected?: string; product_id?: string; product_name?: string;
  payload?: any; success: boolean; error_message?: string;
}) {
  try {
    await supabase.from('webhook_logs').insert(data);
  } catch (e) {
    console.error('Failed to log webhook:', e);
  }
}

async function detectPlanFromMapping(supabase: any, platform: string, payload: any): Promise<{
  plan: string; planName: string; durationMonths: number; isLifetime: boolean; matched: boolean;
} | null> {
  // Extract product identifiers from payload
  const productId = payload.data?.product?.id || payload.data?.offer?.id || 
    payload.product_id || payload.data?.id || null;
  const productName = payload.data?.product?.name || payload.data?.offer?.name || 
    payload.product_name || payload.data?.purchase?.product?.name || null;

  if (!productId && !productName) return null;

  // Query mapping table
  const query = supabase
    .from('product_plan_mapping')
    .select('*')
    .eq('is_active', true)
    .eq('platform', platform.toLowerCase());

  const { data: mappings } = await query;
  if (!mappings || mappings.length === 0) return null;

  // Try exact product_id match first
  if (productId) {
    const match = mappings.find((m: any) => m.product_id === String(productId));
    if (match) {
      return {
        plan: match.plan_name,
        planName: match.plan_name.charAt(0).toUpperCase() + match.plan_name.slice(1),
        durationMonths: match.duration_months,
        isLifetime: match.is_lifetime,
        matched: true,
      };
    }
  }

  // Try product_name match (case insensitive, partial)
  if (productName) {
    const match = mappings.find((m: any) => 
      m.product_name && productName.toLowerCase().includes(m.product_name.toLowerCase())
    );
    if (match) {
      return {
        plan: match.plan_name,
        planName: match.plan_name.charAt(0).toUpperCase() + match.plan_name.slice(1),
        durationMonths: match.duration_months,
        isLifetime: match.is_lifetime,
        matched: true,
      };
    }
  }

  // Try keyword detection from product name
  if (productName) {
    const name = productName.toLowerCase();
    const keywordMap: Record<string, { plan: string; months: number; lifetime: boolean }> = {
      'vitalicio': { plan: 'vitalicio', months: 0, lifetime: true },
      'vitalício': { plan: 'vitalicio', months: 0, lifetime: true },
      'lifetime': { plan: 'vitalicio', months: 0, lifetime: true },
      'anual': { plan: 'anual', months: 12, lifetime: false },
      'yearly': { plan: 'anual', months: 12, lifetime: false },
      'semestral': { plan: 'semestral', months: 6, lifetime: false },
      'trimestral': { plan: 'trimestral', months: 3, lifetime: false },
      'quarterly': { plan: 'trimestral', months: 3, lifetime: false },
      'mensal': { plan: 'mensal', months: 1, lifetime: false },
      'monthly': { plan: 'mensal', months: 1, lifetime: false },
    };
    for (const [keyword, info] of Object.entries(keywordMap)) {
      if (name.includes(keyword)) {
        return {
          plan: info.plan,
          planName: info.plan.charAt(0).toUpperCase() + info.plan.slice(1),
          durationMonths: info.months,
          isLifetime: info.lifetime,
          matched: true,
        };
      }
    }
  }

  return null;
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

    const event = payload.event || payload.type || payload.data?.status || payload.status || payload.action || '';
    
    const paidKeywords = ['paid', 'approved', 'completed', 'succeeded', 'finalizada', 'active'];
    const isPaidEvent = paidKeywords.some(k => event.toLowerCase().includes(k)) || 
      payload.paid === true || 
      payload.data?.status === 'paid';

    const errorKeywords = ['failed', 'declined', 'refused', 'error', 'cancelled', 'canceled', 'refunded', 'chargeback'];
    const isErrorEvent = errorKeywords.some(k => event.toLowerCase().includes(k));

    const email = 
      payload.email || payload.customer?.email || payload.buyer?.email || payload.client?.email ||
      payload.data?.customer?.email || payload.data?.email || payload.payer?.email ||
      payload.customer_email || payload.buyer_email ||
      payload.data?.object?.customer_email ||
      payload.data?.buyer?.email ||
      payload.data?.purchase?.buyer?.email ||
      payload.data?.subscription?.customer?.email;

    const phone = 
      payload.phone || payload.customer?.phone || payload.buyer?.phone || payload.client?.phone ||
      payload.data?.customer?.phone || payload.data?.phone || payload.customer_phone || payload.buyer_phone ||
      payload.data?.subscription?.customer?.phone || null;

    let amount = 
      payload.amount || payload.value || payload.total || payload.price ||
      payload.data?.amount || payload.data?.value ||
      payload.data?.purchase?.price?.value ||
      payload.data?.object?.amount_total ||
      payload.data?.offer?.price ||
      payload.transaction?.amount || payload.order?.amount || 0;

    if (typeof amount === 'number' && amount > 1000) amount = amount / 100;
    else if (typeof amount === 'string') amount = parseFloat(amount.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

    const transactionId = 
      payload.transaction_id || payload.id || payload.order_id || payload.data?.id ||
      payload.data?.refId ||
      payload.reference || payload.trans_cod || payload.chave_unica || `wh_${Date.now()}`;

    // Extract product info for logging
    const productId = payload.data?.product?.id || payload.data?.offer?.id || payload.product_id || null;
    const productName = payload.data?.product?.name || payload.data?.offer?.name || payload.product_name || null;

    console.log(`Processing: platform=${platform}, email=${email}, amount=${amount}, event=${event}, isPaid=${isPaidEvent}, productId=${productId}, productName=${productName}`);

    // Error event
    if (isErrorEvent && email) {
      await logWebhook(supabase, { platform, event_type: event, email, amount, success: false, error_message: 'Payment error/refused', product_id: productId, product_name: productName, payload });
      await sendNotification(supabase, 'payment_error', email, phone, '', amount, platform);
      return new Response(
        JSON.stringify({ success: true, message: `Payment error from ${platform} - notification sent`, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isPaidEvent) {
      await logWebhook(supabase, { platform, event_type: event, email, amount, success: true, error_message: `Non-payment event: ${event}`, product_id: productId, product_name: productName, payload });
      return new Response(
        JSON.stringify({ success: true, message: `Event "${event}" from ${platform} received but not a payment confirmation`, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email) {
      await logWebhook(supabase, { platform, event_type: event, amount, success: false, error_message: 'Email not found in payload', product_id: productId, product_name: productName, payload });
      return new Response(
        JSON.stringify({ success: false, error: 'Email not found in payload', platform, received_payload: payload }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════ PLAN DETECTION ═══════════
    // Step 1: Try product_plan_mapping table first (explicit mapping)
    let plan = 'mensal';
    let planName = 'Mensal';
    let durationMonths = 1;
    let isLifetime = false;
    let detectionMethod = 'price_heuristic';

    const mappingResult = await detectPlanFromMapping(supabase, platform, payload);
    
    if (mappingResult && mappingResult.matched) {
      plan = mappingResult.plan;
      planName = mappingResult.planName;
      durationMonths = mappingResult.durationMonths;
      isLifetime = mappingResult.isLifetime;
      detectionMethod = 'product_mapping';
      console.log(`✅ Plan detected via mapping: ${plan} (product: ${productId || productName})`);
    } else {
      // Step 2: Fallback to price-based heuristics
      const { data: precosSettings } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['preco_mensal', 'preco_trimestral', 'preco_semestral', 'preco_anual', 'preco_vitalicio']);
      
      const precoMensal = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_mensal')?.value || '50');
      const precoTrimestral = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_trimestral')?.value || '120');
      const precoSemestral = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_semestral')?.value || '200');
      const precoAnual = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_anual')?.value || '300');
      const precoVitalicio = parseFloat(precosSettings?.find((s: any) => s.key === 'preco_vitalicio')?.value || '997');
      
      const matchPlan = (value: number, target: number) => Math.abs(value - target) / target <= 0.2;
      
      if (matchPlan(amount, precoVitalicio) || amount >= precoVitalicio * 0.8) {
        plan = 'vitalicio'; planName = 'Vitalício'; durationMonths = 0; isLifetime = true;
      } else if (matchPlan(amount, precoAnual) || amount >= precoAnual * 0.8) {
        plan = 'anual'; planName = 'Anual'; durationMonths = 12;
      } else if (matchPlan(amount, precoSemestral) || amount >= precoSemestral * 0.8) {
        plan = 'semestral'; planName = 'Semestral'; durationMonths = 6;
      } else if (matchPlan(amount, precoTrimestral) || amount >= precoTrimestral * 0.8) {
        plan = 'trimestral'; planName = 'Trimestral'; durationMonths = 3;
      } else {
        plan = 'mensal'; planName = 'Mensal'; durationMonths = 1;
      }
      console.log(`📊 Plan detected via price heuristic: ${plan} (amount: ${amount})`);
    }

    // Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
      await logWebhook(supabase, { platform, event_type: event, email, amount, plan_detected: plan, success: false, error_message: 'Error finding user', product_id: productId, product_name: productName, payload });
      return new Response(
        JSON.stringify({ success: false, error: 'Error finding user', platform }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      await logWebhook(supabase, { platform, event_type: event, email, amount, plan_detected: plan, success: true, error_message: 'User not registered - pending activation', product_id: productId, product_name: productName, payload });
      await sendNotification(supabase, 'pending_activation', email, phone, planName, amount, platform);
      return new Response(
        JSON.stringify({ success: true, message: 'Payment recorded. User not registered yet - will auto-activate on signup.', email, platform, plan: planName, detection_method: detectionMethod, hint: 'Quando o usuário criar a conta com este email, o acesso será liberado automaticamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phone from profile if not in payload
    let userPhone = phone;
    if (!userPhone) {
      const { data: profile } = await supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle();
      userPhone = profile?.phone || null;
    }
    
    const startDate = new Date();
    const endDate = isLifetime ? null : new Date();
    if (endDate) endDate.setMonth(endDate.getMonth() + durationMonths);

    // Update subscription
    const subscriptionData: any = {
      user_id: user.id,
      plan,
      status: 'aprovado',
      is_active: true,
      start_date: startDate.toISOString(),
      end_date: endDate ? endDate.toISOString() : null,
      payment_date: startDate.toISOString(),
    };

    const { error: updateError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id' });

    if (updateError) {
      await logWebhook(supabase, { platform, event_type: event, email, amount, plan_detected: plan, success: false, error_message: `Subscription update error: ${updateError.message}`, product_id: productId, product_name: productName, payload });
      await sendNotification(supabase, 'payment_error', email, userPhone, plan, amount, platform);
      return new Response(
        JSON.stringify({ success: false, error: 'Error updating subscription', platform, details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log success
    await logWebhook(supabase, { platform, event_type: event, email, amount, plan_detected: plan, success: true, product_id: productId, product_name: productName, payload });

    // Send success + access notifications
    await sendNotification(supabase, 'payment_success', email, userPhone, planName, amount, platform);
    await sendNotification(supabase, 'access_granted', email, userPhone, planName, amount, platform, user.email?.split('@')[0]);

    console.log(`✅ Subscription activated: ${email} via ${platform} - Plan: ${plan} (detected via: ${detectionMethod})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Assinatura ${planName} ativada via ${platform}!`,
        platform,
        detection_method: detectionMethod,
        data: { email, plan, plan_name: planName, amount, duration_months: durationMonths, is_lifetime: isLifetime, start_date: startDate.toISOString(), end_date: endDate?.toISOString() || null, transaction_id: transactionId }
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
