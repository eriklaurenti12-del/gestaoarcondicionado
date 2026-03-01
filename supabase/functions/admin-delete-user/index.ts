// Deno Edge Function: admin-delete-user
// Permanently deletes a user and ALL their data
// Only accessible by super_admin users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    const supabaseAuthed = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin role
    const { data: roles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some((r: any) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { target_user_id, delete_data } = body;

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'Missing target_user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent deleting super admin
    const { data: targetRoles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', target_user_id);
    
    if (targetRoles?.some((r: any) => r.role === 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Cannot delete super admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[admin-delete-user] Deleting user:', target_user_id, 'delete_data:', delete_data);

    if (delete_data) {
      // Delete all user data from all tables
      const tables = [
        'appointments', 'sales', 'financial_records', 'fixed_expenses',
        'installments', 'products', 'clients', 'suppliers', 'quotes',
        'service_orders', 'tax_records', 'company_data', 'scheduled_maintenance',
        'maintenance_contracts', 'client_equipment', 'online_bookings'
      ];

      for (const table of tables) {
        const { error } = await supabaseService.from(table).delete().eq('user_id', target_user_id);
        if (error) console.warn(`[admin-delete-user] Error deleting from ${table}:`, error.message);
      }
    }

    // Delete subscription, profile, roles
    await supabaseService.from('subscriptions').delete().eq('user_id', target_user_id);
    await supabaseService.from('profiles').delete().eq('user_id', target_user_id);
    await supabaseService.from('user_roles').delete().eq('user_id', target_user_id);

    // Delete auth user
    const { error: deleteError } = await supabaseService.auth.admin.deleteUser(target_user_id);
    if (deleteError) {
      console.error('[admin-delete-user] Error deleting auth user:', deleteError.message);
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[admin-delete-user] User deleted successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[admin-delete-user] Unhandled error', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
