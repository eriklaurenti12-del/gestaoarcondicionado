import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invite_code, user_id, user_email, selected_role } = await req.json();

    console.log('[accept-team-invite] Processing invite:', invite_code, 'for user:', user_email, 'role:', selected_role);

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
      console.error('[accept-team-invite] Invalid invite:', inviteError?.message);
      return new Response(JSON.stringify({ error: 'Convite inválido ou já utilizado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use selected_role from the user, or fallback to invite's team_role
    const teamRole = selected_role || invite.team_role || 'sistema';
    console.log('[accept-team-invite] Team role:', teamRole);

    // Mark invite as accepted
    const { error: updateError } = await supabase.from('team_invites').update({
      accepted_by: user_id,
      accepted_email: user_email,
      status: 'accepted',
      team_role: teamRole,
      accepted_at: new Date().toISOString()
    }).eq('id', invite.id);

    if (updateError) {
      console.error('[accept-team-invite] Update error:', updateError.message);
    }

    // Give role based on team_role
    if (teamRole === 'suporte') {
      // Support - admin role only
      await supabase.from('user_roles').upsert({
        user_id,
        role: 'admin'
      }, { onConflict: 'user_id,role' });
    } else {
      // painel or sistema - super_admin role
      await supabase.from('user_roles').upsert({
        user_id,
        role: 'super_admin'
      }, { onConflict: 'user_id,role' });
    }

    // Activate subscription (lifetime for team members) - upsert to handle new users
    const { error: subError } = await supabase.from('subscriptions').upsert({
      user_id,
      plan: 'vitalicio',
      status: 'aprovado',
      is_active: true,
      start_date: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (subError) {
      console.error('[accept-team-invite] Subscription error:', subError.message);
      // Try insert if upsert fails
      await supabase.from('subscriptions').insert({
        user_id,
        plan: 'vitalicio',
        status: 'aprovado',
        is_active: true,
        start_date: new Date().toISOString()
      });
    }

    console.log('[accept-team-invite] Success for:', user_email);

    return new Response(JSON.stringify({ success: true, team_role: teamRole }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[accept-team-invite] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
