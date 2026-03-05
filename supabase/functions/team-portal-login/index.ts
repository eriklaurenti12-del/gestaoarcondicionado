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
    const { member_name, pin } = await req.json();

    if (!member_name || !pin || pin.length !== 4) {
      return new Response(JSON.stringify({ error: 'Nome e PIN de 4 dígitos são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[team-portal-login] Looking for member:', member_name);

    // Find accepted team invite matching the name or phone
    const { data: invites } = await supabase
      .from('team_invites')
      .select('accepted_email, accepted_by, team_role')
      .eq('status', 'accepted');

    if (!invites || invites.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Try to match by name (case-insensitive)
    let userId: string | null = null;

    const nameMatch = invites.find((i: any) =>
      i.accepted_email?.toLowerCase().trim() === member_name.trim().toLowerCase()
    );

    if (nameMatch?.accepted_by) {
      userId = nameMatch.accepted_by;
    } else {
      // Try matching by phone in profiles
      const cleanInput = member_name.replace(/\D/g, '');
      if (cleanInput.length >= 8) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, phone');

        if (profiles) {
          for (const profile of profiles) {
            const cleanPhone = profile.phone?.replace(/\D/g, '') || '';
            if (cleanPhone.endsWith(cleanInput.slice(-8))) {
              // Verify this user is a team member
              const isTeam = invites.find((i: any) => i.accepted_by === profile.user_id);
              if (isTeam) {
                userId = profile.user_id;
                break;
              }
            }
          }
        }
      }

      // Also try matching username in profiles
      if (!userId) {
        const { data: profileByName } = await supabase
          .from('profiles')
          .select('user_id')
          .ilike('username', member_name.trim())
          .maybeSingle();

        if (profileByName) {
          const isTeam = invites.find((i: any) => i.accepted_by === profileByName.user_id);
          if (isTeam) {
            userId = profileByName.user_id;
          }
        }
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Membro não encontrado. Verifique o nome ou telefone.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the auth user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user?.email) {
      console.error('[team-portal-login] getUserById error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Erro ao buscar credenciais' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const teamPassword = `team${pin}00`;

    console.log('[team-portal-login] Found user:', user.email);

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
