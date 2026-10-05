import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, phone } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store code in phone_verifications table (reusing existing table)
    // Use the phone field to store identifier (phone or email hash)
    const identifier = phone || email;
    await supabase.from("phone_verifications").insert({
      phone: identifier.replace(/\D/g, "") || email,
      code,
      expires_at: expiresAt,
    });

    // Build a simple HTML email with the code
    const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://www.ellosuit.app/lovable-uploads/ellosuit-logo.png" alt="Ellosuit" style="height: 32px; width: auto;" />
      </div>
      <div style="background: #f8f9fa; border-radius: 16px; padding: 32px; text-align: center;">
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Código de verificação</h2>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">Use o código abaixo para verificar sua identidade</p>
        <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 240px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #3000E3; font-family: monospace;">${code}</span>
        </div>
        <p style="margin: 24px 0 0; color: #999; font-size: 12px;">Válido por 10 minutos. Se você não solicitou, ignore este email.</p>
      </div>
      <p style="text-align: center; margin-top: 24px; color: #999; font-size: 11px;">© ${new Date().getFullYear()} Ellosuit. Todos os direitos reservados.</p>
    </div>`;

    // Send via send-email edge function directly
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        recipient_email: email,
        recipient_name: email.split("@")[0],
        subject: `${code} - Código de Verificação Ellosuit`,
        content_html: htmlContent,
        provider: "gmail",
        from_email: "contato@ellosuit.com",
        from_name: "Ellosuit",
        user_id: "c63ba931-0c34-4461-ae8d-2908aed7dd20",
        company_id: "60008c43-e536-482d-a090-91904de57534",
      }),
    });

    const sendResult = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[EMAIL-CODE] Send failed:", sendResult);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar código por email." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EMAIL-CODE] Code sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado por email" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[EMAIL-CODE] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
