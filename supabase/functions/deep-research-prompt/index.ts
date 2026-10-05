import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, url, language = "pt-BR" } = await req.json();
    
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");

    if (!perplexityKey) {
      throw new Error("PERPLEXITY_API_KEY não configurada");
    }

    console.log(`[deep-research] Processing prompt: ${prompt}${url ? ` for URL: ${url}` : ""}`);

    // 1. Research phase (Perplexity)
    const systemPrompt = `Você é um pesquisador especialista. Sua tarefa é ENRIQUECER o pedido do usuário com informações REAIS da web.
Se o usuário forneceu uma URL, extraia os dados principais dela (produtos, preços, imagens, descrição).
Se for uma pesquisa geral, busque tendências e melhores práticas.
Responda em ${language}. Devolva um briefing estruturado em markdown.
Inclua uma seção específica chamada "📷 IMAGENS E MÍDIAS" listando URLs de imagens encontradas ou termos de busca visual específicos.`;

    const userPrompt = url 
      ? `Pesquise profundamente o conteúdo deste site: ${url}. Foque em extrair detalhes de produtos e links de imagens.\nPedido original: ${prompt}`
      : `Pesquise sobre: ${prompt}. Busque dados factuais e referências visuais.`;

    const perpRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!perpRes.ok) throw new Error(`Perplexity falhou: ${perpRes.status}`);
    const perpData = await perpRes.json();
    const research = perpData.choices?.[0]?.message?.content || "";
    const citations = perpData.citations || [];

    // 2. Image Scraping/Search phase (Brave)
    let foundImages: any[] = [];
    if (braveKey) {
      // Extrair URLs do Perplexity se disponíveis ou termos de busca
      const searchTerms = [prompt];
      
      // Tenta extrair URLs de imagens do research via regex se for um site específico
      if (url) {
        const urlRegex = /(https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|gif|svg))/gi;
        const matches = research.match(urlRegex);
        if (matches) {
          matches.forEach(m => {
            if (!foundImages.find(img => img.url === m)) {
              foundImages.push({ url: m, title: "Encontrado no site", source: url });
            }
          });
        }
      }

      const query = encodeURIComponent(searchTerms[0]);
      const braveRes = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${query}&count=15`, {
        headers: { "X-Subscription-Token": braveKey },
      });
      if (braveRes.ok) {
        const braveData = await braveRes.json();
        const results = (braveData.results || []).map((r: any) => ({
          url: r.properties?.url || r.thumbnail?.src,
          title: r.title,
          source: r.source
        })).filter((img: any) => img.url);
        
        foundImages = [...foundImages, ...results];
      }
    }

    const enrichedPrompt = `${prompt}\n\n---\n🔎 PESQUISA APROFUNDADA E SCRAPING:\n${research}\n\n${
      citations.length ? `Fontes:\n${citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")}` : ""
    }\n---\nUse os dados acima para construir o fluxo. Se houver imagens no catálogo abaixo, sugira o uso delas nos blocos de imagem.`;

    return new Response(
      JSON.stringify({ 
        enrichedPrompt, 
        research, 
        citations, 
        images: foundImages 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("deep-research-prompt error:", e);
    return new Response(JSON.stringify({ error: String(e.message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});