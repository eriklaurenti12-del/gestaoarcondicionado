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

    console.log('[team-portal-login] Looking for:', member_name);

    // Search in team_members table by name or phone
    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true);

    if (error || !members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Match by name (case-insensitive) or by phone (last 8 digits)
    const cleanInput = member_name.replace(/\D/g, '');
    const match = members.find((m: any) => {
      // Match by name
      if (m.name.toLowerCase().trim() === member_name.toLowerCase().trim()) return true;
      // Match by phone
      if (cleanInput.length >= 8 && m.phone) {
        const cleanPhone = m.phone.replace(/\D/g, '');
        if (cleanPhone.endsWith(cleanInput.slice(-8))) return true;
      }
      return false;
    });

    if (!match) {
      return new Response(JSON.stringify({ error: 'Membro não encontrado. Verifique seu nome ou telefone.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify PIN
    if (match.pin !== pin) {
      return new Response(JSON.stringify({ error: 'PIN incorreto.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[team-portal-login] Authenticated:', match.name);

    return new Response(JSON.stringify({
      member_id: match.id,
      member_name: match.name,
      role: match.role,
      owner_id: match.user_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[team-portal-login] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
