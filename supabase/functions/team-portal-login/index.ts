import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = 'Credenciais inválidas';
const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8h

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signSessionToken(payload: Record<string, unknown>): Promise<string> {
  const secret = Deno.env.get('TEAM_PORTAL_JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  return `${data}.${b64url(sig)}`;
}

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

    // Look up active members
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name, phone, role, user_id, is_active, permissions')
      .eq('is_active', true);

    const cleanInput = member_name.replace(/\D/g, '');
    const match = (members || []).find((m: any) => {
      if (m.name?.toLowerCase().trim() === member_name.toLowerCase().trim()) return true;
      if (cleanInput.length >= 8 && m.phone) {
        const cleanPhone = m.phone.replace(/\D/g, '');
        if (cleanPhone.endsWith(cleanInput.slice(-8))) return true;
      }
      return false;
    });

    if (!match) {
      // Generic error to prevent username enumeration
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check lockout
    const { data: attempts } = await supabase
      .from('team_login_attempts')
      .select('fail_count, locked_until')
      .eq('member_id', match.id)
      .maybeSingle();

    if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) {
      return new Response(JSON.stringify({ error: 'Conta temporariamente bloqueada. Tente novamente em alguns minutos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify PIN via SECURITY DEFINER function (compares against bcrypt hash)
    const { data: verifyResult } = await supabase.rpc('verify_team_pin', {
      _member_id: match.id,
      _pin: pin,
    });

    if (verifyResult !== true) {
      const newCount = (attempts?.fail_count || 0) + 1;
      const lockUntil = newCount >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;

      await supabase.from('team_login_attempts').upsert({
        member_id: match.id,
        fail_count: newCount,
        locked_until: lockUntil,
        last_attempt_at: new Date().toISOString(),
      }, { onConflict: 'member_id' });

      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Success: reset attempts
    await supabase.from('team_login_attempts').upsert({
      member_id: match.id,
      fail_count: 0,
      locked_until: null,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'member_id' });

    const now = Math.floor(Date.now() / 1000);
    const token = await signSessionToken({
      sub: match.id,
      member_id: match.id,
      owner_id: match.user_id,
      role: match.role,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    });

    return new Response(JSON.stringify({
      member_id: match.id,
      member_name: match.name,
      role: match.role,
      owner_id: match.user_id,
      permissions: (match as any).permissions || null,
      token,
      expires_at: (now + TOKEN_TTL_SECONDS) * 1000,
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
