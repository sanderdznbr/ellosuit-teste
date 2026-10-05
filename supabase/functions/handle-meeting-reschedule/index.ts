import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { action, reschedule_request_id, event_id } = body;

    // Action: organizer confirms or denies a reschedule proposal
    if (action === 'respond') {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: AI interprets a free-text reschedule response from participant
    if (action === 'interpret') {
      const { message, attendee_phone, rsvp_id, event_id: evId, company_id, session_id, conversation_id, remote_jid } = body;
      
      // Get event details
      const { data: eventInfo } = await supabase
        .from('calendar_events')
        .select('title, start_date, end_date, created_by, company_id')
        .eq('id', evId)
        .single();

      if (!eventInfo) {
        return new Response(JSON.stringify({ error: 'Event not found' }), { 
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Use AI to interpret the message
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date().getDay()];
      const aiPrompt = `Você é um assistente que interpreta respostas de participantes sobre remarcação de reuniões.

O participante recusou a reunião "${eventInfo.title}" que estava agendada para ${eventInfo.start_date}.
Hoje é ${dayOfWeek}, ${today}.

O participante respondeu: "${message}"

REGRAS IMPORTANTES:
1. Determine se quer REMARCAR ou CANCELAR.
2. Se quer remarcar, extraia a data e o HORÁRIO EXATO mencionado na mensagem.
3. O HORÁRIO deve ser EXATAMENTE o que o participante escreveu. Se disse "10h", use 10:00. Se disse "14h", use 14:00. Se disse "15h", use 15:00. Se disse "15:30", use 15:30. NUNCA invente ou altere o horário.
4. Para dias da semana (ex: "terça"), calcule a próxima ocorrência a partir de hoje.
5. IMPORTANTE: O horário é no fuso horário de Brasília (America/Sao_Paulo, UTC-3). Retorne a data/hora NO FORMATO COM OFFSET: "YYYY-MM-DDTHH:MM:SS-03:00".

Responda APENAS com JSON válido:
{"type": "reschedule" ou "cancel", "suggested_date": "YYYY-MM-DDTHH:MM:SS-03:00" ou null, "interpretation": "breve explicação em português"}

ATENÇÃO: O horário no suggested_date DEVE ser idêntico ao mencionado pelo participante no fuso de Brasília. Exemplo: se disse "15h", suggested_date deve ser "YYYY-MM-DDT15:00:00-03:00". NUNCA converta para UTC.`;

      let aiResult = { type: 'cancel', suggested_date: null as string | null, interpretation: 'Não foi possível interpretar a resposta' };

      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'user', content: aiPrompt }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiResult = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiErr) {
          console.error('[RESCHEDULE] AI interpretation error:', aiErr);
        }
      }

      // Create reschedule request record
      const { data: rescheduleReq } = await supabase
        .from('meeting_reschedule_requests')
        .insert({
          event_id: evId,
          rsvp_id,
          company_id,
          attendee_phone,
          attendee_name: null, // will be filled from rsvp
          request_type: aiResult.type,
          suggested_text: message,
          ai_interpreted_date: aiResult.suggested_date,
          ai_interpretation: aiResult.interpretation,
          status: aiResult.type === 'cancel' ? 'cancelled' : 'reschedule_proposed',
        })
        .select()
        .single();

      // Get attendee name from RSVP
      const { data: rsvpData } = await supabase
        .from('meeting_rsvp')
        .select('attendee_name, attendee_phone')
        .eq('id', rsvp_id)
        .single();

      if (rsvpData?.attendee_name && rescheduleReq) {
        await supabase
          .from('meeting_reschedule_requests')
          .update({ attendee_name: rsvpData.attendee_name })
          .eq('id', rescheduleReq.id);
      }

      const displayName = rsvpData?.attendee_name || attendee_phone;

      // Send WhatsApp acknowledgment to participant
      if (session_id) {
        const { data: sess } = await supabase
          .from('whatsapp_sessions')
          .select('baileys_server_url, instance_name')
          .eq('id', session_id)
          .single();

        if (sess?.baileys_server_url) {
          const replyJid = remote_jid.includes('@') ? remote_jid : `${remote_jid}@s.whatsapp.net`;
          let ackMsg = '';
          
          if (aiResult.type === 'reschedule') {
            const dateStr = aiResult.suggested_date 
              ? new Date(aiResult.suggested_date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'a data sugerida';
            ackMsg = `📅 *Solicitação de remarcação recebida!*\n\nEntendemos que você gostaria de remarcar para *${dateStr}*.\n\nO organizador será notificado e você receberá a confirmação em breve.`;
          } else {
            ackMsg = `📋 *Cancelamento registrado*\n\nRegistramos que você não deseja participar da reunião *"${eventInfo.title}"*.\n\nO organizador será notificado.`;
          }

          await fetch(`${sess.baileys_server_url}/api/message/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName: sess.instance_name, jid: replyJid, message: { text: ackMsg } }),
          });

          // Save ack as message
          if (conversation_id) {
            await supabase.from('whatsapp_messages').insert({
              session_id,
              conversation_id,
              company_id,
              content: ackMsg,
              from_me: true,
              message_type: 'text',
              status: 'sent',
              sender_name: 'Sistema',
            });
          }
        }
      }

      // Notify organizer
      if (aiResult.type === 'reschedule') {
        const dateStr = aiResult.suggested_date
          ? new Date(aiResult.suggested_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'data não especificada';
        
        await supabase.from('notifications').insert({
          user_id: eventInfo.created_by,
          company_id: eventInfo.company_id,
          title: '📅 Solicitação de remarcação',
          message: `${displayName} quer remarcar "${eventInfo.title}" para ${dateStr}`,
          type: 'action',
          category: 'calendar',
          icon: 'Calendar',
          action_url: '/dashboard/agenda',
          metadata: { 
            event_id: evId, 
            reschedule_request_id: rescheduleReq?.id,
            type: 'reschedule_request' 
          },
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: eventInfo.created_by,
          company_id: eventInfo.company_id,
          title: '❌ Participante cancelou',
          message: `${displayName} decidiu cancelar a participação em "${eventInfo.title}"`,
          type: 'warning',
          category: 'calendar',
          icon: 'Calendar',
          action_url: '/dashboard/agenda',
          metadata: { 
            event_id: evId, 
            reschedule_request_id: rescheduleReq?.id,
            type: 'cancel_request' 
          },
        });
      }

      return new Response(JSON.stringify({ ok: true, result: aiResult, reschedule_request: rescheduleReq }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: organizer confirms reschedule - update event and notify participant
    if (action === 'confirm_reschedule') {
      const { data: request } = await supabase
        .from('meeting_reschedule_requests')
        .select('*, calendar_events:event_id(title, start_date, end_date, created_by)')
        .eq('id', reschedule_request_id)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update request status
      await supabase
        .from('meeting_reschedule_requests')
        .update({ status: 'confirmed', organizer_response: 'confirmed', responded_at: new Date().toISOString() })
        .eq('id', reschedule_request_id);

      // Update RSVP back to pending (since event is being rescheduled)
      await supabase
        .from('meeting_rsvp')
        .update({ status: 'pending', responded_at: null })
        .eq('id', request.rsvp_id);

      // If there's a suggested date, update the event
      if (request.ai_interpreted_date) {
        const originalEvent = request.calendar_events as any;
        const originalDuration = new Date(originalEvent.end_date).getTime() - new Date(originalEvent.start_date).getTime();
        const newStart = new Date(request.ai_interpreted_date);
        const newEnd = new Date(newStart.getTime() + originalDuration);

        await supabase
          .from('calendar_events')
          .update({ 
            start_date: newStart.toISOString(), 
            end_date: newEnd.toISOString() 
          })
          .eq('id', request.event_id);
      }

      // Notify participant via WhatsApp
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, baileys_server_url, instance_name')
        .eq('company_id', request.company_id)
        .eq('status', 'connected')
        .limit(1);

      if (sessions?.[0]?.baileys_server_url) {
        const sess = sessions[0];
        const phone = request.attendee_phone.replace(/\D/g, '');
        const jid = `${phone}@s.whatsapp.net`;
        const dateStr = request.ai_interpreted_date
          ? new Date(request.ai_interpreted_date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'nova data';

        const msg = `📅 *Reunião remarcada!*\n\nA reunião *"${(request.calendar_events as any)?.title}"* foi remarcada para *${dateStr}*.\n\nVocê confirma sua presença no novo horário?\n\nResponda *Sim* para confirmar ou *Não* para recusar.`;

        await fetch(`${sess.baileys_server_url}/api/message/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: sess.instance_name, jid, message: { text: msg } }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: organizer denies reschedule
    if (action === 'deny_reschedule') {
      const { data: request } = await supabase
        .from('meeting_reschedule_requests')
        .select('*, calendar_events:event_id(title)')
        .eq('id', reschedule_request_id)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase
        .from('meeting_reschedule_requests')
        .update({ status: 'denied', organizer_response: 'denied', responded_at: new Date().toISOString() })
        .eq('id', reschedule_request_id);

      // Notify participant
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, baileys_server_url, instance_name')
        .eq('company_id', request.company_id)
        .eq('status', 'connected')
        .limit(1);

      if (sessions?.[0]?.baileys_server_url) {
        const sess = sessions[0];
        const phone = request.attendee_phone.replace(/\D/g, '');
        const jid = `${phone}@s.whatsapp.net`;
        const msg = `❌ *Remarcação não aprovada*\n\nO organizador da reunião *"${(request.calendar_events as any)?.title}"* não pôde aprovar a remarcação.\n\nEntre em contato para mais informações.`;

        await fetch(`${sess.baileys_server_url}/api/message/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: sess.instance_name, jid, message: { text: msg } }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[handle-meeting-reschedule] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
