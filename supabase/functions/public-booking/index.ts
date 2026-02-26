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
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (req.method === 'GET') {
      // Get business info and available services
      const [
        { data: company },
        { data: services },
        { data: appointments }
      ] = await Promise.all([
        supabase.from('company_data').select('company_name, whatsapp, address').eq('user_id', userId).maybeSingle(),
        supabase.from('products').select('id, name, price, service_duration, type').eq('user_id', userId).eq('type', 'service'),
        supabase.from('appointments').select('appointment_date, status')
          .eq('user_id', userId)
          .in('status', ['agendado', 'confirmado'])
          .gte('appointment_date', new Date().toISOString())
      ]);

      // Calculate busy slots
      const busySlots = (appointments || []).map((a: any) => a.appointment_date);

      return new Response(JSON.stringify({
        company: company || { company_name: 'AC Service Pro' },
        services: services || [],
        busySlots
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { client_name, client_phone, client_email, service_name, preferred_date, preferred_time, payment_method, notes } = body;

      if (!client_name || !client_phone || !service_name || !preferred_date || !preferred_time) {
        return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.from('online_bookings').insert({
        user_id: userId,
        client_name,
        client_phone,
        client_email: client_email || null,
        service_name,
        preferred_date,
        preferred_time,
        payment_method: payment_method || null,
        notes: notes || null,
        status: 'pendente'
      }).select().single();

      if (error) {
        console.error('[public-booking] Insert error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, booking: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[public-booking] Error:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
