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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client for creating users
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check authorization
    const authHeader = req.headers.get('Authorization');
    const apikeyHeader = req.headers.get('apikey');

    // Allow service role key (internal calls from curl/admin tools)
    const isServiceRole = apikeyHeader === serviceRoleKey || 
      (authHeader && authHeader.replace('Bearer ', '') === serviceRoleKey);

    if (!isServiceRole) {
      // Validate user token
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Use anon key client with user's auth header for getClaims
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        console.error('[create-fake-user] Auth error:', claimsError?.message);
        return new Response(JSON.stringify({ error: 'Token inválido' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const userId = claimsData.user.id;

      // Check super_admin role using admin client (bypasses RLS)
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Apenas super admin pode criar usuários fake' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[create-fake-user] Authorized: ${claimsData.user.email} (super_admin)`);
    } else {
      console.log('[create-fake-user] Authorized via service role key');
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user via admin API (does NOT affect caller session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: email.split('@')[0] }
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[create-fake-user] Created: ${email} (${newUser.user.id})`);

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.user.id,
      email: newUser.user.email,
      message: `Usuário ${email} criado com sucesso`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[create-fake-user] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
