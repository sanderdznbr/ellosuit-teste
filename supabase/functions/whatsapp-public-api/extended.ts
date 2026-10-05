// Extended public API actions: chatbots, AI agents, post approvals and social publishing.
// deno-lint-ignore-file no-explicit-any
import {
  linkConversation, normalizePhone, publicApproval, publishToSocial, sendApprovalToClient, sendWebhook,
} from '../_shared/post-approval.ts';

export const EXTENDED_ACTIONS = [
  'list_chatbots', 'get_chatbot', 'create_chatbot', 'update_chatbot', 'activate_chatbot', 'deactivate_chatbot', 'delete_chatbot',
  'list_agents', 'get_agent', 'create_agent', 'update_agent', 'toggle_agent', 'delete_agent', 'assign_agent_to_conversation',
  'create_approval', 'submit_revision', 'get_approval', 'list_approvals', 'cancel_approval', 'publish_approval',
  'list_social_accounts', 'publish_post', 'test_webhook',
  'create_lead',
];

class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const need = (cond: unknown, msg: string) => { if (!cond) throw new ApiError(400, msg); };
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

async function ownerUserId(supabase: any, companyId: string): Promise<string> {
  const { data } = await supabase.from('company_users').select('user_id, role').eq('company_id', companyId).order('created_at', { ascending: true }).limit(10);
  const admin = (data || []).find((u: any) => u.role === 'admin' || u.role === 'adminmaster') || (data || [])[0];
  if (!admin) throw new ApiError(500, 'Nenhum usuário encontrado na empresa');
  return admin.user_id;
}

export async function handleExtendedAction(supabase: any, keyData: any, body: any, env: { url: string; key: string }) {
  const companyId = keyData.company_id;
  const action = body.action;
  try {
    switch (action) {
      // ===================== CHATBOTS =====================
      case 'list_chatbots': {
        const { data, error } = await supabase.from('chatbot_flows')
          .select('id, name, description, is_active, execution_count, trigger_config, created_at, updated_at')
          .eq('company_id', companyId).order('updated_at', { ascending: false });
        if (error) throw error;
        return { success: true, chatbots: data };
      }
      case 'get_chatbot': {
        need(body.chatbot_id, 'chatbot_id is required');
        const { data } = await supabase.from('chatbot_flows').select('*').eq('company_id', companyId).eq('id', body.chatbot_id).maybeSingle();
        if (!data) throw new ApiError(404, 'Chatbot not found');
        return { success: true, chatbot: data };
      }
      case 'create_chatbot': {
        need(body.name, 'name is required');
        need(!body.nodes || Array.isArray(body.nodes), 'nodes must be an array');
        need(!body.edges || Array.isArray(body.edges), 'edges must be an array');
        const created_by = await ownerUserId(supabase, companyId);
        const trigger_config = body.trigger_config || { type: 'whatsapp_channel', sessionId: keyData.session_id };
        const { data, error } = await supabase.from('chatbot_flows').insert({
          company_id: companyId, created_by, name: String(body.name).slice(0, 200), description: body.description || null,
          nodes: body.nodes || [], edges: body.edges || [], trigger_config, settings: body.settings || {}, is_active: !!body.is_active,
        }).select('*').single();
        if (error) throw error;
        return { success: true, chatbot: data };
      }
      case 'update_chatbot': {
        need(body.chatbot_id, 'chatbot_id is required');
        const patch = pick(body, ['name', 'description', 'nodes', 'edges', 'trigger_config', 'settings', 'is_active']);
        const { data, error } = await supabase.from('chatbot_flows').update(patch).eq('company_id', companyId).eq('id', body.chatbot_id).select('*').maybeSingle();
        if (error) throw error;
        if (!data) throw new ApiError(404, 'Chatbot not found');
        return { success: true, chatbot: data };
      }
      case 'activate_chatbot':
      case 'deactivate_chatbot': {
        need(body.chatbot_id, 'chatbot_id is required');
        const { data } = await supabase.from('chatbot_flows').update({ is_active: action === 'activate_chatbot' })
          .eq('company_id', companyId).eq('id', body.chatbot_id).select('id, name, is_active').maybeSingle();
        if (!data) throw new ApiError(404, 'Chatbot not found');
        return { success: true, chatbot: data };
      }
      case 'delete_chatbot': {
        need(body.chatbot_id, 'chatbot_id is required');
        const { error } = await supabase.from('chatbot_flows').delete().eq('company_id', companyId).eq('id', body.chatbot_id);
        if (error) throw error;
        return { success: true, deleted: body.chatbot_id };
      }

      // ===================== AI AGENTS =====================
      case 'list_agents': {
        const { data, error } = await supabase.from('ai_agents')
          .select('id, name, description, personality, model, is_active, whatsapp_enabled, whatsapp_session_id, created_at, updated_at')
          .eq('company_id', companyId).order('updated_at', { ascending: false });
        if (error) throw error;
        return { success: true, agents: data };
      }
      case 'get_agent': {
        need(body.agent_id, 'agent_id is required');
        const { data } = await supabase.from('ai_agents').select('*').eq('company_id', companyId).eq('id', body.agent_id).maybeSingle();
        if (!data) throw new ApiError(404, 'Agent not found');
        return { success: true, agent: data };
      }
      case 'create_agent': {
        need(body.name, 'name is required');
        need(body.instructions, 'instructions is required');
        const created_by = await ownerUserId(supabase, companyId);
        const { data, error } = await supabase.from('ai_agents').insert({
          company_id: companyId, created_by, name: String(body.name).slice(0, 200), description: body.description || null,
          personality: body.personality || 'profissional e cordial', instructions: String(body.instructions),
          model: body.model || null, avatar_url: body.avatar_url || null, settings: body.settings || {},
          is_active: body.is_active !== false, whatsapp_enabled: !!body.whatsapp_enabled,
          whatsapp_session_id: body.whatsapp_enabled ? (body.whatsapp_session_id || keyData.session_id) : null,
        }).select('*').single();
        if (error) throw error;
        return { success: true, agent: data };
      }
      case 'update_agent': {
        need(body.agent_id, 'agent_id is required');
        const patch = pick(body, ['name', 'description', 'personality', 'instructions', 'model', 'avatar_url', 'settings', 'is_active', 'whatsapp_enabled', 'whatsapp_session_id']);
        const { data, error } = await supabase.from('ai_agents').update(patch).eq('company_id', companyId).eq('id', body.agent_id).select('*').maybeSingle();
        if (error) throw error;
        if (!data) throw new ApiError(404, 'Agent not found');
        return { success: true, agent: data };
      }
      case 'toggle_agent': {
        need(body.agent_id, 'agent_id is required');
        need(typeof body.is_active === 'boolean', 'is_active (boolean) is required');
        const { data } = await supabase.from('ai_agents').update({ is_active: body.is_active }).eq('company_id', companyId).eq('id', body.agent_id).select('id, name, is_active').maybeSingle();
        if (!data) throw new ApiError(404, 'Agent not found');
        return { success: true, agent: data };
      }
      case 'delete_agent': {
        need(body.agent_id, 'agent_id is required');
        const { error } = await supabase.from('ai_agents').delete().eq('company_id', companyId).eq('id', body.agent_id);
        if (error) throw error;
        return { success: true, deleted: body.agent_id };
      }
      case 'assign_agent_to_conversation': {
        need(body.phone, 'phone is required');
        const { data: agent } = body.agent_id
          ? await supabase.from('ai_agents').select('id').eq('company_id', companyId).eq('id', body.agent_id).maybeSingle()
          : { data: null };
        if (body.agent_id && !agent) throw new ApiError(404, 'Agent not found');
        const { phoneVariants } = await import('../_shared/post-approval.ts');
        const { data, error } = await supabase.from('whatsapp_conversations')
          .update({ ai_agent_id: body.agent_id || null, ai_auto_reply_enabled: !!body.agent_id, api_managed: false, human_takeover: false })
          .eq('company_id', companyId).in('contact_phone', phoneVariants(body.phone)).select('id, contact_phone, ai_agent_id');
        if (error) throw error;
        if (!data?.length) throw new ApiError(404, 'Conversation not found for this phone. Send a message first.');
        return { success: true, conversations: data };
      }

      // ===================== POST APPROVALS =====================
      case 'create_approval': {
        need(body.phone, 'phone is required');
        const media = body.media_urls ?? (body.media_url ? [body.media_url] : []);
        need(Array.isArray(media) && media.every((u: unknown) => typeof u === 'string' && /^https?:\/\//.test(u as string)), 'media_urls must be an array of public https URLs');
        need(media.length || body.caption, 'media_urls or caption is required');
        need(media.length <= 10, 'max 10 media per approval');
        const session = keyData.whatsapp_sessions;
        if (session?.status !== 'connected') throw new ApiError(503, 'WhatsApp session is not connected');
        const phone = normalizePhone(body.phone);
        if (body.external_id) {
          await supabase.from('post_approvals').update({ status: 'superseded', stage: 'done' })
            .eq('company_id', companyId).eq('external_id', body.external_id).in('status', ['pending', 'awaiting_decision', 'revision_requested']);
        }
        // Only one open approval per phone: older ones are superseded
        await supabase.from('post_approvals').update({ status: 'superseded', stage: 'done' })
          .eq('company_id', companyId).eq('contact_phone', phone).in('status', ['pending', 'awaiting_decision']);
        const { data: row, error } = await supabase.from('post_approvals').insert({
          company_id: companyId, api_key_id: keyData.id, session_id: keyData.session_id, contact_phone: phone,
          contact_name: body.contact_name || null, external_id: body.external_id || null, media_urls: media,
          caption: body.caption || '', question: body.question || null, webhook_url: body.webhook_url || null,
          auto_publish: !!body.auto_publish, publish_targets: normalizeTargets(body.publish_to),
          metadata: body.metadata || {},
          expires_at: new Date(Date.now() + (Number(body.expires_in_hours) || 168) * 3600000).toISOString(),
          history: [{ at: new Date().toISOString(), version: 1, from: 'api', text: 'created' }],
        }).select('*').single();
        if (error) throw error;
        await linkConversation(supabase, row);
        try {
          await sendApprovalToClient(env, supabase, row);
        } catch (e) {
          await supabase.from('post_approvals').update({ status: 'failed', stage: 'done' }).eq('id', row.id);
          throw new ApiError(502, `Failed to send to WhatsApp: ${e instanceof Error ? e.message : e}`);
        }
        await linkConversation(supabase, row);
        await sendWebhook(supabase, { companyId, apiKeyId: keyData.id, url: row.webhook_url, event: 'approval.sent', data: { approval: publicApproval(row) } });
        return { success: true, approval: publicApproval(row) };
      }
      case 'submit_revision': {
        const row = await findApproval(supabase, companyId, body);
        need(['revision_requested', 'awaiting_decision', 'pending'].includes(row.status), `Cannot revise an approval with status "${row.status}"`);
        const media = body.media_urls ?? (body.media_url ? [body.media_url] : row.media_urls);
        need(Array.isArray(media), 'media_urls must be an array');
        const history = [...(row.history || []), { at: new Date().toISOString(), version: row.version + 1, from: 'api', text: 'revision submitted' }];
        const { data: updated } = await supabase.from('post_approvals').update({
          media_urls: media, caption: body.caption ?? row.caption, version: row.version + 1,
          status: 'pending', stage: 'awaiting_approval', history, revision_notes: null,
          expires_at: new Date(Date.now() + (Number(body.expires_in_hours) || 168) * 3600000).toISOString(),
        }).eq('id', row.id).select('*').single();
        await sendApprovalToClient(env, supabase, updated);
        await sendWebhook(supabase, { companyId, apiKeyId: keyData.id, url: updated.webhook_url, event: 'approval.sent', data: { approval: publicApproval(updated) } });
        return { success: true, approval: publicApproval(updated) };
      }
      case 'get_approval': {
        const row = await findApproval(supabase, companyId, body);
        return { success: true, approval: publicApproval(row) };
      }
      case 'list_approvals': {
        let q = supabase.from('post_approvals').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(Math.min(Number(body.limit) || 50, 200));
        if (body.status) q = q.eq('status', body.status);
        if (body.phone) q = q.eq('contact_phone', normalizePhone(body.phone));
        const { data, error } = await q;
        if (error) throw error;
        return { success: true, approvals: (data || []).map(publicApproval) };
      }
      case 'cancel_approval': {
        const row = await findApproval(supabase, companyId, body);
        const { data } = await supabase.from('post_approvals').update({ status: 'cancelled', stage: 'done' }).eq('id', row.id).select('*').single();
        if (body.notify_client && row.session_id) {
          const { sendWhatsAppText } = await import('../_shared/post-approval.ts');
          await sendWhatsAppText(env, { sessionId: row.session_id, companyId, phone: row.contact_phone, conversationId: row.conversation_id, message: body.message || 'Este pedido de aprovação foi cancelado.' }).catch(() => {});
        }
        await sendWebhook(supabase, { companyId, apiKeyId: keyData.id, url: row.webhook_url, event: 'approval.cancelled', data: { approval: publicApproval(data), cancelled_by: 'api' } });
        return { success: true, approval: publicApproval(data) };
      }
      case 'publish_approval': {
        const row = await findApproval(supabase, companyId, body);
        need(['approved', 'publish_failed'].includes(row.status), 'Only approved posts can be published');
        const targets = body.publish_to ? normalizeTargets(body.publish_to) : row.publish_targets;
        const results = await publishToSocial(supabase, { companyId, mediaUrls: row.media_urls || [], caption: body.caption ?? row.caption ?? '', targets });
        const ok = results.some((r) => r.success);
        const { data } = await supabase.from('post_approvals').update({ status: ok ? 'published' : 'publish_failed', published_results: results }).eq('id', row.id).select('*').single();
        await sendWebhook(supabase, { companyId, apiKeyId: keyData.id, url: row.webhook_url, event: ok ? 'approval.published' : 'approval.publish_failed', data: { approval: publicApproval(data), results } });
        return { success: ok, approval: publicApproval(data), results };
      }

      // ===================== SOCIAL =====================
      case 'list_social_accounts': {
        const { data, error } = await supabase.from('social_connections')
          .select('id, platform, page_name, instagram_username, is_active, token_expires_at')
          .eq('company_id', companyId).eq('is_active', true);
        if (error) throw error;
        return { success: true, accounts: data };
      }
      case 'publish_post': {
        const media = body.media_urls ?? (body.media_url ? [body.media_url] : []);
        need(Array.isArray(media), 'media_urls must be an array');
        need(body.publish_to, 'publish_to is required (e.g. ["instagram","facebook"])');
        const results = await publishToSocial(supabase, { companyId, mediaUrls: media, caption: body.caption || '', targets: normalizeTargets(body.publish_to) });
        return { success: results.some((r) => r.success), results };
      }

      case 'test_webhook': {
        const r = await sendWebhook(supabase, { companyId, apiKeyId: keyData.id, url: body.webhook_url || null, event: 'webhook.test', data: { message: 'Ellosuit webhook test' } });
        if ((r as any).skipped) throw new ApiError(400, 'No webhook_url configured for this API key');
        return { success: (r as any).delivered, ...r };
      }

      // ===================== FUNIL DE VENDAS =====================
      // Recebe leads externos (formulários, anúncios, sistemas) e cria a conversa
      // direto na etapa do funil/kanban do CRM.
      case 'create_lead': {
        need(body.phone, 'phone is required');
        const phone = normalizePhone(String(body.phone));
        need(phone.replace(/\D/g, '').length >= 8, 'phone inválido');
        const stage = body.stage ? String(body.stage).slice(0, 100) : null;
        const now = new Date().toISOString();
        const { data, error } = await supabase.from('whatsapp_conversations').insert({
          company_id: companyId,
          session_id: keyData.session_id ?? null,
          contact_phone: phone,
          contact_name: body.name ? String(body.name).slice(0, 200) : null,
          pipeline_stage: stage,
          last_message: body.source
            ? `Lead capturado via ${String(body.source).slice(0, 80)}`
            : 'Lead capturado via webhook',
          last_message_at: now,
          status: 'open',
          unread_count: 0,
        }).select('id, contact_name, contact_phone, pipeline_stage').single();
        if (error) throw error;
        return { success: true, lead: data };
      }
    }
    return null;
  } catch (e: any) {
    if (e instanceof ApiError) return { __status: e.status, error: e.message };
    console.error('[public-api extended]', action, e);
    return { __status: 500, error: e?.message || String(e) };
  }
}

function normalizeTargets(v: any): Array<{ platform: string; connection_id?: string }> {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((t: any) => typeof t === 'string' ? { platform: t } : { platform: t.platform, connection_id: t.connection_id })
    .filter((t: any) => t.platform === 'instagram' || t.platform === 'facebook');
}

async function findApproval(supabase: any, companyId: string, body: any) {
  need(body.approval_id || body.external_id, 'approval_id or external_id is required');
  let q = supabase.from('post_approvals').select('*').eq('company_id', companyId);
  q = body.approval_id ? q.eq('id', body.approval_id) : q.eq('external_id', body.external_id).order('created_at', { ascending: false }).limit(1);
  const { data } = await q.maybeSingle();
  if (!data) throw new ApiError(404, 'Approval not found');
  return data;
}
