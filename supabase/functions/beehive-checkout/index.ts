import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEEHIVE_API_URL = "https://api.conta.paybeehive.com.br/v1";

// Plan definitions (prices in cents)
const PLANS: Record<string, { label: string; price: number; sessions: number }> = {
  starter:      { label: "Starter",      price: 30000,  sessions: 1 },  // R$300/ano
  professional: { label: "Professional", price: 79700,  sessions: 3 },  // R$797/ano
  business:     { label: "Business",     price: 149700, sessions: 5 },  // R$1.497/ano
  enterprise:   { label: "Enterprise",   price: 300000, sessions: 10 }, // R$3.000/ano
};

function getBeehiveAuth(): string {
  const secretKey = Deno.env.get("BEEHIVE_SECRET_KEY");
  if (!secretKey) throw new Error("BEEHIVE_SECRET_KEY not configured");
  // Basic Auth: base64(SECRET_KEY:x)
  const encoded = btoa(`${secretKey}:x`);
  return `Basic ${encoded}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const userClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser(token);
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const userEmail = claimsData.user.email || "";

    const body = await req.json();
    const {
      plan_name,
      installments = 1,
      card_token,
      customer_name,
      customer_document,
      customer_phone,
      customer_address,
    } = body;

    // Validate plan
    const plan = PLANS[plan_name];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate installments (1-12)
    const inst = Math.min(Math.max(Math.round(installments), 1), 12);

    // Get company_id
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!companyUser) {
      return new Response(JSON.stringify({ error: "User not associated with a company" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = companyUser.company_id;

    // Calculate installment amount
    const installmentAmount = Math.ceil(plan.price / inst);

    // Create subscription record (pending)
    const { data: sub, error: subErr } = await adminClient
      .from("api_whatsapp_subscriptions")
      .insert({
        company_id: companyId,
        user_id: userId,
        plan_name,
        plan_label: plan.label,
        sessions_included: plan.sessions,
        annual_price: plan.price,
        installments: inst,
        installment_amount: installmentAmount,
        status: "pending",
        beehive_status: "processing",
        payment_method: "credit_card",
        customer_name: customer_name || userEmail.split("@")[0],
        customer_email: userEmail,
        customer_document: customer_document,
        customer_phone: customer_phone,
      })
      .select()
      .single();

    if (subErr || !sub) {
      console.error("[BEEHIVE] Subscription insert error:", subErr);
      return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build BeehiveHub transaction payload
    const postbackUrl = `${supabaseUrl}/functions/v1/beehive-webhook`;
    
    const txPayload: Record<string, unknown> = {
      amount: plan.price,
      paymentMethod: "credit_card",
      installments: inst,
      postbackUrl,
      metadata: JSON.stringify({
        subscription_id: sub.id,
        company_id: companyId,
        plan_name,
      }),
      externalRef: sub.id,
      customer: {
        name: customer_name || "Cliente Ellosuit",
        email: userEmail,
        document: {
          number: (customer_document || "").replace(/\D/g, ""),
          type: (customer_document || "").replace(/\D/g, "").length > 11 ? "cnpj" : "cpf",
        },
        phone: customer_phone ? `+55${customer_phone.replace(/\D/g, "")}` : undefined,
        ...(customer_address ? {
          address: {
            street: customer_address.street || "",
            number: customer_address.number || "",
            complement: customer_address.complement || "",
            neighborhood: customer_address.neighborhood || "",
            city: customer_address.city || "",
            state: customer_address.state || "",
            zipcode: (customer_address.zipcode || "").replace(/\D/g, ""),
            country: "BR",
          },
        } : {}),
      },
      items: [
        {
          title: `API WhatsApp - Plano ${plan.label} (Anual)`,
          unitPrice: plan.price,
          quantity: 1,
          tangible: false,
        },
      ],
      card: {
        hash: card_token,
      },
    };

    console.log("[BEEHIVE] Creating transaction for subscription:", sub.id);

    // Call BeehiveHub API
    const beehiveRes = await fetch(`${BEEHIVE_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": getBeehiveAuth(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(txPayload),
    });

    const beehiveData = await beehiveRes.json();

    if (!beehiveRes.ok) {
      console.error("[BEEHIVE] Transaction failed:", beehiveData);
      
      // Update subscription as failed
      await adminClient
        .from("api_whatsapp_subscriptions")
        .update({
          beehive_status: "refused",
          status: "canceled",
          metadata: { error: beehiveData },
        })
        .eq("id", sub.id);

      return new Response(JSON.stringify({
        error: "Payment failed",
        details: beehiveData.message || beehiveData.error || "Transaction refused",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update subscription with BeehiveHub data
    const updateData: Record<string, unknown> = {
      beehive_transaction_id: String(beehiveData.id),
      beehive_status: beehiveData.status,
      beehive_secure_id: beehiveData.secureId,
      beehive_secure_url: beehiveData.secureUrl,
      card_last_digits: beehiveData.card?.lastDigits,
      card_brand: beehiveData.card?.brand,
    };

    // If immediately paid
    if (beehiveData.status === "paid") {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      
      updateData.status = "active";
      updateData.starts_at = now.toISOString();
      updateData.expires_at = expiresAt.toISOString();
      updateData.paid_at = beehiveData.paidAt || now.toISOString();
    }

    await adminClient
      .from("api_whatsapp_subscriptions")
      .update(updateData)
      .eq("id", sub.id);

    console.log("[BEEHIVE] ✅ Transaction created:", beehiveData.id, "status:", beehiveData.status);

    return new Response(JSON.stringify({
      success: true,
      subscription_id: sub.id,
      transaction_id: beehiveData.id,
      status: beehiveData.status,
      secure_url: beehiveData.secureUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: unknown) {
    console.error("[BEEHIVE] Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
