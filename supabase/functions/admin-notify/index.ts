import { createClient } from "npm:@supabase/supabase-js@2";

const CLOUD_BAILEYS_URL = 'https://baileys-server-novo-production.up.railway.app';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin phone to notify
const ADMIN_PHONE = "5541989015612";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      event_type,
      event_title,
      event_description,
      user_id,
      user_email,
      company_id,
      company_name,
      metadata,
      send_whatsapp = true,
    } = body;

    console.log(`[ADMIN-NOTIFY] Event: ${event_type} - ${event_title}`);

    // 1. Log the event
    const { error: logError } = await supabase
      .from("system_notifications_log")
      .insert({
        event_type,
        event_title,
        event_description,
        user_id,
        user_email,
        company_id,
        company_name,
        metadata: metadata || {},
        notification_sent: false,
      });

    if (logError) {
      console.error("[ADMIN-NOTIFY] Log insert error:", logError);
    }

    // 2. Send WhatsApp notification to admin
    let notificationSent = false;
    let notificationError = null;

    if (send_whatsapp) {
      try {
        // Find admin's connected WhatsApp session
        const { data: adminUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("role", "adminmaster")
          .limit(1)
          .single();

        if (adminUser) {
          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("id, baileys_server_url, instance_name, phone_number")
            .eq("company_id", adminUser.company_id)
            .eq("status", "connected")
            .limit(1)
            .single();

          if (session?.baileys_server_url) {
            const resolvedUrl = CLOUD_BAILEYS_URL;
            // Format message
            const message = formatNotificationMessage(event_type, event_title, event_description, user_email, company_name, metadata);

            const jid = `${ADMIN_PHONE}@s.whatsapp.net`;
            const sendRes = await fetch(`${resolvedUrl}/api/message/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instanceName: session.instance_name,
                jid,
                message: { text: message },
              }),
            });

            if (sendRes.ok) {
              notificationSent = true;
              console.log(`[ADMIN-NOTIFY] WhatsApp sent to admin successfully`);
            } else {
              const errText = await sendRes.text();
              notificationError = `Send failed: ${sendRes.status} - ${errText}`;
              console.error(`[ADMIN-NOTIFY] WhatsApp send error:`, notificationError);
            }
          } else {
            notificationError = "No connected WhatsApp session for admin";
            console.warn(`[ADMIN-NOTIFY]`, notificationError);
          }
        }
      } catch (whatsappErr: any) {
        notificationError = whatsappErr.message || "Unknown WhatsApp error";
        console.error("[ADMIN-NOTIFY] WhatsApp error:", whatsappErr);
      }

      // Update log with notification status
      if (logError === null) {
        await supabase
          .from("system_notifications_log")
          .update({
            notification_sent: notificationSent,
            notification_error: notificationError,
          })
          .eq("event_type", event_type)
          .eq("event_title", event_title)
          .order("created_at", { ascending: false })
          .limit(1);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notification_sent: notificationSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[ADMIN-NOTIFY] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatNotificationMessage(
  eventType: string,
  title: string,
  description: string | undefined,
  userEmail: string | undefined,
  companyName: string | undefined,
  metadata: any
): string {
  const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const userInfo = companyName || userEmail || "Usuário";

  const icons: Record<string, string> = {
    whatsapp_connected: "📱✅",
    whatsapp_disconnected: "📱❌",
    bulk_dispatch_started: "📤🚀",
    bulk_dispatch_completed: "📤✅",
    bulk_dispatch_failed: "📤❌",
    email_sent: "📧✅",
    email_campaign_sent: "📧📊",
    user_registered: "👤🆕",
    chatbot_activated: "🤖✅",
    ai_agent_assigned: "🤖🧠",
  };

  const icon = icons[eventType] || "🔔";
  let msg = `${icon} *ELLOSUIT - Notificação*\n\n`;
  msg += `*${title}*\n`;
  if (description) msg += `${description}\n`;
  msg += `\n👤 ${userInfo}`;
  if (userEmail && companyName) msg += ` (${userEmail})`;
  msg += `\n🕐 ${timestamp}`;

  // Add metadata details
  if (metadata) {
    if (metadata.total_messages) msg += `\n📊 Total: ${metadata.total_messages} mensagens`;
    if (metadata.phone_number) msg += `\n📞 Número: ${metadata.phone_number}`;
    if (metadata.campaign_name) msg += `\n📋 Campanha: ${metadata.campaign_name}`;
    if (metadata.recipient_count) msg += `\n👥 Destinatários: ${metadata.recipient_count}`;
  }

  return msg;
}
