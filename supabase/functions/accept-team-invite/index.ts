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
    const { invite_code, user_id, user_email, selected_role } = await req.json();

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

    // Determine the role based on selected_role from invite
    const teamRole = selected_role || invite.team_role || 'sistema';

    // Mark invite as accepted
    await supabase.from('team_invites').update({
      accepted_by: user_id,
      accepted_email: user_email,
      status: 'accepted',
      team_role: teamRole,
      accepted_at: new Date().toISOString()
    }).eq('id', invite.id);

    // Give role based on team_role
    if (teamRole === 'painel') {
      // Access to admin panel only
      await supabase.from('user_roles').upsert({
        user_id,
        role: 'super_admin'
      }, { onConflict: 'user_id,role' });
    } else if (teamRole === 'suporte') {
      // Support access only - admin role
      await supabase.from('user_roles').upsert({
        user_id,
        role: 'admin'
      }, { onConflict: 'user_id,role' });
    } else {
      // Full system access - super_admin
      await supabase.from('user_roles').upsert({
        user_id,
        role: 'super_admin'
      }, { onConflict: 'user_id,role' });
    }

    // Activate subscription (lifetime for team members)
    await supabase.from('subscriptions').update({
      plan: 'vitalicio',
      status: 'aprovado',
      is_active: true,
      start_date: new Date().toISOString()
    }).eq('user_id', user_id);

    return new Response(JSON.stringify({ success: true, team_role: teamRole }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
