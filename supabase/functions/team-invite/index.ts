import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");

    const { action, ...body } = await req.json();

    if (action === "send-invite") {
      // Validate auth
      if (!authHeader) throw new Error("Não autorizado");
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error("Não autorizado");

      const { email, role, permissions, companyId } = body;

      // Verify caller is admin
      const { data: callerRole } = await supabaseAdmin
        .from("company_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .single();

      if (!callerRole || !["admin", "adminmaster", "manager"].includes(callerRole.role)) {
        throw new Error("Sem permissão para convidar");
      }

      // Check if already invited (pending)
      const { data: existing } = await supabaseAdmin
        .from("team_invitations")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("company_id", companyId)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        throw new Error("Já existe um convite pendente para este email");
      }

      // Check if already member
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        const { data: alreadyMember } = await supabaseAdmin
          .from("company_users")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("company_id", companyId)
          .maybeSingle();

        if (alreadyMember) {
          throw new Error("Este usuário já faz parte da empresa");
        }
      }

      // Get company name
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();

      // Create invitation
      const { data: invitation, error: invError } = await supabaseAdmin
        .from("team_invitations")
        .insert({
          company_id: companyId,
          invited_by: user.id,
          email: email.toLowerCase(),
          role: role || "employee",
          permissions: permissions || [],
        })
        .select()
        .single();

      if (invError) throw invError;

      // Send invitation email via Supabase Auth (invite user)
      // Sempre usar o domínio canônico — nunca cair para origin do request,
      // senão previews Lovable vazam em convites enviados por email.
      const redirectUrl = `https://www.ellosuit.app/convite/${invitation.token}`;

      // Try to send magic link / invite
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        redirectTo: redirectUrl,
        data: {
          invitation_token: invitation.token,
          company_name: company?.name || "Empresa",
        },
      });

      // If user already exists, that's fine - they can still use the link
      if (inviteError && !inviteError.message?.includes("already been registered")) {
        console.error("Invite email error:", inviteError);
      }

      return new Response(
        JSON.stringify({ success: true, invitation, inviteUrl: redirectUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "accept-invite") {
      const { token } = body;

      if (!authHeader) throw new Error("Faça login antes de aceitar o convite");
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error("Faça login antes de aceitar o convite");

      // Get invitation
      const { data: invitation, error: invErr } = await supabaseAdmin
        .from("team_invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (invErr || !invitation) throw new Error("Convite não encontrado ou já utilizado");

      // Check expiry
      if (new Date(invitation.expires_at) < new Date()) {
        await supabaseAdmin.from("team_invitations").update({ status: "expired" }).eq("id", invitation.id);
        throw new Error("Este convite expirou");
      }

      // Check email match
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error(`Este convite é para ${invitation.email}. Faça login com esse email.`);
      }

      // Check if already member
      const { data: alreadyMember } = await supabaseAdmin
        .from("company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", invitation.company_id)
        .maybeSingle();

      if (alreadyMember) {
        await supabaseAdmin.from("team_invitations").update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() }).eq("id", invitation.id);
        return new Response(
          JSON.stringify({ success: true, message: "Você já faz parte desta empresa", companyId: invitation.company_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add user to company
      const { error: addError } = await supabaseAdmin
        .from("company_users")
        .insert({
          company_id: invitation.company_id,
          user_id: user.id,
          role: invitation.role as any,
        });

      if (addError) throw addError;

      // Set permissions
      if (invitation.permissions && invitation.permissions.length > 0) {
        const permsToInsert = invitation.permissions.map((p: string) => ({
          user_id: user.id,
          company_id: invitation.company_id,
          permission: p,
          granted_by: invitation.invited_by,
        }));

        await supabaseAdmin.from("user_permissions").insert(permsToInsert);
      }

      // Update invitation
      await supabaseAdmin.from("team_invitations").update({
        status: "accepted",
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      }).eq("id", invitation.id);

      return new Response(
        JSON.stringify({ success: true, message: "Convite aceito! Bem-vindo à equipe.", companyId: invitation.company_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cancel-invite") {
      if (!authHeader) throw new Error("Não autorizado");
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error("Não autorizado");

      const { invitationId, companyId } = body;

      const { error } = await supabaseAdmin
        .from("team_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId)
        .eq("company_id", companyId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resend-invite") {
      if (!authHeader) throw new Error("Não autorizado");
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error("Não autorizado");

      const { invitationId } = body;

      // Refresh expiry
      const { data: invitation, error } = await supabaseAdmin
        .from("team_invitations")
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
        })
        .eq("id", invitationId)
        .select()
        .single();

      if (error) throw error;

      const redirectUrl = `https://www.ellosuit.app/convite/${invitation.token}`;

      await supabaseAdmin.auth.admin.inviteUserByEmail(invitation.email, {
        redirectTo: redirectUrl,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Ação inválida");
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
