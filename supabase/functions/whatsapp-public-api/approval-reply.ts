// Handles a client's WhatsApp reply to a pending post approval created via the public API.
import {
  aiClassify, FOLLOWUP_QUESTION, publicApproval, publishToSocial, quickClassify,
  retryPendingWebhooks, sendWebhook, sendWhatsAppText, type Decision,
} from '../_shared/post-approval.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
export async function handleApprovalReply(supabase: any, body: any, url: string, key: string): Promise<Response> {
  const env = { url, key };
  try {
    if (body.action === 'retry_webhooks') { await retryPendingWebhooks(supabase); return json({ ok: true }); }
    const { conversation_id, content } = body;
    if (!conversation_id || !content) return json({ error: 'conversation_id and content required' }, 400);

    const { data: a } = await supabase.from('post_approvals').select('*')
      .eq('conversation_id', conversation_id).in('status', ['pending', 'awaiting_decision'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!a) return json({ handled: false });

    const text = String(content);
    let decision: Decision = quickClassify(text, a.stage);
    let notes = '';
    if (decision === 'unclear' || text.split(/\s+/).length > 3) {
      const ai = await aiClassify(text, a.stage);
      if (ai.decision !== 'unclear') decision = ai.decision;
      notes = ai.notes;
    }

    const history = Array.isArray(a.history) ? a.history : [];
    history.push({ at: new Date().toISOString(), version: a.version, from: 'client', text, decision });
    const send = (message: string) => sendWhatsAppText(env, { sessionId: a.session_id, companyId: a.company_id, phone: a.contact_phone, conversationId: conversation_id, message });
    const update = async (patch: Record<string, unknown>) => {
      const { data } = await supabase.from('post_approvals').update({ ...patch, history, last_client_reply: text }).eq('id', a.id).select('*').single();
      return data;
    };
    const hook = (event: string, row: any, extra: Record<string, unknown> = {}) =>
      sendWebhook(supabase, { companyId: a.company_id, apiKeyId: a.api_key_id, url: a.webhook_url, event, data: { approval: publicApproval(row), ...extra } });

    if (decision === 'approve' && a.stage === 'awaiting_approval') {
      let row = await update({ status: 'approved', stage: 'done' });
      await send('Perfeito! Post aprovado ✅ Obrigado.');
      await hook('approval.approved', row);
      if (a.auto_publish) {
        const results = await publishToSocial(supabase, { companyId: a.company_id, mediaUrls: a.media_urls || [], caption: a.caption || '', targets: a.publish_targets || [] });
        const ok = results.some((r) => r.success);
        row = await update({ status: ok ? 'published' : 'publish_failed', published_results: results });
        await hook(ok ? 'approval.published' : 'approval.publish_failed', row, { results });
      }
      return json({ handled: true, decision });
    }

    if (decision === 'reject' && a.stage === 'awaiting_approval') {
      const row = await update({ status: 'awaiting_decision', stage: 'awaiting_decision' });
      await send(FOLLOWUP_QUESTION);
      await hook('approval.rejected', row);
      return json({ handled: true, decision });
    }

    if (decision === 'new_version') {
      const row = await update({ status: 'revision_requested', stage: 'awaiting_revision', revision_notes: notes || text });
      await send('Combinado! Vamos preparar uma nova versão e te envio em breve. 🎨');
      await hook('approval.revision_requested', row, { client_feedback: notes || text });
      return json({ handled: true, decision });
    }

    if (decision === 'cancel') {
      const row = await update({ status: 'cancelled', stage: 'done' });
      await send('Tudo certo, o post foi cancelado. Se precisar de algo, é só chamar.');
      await hook('approval.cancelled', row, { cancelled_by: 'client' });
      return json({ handled: true, decision });
    }

    await update({});
    await send(a.stage === 'awaiting_decision' ? FOLLOWUP_QUESTION : 'Desculpe, não entendi. Você aprova o post? Responda *SIM* ou *NÃO*.');
    return json({ handled: true, decision: 'unclear' });
  } catch (e) {
    console.error('[post-approval-handler]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
