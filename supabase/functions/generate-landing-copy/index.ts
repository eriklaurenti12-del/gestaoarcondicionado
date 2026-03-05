import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompts: Record<string, string> = {
      hero: `Gere textos persuasivos para a landing page de um sistema de gestão para técnicos de ar condicionado chamado "AC Service Pro". Gere:
- titulo: Título principal (máx 8 palavras, forte, que gere urgência)
- subtitulo: Subtítulo complementar (máx 10 palavras)
- descricao: Descrição do hero (2-3 frases, focada nas dores do técnico)
- badge_urgencia: Badge de urgência (1 frase curta com emoji)
- frase_destaque: Frase de destaque/prova social (1 frase impactante)
- btn_cta: Texto do botão CTA (máx 5 palavras, ação forte)
Contexto: ${context || 'Sistema para técnicos autônomos e empresas de ar condicionado'}`,
      faq: `Gere 6 perguntas e respostas para a seção FAQ de um sistema de gestão para técnicos de ar condicionado. Foque em eliminar objeções de compra. Cada FAQ deve ter:
- pergunta: Pergunta comum de potenciais clientes
- resposta: Resposta clara e persuasiva (2-3 frases)`,
      depoimentos: `Gere 4 depoimentos realistas de técnicos de ar condicionado que usam um sistema de gestão. Cada depoimento deve ter:
- nome: Nome brasileiro realista (primeiro nome + inicial do sobrenome)
- role: Cargo e cidade (ex: "Técnico Autônomo - SP")
- texto: Depoimento de 2-3 frases, natural e convincente
- estrelas: Sempre 5`,
      ofertas: `Gere textos persuasivos para 2 planos de um sistema de gestão para técnicos de ar condicionado:
Plano 1 (Mensal):
- titulo, descricao, badge, btn_texto, features (5 itens)
Plano 2 (Anual):
- titulo, descricao, badge, btn_texto, features (5 itens)
Foque em benefícios reais e urgência.`,
    };

    const systemPrompt = `Você é um copywriter especialista em landing pages de alta conversão para o mercado de ar condicionado no Brasil. Sempre responda em português brasileiro. Seus textos devem ser persuasivos, usar gatilhos mentais (urgência, escassez, prova social, autoridade) e falar diretamente com técnicos de ar condicionado.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompts[type] || prompts.hero },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_copy",
            description: "Return generated copy for the landing page section",
            parameters: type === 'hero' ? {
              type: "object",
              properties: {
                titulo: { type: "string" },
                subtitulo: { type: "string" },
                descricao: { type: "string" },
                badge_urgencia: { type: "string" },
                frase_destaque: { type: "string" },
                btn_cta: { type: "string" },
              },
              required: ["titulo", "subtitulo", "descricao", "badge_urgencia", "frase_destaque", "btn_cta"],
              additionalProperties: false,
            } : type === 'faq' ? {
              type: "object",
              properties: {
                faqs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pergunta: { type: "string" },
                      resposta: { type: "string" },
                    },
                    required: ["pergunta", "resposta"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["faqs"],
              additionalProperties: false,
            } : type === 'depoimentos' ? {
              type: "object",
              properties: {
                depoimentos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      role: { type: "string" },
                      texto: { type: "string" },
                      estrelas: { type: "string" },
                    },
                    required: ["nome", "role", "texto", "estrelas"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["depoimentos"],
              additionalProperties: false,
            } : {
              type: "object",
              properties: {
                plano1: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descricao: { type: "string" },
                    badge: { type: "string" },
                    btn_texto: { type: "string" },
                    features: { type: "array", items: { type: "string" } },
                  },
                  required: ["titulo", "descricao", "badge", "btn_texto", "features"],
                  additionalProperties: false,
                },
                plano2: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descricao: { type: "string" },
                    badge: { type: "string" },
                    btn_texto: { type: "string" },
                    features: { type: "array", items: { type: "string" } },
                  },
                  required: ["titulo", "descricao", "badge", "btn_texto", "features"],
                  additionalProperties: false,
                },
              },
              required: ["plano1", "plano2"],
              additionalProperties: false,
            },
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_copy" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para geração de IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou dados estruturados");

    const generated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ generated, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-landing-copy error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
