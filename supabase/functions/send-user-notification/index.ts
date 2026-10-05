import { createClient } from "npm:@supabase/supabase-js@2";

const CLOUD_BAILEYS_URL = 'https://baileys-server-novo-production.up.railway.app';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      user_id,
      company_id,
      title,
      message,
      type = "info",
      category = "system",
      notification_type, // e.g. 'event_created', 'event_upcoming', 'event_deleted', 'task_due', 'email_sent', 'dispatch_progress'
      icon,
      action_url,
      metadata = {},
      send_whatsapp = true,
    } = body;

    if (!user_id || !company_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, company_id, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[USER-NOTIFY] Creating notification for user ${user_id}: ${title} (type: ${notification_type})`);

    // 1. Insert notification into DB
    const { data: notification, error: insertError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        company_id,
        title,
        message,
        type,
        category,
        icon,
        action_url,
        metadata: { ...metadata, notification_type },
        whatsapp_sent: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[USER-NOTIFY] Insert error:", insertError);
      throw insertError;
    }

    // 1.5 Send Push Notification via OneSignal
    let pushSent = false;
    try {
      const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
      const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        const pushPayload: any = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [user_id] },
          target_channel: "push",
          headings: { en: title },
          contents: { en: message },
        };

        if (action_url) {
          pushPayload.url = action_url;
        }

        const pushRes = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(pushPayload),
        });

        const pushData = await pushRes.json();
        if (pushRes.ok) {
          pushSent = true;
          console.log(`[USER-NOTIFY] Push sent via OneSignal: id=${pushData.id}, recipients=${pushData.recipients}, errors=${JSON.stringify(pushData.errors || [])}`);
        } else {
          console.error(`[USER-NOTIFY] OneSignal push failed:`, JSON.stringify(pushData));
        }
      } else {
        console.log("[USER-NOTIFY] OneSignal not configured, skipping push");
      }
    } catch (pushErr: any) {
      console.error("[USER-NOTIFY] Push error:", pushErr);
    }

    // 2. Send WhatsApp notification if enabled
    let whatsappSent = false;

    if (send_whatsapp) {
      try {
        // Check user's notification_settings for specific WhatsApp toggles
        const { data: notifSettings } = await supabase
          .from("notification_settings")
          .select("*")
          .eq("user_id", user_id)
          .maybeSingle();

        // Map notification_type to the column name in notification_settings
    const typeToColumn: Record<string, string> = {
          event_created: "whatsapp_event_created",
          event_upcoming: "whatsapp_event_upcoming",
          event_deleted: "whatsapp_event_deleted",
          task_due: "whatsapp_task_due",
          email_sent: "whatsapp_email_sent",
          dispatch_progress: "whatsapp_dispatch_progress",
          birthday_reminder: "whatsapp_birthday_reminder",
        };

        const whatsappGlobalEnabled = notifSettings?.whatsapp_enabled !== false;
        const specificColumn = typeToColumn[notification_type || ""];
        const specificEnabled = specificColumn
          ? (notifSettings as any)?.[specificColumn] !== false
          : true;

        // Also check notification_preferences for quiet hours and whatsapp number
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user_id)
          .maybeSingle();

        // Check quiet hours
        let inQuietHours = false;
        if (prefs?.quiet_hours_start && prefs?.quiet_hours_end) {
          const now = new Date();
          const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const hours = brTime.getHours();
          const minutes = brTime.getMinutes();
          const currentTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
          inQuietHours = currentTime >= prefs.quiet_hours_start && currentTime <= prefs.quiet_hours_end;
        }

        console.log(`[USER-NOTIFY] WhatsApp global=${whatsappGlobalEnabled}, specific=${specificEnabled}, quietHours=${inQuietHours}`);

        if (whatsappGlobalEnabled && specificEnabled && !inQuietHours) {
          // Get user's WhatsApp number from multiple sources
          let userPhone = prefs?.whatsapp_number;

          // Fallback 1: auth.users metadata
          if (!userPhone) {
            const { data: userData } = await supabase.auth.admin.getUserById(user_id);
            userPhone = userData?.user?.phone || userData?.user?.user_metadata?.whatsapp || userData?.user?.user_metadata?.phone;
          }

          // Fallback 2: clients table (match by user email)
          if (!userPhone) {
            const { data: userData } = await supabase.auth.admin.getUserById(user_id);
            if (userData?.user?.email) {
              const { data: clientMatch } = await supabase
                .from("clients")
                .select("whatsapp, phone")
                .eq("email", userData.user.email)
                .limit(1)
                .maybeSingle();
              userPhone = clientMatch?.whatsapp || clientMatch?.phone;
            }
          }

          console.log(`[USER-NOTIFY] Phone lookup for user ${user_id}: ${userPhone ? userPhone.slice(0, 6) + '***' : 'NOT FOUND'}`);

          if (userPhone) {
            // Try user's own company session first, then fallback to adminmaster
            let session: any = null;

            // 1. User's own company session
            const { data: userCompany } = await supabase
              .from("company_users")
              .select("company_id")
              .eq("user_id", user_id)
              .limit(1)
              .maybeSingle();

            if (userCompany) {
              const { data: companySession } = await supabase
                .from("whatsapp_sessions")
                .select("id, baileys_server_url, instance_name")
                .eq("company_id", userCompany.company_id)
                .eq("status", "connected")
                .limit(1)
                .maybeSingle();
              if (companySession?.baileys_server_url) session = companySession;
            }

            // 2. Fallback to adminmaster session
            if (!session) {
              const { data: adminUser } = await supabase
                .from("company_users")
                .select("company_id")
                .eq("role", "adminmaster")
                .limit(1)
                .maybeSingle();

              if (adminUser) {
                const { data: adminSession } = await supabase
                  .from("whatsapp_sessions")
                  .select("id, baileys_server_url, instance_name")
                  .eq("company_id", adminUser.company_id)
                  .eq("status", "connected")
                  .limit(1)
                  .maybeSingle();
                if (adminSession?.baileys_server_url) session = adminSession;
              }
            }

            if (session?.baileys_server_url) {
              const resolvedUrl = CLOUD_BAILEYS_URL;
              const cleanPhone = userPhone.replace(/\D/g, "");
              // Ensure BR country code
              const normalizedPhone = (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) ? "55" + cleanPhone : cleanPhone;
              const jid = `${normalizedPhone}@s.whatsapp.net`;
              const whatsappMessage = formatWhatsAppMessage(title, message, category, notification_type, action_url);

              const sendRes = await fetch(`${resolvedUrl}/api/message/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  instanceName: session.instance_name,
                  jid,
                  message: { text: whatsappMessage },
                }),
              });

              if (sendRes.ok) {
                whatsappSent = true;
                console.log(`[USER-NOTIFY] WhatsApp sent to ${normalizedPhone} via session ${session.instance_name}`);
              } else {
                console.error(`[USER-NOTIFY] WhatsApp send failed:`, await sendRes.text());
              }
            } else {
              console.log(`[USER-NOTIFY] No connected WhatsApp session found for sending`);
            }
          } else {
            console.log(`[USER-NOTIFY] No WhatsApp number found for user ${user_id}`);
          }
        } else {
          console.log(`[USER-NOTIFY] WhatsApp disabled or in quiet hours for user ${user_id}`);
        }
      } catch (whatsappErr: any) {
        console.error("[USER-NOTIFY] WhatsApp error:", whatsappErr);
      }

      if (whatsappSent) {
        await supabase
          .from("notifications")
          .update({ whatsapp_sent: true })
          .eq("id", notification.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notification_id: notification.id, whatsapp_sent: whatsappSent, push_sent: pushSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[USER-NOTIFY] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatWhatsAppMessage(
  title: string,
  message: string,
  category: string,
  notificationType?: string,
  actionUrl?: string
): string {
  const typeIcons: Record<string, string> = {
    event_created: "📅✅",
    event_upcoming: "⏰📅",
    event_deleted: "📅❌",
    task_due: "✅⏰",
    email_sent: "📧✅",
    dispatch_progress: "📤🚀",
    birthday_reminder: "🎂🎉",
  };

  const categoryIcons: Record<string, string> = {
    system: "🔔",
    calendar: "📅",
    crm: "💬",
    task: "✅",
    meeting: "🎥",
    email: "📧",
    drive: "📁",
  };

  const icon = typeIcons[notificationType || ""] || categoryIcons[category] || "🔔";
  const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  let msg = `${icon} *ELLOSUIT*\n\n`;
  msg += `*${title}*\n`;
  msg += `${message}\n`;
  msg += `\n🕐 ${timestamp}`;

  if (actionUrl) {
    msg += `\n\n🔗 Acesse: ${actionUrl}`;
  }

  return msg;
}
