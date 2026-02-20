import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Legacy endpoint - redirects all requests to the new universal payment-webhook
// Kept for backward compatibility with platforms already configured with this URL
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const newWebhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
    
    // Forward the request to the new universal webhook
    const bodyText = await req.text();
    
    const response = await fetch(newWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
    });

    const data = await response.json();
    
    // Add legacy notice to response
    return new Response(
      JSON.stringify({
        ...data,
        _notice: 'Este endpoint é legado. Use payment-webhook para novas integrações.',
        _new_endpoint: newWebhookUrl,
      }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        _notice: 'Este endpoint é legado. Use payment-webhook para novas integrações.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
