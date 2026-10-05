import { createClient } from "npm:@supabase/supabase-js@2";

// Validação rigorosa do domínio para meeting links enviados aos participantes.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      change_type,     // 'rescheduled' | 'completed' | 'cancelled' | 'confirmation_request'
      event_title,
      event_date,
      event_time,
      new_date,
      new_time,
      meeting_link: rawMeetingLink,
      attendees,
      company_id,
      custom_message,  // optional: override the WhatsApp message
      event_id,        // optional: calendar_events ID for RSVP tracking
    } = body;

    const meeting_link = sanitizeMeetingLink(rawMeetingLink);
    if (rawMeetingLink && !meeting_link) {
      return new Response(JSON.stringify({
        error: `meeting_link inválido: só é permitido enviar links iniciados por ${ALLOWED_MEETING_URL_PREFIX}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!change_type || !event_title || !attendees || attendees.length === 0) {
      return new Response(JSON.stringify({ error: 'change_type, event_title e attendees são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Event Change] ${change_type} - "${event_title}" to ${attendees.length} attendees`);

    // Fetch meeting_code if event_id is provided
    let meetingCode = '';
    if (event_id) {
      const { data: eventRow } = await supabase
        .from('calendar_events')
        .select('meeting_code')
        .eq('id', event_id)
        .single();
      meetingCode = eventRow?.meeting_code || '';
    }

    // Build message based on change type
    let whatsappMessage = '';
    let emailSubject = '';
    let emailBody = '';

    switch (change_type) {
      case 'rescheduled':
        whatsappMessage = `📅 *Reunião Reagendada*\n\n` +
          `*${event_title}*\n\n` +
          `A reunião foi reagendada:\n` +
          (event_date ? `📆 De: ${event_date}${event_time ? ` às ${event_time}` : ''}\n` : '') +
          (new_date ? `📆 Para: ${new_date}${new_time ? ` às ${new_time}` : ''}\n` : '') +
          (meeting_link ? `\n🔗 *Link:* ${meeting_link}\n` : '') +
          `\n_Enviado via Ellosuit_`;
        emailSubject = `📅 Reunião reagendada: ${event_title}`;
        emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3600FF;">📅 Reunião Reagendada</h2>
            <h3>${event_title}</h3>
            <p>A reunião foi reagendada:</p>
            ${event_date ? `<p><strong>De:</strong> ${event_date}${event_time ? ` às ${event_time}` : ''}</p>` : ''}
            ${new_date ? `<p><strong>Para:</strong> ${new_date}${new_time ? ` às ${new_time}` : ''}</p>` : ''}
            ${meeting_link ? `<p><a href="${meeting_link}" style="background: #3600FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 16px;">Entrar na Reunião</a></p>` : ''}
            <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">Enviado via Ellosuit</p>
          </div>`;
        break;

      case 'completed':
        whatsappMessage = `✅ *Reunião Concluída*\n\n` +
          `*${event_title}*\n` +
          (event_date ? `📆 Data: ${event_date}\n` : '') +
          `\nA reunião foi marcada como concluída.\n` +
          `\n_Enviado via Ellosuit_`;
        emailSubject = `✅ Reunião concluída: ${event_title}`;
        emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #22c55e;">✅ Reunião Concluída</h2>
            <h3>${event_title}</h3>
            ${event_date ? `<p><strong>Data:</strong> ${event_date}</p>` : ''}
            <p>A reunião foi marcada como concluída.</p>
            <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">Enviado via Ellosuit</p>
          </div>`;
        break;

      case 'cancelled':
        whatsappMessage = `❌ *Reunião Cancelada*\n\n` +
          `*${event_title}*\n` +
          (event_date ? `📆 Data: ${event_date}\n` : '') +
          `\nA reunião foi cancelada.\n` +
          `\n_Enviado via Ellosuit_`;
        emailSubject = `❌ Reunião cancelada: ${event_title}`;
        emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">❌ Reunião Cancelada</h2>
            <h3>${event_title}</h3>
            ${event_date ? `<p><strong>Data:</strong> ${event_date}</p>` : ''}
            <p>A reunião foi cancelada.</p>
            <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">Enviado via Ellosuit</p>
          </div>`;
        break;

      case 'confirmation_request':
        whatsappMessage = custom_message || `📋 *Solicitação de Confirmação*\n\n` +
          (meetingCode ? `🆔 Código: *${meetingCode}*\n` : '') +
          `🎯 *${event_title}*\n` +
          `${event_date ? `📆 ${event_date}` : ''}${event_time ? ` às ${event_time}` : ''}\n` +
          (meeting_link ? `🔗 ${meeting_link}\n` : '') +
          `\nResponda *Sim* para confirmar ou *Não* para recusar.\n\n_Enviado via Ellosuit_`;
        emailSubject = `📋 Confirme sua presença: ${event_title}`;
        emailBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #3600FF;">📋 Confirme sua Presença</h2>${meetingCode ? `<p><strong>Código:</strong> ${meetingCode}</p>` : ''}<h3>${event_title}</h3>${event_date ? `<p><strong>Data:</strong> ${event_date}</p>` : ''}${event_time ? `<p><strong>Horário:</strong> ${event_time}</p>` : ''}<p>Por favor, confirme sua participação respondendo a este convite.</p><hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" /><p style="color: #999; font-size: 12px;">Enviado via Ellosuit</p></div>`;
        break;

      default:
        return new Response(JSON.stringify({ error: 'change_type inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Get company WhatsApp session
    const resolvedCompanyId = company_id || (await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    ).data?.company_id;

    const { data: whatsappSession } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, baileys_server_url, status')
      .eq('company_id', resolvedCompanyId)
      .eq('status', 'connected')
      .limit(1)
      .single();

    const BAILEYS_URL = 'https://baileys-server-novo-production.up.railway.app';
    const results: any[] = [];

    for (const attendee of attendees) {
      const isEmail = attendee.includes('@');

      if (isEmail) {
        // Send email
        try {
          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ to: attendee, subject: emailSubject, html: emailBody })
          });
          results.push({ attendee, status: emailResponse.ok ? 'sent' : 'failed', channel: 'email' });
        } catch (err) {
          results.push({ attendee, status: 'failed', channel: 'email', reason: String(err) });
        }
      } else {
        // Send WhatsApp
        let phone = attendee.replace(/\D/g, '');
        if (!phone || phone.length < 8) {
          results.push({ attendee, status: 'skipped', reason: 'Número inválido' });
          continue;
        }
        if (!phone.startsWith('55') && phone.length <= 11) {
          phone = '55' + phone;
        }

        if (whatsappSession && BAILEYS_URL) {
          const normalizedServerUrl = BAILEYS_URL.replace(/\/+$/, '');

          // Resolve real JID via number check
          let resolvedJid = `${phone}@s.whatsapp.net`;
          try {
            const checkResponse = await fetch(`${normalizedServerUrl}/api/number/check`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instanceName: whatsappSession.instance_name, phone })
            });
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              if (checkData.exists && checkData.jid) {
                resolvedJid = checkData.jid;
                console.log(`[Event Change] Resolved ${phone} -> ${resolvedJid}`);
              }
            }
          } catch (e) {
            console.error(`[Event Change] Number check failed:`, e);
          }

          try {
            const sendResponse = await fetch(`${normalizedServerUrl}/api/message/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName: whatsappSession.instance_name,
                jid: resolvedJid,
                message: { text: whatsappMessage }
              })
            });
            results.push({ attendee, status: sendResponse.ok ? 'sent' : 'failed', channel: 'whatsapp' });
            if (sendResponse.ok) {
              console.log(`[Event Change] ✅ WhatsApp sent to ${resolvedJid}`);
              
              // Create/update RSVP record for confirmation requests
              if (change_type === 'confirmation_request' && event_id) {
                // Upsert RSVP record
                const { data: existingRsvp } = await supabase
                  .from('meeting_rsvp')
                  .select('id')
                  .eq('event_id', event_id)
                  .eq('attendee_phone', phone)
                  .limit(1)
                  .single();
                
                if (existingRsvp) {
                  await supabase.from('meeting_rsvp')
                    .update({ status: 'pending', responded_at: null, resolved_jid: resolvedJid })
                    .eq('id', existingRsvp.id);
                } else {
                  await supabase.from('meeting_rsvp').insert({
                    event_id,
                    company_id: resolvedCompanyId,
                    attendee_phone: phone,
                    resolved_jid: resolvedJid,
                    status: 'pending',
                  });
                }
                console.log(`[Event Change] 📋 RSVP record upserted for ${phone}`);
              }
            }
          } catch (err) {
            results.push({ attendee, status: 'failed', channel: 'whatsapp', reason: String(err) });
          }
        } else {
          results.push({ attendee, status: 'skipped', reason: 'WhatsApp não conectado' });
        }
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    console.log(`[Event Change] Done: ${sentCount}/${attendees.length} notifications sent`);

    return new Response(JSON.stringify({ success: true, results, sent: sentCount, total: attendees.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[Event Change] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
