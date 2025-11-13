// Deno Edge Function: admin-members
// Returns list of users with emails merged with profiles and subscriptions
// Only accessible by super_admin users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    // Client that validates the incoming JWT (forwarding Authorization)
    const supabaseAuthed = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Service client without user context for admin operations
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin role
    const { data: roles, error: rolesError } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      return new Response(JSON.stringify({ error: rolesError.message }), { status: 500 });
    }

    const isSuperAdmin = roles?.some((r: any) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      return new Response('Forbidden', { status: 403 });
    }

    // List all users (paginate just in case)
    const allUsers: any[] = [];
    let page = 1; const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseService.auth.admin.listUsers({ page, perPage });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
      page += 1;
    }

    // Load subscriptions and profiles
    const [{ data: subs }, { data: profiles }] = await Promise.all([
      supabaseService.from('subscriptions').select('*'),
      supabaseService.from('profiles').select('user_id, created_at')
    ]);

    const members = allUsers.map((u: any) => {
      const profile = profiles?.find((p: any) => p.user_id === u.id);
      const subscription = subs?.find((s: any) => s.user_id === u.id) || null;
      return {
        id: u.id,
        email: u.email,
        created_at: (profile?.created_at ?? u.created_at),
        subscription,
      };
    });

    return new Response(JSON.stringify(members), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
