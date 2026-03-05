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
    const { owner_id, member_id, type, start, end } = await req.json();

    if (!owner_id || !member_id) {
      return new Response(JSON.stringify({ error: 'IDs obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the member exists and is active
    const { data: member } = await supabase
      .from('team_members')
      .select('id, user_id, is_active')
      .eq('id', member_id)
      .eq('user_id', owner_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'appointments') {
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, appointment_date, status, notes, clients(name, telefone, address)')
        .eq('user_id', owner_id)
        .gte('appointment_date', start)
        .lt('appointment_date', end)
        .order('appointment_date', { ascending: true });

      const formatted = (appointments || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        notes: a.notes,
        client_name: a.clients?.name || 'Cliente',
        phone: a.clients?.telefone || '',
        address: a.clients?.address || '',
        time: new Date(a.appointment_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }));

      return new Response(JSON.stringify({ appointments: formatted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'bookings') {
      const { data: bookings } = await supabase
        .from('online_bookings')
        .select('*')
        .eq('user_id', owner_id)
        .eq('status', 'pendente')
        .order('preferred_date', { ascending: true });

      return new Response(JSON.stringify({ bookings: bookings || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Tipo inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[team-portal-data] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
