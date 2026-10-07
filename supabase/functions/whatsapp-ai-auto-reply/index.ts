import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyPipelineStage } from "../_shared/pipelineClassifier.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cleanReply = (value: string) => value
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/\*(.*?)\*/g, '$1')
  .replace(/#{1,6}\s?/g, '')
  .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
  .replace(/\[(.*?)\]\((.*?)\)/g, '$2')
  .replace(/\[STAGE:\w+\]/g, '')
  .replace('[HANDOFF]', '')
  .trim();

// Deterministic Kanban stage classifier — shared module ensures both this
// worker and the main webhook produce identical column moves.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
    const work = processAutoReply(body).catch((error) => console.error('🤖 [AI-AUTO-REPLY] Worker error:', error));
    if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
    else await work;

    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('🤖 [AI-AUTO-REPLY] Request error:', error);
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processAutoReply(body: any) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const conversationId = String(body.conversationId || '');
  const incomingMessageId = String(body.messageId || '');
  const content = String(body.content || '').trim();
  const messageType = String(body.messageType || 'text');
  if (!conversationId || !content) return;

  // Lock atômico antes do debounce: a primeira mensagem do bloco segura o
  // processamento, as próximas só ficam registradas e serão lidas em conjunto.
  const { data: claimed } = await supabase.rpc('claim_ai_reply', {
    p_conversation_id: conversationId,
    p_ttl_seconds: 90,
  });
  if (claimed !== true) {
    console.log('🤖 [AI-AUTO-REPLY] Skipping: another reply is already collecting messages', conversationId);
    return;
  }
  const releaseLock = async () => {
    try {
      await supabase.from('ai_reply_locks').delete().eq('conversation_id', conversationId);
    } catch (_e) { /* ignore */ }
  };
  try {
    await runReply();
  } finally {
    await releaseLock();
  }

  async function runReply() {

  // Aggregation debounce: wait up to 5s so a burst of customer messages
  // becomes one AI turn instead of one reply per message.
  const AGGREGATION_DELAY_MS = 5000;
  await new Promise((resolve) => setTimeout(resolve, AGGREGATION_DELAY_MS));

  // Check if there was any human (non-AI) response from us since the last AI message.
  // If a human sent a message, we should disable AI auto-reply for this conversation.
  const { data: lastHumanMessage } = await supabase
    .from('whatsapp_messages')
    .select('timestamp, is_ai_response')
    .eq('conversation_id', conversationId)
    .eq('from_me', true)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastHumanMessage && lastHumanMessage.is_ai_response === false) {
    console.log('🤖 [AI-AUTO-REPLY] Human intervention detected, disabling AI for', conversationId);
    await supabase
      .from('whatsapp_conversations')
      .update({ ai_auto_reply_enabled: false })
      .eq('id', conversationId);
    return;
  }

  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, company_id, session_id, contact_phone, remote_jid, assigned_agent_id, ai_auto_reply_enabled, pipeline_stage, human_takeover')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation?.assigned_agent_id || !conversation.ai_auto_reply_enabled) {
    console.log('🤖 [AI-AUTO-REPLY] Skipping: no active assigned agent', conversationId);
    return;
  }

  if ((conversation as any).human_takeover) {
    console.log('🤖 [AI-AUTO-REPLY] Skipping: conversation under human takeover', conversationId);
    return;
  }

  // Dedupe correctly: only skip when we already answered THIS specific incoming message.
  // Find the incoming message timestamp, then check whether an AI response was inserted AFTER it.
  let incomingTimestamp: string | null = null;
  if (incomingMessageId) {
    const { data: incomingRow } = await supabase
      .from('whatsapp_messages')
      .select('timestamp')
      .eq('wa_message_id', incomingMessageId)
      .maybeSingle();
    incomingTimestamp = incomingRow?.timestamp ?? null;
  }

  if (incomingTimestamp) {
    const { data: laterAi } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('is_ai_response', true)
      .gt('timestamp', incomingTimestamp)
      .limit(1);
    if (laterAi && laterAi.length > 0) {
      console.log('🤖 [AI-AUTO-REPLY] Skipping: this message already answered', conversationId, incomingMessageId);
      return;
    }
  }

  const { data: agent } = await supabase
    .from('ai_agents')
    .select('id, name, personality, instructions, settings, is_active, model')
    .eq('id', conversation.assigned_agent_id)
    .maybeSingle();
  if (!agent) return;

  const settings = (agent.settings || {}) as Record<string, any>;
  const maxChars = settings.maxResponseChars ?? 500;
  const temperature = settings.temperature ?? 0.7;
  // Use the model configured on the agent (e.g. "openai/gpt-5-mini"). Fall back to
  // the OpenAI default when the agent has none — ai-chat/_shared/llm.ts maps every
  // gateway name (google/*, openai/*, ...) to a real OpenAI model id.
  const agentModel = ((agent as any).model as string) || (settings.model as string) || 'openai/gpt-5-mini';
  const audioResponseMode = (settings.audioResponseMode as string) || 'disabled';
  const ttsVoice = (settings.ttsVoice as string) || 'alloy';

  // Find timestamp of the last AI/agent reply to know which inbound messages are unanswered.
  const { data: lastAi } = await supabase
    .from('whatsapp_messages')
    .select('timestamp')
    .eq('conversation_id', conversationId)
    .eq('from_me', true)
    .order('timestamp', { ascending: false })
    .limit(1);
  const lastAiTs = lastAi?.[0]?.timestamp ?? null;

  // All inbound messages since the last reply — these are the ones we need to answer together.
  let pendingQuery = supabase
    .from('whatsapp_messages')
    .select('content, message_type, media_url, timestamp, wa_message_id')
    .eq('conversation_id', conversationId)
    .eq('from_me', false)
    .order('timestamp', { ascending: true });
  if (lastAiTs) pendingQuery = pendingQuery.gt('timestamp', lastAiTs);
  const { data: pendingInbound } = await pendingQuery;

  // Transcribe any audio/ptt messages so the AI actually understands them.
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const transcribeAudio = async (url: string): Promise<string> => {
    try {
      const audioResp = await fetch(url);
      if (!audioResp.ok) return '';
      const audioBuffer = await audioResp.arrayBuffer();
      if (ELEVENLABS_API_KEY) {
        const form = new FormData();
        form.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
        form.append('model_id', 'scribe_v2');
        form.append('language_code', 'por');
        const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY }, body: form,
        });
        if (r.ok) {
          const j = await r.json();
          if (j.text?.trim()) return j.text.trim();
        } else {
          console.error('🎙️ [AI-AUTO-REPLY] ElevenLabs STT failed:', r.status);
        }
      }
      if (OPENAI_API_KEY) {
        const form = new FormData();
        form.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
        form.append('model', 'whisper-1');
        form.append('language', 'pt');
        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: form,
        });
        if (r.ok) {
          const j = await r.json();
          if (j.text?.trim()) return j.text.trim();
        }
      }
    } catch (e) {
      console.error('🎙️ [AI-AUTO-REPLY] transcribe error:', e);
    }
    return '';
  };

  let hasAudioInBatch = false;
  const messagesToProcess = (pendingInbound && pendingInbound.length > 0)
    ? pendingInbound
    : [{ content, message_type: messageType, media_url: null, wa_message_id: incomingMessageId, timestamp: incomingTimestamp }];

  const parts: string[] = [];
  for (const m of messagesToProcess) {
    const mt = m.message_type || 'text';
    if (mt === 'audio' || mt === 'ptt') {
      hasAudioInBatch = true;
      let text = '';
      if (m.media_url) text = await transcribeAudio(m.media_url);
      if (text) {
        parts.push(`(Áudio transcrito automaticamente) ${text}`);
        try {
          await supabase.from('whatsapp_messages')
            .update({ content: `🎙️ ${text}` })
            .eq('wa_message_id', m.wa_message_id);
        } catch (_) {}
      } else {
        parts.push('[O usuário enviou um áudio mas a transcrição não foi possível.]');
      }
    } else if (mt !== 'text') {
      parts.push(`[${mt}] ${m.content || ''}`);
    } else if (m.content) {
      parts.push(m.content);
    }
  }
   const aggregatedUserText = parts.filter((t) => t.trim().length > 0).join('\n');
   if (!aggregatedUserText) return;
 
   // Fetch conversion fields to extract data (optional, for specific fields)
   const { data: conversionFields } = await supabase
     .from('ai_agent_conversions')
     .select('field_name, field_key, field_description')
     .eq('agent_id', agent.id);
 
   let extraInstructions = `
 TAREFA ADICIONAL: Analise a conversa e extraia dados estruturados importantes (ex: nome, interesse, orçamento, e-mail, etc.).
 `;
 
   if (conversionFields && conversionFields.length > 0) {
     const schemaStr = conversionFields.map(f => `- ${f.field_key}: ${f.field_name} (${f.field_description || ''})`).join('\n');
     extraInstructions += `
 Foco especial nos seguintes campos solicitados:
 ${schemaStr}
 `;
   }
 
   extraInstructions += `
 Se você identificar novos dados relevantes ou atualizações para os campos acima, formate-os EXCLUSIVAMENTE no final da sua resposta usando o formato: [DATA:{"chave":"valor"}]. Substitua apenas os campos identificados. Use chaves curtas e descritivas (ex: "nome", "interesse", "valor").
 
 KANBAN CRM: Você também deve atualizar a etapa do Kanban conforme a conversa evolui.
 Etapas disponíveis: "novo", "em_atendimento", "aguardando", "qualificado", "finalizado".
 
 Regras de atualização:
 - Mude para "em_atendimento" quando começar a interagir.
 - Mude para "aguardando" se o cliente disser que vai pensar ou se você precisar esperar uma resposta externa.
 - Mude para "qualificado" se identificar que o lead tem real interesse ou preencheu dados chave.
 - Mude para "finalizado" após concluir o objetivo da conversa.
 
 Se desejar mudar a etapa, adicione "stage": "ID_DA_ETAPA" dentro do JSON [DATA:...]. Ex: [DATA:{"nome":"João", "stage":"qualificado"}].
 `;

  const shouldSendAudio = audioResponseMode === 'always' ||
    (audioResponseMode === 'when_audio' && hasAudioInBatch);

  // Conversation history (older context, excluding the pending inbound batch we'll send as the user turn).
  const { data: hist } = await supabase
    .from('whatsapp_messages')
    .select('from_me, content, timestamp')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(20);
  const historyMessages = (hist || [])
    .reverse()
    .filter((m: any) => !lastAiTs || new Date(m.timestamp).getTime() <= new Date(lastAiTs).getTime());

  // Últimas mensagens já enviadas por nós — para o modelo não repetir texto.
  const previousOutbound = (hist || [])
    .filter((m: any) => m.from_me && (m.content || '').trim().length > 0)
    .slice(0, 5)
    .map((m: any) => `- ${String(m.content).slice(0, 200)}`)
    .join('\n');

   const systemPrompt = [
     `Você é ${agent.name}, atendente de WhatsApp.`,
     `Personalidade: ${agent.personality || 'profissional'}`,
     agent.instructions || '',
     `Responda em português brasileiro, curto, natural, sem markdown e com no máximo ${maxChars} caracteres.`,
     'Responda apenas ao que o cliente perguntou e envie uma única mensagem.',
     extraInstructions,
     'IMPORTANTE: Você ENTENDE mensagens de áudio. Quando o cliente envia um áudio, o sistema transcreve automaticamente para você como texto (marcado com "(Áudio transcrito automaticamente)" ou prefixo 🎙️). NUNCA diga que não consegue ouvir, escutar ou entender áudios. Responda normalmente ao conteúdo transcrito como se tivesse ouvido. Ignore qualquer mensagem anterior sua que diga o contrário.',
     'REGRA DE OURO — QUANDO NÃO SOUBER RESPONDER: Se a pergunta do cliente for fora do seu escopo, ambígua ou você não tiver informação confiável para responder, NUNCA invente. Você tem duas opções: (1) ficar em silêncio respondendo apenas com a tag exata [SILENCIO] (e nada mais) — use isso quando a mensagem não exigir resposta (ex.: figurinhas, "ok", reações); ou (2) direcionar educadamente para um atendente humano respondendo apenas com a tag exata [HANDOFF] seguida de uma frase curta como "Vou te encaminhar para um de nossos atendentes que poderá te ajudar melhor com isso. Um momento, por favor." NUNCA chute respostas, NUNCA prometa o que não pode cumprir.',
     'REGRA DE PARADA (ASSUNTO DESCONEXO): Se o cliente falar de OUTRO produto, outro assunto, pedir algo que não faz parte da sua oferta, ou levar a conversa para fora do escopo (dúvidas médicas/técnicas, reclamações, outro pedido, etc.), NÃO responda nada e devolva APENAS a tag exata [PARAR]. Nesse caso o atendimento humano assume. Nunca tente contornar nem repetir a oferta quando o assunto sair do escopo.',
     previousOutbound
       ? `NÃO REPITA MENSAGENS: você já enviou as mensagens abaixo neste chat. Nunca repita o mesmo texto, a mesma oferta ou o mesmo link já enviado. Se não houver algo novo e útil para dizer, responda apenas [SILENCIO].\n${previousOutbound}`
       : 'NÃO REPITA MENSAGENS: nunca envie duas vezes o mesmo texto, a mesma oferta ou o mesmo link.',
   ].join('\n');


  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.map((m: any) => ({ role: m.from_me ? 'assistant' : 'user', content: m.content || '' })),
    { role: 'user', content: aggregatedUserText },
  ];

  const creditCost = 0.10;
  const { data: credit } = await supabase.rpc('consume_ai_credits', {
    p_company_id: conversation.company_id,
    p_agent_id: agent.id,
    p_amount: creditCost,
    p_description: `Agente "${agent.name}" respondeu no WhatsApp`,
  });
  if (credit && !credit.success) {
    console.log('🤖 [AI-AUTO-REPLY] Skipping: insufficient credits', conversation.company_id);
    return;
  }

  console.log(`🤖 [AI-AUTO-REPLY] Asking ai-chat (OpenAI) with model "${agentModel}" for agent ${agent.name}`);
  const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ messages, model: agentModel, temperature }),
  });
  if (!aiResponse.ok) {
    console.error('🤖 [AI-AUTO-REPLY] ai-chat failed:', aiResponse.status, await aiResponse.text());
    return;
  }

   const aiData = await aiResponse.json();
   const rawReply = aiData.response || aiData.message || '';

    // PARAR — assunto desconexo/fora de escopo: agente para de responder e humano assume.
   if (/\[PARAR\]/i.test(rawReply)) {
     console.log('🤖 [AI-AUTO-REPLY] Off-topic detected ([PARAR]). Stopping agent for', conversationId);
     await supabase
       .from('whatsapp_conversations')
       .update({ ai_auto_reply_enabled: false, human_takeover: true })
       .eq('id', conversationId);
     return;
   }

    // Honor SILENCIO tag — agent chose to stay silent
   if (/\[SILENCIO\]/i.test(rawReply)) {
     console.log('🤖 [AI-AUTO-REPLY] Agent chose silence ([SILENCIO]). Skipping reply.');
     return;
   }

    // HANDOFF must go to the CRM autopilot/Pai flow, not as a message to the customer.
    if (/\[HANDOFF\]/i.test(rawReply)) {
      console.log('🤖 [AI-AUTO-REPLY] Agent requested handoff; dispatching CRM autopilot', conversationId);
      await supabase
        .from('whatsapp_conversations')
        .update({ ai_auto_reply_enabled: false, assigned_agent_id: null })
        .eq('id', conversationId);
      await fetch(`${SUPABASE_URL}/functions/v1/crm-autopilot-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ conversationId, incomingMessageId, force: true }),
      }).catch((error) => console.error('🤖 [AI-AUTO-REPLY] Autopilot handoff failed:', error));
      return;
    }
   
   // Parse extracted data [DATA:{"key":"val"}]
   let reply = rawReply;
   let stageToUpdate = null;
   const dataMatch = rawReply.match(/\[DATA:(.*?)\]/);
   if (dataMatch) {
     try {
       const extractedJson = JSON.parse(dataMatch[1]);
       reply = rawReply.replace(dataMatch[0], '').trim();
       
       if (extractedJson.stage) {
         stageToUpdate = extractedJson.stage;
         delete extractedJson.stage;
       }
       
       // Save extracted data
       const { data: existingData } = await supabase
         .from('ai_agent_extracted_data')
         .select('id, extracted_data')
         .eq('agent_id', agent.id)
         .eq('contact_phone', conversation.contact_phone)
         .maybeSingle();
         
       const newData = { ...(existingData?.extracted_data || {}), ...extractedJson };
       
       if (existingData) {
         await supabase
           .from('ai_agent_extracted_data')
           .update({ 
             extracted_data: newData, 
             last_updated_at: new Date().toISOString(),
             conversation_id: conversationId 
           })
           .eq('id', existingData.id);
       } else {
         await supabase
           .from('ai_agent_extracted_data')
           .insert({
             agent_id: agent.id,
             conversation_id: conversationId,
             contact_phone: conversation.contact_phone,
             extracted_data: newData
           });
       }
     } catch (e) {
       console.error('🤖 [AI-AUTO-REPLY] Data extraction error:', e);
     }
   }

    // Update pipeline stage ONLY when the AI explicitly emits a [DATA:{stage}]
    // tag. No deterministic fallback — columns must only change on real AI
    // decisions or manual drag-and-drop.
    if (stageToUpdate && stageToUpdate !== conversation.pipeline_stage) {
      console.log(`🤖 [AI-AUTO-REPLY] AI moved stage for ${conversationId} to ${stageToUpdate} (prev=${conversation.pipeline_stage ?? 'null'})`);
      await supabase
        .from('whatsapp_conversations')
        .update({ pipeline_stage: stageToUpdate })
        .eq('id', conversationId);
    }
 
   reply = cleanReply(reply);
   if (!reply) return;

  // Guarda anti-repetição: não reenviar texto igual/quase igual ao que já mandamos.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9à-ú ]/gi, ' ').replace(/\s+/g, ' ').trim();
  const similarity = (a: string, b: string) => {
    const wa = new Set(norm(a).split(' ').filter(Boolean));
    const wb = new Set(norm(b).split(' ').filter(Boolean));
    if (!wa.size || !wb.size) return 0;
    let inter = 0;
    wa.forEach((w) => { if (wb.has(w)) inter++; });
    return inter / Math.max(wa.size, wb.size);
  };
  const recentOutbound = (hist || [])
    .filter((m: any) => m.from_me && (m.content || '').trim().length > 0)
    .slice(0, 5)
    .map((m: any) => String(m.content));
  if (recentOutbound.some((prev) => similarity(prev, reply) >= 0.8)) {
    console.log('🤖 [AI-AUTO-REPLY] Skipping duplicate/near-duplicate reply for', conversationId);
    return;
  }


  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('id, instance_name, baileys_server_url')
    .eq('id', conversation.session_id)
    .maybeSingle();
  if (!session?.baileys_server_url) return;

  const sendJid = conversation.remote_jid?.includes('@')
    ? conversation.remote_jid
    : `${conversation.contact_phone}@s.whatsapp.net`;
  const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const baileysBase = session.baileys_server_url.replace(/\/+$/, '');

  // Try to send as voice note when configured.
  if (shouldSendAudio) {
    let audioBase64 = '';
    let audioContentType = 'audio/ogg; codecs=opus';

    if (ttsVoice === 'ello' && ELEVENLABS_API_KEY) {
      try {
        const elloResp = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/RGymW84CSmfVugnA5tvA?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: reply.slice(0, 5000), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
          },
        );
        if (elloResp.ok) {
          const buf = new Uint8Array(await elloResp.arrayBuffer());
          let binary = '';
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          audioBase64 = btoa(binary);
          audioContentType = 'audio/mpeg';
        } else {
          console.error('🎙️ [AI-AUTO-REPLY] Ello TTS failed:', elloResp.status);
        }
      } catch (e) { console.error('🎙️ [AI-AUTO-REPLY] Ello TTS error:', e); }
    }

    if (!audioBase64) {
      try {
        const ttsResp = await fetch(`${SUPABASE_URL}/functions/v1/tts-openai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ text: reply, voice: ttsVoice === 'ello' ? 'nova' : ttsVoice, speed: 1.0, format: 'opus' }),
        });
        if (ttsResp.ok) {
          const j = await ttsResp.json();
          audioBase64 = j.audio_base64;
          audioContentType = 'audio/ogg; codecs=opus';
        }
      } catch (e) { console.error('🎙️ [AI-AUTO-REPLY] OpenAI TTS error:', e); }
    }

    if (audioBase64) {
      try {
        const fileName = `ai-audio/${aiMessageId}.${audioContentType.includes('mpeg') ? 'mp3' : 'ogg'}`;
        const binStr = atob(audioBase64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(fileName, bytes, { contentType: audioContentType, upsert: true });
        if (!upErr) {
          const { data: pubUrl } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);
          // Try modern endpoint first, fallback to legacy
          let voiceResp = await fetch(`${baileysBase}/api/message/send-voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName: session.instance_name, jid: sendJid, audioUrl: pubUrl.publicUrl, mimetype: audioContentType }),
          });
          if (!voiceResp.ok) {
            voiceResp = await fetch(`${baileysBase}/message/sendWhatsAppAudio/${session.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('EVOLUTION_API_KEY') || '' },
              body: JSON.stringify({ number: sendJid.replace(/@.*/, ''), audio: pubUrl.publicUrl }),
            });
          }
          if (voiceResp.ok) {
            await supabase.from('whatsapp_messages').insert({
              conversation_id: conversationId,
              session_id: session.id,
              company_id: conversation.company_id,
              wa_message_id: aiMessageId,
              from_me: true,
              content: '[Áudio]',
              message_type: 'ptt',
              media_url: pubUrl.publicUrl,
              status: 'sent',
              is_ai_response: true,
              sender_name: agent.name,
              timestamp: new Date().toISOString(),
            });
            await supabase.from('whatsapp_conversations')
              .update({ last_message: '🎙️ Áudio', last_message_at: new Date().toISOString() })
              .eq('id', conversationId);
            console.log('🎙️ [AI-AUTO-REPLY] sent voice note for', conversationId);
            return;
          } else {
            console.error('🎙️ [AI-AUTO-REPLY] send-voice failed:', voiceResp.status, await voiceResp.text());
          }
        }
      } catch (e) { console.error('🎙️ [AI-AUTO-REPLY] voice send error:', e); }
    }
    // Fall through to text if voice flow failed.
  }

  // Checagem final imediatamente antes do envio: se outra execução já mandou
  // algo parecido enquanto gerávamos a resposta, aborta.
  const { data: freshOut } = await supabase
    .from('whatsapp_messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('from_me', true)
    .order('timestamp', { ascending: false })
    .limit(3);
  if ((freshOut || []).some((m: any) => similarity(String(m.content || ''), reply) >= 0.8)) {
    console.log('🤖 [AI-AUTO-REPLY] Aborting: duplicate detected right before send', conversationId);
    return;
  }


  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    session_id: session.id,
    company_id: conversation.company_id,
    wa_message_id: aiMessageId,
    from_me: true,
    content: reply,
    message_type: 'text',
    status: 'sending',
    is_ai_response: true,
    sender_name: agent.name,
    timestamp: new Date().toISOString(),
  });

  const sendResponse = await fetch(`${baileysBase}/message/sendText/${session.instance_name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('EVOLUTION_API_KEY') || '' },
    body: JSON.stringify({ number: sendJid.replace(/@.*/, ''), text: reply }),
  });

  await supabase.from('whatsapp_messages')
    .update({ status: sendResponse.ok ? 'sent' : 'failed' })
    .eq('wa_message_id', aiMessageId);

  await supabase.from('whatsapp_conversations')
    .update({ last_message: reply.slice(0, 100), last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (!sendResponse.ok) {
    console.error('🤖 [AI-AUTO-REPLY] send failed:', sendResponse.status, await sendResponse.text());
  } else {
    console.log('🤖 [AI-AUTO-REPLY] sent for conversation', conversationId);
  }
  }
}

