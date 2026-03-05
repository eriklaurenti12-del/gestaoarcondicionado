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
    const { member_name, pin } = await req.json();

    if (!member_name || !pin || pin.length !== 4) {
      return new Response(JSON.stringify({ error: 'Nome e PIN são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find accepted team invite matching the name
    const { data: invites } = await supabase
      .from('team_invites')
      .select('accepted_email, accepted_by, team_role')
      .eq('status', 'accepted');

    if (!invites || invites.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Match by name (case-insensitive)
    const match = invites.find((i: any) =>
      i.accepted_email?.toLowerCase() === member_name.trim().toLowerCase()
    );

    if (!match || !match.accepted_by) {
      // Try matching by phone in profiles
      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('user_id, username')
        .or(`phone.ilike.%${member_name.replace(/\D/g, '').slice(-8)}%,username.ilike.${member_name.trim()}`)
        .maybeSingle();

      if (!profileMatch) {
        return new Response(JSON.stringify({ error: 'Membro não encontrado. Verifique o nome ou telefone.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify this user is actually a team member
      const teamInvite = invites.find((i: any) => i.accepted_by === profileMatch.user_id);
      if (!teamInvite) {
        return new Response(JSON.stringify({ error: 'Usuário não é membro da equipe' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find auth user email
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profileMatch.user_id);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar usuário' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const teamPassword = `team${pin}00`;
      return new Response(JSON.stringify({ email: user.email, password: teamPassword }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Found by name in team_invites - get auth user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(match.accepted_by);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar credenciais' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const teamPassword = `team${pin}00`;

    return new Response(JSON.stringify({ email: user.email, password: teamPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[team-portal-login] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
