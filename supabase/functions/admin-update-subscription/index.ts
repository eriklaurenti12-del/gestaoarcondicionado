// Deno Edge Function: admin-update-subscription
// Allows super_admin to update any user's subscription

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

    console.log('[admin-update-subscription] Incoming request');

    // Client that validates the incoming JWT
    const supabaseAuthed = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
    if (authError || !user) {
      console.warn('[admin-update-subscription] Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Service client for admin operations
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin role
    const { data: roles, error: rolesError } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[admin-update-subscription] rolesError', rolesError.message);
      return new Response(JSON.stringify({ error: rolesError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const isSuperAdmin = roles?.some((r: any) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      console.warn('[admin-update-subscription] Forbidden - user is not super_admin');
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get request body
    const body = await req.json();
    const { target_user_id, plan, status, is_active, start_date, end_date, payment_date } = body;

    if (!target_user_id || !plan || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[admin-update-subscription] Updating subscription for user:', target_user_id);
    console.log('[admin-update-subscription] New values:', { plan, status, is_active, start_date, end_date });

    // First check if subscription exists
    const { data: existingSub, error: checkError } = await supabaseService
      .from('subscriptions')
      .select('id')
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (checkError) {
      console.error('[admin-update-subscription] Check error:', checkError.message);
      return new Response(JSON.stringify({ error: checkError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let updateError;

    if (existingSub) {
      // Update existing subscription
      const { error } = await supabaseService
        .from('subscriptions')
        .update({
          plan,
          status,
          is_active,
          start_date,
          end_date,
          payment_date,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', target_user_id);
      updateError = error;
    } else {
      // Insert new subscription
      const { error } = await supabaseService
        .from('subscriptions')
        .insert({
          user_id: target_user_id,
          plan,
          status,
          is_active,
          start_date,
          end_date,
          payment_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      updateError = error;
    }

    if (updateError) {
      console.error('[admin-update-subscription] Update/Insert error:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[admin-update-subscription] Subscription updated successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[admin-update-subscription] Unhandled error', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
