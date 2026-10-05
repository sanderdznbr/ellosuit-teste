import { createClient } from "npm:@supabase/supabase-js@2";

const CLOUD_BAILEYS_URL = 'https://baileys-server-novo-production.up.railway.app';

// Validação rigorosa: apenas o domínio canônico é aceito para meeting links
// do produto. Provedores externos conhecidos passam sem modificação.
const ALLOWED_MEETING_URL_PREFIX = 'https://www.ellosuit.app';
const EXTERNAL_MEETING_HOSTS = [
  'https://meet.google.com/',
  'https://zoom.us/',
  'https://us02web.zoom.us/',
  'https://us04web.zoom.us/',
  'https://us05web.zoom.us/',
  'https://us06web.zoom.us/',
  'https://teams.microsoft.com/',
  'https://teams.live.com/',
  'https://whereby.com/',
];
function sanitizeMeetingLink(input: unknown): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(ALLOWED_MEETING_URL_PREFIX + '/')) return trimmed;
  if (EXTERNAL_MEETING_HOSTS.some((h) => trimmed.startsWith(h))) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/meet\/([^/?#]+)/);
    if (match) return `${ALLOWED_MEETING_URL_PREFIX}/meet/${match[1]}`;
  } catch { /* noop */ }
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeContactPhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';

  let normalized = digits;
  if (!normalized.startsWith('55') && normalized.length <= 11) {
    normalized = `55${normalized}`;
  }

  if (normalized.startsWith('55') && normalized.length === 12) {
    normalized = `${normalized.slice(0, 4)}9${normalized.slice(4)}`;
  }

  return normalized;
}

function buildPhoneVariants(normalizedPhone: string): string[] {
  if (!normalizedPhone) return [];

  const variants = new Set<string>([normalizedPhone]);
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 13) {
    variants.add(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
  }
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 12) {
    variants.add(normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4));
  }

  return Array.from(variants);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { 
      event_title, 
      event_date, 
      event_time,
      meeting_link: rawMeetingLink,
      participants,  // Array of { type: 'email' | 'phone', value: string, name?: string }
      company_id,
      event_id       // calendar_events ID for RSVP tracking
    } = body;

    // Sanitiza/valida o link antes de qualquer uso ou envio.
    const meeting_link = sanitizeMeetingLink(rawMeetingLink);
    if (rawMeetingLink && !meeting_link) {
      return new Response(JSON.stringify({
        error: `meeting_link inválido: só é permitido enviar links iniciados por ${ALLOWED_MEETING_URL_PREFIX}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!event_title || !participants || participants.length === 0) {
      return new Response(JSON.stringify({ error: 'event_title e participants são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Meeting Invite] Sending invites for "${event_title}" to ${participants.length} participants`);

    const results: any[] = [];

    // Get company's WhatsApp session for sending messages
    const resolvedCompanyId = company_id || (await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    ).data?.company_id;

    if (!resolvedCompanyId) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find active WhatsApp session for this company
    const { data: whatsappSession } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, baileys_server_url, status')
      .eq('company_id', resolvedCompanyId)
      .eq('status', 'connected')
      .limit(1)
      .single();

    const BAILEYS_URL = CLOUD_BAILEYS_URL;

    // Build invite message with RSVP options
    const inviteMessage = `📅 *Convite de Reunião*\n\n` +
      `*${event_title}*\n` +
      (event_date ? `📆 Data: ${event_date}\n` : '') +
      (event_time ? `🕐 Horário: ${event_time}\n` : '') +
      (meeting_link ? `\n🔗 *Link da reunião:*\n${meeting_link}\n` : '') +
      `\n📋 *Confirme sua presença:*\n` +
      `Responda *Sim* para confirmar\n` +
      `Responda *Não* para recusar\n` +
      `\n_Enviado via Ellosuit_`;

    for (const participant of participants) {
      try {
        if (participant.type === 'phone' || (participant.type === 'user' && !participant.value.includes('@'))) {
          // Send WhatsApp message
          const phone = normalizeContactPhone(participant.value || '');

          if (!phone || phone.length < 8) {
            results.push({ participant: participant.value, status: 'skipped', reason: 'Número inválido' });
            continue;
          }

          const phoneVariants = buildPhoneVariants(phone);

          if (whatsappSession && BAILEYS_URL) {
            const normalizedServerUrl = BAILEYS_URL.replace(/\/+$/, '');

            // Use number check to resolve the real JID (handles LID contacts, 9th digit, etc.)
            let resolvedJid = `${phone}@s.whatsapp.net`;
            try {
              const checkResponse = await fetch(`${normalizedServerUrl}/api/number/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  instanceName: whatsappSession.instance_name,
                  phone: phone,
                })
              });
              if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData.exists && checkData.jid) {
                  resolvedJid = checkData.jid;
                  console.log(`[Meeting Invite] Resolved ${phone} -> ${resolvedJid}`);
                } else {
                  console.log(`[Meeting Invite] Number ${phone} not found on WhatsApp, using default JID`);
                }
              }
            } catch (checkErr) {
              console.error(`[Meeting Invite] Number check failed, using default JID:`, checkErr);
            }

            console.log(`[Meeting Invite] Sending WhatsApp to ${resolvedJid} via ${normalizedServerUrl}`);

            const sendResponse = await fetch(`${normalizedServerUrl}/api/message/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName: whatsappSession.instance_name,
                jid: resolvedJid,
                message: { text: inviteMessage }
              })
            });

            if (sendResponse.ok) {
              // Save message in existing conversation (company-wide + phone variants)
              let { data: conversation } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('company_id', resolvedCompanyId)
                .in('contact_phone', phoneVariants)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!conversation) {
                const { data: newConv } = await supabase
                  .from('whatsapp_conversations')
                  .insert({
                    session_id: whatsappSession.id,
                    company_id: resolvedCompanyId,
                    contact_phone: phone,
                    contact_name: participant.name || phone,
                    remote_jid: resolvedJid,
                    status: 'open',
                    last_message_at: new Date().toISOString()
                  })
                  .select('id')
                  .single();
                conversation = newConv;
              } else {
                await supabase
                  .from('whatsapp_conversations')
                  .update({
                    session_id: whatsappSession.id,
                    contact_phone: phone,
                    remote_jid: resolvedJid,
                    last_message_at: new Date().toISOString(),
                  })
                  .eq('id', conversation.id);
              }

              if (conversation) {
                await supabase
                  .from('whatsapp_messages')
                  .insert({
                    conversation_id: conversation.id,
                    content: inviteMessage,
                    message_type: 'text',
                    from_me: true,
                    status: 'sent',
                    timestamp: new Date().toISOString()
                  });
              }

              // Create RSVP record
              if (event_id) {
                await supabase.from('meeting_rsvp').insert({
                  event_id,
                  company_id: resolvedCompanyId,
                  attendee_phone: phone,
                  attendee_name: participant.name || null,
                  resolved_jid: resolvedJid,
                  status: 'pending',
                });
                console.log(`[Meeting Invite] 📋 RSVP record created for ${phone}`);
              }

              results.push({ participant: participant.value, status: 'sent', channel: 'whatsapp' });
              console.log(`[Meeting Invite] ✅ WhatsApp sent to ${phone}`);
            } else {
              const errorText = await sendResponse.text();
              console.error(`[Meeting Invite] ❌ WhatsApp send failed:`, errorText);
              results.push({ participant: participant.value, status: 'failed', reason: 'Falha no envio WhatsApp', channel: 'whatsapp' });
            }
          } else {
            console.log(`[Meeting Invite] No active WhatsApp session for company ${resolvedCompanyId}`);
            results.push({ participant: participant.value, status: 'skipped', reason: 'WhatsApp não conectado' });
          }

        } else if (participant.type === 'email' || (participant.type === 'user' && participant.value.includes('@'))) {
          // Send email invite
          console.log(`[Meeting Invite] Sending email invite to ${participant.value}`);
          
          // Use existing send-system-email edge function
          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              to: participant.value,
              subject: `📅 Convite: ${event_title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #3600FF;">📅 Convite de Reunião</h2>
                  <h3>${event_title}</h3>
                  ${event_date ? `<p><strong>Data:</strong> ${event_date}</p>` : ''}
                  ${event_time ? `<p><strong>Horário:</strong> ${event_time}</p>` : ''}
                  ${meeting_link ? `<p><a href="${meeting_link}" style="background: #3600FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 16px;">Entrar na Reunião</a></p>` : ''}
                  <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
                  <p style="color: #999; font-size: 12px;">Enviado via Ellosuit</p>
                </div>
              `
            })
          });

          if (emailResponse.ok) {
            results.push({ participant: participant.value, status: 'sent', channel: 'email' });
            console.log(`[Meeting Invite] ✅ Email sent to ${participant.value}`);
          } else {
            const errorText = await emailResponse.text();
            console.error(`[Meeting Invite] ❌ Email send failed:`, errorText);
            results.push({ participant: participant.value, status: 'failed', reason: 'Falha no envio do email', channel: 'email' });
          }
        }
      } catch (err) {
        console.error(`[Meeting Invite] Error sending to ${participant.value}:`, err);
        results.push({ participant: participant.value, status: 'failed', reason: String(err) });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    console.log(`[Meeting Invite] Done: ${sentCount}/${participants.length} sent successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      sent: sentCount,
      total: participants.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[Meeting Invite] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
