// AI Chat function — chat completions pela API da OpenAI (ver _shared/llm.ts)
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/llm.ts";

async function logUsage(params: { service_type: string; action: string; model?: string; input_tokens?: number; output_tokens?: number; total_cost: number; company_id?: string; user_id?: string; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type,
      action: params.action,
      model: params.model || null,
      input_tokens: params.input_tokens || 0,
      output_tokens: params.output_tokens || 0,
      total_cost: params.total_cost,
      unit_cost: params.total_cost,
      company_id: params.company_id || null,
      user_id: params.user_id || null,
      metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, message, personality, instructions, model = 'openai/gpt-5', stream = false, temperature } = await req.json();

    // Build messages array
    let apiMessages = [];
    
    if (messages && Array.isArray(messages)) {
      // New format with messages array - already includes system prompt
      apiMessages = messages;
    } else if (message) {
      // Old format with single message - build system prompt
      const systemPrompt = `${personality ? `Personalidade: ${personality}\n\n` : ''}${instructions || 'Você é um assistente IA útil e amigável. Responda sempre em português brasileiro.'}`;
      apiMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];
    } else {
      throw new Error('Either "messages" array or "message" string is required');
    }

    console.log('🤖 Processing chat request:', { model, messageCount: apiMessages.length, stream });

    const response = await chatCompletion({
      model,
      messages: apiMessages,
      stream,
      ...(temperature != null ? { temperature } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', response.status, errorText);

      const friendly =
        response.status === 429
          ? 'Limite de requisições atingido. Tente novamente em alguns segundos.'
          : response.status === 401 || response.status === 403
            ? 'Chave da OpenAI inválida ou sem permissão. Confira a secret OPENAI_API_KEY.'
            : response.status === 400 || response.status === 404
              ? `Modelo indisponível para esta conta da OpenAI. Detalhe: ${errorText.substring(0, 200)}`
              : null;

      if (friendly) {
        return new Response(JSON.stringify({ error: friendly }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
    }

    // If streaming, pass through the response
    if (stream) {
      console.log('📡 Streaming response...');
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Non-streaming response
    const data = await response.json();
    console.log('✅ AI response received');
    
    const assistantMessage = data.choices[0].message.content;

    // Log cost based on usage tokens
    const usage = data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    // Estimate cost based on model (updated for 2026 models)
    let costPer1kInput = 0.0015; 
    let costPer1kOutput = 0.005;
    const totalCost = (inputTokens / 1000) * costPer1kInput + (outputTokens / 1000) * costPer1kOutput;

    logUsage({
      service_type: 'openai',
      action: 'chat_completion',
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_cost: totalCost,
      metadata: { stream: false },
    });

    return new Response(JSON.stringify({ 
      response: assistantMessage,
      message: assistantMessage, // For backward compatibility
      model: model,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in ai-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
