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
      completo: `Você é um copywriter expert. Gere TODOS os textos para uma landing page de vendas de um sistema de gestão para técnicos de ar condicionado chamado "AC Service Pro".

INFORMAÇÕES ATUAIS DO PRODUTO:
${context}

Gere os seguintes campos (todos em português brasileiro, tom persuasivo, com gatilhos mentais):

1. hero_titulo: Título principal do hero (5-8 palavras, urgência)
2. hero_subtitulo: Subtítulo complementar (máx 10 palavras)
3. hero_descricao: Descrição do hero (2-3 frases sobre as dores do técnico)
4. badge_urgencia: Texto de urgência no topo (1 frase com emoji)
5. frase_destaque: Frase destaque/prova social (1 frase impactante sobre o sistema)
6. btn_cta: Texto do botão CTA principal (máx 5 palavras, ação forte com caps)
7. dor_titulo: Título da seção de dor. Use ** para destacar. Ex: "Você se **identifica** com isso?"
8. dor_itens: 8 itens de dor do técnico, separados por \\n (um por linha)
9. dor_conclusao: Frase de conclusão da dor. Use ** para destaque. Ex: "Se marcou 2 ou mais... **você PRECISA desse sistema.**"
10. comparativo_titulo: Título do comparativo. Use ** para destaque.
11. comparativo_outros: 6 itens negativos dos concorrentes, separados por \\n. IMPORTANTE: Use os preços REAIS do contexto, não invente valores.
12. comparativo_nosso: 6 itens positivos do AC Service Pro, separados por \\n. Use {{preco_mensal}} como placeholder para o preço dinâmico.
13. features_titulo: Título da seção de funcionalidades. Use ** para destaque.
14. urgencia_titulo: Título de urgência final. Use ** para destaque.
15. urgencia_subtitulo: Subtítulo urgência. Use ** para destaque bold.
16. cta_final_titulo: Título do CTA final. Use ** para destaque.

REGRAS IMPORTANTES:
- NÃO invente preços, use EXATAMENTE os valores fornecidos no contexto
- Use {{preco_mensal}} para referência dinâmica ao preço mensal nos itens do comparativo
- Todos os textos devem ser persuasivos e falar diretamente com técnicos de ar condicionado
- Use gatilhos: urgência, escassez, prova social, medo de perda`,
    };

    const systemPrompt = `Você é um copywriter especialista em landing pages de alta conversão para o mercado de ar condicionado no Brasil. Sempre responda em português brasileiro. Seus textos devem ser persuasivos, usar gatilhos mentais (urgência, escassez, prova social, autoridade) e falar diretamente com técnicos de ar condicionado.`;

    const toolSchema = type === 'completo' ? {
      type: "object",
      properties: {
        hero_titulo: { type: "string" },
        hero_subtitulo: { type: "string" },
        hero_descricao: { type: "string" },
        badge_urgencia: { type: "string" },
        frase_destaque: { type: "string" },
        btn_cta: { type: "string" },
        dor_titulo: { type: "string" },
        dor_itens: { type: "string" },
        dor_conclusao: { type: "string" },
        comparativo_titulo: { type: "string" },
        comparativo_outros: { type: "string" },
        comparativo_nosso: { type: "string" },
        features_titulo: { type: "string" },
        urgencia_titulo: { type: "string" },
        urgencia_subtitulo: { type: "string" },
        cta_final_titulo: { type: "string" },
      },
      required: ["hero_titulo", "hero_subtitulo", "hero_descricao", "badge_urgencia", "frase_destaque", "btn_cta", "dor_titulo", "dor_itens", "dor_conclusao", "comparativo_titulo", "comparativo_outros", "comparativo_nosso", "features_titulo", "urgencia_titulo", "urgencia_subtitulo", "cta_final_titulo"],
      additionalProperties: false,
    } : type === 'hero' ? {
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
    };

    const functionName = type === 'completo' ? 'generate_complete_copy' : type === 'hero' ? 'generate_hero_copy' : type === 'faq' ? 'generate_faq_copy' : type === 'depoimentos' ? 'generate_depoimentos_copy' : 'generate_ofertas_copy';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompts[type] || prompts.hero },
        ],
        tools: [{
          type: "function",
          function: {
            name: functionName,
            description: `Return generated copy fields. You MUST return all required fields with the exact names specified in the schema.`,
            parameters: toolSchema,
          }
        }],
        tool_choice: { type: "function", function: { name: functionName } },
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
