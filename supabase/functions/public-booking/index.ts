import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    // Validate user_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'user_id inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (req.method === 'GET') {
      const action = url.searchParams.get('action');
      
      // Lookup bookings by phone
      if (action === 'lookup') {
        const phone = (url.searchParams.get('phone') || '').replace(/[^0-9]/g, '');
        if (phone.length < 8) {
          return new Response(JSON.stringify({ bookings: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const { data: bookings } = await supabase
          .from('online_bookings')
          .select('id, client_name, client_phone, service_name, preferred_date, preferred_time, payment_method, status, created_at')
          .eq('user_id', userId)
          .ilike('client_phone', `%${phone.slice(-8)}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        return new Response(JSON.stringify({ bookings: bookings || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get business info, services, busy slots and online booking settings
      const [
        { data: company },
        { data: services },
        { data: appointments },
        { data: settings }
      ] = await Promise.all([
        supabase.from('company_data').select('company_name, whatsapp, address, logo_url, instagram').eq('user_id', userId).maybeSingle(),
        supabase.from('products').select('id, name, price, service_duration, type, image_url').eq('user_id', userId).eq('type', 'service'),
        supabase.from('appointments').select('appointment_date, status')
          .eq('user_id', userId)
          .in('status', ['pendente', 'confirmado'])
          .gte('appointment_date', new Date().toISOString()),
        supabase.from('online_booking_settings').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const busySlots = (appointments || []).map((a: any) => a.appointment_date);

      const defaultSettings = {
        enabled: true,
        weekdays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
        start_time: '08:00',
        end_time: '18:00',
        slot_minutes: 30,
        lunch_start: '12:00',
        lunch_end: '13:00',
        min_advance_hours: 2,
        max_advance_days: 30,
        auto_confirm: false,
      };

      return new Response(JSON.stringify({
        company: company || { company_name: 'AC Service Pro' },
        services: services || [],
        busySlots,
        settings: settings || defaultSettings,
        server_time: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { booking_id, action, service_name, preferred_date, preferred_time } = body;

      if (action === 'cancel' && booking_id) {
        const { error } = await supabase
          .from('online_bookings')
          .update({ status: 'cancelado', updated_at: new Date().toISOString() })
          .eq('id', booking_id)
          .eq('user_id', userId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'update' && booking_id) {
        if (!service_name || !preferred_date || !preferred_time) {
          return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const { error } = await supabase
          .from('online_bookings')
          .update({ 
            service_name, 
            preferred_date, 
            preferred_time,
            updated_at: new Date().toISOString() 
          })
          .eq('id', booking_id)
          .eq('user_id', userId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { client_name, client_phone, client_email, client_address, client_cep, service_name, preferred_date, preferred_time, payment_method, notes } = body;

      // Input validation
      if (!client_name || !client_phone || !service_name || !preferred_date || !preferred_time) {
        return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sanitize inputs
      const safeName = String(client_name).slice(0, 100).trim();
      const safePhone = String(client_phone).replace(/[^0-9()\-\s+]/g, '').slice(0, 20);
      const safeEmail = client_email ? String(client_email).slice(0, 255).trim() : null;
      const safeService = String(service_name).slice(0, 200).trim();
      const safeDate = String(preferred_date).slice(0, 10);
      const safeTime = String(preferred_time).slice(0, 5);
      const safePayment = payment_method ? String(payment_method).slice(0, 50) : null;
      const safeNotes = [notes ? String(notes).slice(0, 500) : '', client_address ? `📍 ${String(client_address).slice(0, 300)}` : '', client_cep ? `CEP: ${String(client_cep).slice(0, 10)}` : ''].filter(Boolean).join(' | ') || null;

      // Date format validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate) || !/^\d{2}:\d{2}$/.test(safeTime)) {
        return new Response(JSON.stringify({ error: 'Formato de data/hora inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate against online_booking_settings (real-time, server-side)
      const { data: cfg } = await supabase
        .from('online_booking_settings').select('*').eq('user_id', userId).maybeSingle();

      const s: any = cfg || {
        enabled: true,
        weekdays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
        start_time: '08:00', end_time: '18:00', slot_minutes: 30,
        lunch_start: '12:00', lunch_end: '13:00',
        min_advance_hours: 2, max_advance_days: 30,
      };

      if (s.enabled === false) {
        return new Response(JSON.stringify({ error: 'Agendamento online desativado.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const slotMin = toMin(safeTime);
      const startMin = toMin(s.start_time || '08:00');
      const endMin = toMin(s.end_time || '18:00');

      if (slotMin < startMin || slotMin >= endMin) {
        return new Response(JSON.stringify({ error: `Horário fora do expediente (${s.start_time} - ${s.end_time}).` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (s.lunch_start && s.lunch_end) {
        const lStart = toMin(s.lunch_start), lEnd = toMin(s.lunch_end);
        if (slotMin >= lStart && slotMin < lEnd) {
          return new Response(JSON.stringify({ error: 'Horário de almoço indisponível.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const dt = new Date(`${safeDate}T${safeTime}:00`);
      const wkKey = ['sun','mon','tue','wed','thu','fri','sat'][dt.getDay()];
      if ((s.weekdays || {})[wkKey] === false) {
        return new Response(JSON.stringify({ error: 'Dia da semana indisponível para agendamento.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date();
      const diffH = (dt.getTime() - now.getTime()) / 3600000;
      const diffD = (dt.getTime() - now.getTime()) / 86400000;
      if (diffH < (s.min_advance_hours ?? 0)) {
        return new Response(JSON.stringify({ error: `Antecedência mínima de ${s.min_advance_hours}h.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (diffD > (s.max_advance_days ?? 365)) {
        return new Response(JSON.stringify({ error: `Antecedência máxima de ${s.max_advance_days} dias.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.from('online_bookings').insert({
        user_id: userId,
        client_name: safeName,
        client_phone: safePhone,
        client_email: safeEmail,
        service_name: safeService,
        preferred_date: safeDate,
        preferred_time: safeTime,
        payment_method: safePayment,
        notes: safeNotes,
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
