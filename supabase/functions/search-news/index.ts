const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, language = 'pt-BR' } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ success: false, error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching news for topic:', topic);

    // Search for real news using Perplexity
    const systemPrompt = `You are a content researcher. Search for the latest real news and information about the given topic. Return a JSON object with the following structure:
{
  "title": "A compelling carousel title about the topic (max 80 chars)",
  "subtitle": "A subtitle that hooks the reader (max 100 chars)",
  "facts": [
    {
      "heading": "Short heading for this fact/point (max 60 chars)",
      "body": "Detailed explanation of this fact or news point (100-200 chars)",
      "source": "Name of the source"
    }
  ],
  "cta_title": "Call to action title (max 60 chars)",
  "cta_body": "Call to action message (max 120 chars)",
  "image_search_terms": ["term1", "term2", "term3"],
  "clean_topic": "The extracted main subject/topic name only (e.g. 'CS2', 'Tesla', 'Bitcoin')",
  "summary": "A brief 2-sentence summary of the key findings"
}
Provide 4-6 facts. All content must be in ${language === 'pt-BR' ? 'Brazilian Portuguese' : language}. Base everything on REAL, current, verified information.

CRITICAL for clean_topic: Extract ONLY the core subject name from the user request. If user says "Crie um post sobre CS2" the clean_topic is "CS2". If user says "Novidades do Bitcoin" the clean_topic is "Bitcoin". Just the subject, no verbs or filler words.

CRITICAL for image_search_terms: Each term MUST be in ENGLISH and describe a specific visual scene directly from the topic. The terms are used for image search, so be very specific and visual. For games like CS2: "Counter-Strike 2 gameplay screenshot Dust2", "CS2 weapon skins showcase", "CS2 competitive match". For brands: "Tesla Model 3 exterior photo", "Tesla factory". NEVER use generic terms like "technology", "update", "performance", "2026". Each term must produce an image that visually represents the specific topic.`;

    const userPrompt = `Search for the latest real news, data, and facts about: "${topic}". Focus on recent developments, statistics, and verified information.`;

    let content = '';
    let citations: string[] = [];

    // Try Perplexity first, fallback to OpenAI
    let perplexityOk = false;
    try {
      console.log('[AI] Trying Perplexity...');
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          search_recency_filter: 'month',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        content = data.choices?.[0]?.message?.content || '';
        citations = data.citations || [];
        perplexityOk = true;
        console.log('[AI] Perplexity OK, citations:', citations.length);
      } else {
        const errText = await response.text();
        console.error('[AI] Perplexity failed:', response.status, errText.slice(0, 200));
      }
    } catch (perplexityErr) {
      console.error('[AI] Perplexity exception:', perplexityErr);
    }

    // Fallback to OpenAI if Perplexity failed
    if (!perplexityOk) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        console.log('[AI] Falling back to OpenAI...');
        try {
          const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.3,
            }),
          });

          if (openaiRes.ok) {
            const openaiData = await openaiRes.json();
            content = openaiData.choices?.[0]?.message?.content || '';
            console.log('[AI] OpenAI fallback OK');
          } else {
            const errText = await openaiRes.text();
            console.error('[AI] OpenAI also failed:', openaiRes.status, errText.slice(0, 200));
            return new Response(
              JSON.stringify({ success: false, error: 'All AI providers unavailable. Please try again.' }),
              { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (openaiErr) {
          console.error('[AI] OpenAI exception:', openaiErr);
          return new Response(
            JSON.stringify({ success: false, error: 'All AI providers failed. Please try again.' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('[AI] No fallback API key available');
        return new Response(
          JSON.stringify({ success: false, error: 'Perplexity unavailable and no fallback configured.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Perplexity response received, citations:', citations.length);

    // Parse the JSON from the response
    let parsedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse JSON, using raw content:', parseErr);
      parsedContent = {
        title: topic,
        subtitle: 'Últimas notícias e informações',
        facts: [{ heading: 'Informação', body: content.slice(0, 200), source: 'Perplexity AI' }],
        cta_title: 'Saiba mais',
        cta_body: 'Acompanhe as novidades',
        image_search_terms: [topic],
        summary: content.slice(0, 300),
      };
    }

    // Search for images - use clean topic from AI, not raw user input
    let images: string[] = [];
    const cleanTopic = parsedContent.clean_topic || topic;
    const searchTerms: string[] = parsedContent.image_search_terms || [`${cleanTopic} screenshot`, `${cleanTopic} photo`];
    console.log('[IMAGES] Clean topic:', cleanTopic);
    console.log('[IMAGES] Search terms:', searchTerms);

    // Strategy 1: Brave Web Search (better for niche topics like games)
    // Search on relevant sites and extract images from results
    const braveApiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
    if (braveApiKey) {
      // First try image search with clean terms
      for (const term of searchTerms.slice(0, 3)) {
        if (images.length >= 20) break;
        try {
          const query = encodeURIComponent(term);
          const url = `https://api.search.brave.com/res/v1/images/search?q=${query}&count=50&safesearch=strict`;
          const imgResponse = await fetch(url, {
            headers: { 'X-Subscription-Token': braveApiKey },
          });
          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const results = (imgData.results || []);
            for (const item of results) {
              const imgUrl = item.properties?.url || item.thumbnail?.src;
              if (imgUrl) images.push(imgUrl);
            }
            console.log('[IMAGES] Brave images for "' + term + '":', results.length, 'results, total:', images.length);
          }
        } catch (e) {
          console.error('[IMAGES] Brave error:', e);
        }
      }
    }

    // Strategy 2: Generate images with AI if search found too few
    if (images.length < 2) {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (lovableKey) {
        console.log('[IMAGES] Generating AI images for topic:', cleanTopic);
        try {
          for (const term of searchTerms.slice(0, 3)) {
            if (images.length >= 4) break;
            const aiPrompt = `Create a high-quality, photorealistic image of: ${term}. Make it visually stunning and suitable for a social media carousel post. No text or watermarks.`;
            const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-image',
                messages: [{ role: 'user', content: aiPrompt }],
                modalities: ['image', 'text'],
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const aiImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              if (aiImage) {
                images.push(aiImage);
                console.log('[IMAGES] AI generated image successfully');
              }
            }
          }
        } catch (e) {
          console.error('[IMAGES] AI generation error:', e);
        }
      }
    }

    // Deduplicate
    images = [...new Set(images)];
    console.log('[IMAGES] Total images found:', images.length);

    return new Response(
      JSON.stringify({
        success: true,
        content: parsedContent,
        citations,
        images: images.slice(0, 50),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in search-news:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
