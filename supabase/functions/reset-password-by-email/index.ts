import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email e nova senha são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check that the email was recently verified
    const { data: verification } = await supabase
      .from("phone_verifications")
      .select("*")
      .eq("phone", email)
      .eq("verified", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Email não verificado. Verifique seu email primeiro." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check verification is recent (within 30 minutes)
    const verifiedAt = new Date(verification.created_at);
    if (Date.now() - verifiedAt.getTime() > 30 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Verificação expirada. Verifique seu email novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      console.error("[RESET-EMAIL] Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Erro interno ao buscar usuário." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conta encontrada com este email." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset the password
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[RESET-EMAIL] Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao redefinir senha. Tente novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up used verification
    await supabase.from("phone_verifications").delete().eq("id", verification.id);

    console.log(`[RESET-EMAIL] Password reset for user ${targetUser.email}`);

    return new Response(
      JSON.stringify({ success: true, email: targetUser.email, message: "Senha redefinida com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[RESET-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
