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
    const { owner_id, member_id, type, start, end } = body;

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
      .select('id, user_id, is_active, role, name, phone')
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

    if (type === 'clients') {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, telefone, address, email, cpf_cnpj, created_at')
        .eq('user_id', owner_id)
        .order('name')
        .limit(500);

      return new Response(JSON.stringify({ clients: clients || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'add_client') {
      const { client_name, client_phone, client_address } = body;
      if (!client_name) {
        return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data, error } = await supabase.from('clients').insert({
        user_id: owner_id,
        name: client_name,
        telefone: client_phone || null,
        address: client_address || null,
      }).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, client: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'financial') {
      const { data: financial } = await supabase
        .from('financial_records')
        .select('id, description, category, type, amount, record_date, payment_method')
        .eq('user_id', owner_id)
        .order('record_date', { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ financial: financial || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'products') {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, cost_price, qty, type')
        .eq('user_id', owner_id)
        .order('name')
        .limit(300);

      return new Response(JSON.stringify({ products: products || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'support_members') {
      // Get all active team members with phone numbers as support contacts
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name, phone, role')
        .eq('user_id', owner_id)
        .eq('is_active', true)
        .not('phone', 'is', null);

      return new Response(JSON.stringify({ members: members || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'suppliers') {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, contact, email, contact_person, cnpj_cpf, address')
        .eq('user_id', owner_id)
        .order('name')
        .limit(200);

      return new Response(JSON.stringify({ suppliers: suppliers || [] }), {
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
