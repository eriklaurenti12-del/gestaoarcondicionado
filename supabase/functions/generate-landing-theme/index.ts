import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { prompt, type } = await req.json();

    let systemPrompt = '';
    let tools: any[] = [];
    let tool_choice: any = undefined;

    if (type === 'colors') {
      systemPrompt = `Você é um designer expert em landing pages de alta conversão. Gere uma paleta de cores que seja profissional, moderna e transmita confiança. Considere o nicho de ar condicionado/serviços técnicos. Retorne cores em formato hexadecimal.`;
      tools = [{
        type: 'function',
        function: {
          name: 'generate_color_palette',
          description: 'Gera paleta de cores para landing page',
          parameters: {
            type: 'object',
            properties: {
              landing_cor_primaria: { type: 'string', description: 'Cor primária hex' },
              landing_cor_secundaria: { type: 'string', description: 'Cor secundária hex' },
              landing_cor_destaque: { type: 'string', description: 'Cor de destaque/accent hex' },
              landing_cor_fundo: { type: 'string', description: 'Cor de fundo hex (escura)' },
              landing_cor_botao_cta: { type: 'string', description: 'Cor do botão CTA hex (vibrante)' },
            },
            required: ['landing_cor_primaria', 'landing_cor_secundaria', 'landing_cor_destaque', 'landing_cor_fundo', 'landing_cor_botao_cta'],
            additionalProperties: false,
          }
        }
      }];
      tool_choice = { type: 'function', function: { name: 'generate_color_palette' } };
    } else if (type === 'texts') {
      systemPrompt = `Você é um copywriter expert em páginas de venda de alta conversão para o nicho de serviços de ar condicionado. Gere textos persuasivos em português brasileiro que usem gatilhos mentais (urgência, prova social, dor/solução). Seja direto e impactante.`;
      tools = [{
        type: 'function',
        function: {
          name: 'generate_landing_texts',
          description: 'Gera textos persuasivos para landing page',
          parameters: {
            type: 'object',
            properties: {
              landing_hero_titulo: { type: 'string', description: 'Título principal impactante (max 60 chars)' },
              landing_hero_subtitulo: { type: 'string', description: 'Subtítulo complementar (max 40 chars)' },
              landing_hero_descricao: { type: 'string', description: 'Descrição hero com dor do cliente (max 200 chars)' },
              landing_badge_urgencia: { type: 'string', description: 'Badge de urgência curto (max 60 chars)' },
              landing_btn_cta_texto: { type: 'string', description: 'Texto do botão CTA (max 40 chars, CAPS)' },
              landing_frase_destaque: { type: 'string', description: 'Frase de destaque persuasiva (max 150 chars)' },
              landing_countdown_texto: { type: 'string', description: 'Texto do countdown com emoji' },
              landing_countdown_desconto: { type: 'string', description: 'Badge de desconto (ex: 30% OFF)' },
            },
            required: ['landing_hero_titulo', 'landing_hero_subtitulo', 'landing_hero_descricao', 'landing_badge_urgencia', 'landing_btn_cta_texto', 'landing_frase_destaque'],
            additionalProperties: false,
          }
        }
      }];
      tool_choice = { type: 'function', function: { name: 'generate_landing_texts' } };
    } else if (type === 'full') {
      systemPrompt = `Você é um designer e copywriter expert. Gere uma landing page completa com cores e textos persuasivos para serviços de ar condicionado.`;
      tools = [{
        type: 'function',
        function: {
          name: 'generate_full_theme',
          description: 'Gera tema completo para landing page',
          parameters: {
            type: 'object',
            properties: {
              landing_cor_primaria: { type: 'string' },
              landing_cor_secundaria: { type: 'string' },
              landing_cor_destaque: { type: 'string' },
              landing_cor_fundo: { type: 'string' },
              landing_cor_botao_cta: { type: 'string' },
              landing_hero_titulo: { type: 'string' },
              landing_hero_subtitulo: { type: 'string' },
              landing_hero_descricao: { type: 'string' },
              landing_badge_urgencia: { type: 'string' },
              landing_btn_cta_texto: { type: 'string' },
              landing_frase_destaque: { type: 'string' },
            },
            required: ['landing_cor_primaria', 'landing_hero_titulo', 'landing_btn_cta_texto'],
            additionalProperties: false,
          }
        }
      }];
      tool_choice = { type: 'function', function: { name: 'generate_full_theme' } };
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt || 'Gere uma variação profissional e moderna para landing page de sistema de gestão de ar condicionado.' },
        ],
        tools,
        tool_choice,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI error:', response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit - tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return structured output');
    }

    const generated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, settings: generated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
