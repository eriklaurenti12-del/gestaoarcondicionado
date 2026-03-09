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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get('Authorization') || '';

    // Check if caller is authorized (super_admin, admin, or service role)
    let callerEmail = 'service_role';

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado - token necessário' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Check if token is the service role key itself
    if (token === serviceRoleKey) {
      console.log('[create-fake-user] Authorized via service role key');
    } else {
      // Validate user JWT
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        console.error('[create-fake-user] Auth failed:', authError?.message);
        return new Response(JSON.stringify({ error: 'Token inválido' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      callerEmail = user.email || 'unknown';

      // Check role using service client (bypasses RLS)
      const { data: roles } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const userRoles = roles?.map((r: any) => r.role) || [];
      const hasPermission = userRoles.includes('super_admin') || userRoles.includes('admin');

      if (!hasPermission) {
        console.warn(`[create-fake-user] Denied for ${callerEmail}, roles: ${userRoles.join(',')}`);
        return new Response(JSON.stringify({ error: 'Sem permissão. Necessário role admin ou super_admin.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[create-fake-user] Authorized: ${callerEmail} (roles: ${userRoles.join(',')})`);
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
      // If user already exists, that's OK for testing
      if (createError.message?.includes('already been registered')) {
        console.log(`[create-fake-user] User ${email} already exists, continuing...`);
        return new Response(JSON.stringify({
          success: true,
          email,
          already_exists: true,
          message: `Usuário ${email} já existe no sistema`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[create-fake-user] Created: ${email} (${newUser.user.id}) by ${callerEmail}`);

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
