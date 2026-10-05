import { createClient } from "npm:@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();
    console.log('⏰ Checking routines at:', now);

    // === SEND REMINDERS ===
    await sendEventReminders(supabase);
    await sendTaskReminders(supabase);
    await sendBirthdayReminders(supabase);
    await sendRsvpReminders(supabase);

    // === EXISTING ROUTINE LOGIC ===
    await executeRoutines(supabase, now);

    return new Response(JSON.stringify({ success: true, timestamp: now }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 Error:', error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ==================== EVENT REMINDERS ====================
async function sendEventReminders(supabase: any) {
  try {
    const nowDate = new Date();
    const windows = [
      { minutes: 5, label: '5 minutos' },
      { minutes: 15, label: '15 minutos' },
      { minutes: 60, label: '1 hora' },
    ];

    for (const w of windows) {
      const from = new Date(nowDate.getTime() + (w.minutes - 1) * 60 * 1000).toISOString();
      const to = new Date(nowDate.getTime() + (w.minutes + 1) * 60 * 1000).toISOString();

      const { data: events } = await supabase
        .from('calendar_events')
        .select('id, title, start_date, created_by, company_id, meeting_link, assigned_user_id, event_type, attendees')
        .gte('start_date', from)
        .lte('start_date', to)
        .neq('status', 'cancelled');

      if (!events || events.length === 0) continue;
      console.log(`⏰ Found ${events.length} events starting in ~${w.label}`);

      for (const evt of events) {
        // Notify creator
        await sendReminderIfNew(supabase, {
          userId: evt.created_by,
          companyId: evt.company_id,
          eventId: evt.id,
          minutes: w.minutes,
          title: `⏰ Evento em ${w.label}!`,
          message: buildEventMessage(evt, w.label),
          meetingLink: evt.meeting_link,
          notificationType: 'event_upcoming',
        });

        // Notify assigned user if different
        if (evt.assigned_user_id && evt.assigned_user_id !== evt.created_by) {
          await sendReminderIfNew(supabase, {
            userId: evt.assigned_user_id,
            companyId: evt.company_id,
            eventId: evt.id,
            minutes: w.minutes,
            title: `⏰ Evento em ${w.label}!`,
            message: buildEventMessage(evt, w.label),
            meetingLink: evt.meeting_link,
            notificationType: 'event_upcoming',
          });
        }

        // Notify external attendees via WhatsApp directly
        await sendAttendeesWhatsAppReminder(supabase, evt, w);
      }
    }
  } catch (err) {
    console.error('⚠️ Error in event reminders:', err);
  }
}

async function sendAttendeesWhatsAppReminder(supabase: any, evt: any, w: { minutes: number; label: string }) {
  try {
    // Parse attendees - can be array of strings (phones/emails) or objects
    let attendeeList: string[] = [];
    if (Array.isArray(evt.attendees)) {
      for (const a of evt.attendees) {
        if (typeof a === 'string') {
          attendeeList.push(a);
        } else if (a?.phone) {
          attendeeList.push(a.phone);
        } else if (a?.value) {
          attendeeList.push(a.value);
        }
      }
    }

    // Filter to phone numbers only (not emails)
    const phoneAttendees = attendeeList
      .filter(a => !a.includes('@'))
      .map(p => p.replace(/\D/g, ''))
      .filter(p => p.length >= 8);

    if (phoneAttendees.length === 0) return;

    // Dedup: check if we already sent this reminder interval to these attendees
    const dedupKey = `evt_reminder_${evt.id}_${w.minutes}`;
    const { data: existingDedups } = await supabase
      .from('meeting_reschedule_requests')
      .select('attendee_phone')
      .eq('event_id', evt.id)
      .eq('status', dedupKey);

    const alreadySent = new Set((existingDedups || []).map((d: any) => d.attendee_phone));
    const toSend = phoneAttendees.filter(p => !alreadySent.has(p));

    if (toSend.length === 0) return;

    // Get YCloud session for the company
    const { data: ySession } = await supabase
      .from('ycloud_sessions')
      .select('id, phone_number, ycloud_api_key')
      .eq('company_id', evt.company_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!ySession?.ycloud_api_key) {
      console.log(`⏰ [Attendee] No YCloud session for company ${evt.company_id}, skipping attendee reminders`);
      return;
    }

    // Build reminder message
    let reminderMsg = `⏰ *Lembrete de Reunião*\n\n` +
      `*${evt.title}*\n` +
      `📆 Começa em ${w.label}!\n`;

    if (evt.meeting_link) {
      reminderMsg += `\n🔗 *Link:* ${evt.meeting_link}\n`;
    }

    // Extract location from description
    const descLines = (evt.description || '').split('\n');
    const locLine = descLines.find((l: string) => l.includes('📍 Local:'));
    if (locLine) {
      reminderMsg += `\n📍 *Local:* ${locLine.replace('📍 Local:', '').trim()}\n`;
    }

    reminderMsg += `\n_Enviado via Ellosuit_`;

    const formattedFrom = ySession.phone_number.startsWith('+') ? ySession.phone_number : `+${ySession.phone_number.replace(/\D/g, '')}`;

    for (const phone of toSend) {
      const normalizedPhone = (!phone.startsWith('55') && phone.length <= 11) ? '55' + phone : phone;
      try {
        const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
          method: 'POST',
          headers: { 'X-API-Key': ySession.ycloud_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: formattedFrom, to: `+${normalizedPhone}`, type: 'text', text: { body: reminderMsg } }),
        });

        if (sendRes.ok) {
          // Track in ycloud_messages if conversation exists
          const sendData = await sendRes.json();
          const { data: yConv } = await supabase
            .from('ycloud_conversations')
            .select('id')
            .eq('session_id', ySession.id)
            .or(`contact_phone.eq.+${normalizedPhone},contact_phone.eq.${normalizedPhone}`)
            .limit(1)
            .maybeSingle();

          if (yConv) {
            await supabase.from('ycloud_messages').insert({
              conversation_id: yConv.id,
              company_id: evt.company_id,
              ycloud_message_id: sendData?.id || `reminder-${Date.now()}`,
              wamid: sendData?.wamid || null,
              from_me: true,
              content: reminderMsg,
              message_type: 'text',
              status: 'sent',
            });
            await supabase.from('ycloud_conversations')
              .update({ last_message: reminderMsg.substring(0, 100), last_message_at: new Date().toISOString() })
              .eq('id', yConv.id);
          }

          // Mark as sent for dedup
          await supabase.from('meeting_reschedule_requests').insert({
            event_id: evt.id,
            attendee_phone: phone,
            status: dedupKey,
            company_id: evt.company_id,
          }).catch(() => {});

          console.log(`⏰ [Attendee] ${w.label} reminder sent to +${normalizedPhone} for "${evt.title}"`);
        } else {
          const errText = await sendRes.text();
          console.error(`⏰ [Attendee] Failed to send to +${normalizedPhone}:`, errText);
        }
      } catch (e) {
        console.error(`⏰ [Attendee] Error sending to ${phone}:`, e);
      }
    }
  } catch (err) {
    console.error('⏰ [Attendee] Error in attendee reminders:', err);
  }
}

function buildEventMessage(evt: any, timeLabel: string): string {
  let msg = `"${evt.title}" começa em ${timeLabel}`;
  if (evt.meeting_link) {
    msg += `\n\n🔗 Link da reunião: ${evt.meeting_link}`;
  }
  return msg;
}

async function sendReminderIfNew(supabase: any, opts: {
  userId: string;
  companyId: string;
  eventId: string;
  minutes: number;
  title: string;
  message: string;
  meetingLink?: string;
  notificationType: string;
}) {
  // Dedup check
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', opts.userId)
    .contains('metadata', {
      event_id: opts.eventId,
      notification_type: opts.notificationType,
      minutes_until: opts.minutes,
    })
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`⏭️ Skipping duplicate for event ${opts.eventId} (${opts.minutes}min, user ${opts.userId.slice(0, 8)})`);
    return;
  }

  await supabase.functions.invoke('send-user-notification', {
    body: {
      user_id: opts.userId,
      company_id: opts.companyId,
      title: opts.title,
      message: opts.message,
      notification_type: opts.notificationType,
      category: 'calendar',
      icon: 'Clock',
      action_url: opts.meetingLink || '/dashboard/agenda',
      metadata: {
        event_id: opts.eventId,
        minutes_until: opts.minutes,
        meeting_link: opts.meetingLink || null,
      },
    },
  }).catch((e: any) => console.error('Notify error:', e));
}

// ==================== TASK REMINDERS ====================
async function sendTaskReminders(supabase: any) {
  try {
    const nowDate = new Date();
    const taskFrom = nowDate.toISOString();
    const taskTo = new Date(nowDate.getTime() + 31 * 60 * 1000).toISOString();

    const { data: dueTasks } = await supabase
      .from('calendar_events')
      .select('id, title, start_date, created_by, company_id, assigned_user_id')
      .in('event_type', ['task', 'reminder'])
      .eq('status', 'pending')
      .gte('start_date', taskFrom)
      .lte('start_date', taskTo);

    if (!dueTasks || dueTasks.length === 0) return;
    console.log(`✅ Found ${dueTasks.length} tasks due soon`);

    for (const task of dueTasks) {
      const targetUser = task.assigned_user_id || task.created_by;

      await sendReminderIfNew(supabase, {
        userId: targetUser,
        companyId: task.company_id,
        eventId: task.id,
        minutes: 0,
        title: '✅⏰ Tarefa prestes a vencer',
        message: `"${task.title}" deve ser realizada agora`,
        notificationType: 'task_due',
      });

      // Also notify creator if assigned to someone else
      if (task.assigned_user_id && task.assigned_user_id !== task.created_by) {
        await sendReminderIfNew(supabase, {
          userId: task.created_by,
          companyId: task.company_id,
          eventId: task.id,
          minutes: 0,
          title: '✅⏰ Tarefa do colaborador prestes a vencer',
          message: `A tarefa "${task.title}" atribuída ao colaborador está prestes a vencer`,
          notificationType: 'task_due',
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Error in task reminders:', err);
  }
}

// ==================== BIRTHDAY REMINDERS ====================
async function sendBirthdayReminders(supabase: any) {
  try {
    const now = new Date();
    // Run only once per day around 8-9 AM BRT (11-12 UTC)
    const utcHour = now.getUTCHours();
    if (utcHour < 11 || utcHour > 12) return;

    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const birthdayPattern = `%-${todayMonth}-${todayDay}%`;

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, birth_date, company_id, created_by')
      .not('birth_date', 'is', null)
      .like('birth_date', birthdayPattern);

    if (!clients || clients.length === 0) return;
    console.log(`🎂 Found ${clients.length} client birthdays today`);

    for (const client of clients) {
      await sendReminderIfNew(supabase, {
        userId: client.created_by,
        companyId: client.company_id,
        eventId: `birthday-${client.id}-${todayMonth}${todayDay}`,
        minutes: 0,
        title: '🎂 Aniversário de cliente!',
        message: `Hoje é aniversário de ${client.name}! Que tal enviar uma mensagem de parabéns?`,
        notificationType: 'birthday_reminder',
      });
    }
  } catch (err) {
    console.error('⚠️ Error in birthday reminders:', err);
  }
}

// ==================== ROUTINE EXECUTION ====================
async function executeRoutines(supabase: any, now: string) {
  // Fix active routines missing next_run_at
  const { data: missingNextRun } = await supabase
    .from('task_routines')
    .select('*')
    .eq('is_active', true)
    .is('next_run_at', null);

  if (missingNextRun && missingNextRun.length > 0) {
    console.log(`🔧 Fixing ${missingNextRun.length} routine(s) missing next_run_at`);
    for (const r of missingNextRun) {
      const nextRun = calculateNextRun(r);
      await supabase.from('task_routines').update({ next_run_at: nextRun }).eq('id', r.id);
    }
  }

  const { data: dueRoutines, error: fetchError } = await supabase
    .from('task_routines')
    .select('*')
    .eq('is_active', true)
    .not('next_run_at', 'is', null)
    .lte('next_run_at', now);

  if (fetchError) {
    console.error('❌ Error fetching routines:', fetchError);
    throw fetchError;
  }

  if (!dueRoutines || dueRoutines.length === 0) {
    console.log('✅ No routines due');
    return;
  }

  console.log(`🔄 Found ${dueRoutines.length} due routine(s)`);

  for (const routine of dueRoutines) {
    try {
      let flowData: { nodes: any[]; edges: any[] } | null = null;
      try {
        flowData = routine.description ? JSON.parse(routine.description) : null;
      } catch {
        console.error(`❌ Invalid flow data for routine ${routine.id}`);
        continue;
      }

      if (!flowData?.nodes || !flowData?.edges) continue;

      const actionNodes = flowData.nodes.filter((n: any) => n.type === 'action');

      for (const actionNode of actionNodes) {
        const config = actionNode.data?.config || {};
        const subType = actionNode.subType;

        if (subType === 'create_task' || subType === 'add_to_calendar') {
          const taskTitle = config.taskTitle || config.title || routine.title;
          const nowDate = new Date();
          const endDate = new Date(nowDate);
          endDate.setMinutes(endDate.getMinutes() + (config.duration || 30));

          const eventData: any = {
            title: taskTitle,
            description: config.description || `Criado automaticamente pelo hábito: ${routine.title}`,
            start_date: nowDate.toISOString(),
            end_date: endDate.toISOString(),
            event_type: 'reminder',
            company_id: routine.company_id,
            created_by: routine.created_by,
            color: routine.color || '#3000E3',
            status: 'pending',
            source: 'habit',
          };

          if (routine.assigned_user_id) {
            eventData.assigned_user_id = routine.assigned_user_id;
          }

          const { error: insertError } = await supabase.from('calendar_events').insert(eventData);
          if (insertError) {
            console.error(`❌ Error creating event for routine ${routine.id}:`, insertError);
          } else {
            console.log(`✅ Created event "${taskTitle}" for routine "${routine.title}"`);
          }
        }
      }

      const nextRun = calculateNextRun(routine);
      await supabase.from('task_routines').update({
        last_run_at: now,
        next_run_at: nextRun,
      }).eq('id', routine.id);

      console.log(`📅 Next run for "${routine.title}": ${nextRun}`);
    } catch (routineError) {
      console.error(`❌ Error executing routine ${routine.id}:`, routineError);
    }
  }
}

function calculateNextRun(routine: any): string {
  const now = new Date();
  const timeParts = (routine.time_of_day || '09:00:00').split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);

  if (routine.frequency === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
  }

  if (routine.frequency === 'weekly') {
    const daysOfWeek: number[] = routine.days_of_week || [1];
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);
      candidate.setHours(hours, minutes, 0, 0);
      if (daysOfWeek.includes(candidate.getDay())) {
        return candidate.toISOString();
      }
    }
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
  }

  if (routine.frequency === 'monthly') {
    const dayOfMonth = routine.day_of_month || 1;
    const next = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes, 0);
    return next.toISOString();
  }

  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

// ==================== RSVP REMINDERS (1h, 30min, 2min before event) ====================
const YCLOUD_BASE = 'https://api.ycloud.com/v2';

async function sendRsvpReminders(supabase: any) {
  try {
    const now = new Date();
    
    // Reminder intervals in minutes
    const intervals = [60, 30, 15, 5, 2];
    
    // Find RSVPs that are NOT declined
    const { data: activeRsvps } = await supabase
      .from('meeting_rsvp')
      .select('id, event_id, company_id, attendee_phone, attendee_name, resolved_jid, status, reminder_sent_at')
      .in('status', ['pending', 'confirmed', 'reminded'])
      .not('attendee_phone', 'is', null);

    if (!activeRsvps || activeRsvps.length === 0) return;

    for (const rsvp of activeRsvps) {
      const { data: event } = await supabase
        .from('calendar_events')
        .select('title, start_date, meeting_link, company_id, description')
        .eq('id', rsvp.event_id)
        .single();

      if (!event) continue;

      const eventStart = new Date(event.start_date);
      const minutesUntil = (eventStart.getTime() - now.getTime()) / 60000;

      // Find which reminder interval we're in
      let matchedInterval: number | null = null;
      for (const interval of intervals) {
        if (minutesUntil > (interval - 2.5) && minutesUntil <= (interval + 2.5)) {
          matchedInterval = interval;
          break;
        }
      }

      if (!matchedInterval) continue;

      // Dedup check
      const { data: existingReminders } = await supabase
        .from('meeting_reschedule_requests')
        .select('id')
        .eq('event_id', rsvp.event_id)
        .eq('attendee_phone', rsvp.attendee_phone)
        .eq('status', `reminder_${matchedInterval}`)
        .limit(1);

      if (matchedInterval === 30 && rsvp.reminder_sent_at) continue;
      if (existingReminders && existingReminders.length > 0) continue;

      // Extract location from description if presencial
      const descriptionLines = (event.description || '').split('\n');
      const locationLine = descriptionLines.find((l: string) => l.includes('📍 Local:'));
      const locationText = locationLine ? locationLine.replace('📍 Local:', '').trim() : '';

      // Build message
      const timeLabel = matchedInterval === 60 ? '1 hora' : `${matchedInterval} minutos`;
      const isConfirmed = rsvp.status === 'confirmed';
      
      let reminderMsg = `⏰ *Lembrete de Reunião*\n\n` +
        `*${event.title}*\n` +
        `📆 Começa em ${timeLabel}!\n`;

      if (event.meeting_link) {
        reminderMsg += `\n🔗 *Link:* ${event.meeting_link}\n`;
      }
      if (locationText) {
        reminderMsg += `\n📍 *Local:* ${locationText}\n`;
      }

      if (!isConfirmed) {
        reminderMsg += `\n📋 Você ainda não confirmou.\nResponda *Sim* para confirmar ou *Não* para recusar.\n`;
      } else {
        reminderMsg += `\n✅ Sua presença está confirmada. Até logo!\n`;
      }
      reminderMsg += `\n_Enviado via Ellosuit_`;

      // Send via YCloud
      let sent = false;

      const { data: ySession } = await supabase
        .from('ycloud_sessions')
        .select('id, phone_number, ycloud_api_key')
        .eq('company_id', rsvp.company_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (ySession?.ycloud_api_key) {
        try {
          const normalizedPhone = rsvp.attendee_phone.startsWith('+') ? rsvp.attendee_phone : `+${rsvp.attendee_phone.replace(/\\D/g, '')}`;
          const formattedFrom = ySession.phone_number.startsWith('+') ? ySession.phone_number : `+${ySession.phone_number.replace(/\\D/g, '')}`;
          
          const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
            method: 'POST',
            headers: { 'X-API-Key': ySession.ycloud_api_key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: formattedFrom, to: normalizedPhone, type: 'text', text: { body: reminderMsg } }),
          });

          if (sendRes.ok) {
            sent = true;
            const sendData = await sendRes.json();
            
            const phoneDigits = rsvp.attendee_phone.replace(/\D/g, '');
            const { data: yConv } = await supabase
              .from('ycloud_conversations')
              .select('id')
              .eq('session_id', ySession.id)
              .or(`contact_phone.eq.+${phoneDigits},contact_phone.eq.${phoneDigits}`)
              .limit(1)
              .maybeSingle();

            if (yConv) {
              await supabase.from('ycloud_messages').insert({
                conversation_id: yConv.id,
                company_id: rsvp.company_id,
                ycloud_message_id: sendData?.id || `reminder-${Date.now()}`,
                wamid: sendData?.wamid || null,
                from_me: true,
                content: reminderMsg,
                message_type: 'text',
                status: 'sent',
              });
              await supabase.from('ycloud_conversations')
                .update({ last_message: reminderMsg.substring(0, 100), last_message_at: new Date().toISOString() })
                .eq('id', yConv.id);
            }

            console.log(`⏰ [RSVP-YCloud] ${timeLabel} reminder sent to ${rsvp.attendee_phone} for "${event.title}"`);
          }
        } catch (e) {
          console.error('⏰ [RSVP-YCloud] Send failed:', e);
        }
      }

      if (sent) {
        // Track reminder
        if (matchedInterval === 30) {
          await supabase.from('meeting_rsvp')
            .update({ status: rsvp.status === 'confirmed' ? 'confirmed' : 'reminded', reminder_sent_at: new Date().toISOString() })
            .eq('id', rsvp.id);
        }
        // Track all intervals via dedup table
        await supabase.from('meeting_reschedule_requests').insert({
          event_id: rsvp.event_id,
          attendee_phone: rsvp.attendee_phone,
          status: `reminder_${matchedInterval}`,
          company_id: rsvp.company_id,
        }).catch(() => {});
        
        console.log(`⏰ [RSVP] ${timeLabel} reminder sent to ${rsvp.attendee_phone} for "${event.title}" (status: ${rsvp.status})`);
      }
    }
  } catch (err) {
    console.error('⏰ [RSVP] Reminder error:', err);
  }
}
