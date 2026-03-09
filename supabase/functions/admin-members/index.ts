// Deno Edge Function: admin-members
// Returns list of users with emails merged with profiles and subscriptions
// Only accessible by super_admin users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[admin-members] Incoming request');

    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate JWT using anon key client
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      console.warn('[admin-members] Unauthorized access attempt', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Service client without user context for admin operations
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin role
    const { data: roles, error: rolesError } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[admin-members] rolesError', rolesError.message);
      return new Response(JSON.stringify({ error: rolesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isSuperAdmin = roles?.some((r: any) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      console.warn('[admin-members] Forbidden - user is not super_admin');
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // List all users (paginate just in case)
    const allUsers: any[] = [];
    let page = 1; const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseService.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('[admin-members] listUsers error', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
      page += 1;
    }

    // Load subscriptions, profiles, and company data
    const [{ data: subs, error: subsError }, { data: profiles, error: profilesError }, { data: companyData }] = await Promise.all([
      supabaseService.from('subscriptions').select('*'),
      supabaseService.from('profiles').select('user_id, created_at, phone'),
      supabaseService.from('company_data').select('user_id, whatsapp, company_name')
    ]);

    if (subsError) {
      console.error('[admin-members] subsError', subsError.message);
      return new Response(JSON.stringify({ error: subsError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (profilesError) {
      console.error('[admin-members] profilesError', profilesError.message);
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const members = allUsers.map((u: any) => {
      const profile = profiles?.find((p: any) => p.user_id === u.id);
      const subscription = subs?.find((s: any) => s.user_id === u.id) || null;
      const company = companyData?.find((c: any) => c.user_id === u.id);
      return {
        id: u.id,
        email: u.email,
        phone: profile?.phone || null,
        company_whatsapp: company?.whatsapp || null,
        company_name: company?.company_name || null,
        created_at: (profile?.created_at ?? u.created_at),
        subscription,
      };
    });

    console.log('[admin-members] Returning', members.length, 'members');

    return new Response(JSON.stringify(members), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[admin-members] Unhandled error', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
