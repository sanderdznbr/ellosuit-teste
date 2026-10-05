import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

type Classification = 'interested' | 'not_interested' | 'unclear';

async function classify(content: string, offer: string): Promise<Classification> {
  const normalized = (content || '').toLowerCase();
  const quickYes = /\b(sim|quero|tenho interesse|interessado|interessada|manda|envia|pode mandar|claro|bora|vamos|me passa|link)\b/.test(normalized);
  const quickNo = /\b(n[aã]o|nao quero|sem interesse|para de|pare|descadastr|remove|remover|nunca mais)\b/.test(normalized);

  if (!LOVABLE_API_KEY) return quickYes && !quickNo ? 'interested' : quickNo ? 'not_interested' : 'unclear';

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite',
        messages: [
          {
            role: 'system',
            content:
              'Você classifica respostas de clientes em português do Brasil. Oferta enviada: ' +
              (offer || 'não informada') +
              '. Responda SOMENTE com uma destas palavras: interested, not_interested, unclear. ' +
              '"interested" quando a pessoa demonstra interesse, curiosidade, pede mais informações ou pede o link. ' +
              '"not_interested" quando recusa, pede para não receber mais, ou reclama. ' +
              '"unclear" quando a resposta é ambígua, uma pergunta não relacionada, ou apenas uma saudação.',
          },
          { role: 'user', content: content?.slice(0, 1500) || '' },
        ],
      }),
    });

    if (res.status === 402 || res.status === 403) {
      console.error('[DISPATCH-QUALIFIER] AI bloqueada:', res.status, await res.text());
      return quickYes && !quickNo ? 'interested' : quickNo ? 'not_interested' : 'unclear';
    }
    if (!res.ok) {
      console.error('[DISPATCH-QUALIFIER] AI erro:', res.status, await res.text());
      return quickYes && !quickNo ? 'interested' : quickNo ? 'not_interested' : 'unclear';
    }

    const data = await res.json();
    const raw = (data?.choices?.[0]?.message?.content || '').toLowerCase();
    if (raw.includes('not_interested')) return 'not_interested';
    if (raw.includes('interested')) return 'interested';
    return 'unclear';
  } catch (err) {
    console.error('[DISPATCH-QUALIFIER] AI exception:', err);
    return quickYes && !quickNo ? 'interested' : quickNo ? 'not_interested' : 'unclear';
  }
}

function applyVars(template: string, vars: Record<string, string>): string {
  return (template || '').replace(/\{\{?\s*(\w+)\s*\}?\}/g, (m, key) => vars[key] ?? m);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { conversation_id, content } = await req.json();
    if (!conversation_id) throw new Error('conversation_id is required');

    const { data: watch } = await supabase
      .from('dispatch_reply_watch')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('status', 'waiting')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!watch) {
      return new Response(JSON.stringify({ handled: false, reason: 'no_watch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: campaign } = await supabase
      .from('dispatch_campaigns')
      .select('*')
      .eq('id', watch.campaign_id)
      .maybeSingle();

    if (!campaign?.reply_ai_enabled) {
      await supabase.from('dispatch_reply_watch')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', watch.id);
      return new Response(JSON.stringify({ handled: false, reason: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const classification = await classify(content || '', campaign.reply_ai_offer || campaign.message_template || '');

    const vars = {
      nome: watch.contact_name || '',
      link: campaign.reply_ai_link || '',
    };

    let message = '';
    if (classification === 'interested') {
      const base = campaign.reply_ai_interested_message
        || 'Perfeito{{nome_virgula}}! Segue o link com todos os detalhes: {{link}}';
      message = applyVars(base.replace('{{nome_virgula}}', vars.nome ? `, ${vars.nome}` : ''), vars);
      if (campaign.reply_ai_link && !message.includes(campaign.reply_ai_link)) {
        message = `${message}\n\n${campaign.reply_ai_link}`;
      }
    } else if (classification === 'not_interested') {
      message = applyVars(
        campaign.reply_ai_not_interested_message
          || 'Tudo bem, agradeço o retorno! Qualquer coisa estou por aqui. 🙌',
        vars,
      );
    } else {
      // Resposta ambígua: mantém em observação para a próxima mensagem
      await supabase.from('dispatch_reply_watch')
        .update({ classification, replied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', watch.id);
      return new Response(JSON.stringify({ handled: false, classification }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: sendData, error: sendError } = await supabase.functions.invoke('whatsapp-api', {
      body: {
        action: 'send_message',
        sessionId: campaign.session_id,
        companyId: campaign.company_id,
        phone: watch.phone,
        message,
        conversationId: conversation_id,
        // Mantém a IA ativa e marca o envio como automático (Chatbot),
        // para NÃO aplicar a tag "Humano" nem parar as automações.
        aiEnabled: true,
        manualTakeover: false,
      },
    });

    if (sendError || sendData?.error) {
      const detail = sendError?.message || sendData?.error;
      await supabase.from('dispatch_reply_watch')
        .update({ status: 'error', classification, updated_at: new Date().toISOString() })
        .eq('id', watch.id);
      throw new Error(String(detail));
    }

    await supabase.from('dispatch_reply_watch')
      .update({
        status: 'answered',
        classification,
        replied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', watch.id);

    return new Response(JSON.stringify({ handled: true, classification }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[DISPATCH-QUALIFIER] error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
