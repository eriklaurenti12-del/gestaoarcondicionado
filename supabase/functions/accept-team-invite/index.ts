import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invite_code, user_id, user_email } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if invite exists and is pending
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('invite_code', invite_code)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Convite inválido ou já utilizado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark invite as accepted
    await supabase.from('team_invites').update({
      accepted_by: user_id,
      accepted_email: user_email,
      status: 'accepted',
      accepted_at: new Date().toISOString()
    }).eq('id', invite.id);

    // Give user super_admin role (so they can access Members page)
    await supabase.from('user_roles').upsert({
      user_id,
      role: 'super_admin'
    }, { onConflict: 'user_id,role' });

    // Activate subscription
    await supabase.from('subscriptions').update({
      plan: 'vitalicio',
      status: 'aprovado',
      is_active: true,
      start_date: new Date().toISOString()
    }).eq('user_id', user_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
