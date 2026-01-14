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

    // Parse the webhook payload from GGCheckout
    const payload = await req.json();
    
    console.log('GGCheckout webhook received:', JSON.stringify(payload, null, 2));

    // GGCheckout sends payment data - extract email and amount
    // Adapte esses campos conforme a estrutura real do webhook da GGCheckout
    const email = payload.email || payload.customer?.email || payload.buyer?.email;
    const amount = parseFloat(payload.amount || payload.value || payload.total || '0');
    const status = payload.status || payload.payment_status || 'approved';
    const transactionId = payload.transaction_id || payload.id || payload.order_id;

    console.log(`Processing payment: email=${email}, amount=${amount}, status=${status}`);

    // Só processa se o pagamento foi aprovado
    if (status !== 'approved' && status !== 'paid' && status !== 'completed') {
      console.log('Payment not approved, skipping activation');
      return new Response(
        JSON.stringify({ success: true, message: 'Payment not approved, no action taken' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email) {
      console.error('No email found in payload');
      return new Response(
        JSON.stringify({ success: false, error: 'Email not found in payload' }),
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
        JSON.stringify({ success: false, error: 'User not registered', email }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar plano baseado no valor
    // R$ 39,90 = mensal (1 mês)
    // Outro valor (ex: R$ 370,00) = anual (12 meses)
    const isMonthly = amount <= 50; // Considera até 50 como mensal
    const plan = isMonthly ? 'mensal' : 'anual';
    const durationMonths = isMonthly ? 1 : 12;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    console.log(`Activating subscription for user ${user.id}: plan=${plan}, duration=${durationMonths} months`);

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
        JSON.stringify({ success: false, error: 'Error updating subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Subscription activated successfully for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription activated successfully',
        data: {
          email,
          plan,
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
