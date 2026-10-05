import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[BEEHIVE-WEBHOOK] Received:", JSON.stringify(body).substring(0, 500));

    const { type, data } = body;

    // Only handle transaction postbacks
    if (type !== "transaction" || !data) {
      console.log("[BEEHIVE-WEBHOOK] Ignoring non-transaction event:", type);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactionId = String(data.id);
    const status = data.status; // paid, refused, refunded, canceled, etc.
    const metadata = data.metadata ? JSON.parse(data.metadata) : {};
    const subscriptionId = metadata.subscription_id || data.externalRef;

    if (!subscriptionId) {
      console.log("[BEEHIVE-WEBHOOK] No subscription_id found, skipping");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update subscription based on transaction status
    const updateData: Record<string, unknown> = {
      beehive_transaction_id: transactionId,
      beehive_status: status,
      card_last_digits: data.card?.lastDigits,
      card_brand: data.card?.brand,
    };

    if (status === "paid") {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      updateData.status = "active";
      updateData.starts_at = now.toISOString();
      updateData.expires_at = expiresAt.toISOString();
      updateData.paid_at = data.paidAt || now.toISOString();

      console.log(`[BEEHIVE-WEBHOOK] ✅ Subscription ${subscriptionId} ACTIVATED until ${expiresAt.toISOString()}`);
    } else if (status === "refused" || status === "canceled") {
      updateData.status = "canceled";
      updateData.canceled_at = new Date().toISOString();
      console.log(`[BEEHIVE-WEBHOOK] ❌ Subscription ${subscriptionId} ${status}`);
    } else if (status === "refunded") {
      updateData.status = "canceled";
      updateData.canceled_at = new Date().toISOString();
      console.log(`[BEEHIVE-WEBHOOK] 💰 Subscription ${subscriptionId} REFUNDED`);
    }

    const { error } = await supabase
      .from("api_whatsapp_subscriptions")
      .update(updateData)
      .eq("id", subscriptionId);

    if (error) {
      console.error("[BEEHIVE-WEBHOOK] Update error:", error);
      // Try by transaction ID as fallback
      await supabase
        .from("api_whatsapp_subscriptions")
        .update(updateData)
        .eq("beehive_transaction_id", transactionId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: unknown) {
    console.error("[BEEHIVE-WEBHOOK] Error:", e);
    // Always return 200 to avoid retries
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
