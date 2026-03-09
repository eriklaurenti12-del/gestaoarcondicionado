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

    // === HEARTBEAT / ONLINE STATUS ===
    if (type === 'heartbeat') {
      await supabase.from('team_online_status').upsert({
        member_id: member_id,
        owner_id: owner_id,
        member_name: member.name,
        member_role: member.role,
        member_phone: member.phone,
        last_seen_at: new Date().toISOString(),
        is_online: true,
      }, { onConflict: 'member_id' });

      // Mark members offline if last_seen > 2 min ago
      await supabase.from('team_online_status')
        .update({ is_online: false })
        .eq('owner_id', owner_id)
        .lt('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

      // Get online members
      const { data: online } = await supabase
        .from('team_online_status')
        .select('*')
        .eq('owner_id', owner_id)
        .eq('is_online', true);

      // Get pending support requests
      const { data: requests } = await supabase
        .from('support_requests')
        .select('*')
        .eq('owner_id', owner_id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(20);

      // Get new pending subscriptions (last 48h)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: newSubs } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan, status, is_active, created_at')
        .eq('status', 'pendente')
        .gte('created_at', twoDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      // Enrich with profile data
      let newSubscriptions: any[] = [];
      if (newSubs && newSubs.length > 0) {
        const userIds = newSubs.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);

        // Get emails from auth
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 100 });
        
        newSubscriptions = newSubs.map(sub => {
          const profile = profiles?.find(p => p.user_id === sub.user_id);
          const authUser = authUsers?.find((u: any) => u.id === sub.user_id);
          return {
            ...sub,
            username: profile?.username || '',
            email: authUser?.email || '',
          };
        });
      }

      return new Response(JSON.stringify({ online: online || [], requests: requests || [], new_subscriptions: newSubscriptions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === LOGOUT / GO OFFLINE ===
    if (type === 'go_offline') {
      await supabase.from('team_online_status')
        .update({ is_online: false })
        .eq('member_id', member_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === RESOLVE SUPPORT REQUEST ===
    if (type === 'resolve_request') {
      const { request_id } = body;
      await supabase.from('support_requests')
        .update({ status: 'resolvido', assigned_member_id: member_id, resolved_at: new Date().toISOString() })
        .eq('id', request_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === GET ONLINE SUPPORT MEMBERS (public - for clients) ===
    if (type === 'online_support') {
      // Mark stale members offline
      await supabase.from('team_online_status')
        .update({ is_online: false })
        .eq('owner_id', owner_id)
        .lt('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

      const { data: online } = await supabase
        .from('team_online_status')
        .select('member_name, member_role, member_phone, is_online, last_seen_at')
        .eq('owner_id', owner_id)
        .eq('is_online', true);

      return new Response(JSON.stringify({ online: online || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === CREATE SUPPORT REQUEST (from client/user) ===
    if (type === 'create_support_request') {
      const { requester_name, requester_phone, requester_email, request_type, message } = body;
      if (!requester_name) {
        return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.from('support_requests').insert({
        owner_id,
        requester_name,
        requester_phone: requester_phone || null,
        requester_email: requester_email || null,
        request_type: request_type || 'ajuda',
        message: message || null,
      }).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, request: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === APPOINTMENTS ===
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
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name, phone, role')
        .eq('user_id', owner_id)
        .eq('is_active', true)
        .not('phone', 'is', null);

      // Get online status for each member
      const memberIds = (members || []).map((m: any) => m.id);
      const { data: onlineData } = await supabase
        .from('team_online_status')
        .select('member_id, is_online, last_seen_at')
        .in('member_id', memberIds.length > 0 ? memberIds : ['none']);

      const onlineMap = new Map((onlineData || []).map((o: any) => [o.member_id, o]));

      const enriched = (members || []).map((m: any) => ({
        ...m,
        is_online: onlineMap.get(m.id)?.is_online || false,
        last_seen_at: onlineMap.get(m.id)?.last_seen_at || null,
      }));

      return new Response(JSON.stringify({ members: enriched }), {
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

    // === SUBSCRIBERS: list all users with subscriptions ===
    if (type === 'subscribers') {
      // All portal members have access

      const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
      const { data: subs } = await supabase.from('subscriptions').select('*');
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, phone, created_at');

      const subscribers = (users?.users || []).map((u: any) => {
        const sub = (subs || []).find((s: any) => s.user_id === u.id);
        const profile = (profiles || []).find((p: any) => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          username: profile?.username || u.email?.split('@')[0],
          phone: profile?.phone || null,
          created_at: profile?.created_at || u.created_at,
          plan: sub?.plan || 'mensal',
          status: sub?.status || 'pendente',
          is_active: sub?.is_active || false,
          start_date: sub?.start_date || null,
          end_date: sub?.end_date || null,
        };
      });

      return new Response(JSON.stringify({ subscribers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === ACTIVATE / DEACTIVATE SUBSCRIBER ===
    if (type === 'activate_subscriber') {
      // All portal members have access

      const { target_user_id, plan, activate } = body;
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: 'ID do usuário obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startDate = new Date();
      let endDate: Date | null = null;
      const selectedPlan = plan || 'mensal';

      if (activate && selectedPlan !== 'vitalicio') {
        endDate = new Date();
        if (selectedPlan === 'anual') endDate.setFullYear(endDate.getFullYear() + 1);
        else if (selectedPlan === 'trimestral') endDate.setMonth(endDate.getMonth() + 3);
        else if (selectedPlan === '7dias') endDate.setDate(endDate.getDate() + 7);
        else if (selectedPlan === '1dia') endDate.setDate(endDate.getDate() + 1);
        else endDate.setMonth(endDate.getMonth() + 1);
      }

      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', target_user_id)
        .maybeSingle();

      const updateData = {
        plan: selectedPlan,
        status: activate ? 'aprovado' : 'cancelado',
        is_active: !!activate,
        start_date: activate ? startDate.toISOString() : null,
        end_date: endDate?.toISOString() || null,
        payment_date: activate ? startDate.toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existingSub) {
        await supabase.from('subscriptions').update(updateData).eq('user_id', target_user_id);
      } else {
        await supabase.from('subscriptions').insert({ user_id: target_user_id, ...updateData });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === CREATE APPOINTMENT ===
    if (type === 'create_appointment') {
      const { client_id, appointment_date, notes: aptNotes, service_id } = body;
      if (!client_id || !appointment_date) {
        return new Response(JSON.stringify({ error: 'Cliente e data obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.from('appointments').insert({
        user_id: owner_id,
        client_id: Number(client_id),
        service_id: service_id ? Number(service_id) : null,
        appointment_date,
        notes: aptNotes || `Agendado via portal por ${member.name}`,
        status: 'agendado',
      }).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, appointment: data }), {
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
