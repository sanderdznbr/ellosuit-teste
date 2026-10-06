// Shared logic for the public "post approval" flow (API -> WhatsApp client -> webhook back).
// deno-lint-ignore-file no-explicit-any

import { OPENAI_FALLBACK_MODEL, assistantText, chatCompletion } from './llm.ts';

export type Decision = 'approve' | 'reject' | 'new_version' | 'cancel' | 'unclear';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function normalizePhone(p: string): string {
  return String(p || '').replace(/\D/g, '');
}

export function phoneVariants(p: string): string[] {
  const c = normalizePhone(p);
  const out = new Set<string>([c, `+${c}`]);
  if (c.startsWith('55') && c.length === 13) {
    const w = c.slice(0, 4) + c.slice(5);
    out.add(w); out.add(`+${w}`);
  } else if (c.startsWith('55') && c.length === 12) {
    const w = c.slice(0, 4) + '9' + c.slice(4);
    out.add(w); out.add(`+${w}`);
  }
  return [...out];
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sends a signed webhook and records the delivery. Retries are handled by `retryPendingWebhooks`. */
export async function sendWebhook(supabase: any, opts: {
  companyId: string; apiKeyId?: string | null; url?: string | null; event: string; data: Record<string, unknown>;
}) {
  let url = opts.url || null;
  let secret = '';
  if (opts.apiKeyId) {
    const { data: key } = await supabase.from('whatsapp_api_keys').select('webhook_url, webhook_secret').eq('id', opts.apiKeyId).maybeSingle();
    url = url || key?.webhook_url || null;
    secret = key?.webhook_secret || '';
  }
  if (!url) return { skipped: true };
  const payload = { event: opts.event, created_at: new Date().toISOString(), data: opts.data };
  const { data: row } = await supabase.from('api_webhook_deliveries').insert({
    company_id: opts.companyId, api_key_id: opts.apiKeyId || null, event: opts.event, url, payload,
  }).select('id').single();
  return await attemptDelivery(supabase, { id: row?.id, url, payload, secret, attempts: 0 });
}

export async function attemptDelivery(supabase: any, d: { id: string; url: string; payload: any; secret: string; attempts: number }) {
  const body = JSON.stringify(d.payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Ellosuit-Webhooks/1.0', 'X-Ellosuit-Event': d.payload.event };
  if (d.secret) headers['X-Ellosuit-Signature'] = `sha256=${await hmacHex(d.secret, body)}`;
  let status = 0; let text = '';
  try {
    const res = await fetch(d.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    status = res.status; text = (await res.text()).slice(0, 500);
  } catch (e) { text = String(e).slice(0, 500); }
  const ok = status >= 200 && status < 300;
  const attempts = d.attempts + 1;
  const backoffMin = [1, 5, 15, 60, 240][Math.min(attempts - 1, 4)];
  if (d.id) {
    await supabase.from('api_webhook_deliveries').update({
      status: ok ? 'delivered' : attempts >= 6 ? 'failed' : 'pending',
      attempts, response_status: status || null, response_body: text,
      next_attempt_at: ok ? null : new Date(Date.now() + backoffMin * 60000).toISOString(),
    }).eq('id', d.id);
  }
  return { delivered: ok, status };
}

export async function retryPendingWebhooks(supabase: any, companyId?: string) {
  let q = supabase.from('api_webhook_deliveries').select('id, url, payload, attempts, api_key_id')
    .eq('status', 'pending').gt('attempts', 0).lte('next_attempt_at', new Date().toISOString()).limit(20);
  if (companyId) q = q.eq('company_id', companyId);
  const { data } = await q;
  for (const d of data || []) {
    let secret = '';
    if (d.api_key_id) {
      const { data: k } = await supabase.from('whatsapp_api_keys').select('webhook_secret').eq('id', d.api_key_id).maybeSingle();
      secret = k?.webhook_secret || '';
    }
    await attemptDelivery(supabase, { ...d, secret });
  }
}

function invokeFn(supabaseUrl: string, serviceKey: string, name: string, body: unknown) {
  return fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));
}

/** Sends text through the internal WhatsApp sender as an automated (non-human) message. */
export async function sendWhatsAppText(env: { url: string; key: string }, a: { sessionId: string; companyId: string; phone: string; conversationId?: string | null; message: string }) {
  const r = await invokeFn(env.url, env.key, 'whatsapp-api', {
    action: 'send_message', sessionId: a.sessionId, companyId: a.companyId, phone: a.phone,
    message: a.message, conversationId: a.conversationId || undefined, aiEnabled: true, manualTakeover: false,
  });
  if (!r.ok || r.data?.error) throw new Error(String(r.data?.error || 'Falha ao enviar mensagem'));
  return r.data;
}

export async function sendWhatsAppMedia(env: { url: string; key: string }, a: { sessionId: string; companyId: string; phone: string; conversationId?: string | null; mediaUrl: string; caption?: string }) {
  const lower = a.mediaUrl.toLowerCase().split('?')[0];
  const mediaType = /\.(mp4|mov|webm)$/.test(lower) ? 'video' : /\.(pdf|docx?|xlsx?)$/.test(lower) ? 'document' : 'image';
  const r = await invokeFn(env.url, env.key, 'whatsapp-api', {
    action: 'send_media', sessionId: a.sessionId, companyId: a.companyId, phone: a.phone,
    mediaUrl: a.mediaUrl, mediaType, caption: a.caption || '', conversationId: a.conversationId || undefined,
    aiEnabled: true, manualTakeover: false,
  });
  if (!r.ok || r.data?.error) throw new Error(String(r.data?.error || 'Falha ao enviar mídia'));
  return r.data;
}

export const DEFAULT_QUESTION = 'Olá! Segue o post para sua aprovação. 👆\n\nVocê aprova esta versão?\nResponda *SIM* para aprovar ou *NÃO* para recusar.';
export const FOLLOWUP_QUESTION = 'Entendido. Você prefere:\n\n*1* - Receber uma *nova versão*\n*2* - *Cancelar* este post\n\nSe quiser, já me diga o que gostaria de mudar.';

/** Sends every media + caption + approval question to the client. */
export async function sendApprovalToClient(env: { url: string; key: string }, supabase: any, approval: any) {
  const media: string[] = Array.isArray(approval.media_urls) ? approval.media_urls : [];
  for (let i = 0; i < media.length; i++) {
    const isLast = i === media.length - 1;
    await sendWhatsAppMedia(env, {
      sessionId: approval.session_id, companyId: approval.company_id, phone: approval.contact_phone,
      conversationId: approval.conversation_id, mediaUrl: media[i], caption: isLast ? (approval.caption || '') : '',
    });
  }
  if (!media.length && approval.caption) {
    await sendWhatsAppText(env, { sessionId: approval.session_id, companyId: approval.company_id, phone: approval.contact_phone, conversationId: approval.conversation_id, message: approval.caption });
  }
  const versionTag = approval.version > 1 ? ` (versão ${approval.version})` : '';
  const q = (approval.question || DEFAULT_QUESTION) + versionTag;
  await sendWhatsAppText(env, { sessionId: approval.session_id, companyId: approval.company_id, phone: approval.contact_phone, conversationId: approval.conversation_id, message: q });
  await linkConversation(supabase, approval);
}

/** Finds the client's conversation and marks it as API-managed so chatbot/AI don't answer. */
export async function linkConversation(supabase: any, approval: any) {
  const { data: conv } = await supabase.from('whatsapp_conversations').select('id')
    .eq('company_id', approval.company_id).in('contact_phone', phoneVariants(approval.contact_phone))
    .order('last_message_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (conv?.id) {
    await supabase.from('whatsapp_conversations').update({ api_managed: true }).eq('id', conv.id);
    if (conv.id !== approval.conversation_id) {
      await supabase.from('post_approvals').update({ conversation_id: conv.id }).eq('id', approval.id);
      approval.conversation_id = conv.id;
    }
  }
  return conv?.id || null;
}

export function quickClassify(text: string, stage: string): Decision {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (stage === 'awaiting_decision') {
    if (/^\s*2\b/.test(t) || /\bcancel/.test(t) || /\bdesist/.test(t) || /\bnao quero mais\b/.test(t)) return 'cancel';
    if (/^\s*1\b/.test(t) || /nova versao|outra versao|refaz|refazer|mudar|alter|troca|ajust/.test(t)) return 'new_version';
    return 'unclear';
  }
  if (/^(sim|s|ok|aprovado|aprovo|pode postar|pode publicar|perfeito|top|show|👍|✅)\b/.test(t) || /\baprov(o|ado|ei)\b/.test(t)) return 'approve';
  if (/^(nao|n|reprovado|recuso)\b/.test(t) || /\bnao (gostei|aprovo|curti)\b/.test(t)) return 'reject';
  return 'unclear';
}

/**
 * AI fallback for free-text replies.
 *
 * Antes usava o /v1/responses do gateway Lovable com streaming SSE; o streaming
 * so era exigido pelo gateway. Com a API da OpenAI basta um chat completion com
 * saida em JSON, entao a leitura de SSE saiu daqui.
 */
export async function aiClassify(text: string, stage: string): Promise<{ decision: Decision; notes: string }> {
  if (!Deno.env.get('OPENAI_API_KEY')) return { decision: 'unclear', notes: '' };
  const options = stage === 'awaiting_decision' ? 'new_version | cancel | unclear' : 'approve | reject | new_version | unclear';
  const prompt = `Um cliente recebeu um post de rede social para aprovar. Classifique a resposta dele.\nOpções: ${options}.\n- approve: aprovou.\n- reject: recusou sem dizer o que fazer.\n- new_version: quer outra versão/mudança (extraia o que mudar).\n- cancel: quer cancelar.\nResponda SOMENTE JSON: {"decision":"...","notes":"o que o cliente pediu para mudar, ou vazio"}\n\nResposta do cliente: """${text.slice(0, 1500)}"""`;
  try {
    const res = await chatCompletion({
      model: OPENAI_FALLBACK_MODEL,
      messages: [
        { role: 'system', content: 'Voce classifica a resposta de um cliente sobre um post de rede social. Responda SOMENTE JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });
    if (!res.ok) { console.warn('[post-approval] AI status', res.status); return { decision: 'unclear', notes: '' }; }
    const out = await assistantText(res);
    const m = out.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : {};
    const d = ['approve', 'reject', 'new_version', 'cancel'].includes(j.decision) ? j.decision : 'unclear';
    return { decision: d, notes: String(j.notes || '') };
  } catch (e) {
    console.warn('[post-approval] AI classify failed', e);
    return { decision: 'unclear', notes: '' };
  }
}

/** Publishes the approval's media to Instagram and/or Facebook using stored social connections. */
export async function publishToSocial(supabase: any, a: { companyId: string; mediaUrls: string[]; caption: string; targets: Array<{ platform: string; connection_id?: string }> }) {
  const results: any[] = [];
  let targets = a.targets || [];
  if (!targets.length) {
    const { data } = await supabase.from('social_connections').select('id, platform').eq('company_id', a.companyId).eq('is_active', true);
    targets = (data || []).map((c: any) => ({ platform: c.platform, connection_id: c.id }));
  }
  for (const t of targets) {
    try {
      let q = supabase.from('social_connections').select('*').eq('company_id', a.companyId).eq('is_active', true).eq('platform', t.platform);
      if (t.connection_id) q = q.eq('id', t.connection_id);
      const { data: conn } = await q.limit(1).maybeSingle();
      if (!conn) throw new Error(`Nenhuma conta ${t.platform} conectada`);
      const postId = t.platform === 'instagram'
        ? await publishInstagram(conn, a.mediaUrls, a.caption)
        : await publishFacebook(conn, a.mediaUrls, a.caption);
      results.push({ platform: t.platform, connection_id: conn.id, success: true, post_id: postId });
    } catch (e) {
      results.push({ platform: t.platform, connection_id: t.connection_id || null, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

async function gpost(url: string, body: Record<string, unknown>) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

async function publishInstagram(conn: any, urls: string[], caption: string): Promise<string> {
  const ig = conn.instagram_account_id; const token = conn.page_access_token;
  if (!ig) throw new Error('Conta do Instagram não vinculada');
  if (!urls.length) throw new Error('Instagram exige pelo menos uma imagem');
  let creationId: string;
  if (urls.length > 1) {
    const children: string[] = [];
    for (const u of urls) children.push((await gpost(`${GRAPH}/${ig}/media`, { image_url: u, is_carousel_item: true, access_token: token })).id);
    creationId = (await gpost(`${GRAPH}/${ig}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: token })).id;
  } else {
    creationId = (await gpost(`${GRAPH}/${ig}/media`, { image_url: urls[0], caption, access_token: token })).id;
  }
  return (await gpost(`${GRAPH}/${ig}/media_publish`, { creation_id: creationId, access_token: token })).id;
}

async function publishFacebook(conn: any, urls: string[], caption: string): Promise<string> {
  const page = conn.page_id; const token = conn.page_access_token;
  if (!urls.length) return (await gpost(`${GRAPH}/${page}/feed`, { message: caption, access_token: token })).id;
  if (urls.length === 1) return (await gpost(`${GRAPH}/${page}/photos`, { url: urls[0], message: caption, access_token: token })).id;
  const ids: string[] = [];
  for (const u of urls) ids.push((await gpost(`${GRAPH}/${page}/photos`, { url: u, published: false, access_token: token })).id);
  return (await gpost(`${GRAPH}/${page}/feed`, { message: caption, attached_media: ids.map((id) => ({ media_fbid: id })), access_token: token })).id;
}

export function publicApproval(a: any) {
  return {
    id: a.id, external_id: a.external_id, status: a.status, stage: a.stage, version: a.version,
    contact_phone: a.contact_phone, contact_name: a.contact_name, media_urls: a.media_urls, caption: a.caption,
    last_client_reply: a.last_client_reply, revision_notes: a.revision_notes, auto_publish: a.auto_publish,
    publish_targets: a.publish_targets, published_results: a.published_results, history: a.history,
    metadata: a.metadata, expires_at: a.expires_at, created_at: a.created_at, updated_at: a.updated_at,
  };
}
