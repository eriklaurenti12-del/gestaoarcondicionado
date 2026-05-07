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
    const body = await req.json();
    const { action, invite_code, user_email, member_name, selected_role } = body;

    console.log('[accept-team-invite] Request action:', action || 'accept', 'invite:', invite_code);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate invite publicly (used on /auth?team=... before signup) — no auth required
    if (action === 'validate') {
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .select('invite_code, team_role, status')
        .eq('invite_code', invite_code)
        .eq('status', 'pending')
        .maybeSingle();

      if (inviteError || !invite) {
        return new Response(JSON.stringify({ valid: false, error: 'Convite inválido ou expirado' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ valid: true, team_role: invite.team_role }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For acceptance: require a verified JWT and derive user_id from it (never trust body)
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authedUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authedUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user_id = authedUser.id;

    // Check if invite exists and is pending for acceptance
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

    // Always enforce the role from the invite (prevents privilege escalation)
    const teamRole = invite.team_role || selected_role || 'sistema';
    console.log('[accept-team-invite] Team role:', teamRole);

    // Mark invite as accepted
    const { error: updateError } = await supabase.from('team_invites').update({
      accepted_by: user_id,
      accepted_email: member_name || user_email || authedUser.email,
      status: 'accepted',
      team_role: teamRole,
      accepted_at: new Date().toISOString()
    }).eq('id', invite.id);

    if (updateError) {
      console.error('[accept-team-invite] Update error:', updateError.message);
    }

    // Update profile with the member name
    if (member_name) {
      await supabase.from('profiles').update({
        username: member_name
      }).eq('user_id', user_id);
    }

    // All team invite roles get 'admin' (NOT super_admin). super_admin is reserved for platform owners.
    await supabase.from('user_roles').upsert({
      user_id,
      role: 'admin'
    }, { onConflict: 'user_id,role' });

    // Activate subscription (lifetime for team members)
    const { error: subError } = await supabase.from('subscriptions').upsert({
      user_id,
      plan: 'vitalicio',
      status: 'aprovado',
      is_active: true,
      start_date: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (subError) {
      console.error('[accept-team-invite] Subscription error:', subError.message);
      await supabase.from('subscriptions').insert({
        user_id,
        plan: 'vitalicio',
        status: 'aprovado',
        is_active: true,
        start_date: new Date().toISOString()
      });
    }

    console.log('[accept-team-invite] Success for:', member_name || user_email);

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
