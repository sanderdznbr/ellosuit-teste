import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System email configuration
const SYSTEM_FROM_EMAIL = "contato@ellosuit.com";
const SYSTEM_FROM_NAME = "Ellosuit";
// Admin master user who owns the Gmail account with the alias
const ADMIN_USER_ID = "c63ba931-0c34-4461-ae8d-2908aed7dd20";
const ADMIN_COMPANY_ID = "60008c43-e536-482d-a090-91904de57534";

// Template IDs
const TEMPLATES: Record<string, string> = {
  welcome: "0694ac25-4442-49d0-892b-be075943cf25",
  payment_confirmed: "594cc505-eb98-4a32-9fd0-7178d585a9e0",
  payment_pending: "1eaf80c7-f806-49f0-aa05-c41c9169ea66",
  trial_started: "a1b2c3d4-0001-4000-8000-000000000001",
  trial_ending: "a1b2c3d4-0002-4000-8000-000000000002",
  account_suspended: "a1b2c3d4-0003-4000-8000-000000000003",
  plan_upgraded: "b1000001-0001-4000-8000-000000000001",
  subscription_renewed: "b1000001-0002-4000-8000-000000000002",
  payment_failed: "b1000001-0003-4000-8000-000000000003",
  cancellation_confirmed: "b1000001-0004-4000-8000-000000000004",
  new_contact: "b1000001-0005-4000-8000-000000000005",
  meeting_scheduled: "b1000001-0006-4000-8000-000000000006",
  meeting_reminder: "b1000001-0007-4000-8000-000000000007",
  document_shared: "b1000001-0008-4000-8000-000000000008",
  proposal_sent: "b1000001-0009-4000-8000-000000000009",
  refund_processed: "b1000001-0010-4000-8000-000000000010",
};

interface SystemEmailRequest {
  template_key: string; // 'welcome' | 'payment_confirmed' | 'payment_pending'
  recipient_email: string;
  recipient_name?: string;
  variables?: Record<string, string>;
  // For payment emails
  invoice_data?: {
    plan_name?: string;
    amount?: number;
    payment_method?: string;
    transaction_id?: string;
    billing_cycle?: string;
    next_billing_date?: string;
    due_date?: string;
  };
}

function replaceVariables(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    // Support both {{key}} and {{nome_cliente}} formats
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString("pt-BR");
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: SystemEmailRequest = await req.json();
    const { template_key, recipient_email, recipient_name, variables = {}, invoice_data } = body;

    console.log(`[SYSTEM-EMAIL] Sending ${template_key} to ${recipient_email}`);

    // Get template
    const templateId = TEMPLATES[template_key as keyof typeof TEMPLATES];
    if (!templateId) {
      return new Response(
        JSON.stringify({ error: `Template '${template_key}' not found` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: template, error: tplErr } = await supabase
      .from("email_templates")
      .select("html_content, name")
      .eq("id", templateId)
      .single();

    if (tplErr || !template) {
      console.error("[SYSTEM-EMAIL] Template fetch error:", tplErr);
      return new Response(
        JSON.stringify({ error: "Template not found in database" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build variables map
    const allVars: Record<string, string> = {
      nome_cliente: recipient_name || recipient_email.split("@")[0],
      email_cliente: recipient_email,
      data_atual: new Date().toLocaleDateString("pt-BR"),
      ano_atual: new Date().getFullYear().toString(),
      ...variables,
    };

    // Add invoice-specific variables
    if (invoice_data) {
      allVars.nome_plano = invoice_data.plan_name || "Business";
      allVars.valor_fatura = invoice_data.amount ? formatCurrency(invoice_data.amount) : "R$ 297,00";
      allVars.metodo_pagamento = invoice_data.payment_method || "Cartão de Crédito";
      allVars.id_transacao = invoice_data.transaction_id || crypto.randomUUID().substring(0, 12).toUpperCase();
      allVars.ciclo_cobranca = invoice_data.billing_cycle === "yearly" ? "Anual" : "Mensal";
      allVars.proxima_cobranca = formatDate(invoice_data.next_billing_date);
      allVars.data_pagamento = formatDate();
      allVars.data_vencimento = formatDate(invoice_data.due_date);
      allVars.numero_fatura = `INV-${Date.now().toString(36).toUpperCase()}`;
    }

    // Replace variables in template
    const finalHtml = replaceVariables(template.html_content, allVars);

    // Determine subject based on template
    const subjects: Record<string, string> = {
      welcome: `Bem-vindo ao Ellosuit, ${allVars.nome_cliente}!`,
      payment_confirmed: `Pagamento Confirmado - Fatura ${allVars.numero_fatura || ""}`,
      payment_pending: `Acao Necessaria: Pagamento Pendente - Ellosuit`,
      trial_started: `Seu periodo de teste comecou - Ellosuit`,
      trial_ending: `Seu periodo de teste esta acabando - Ellosuit`,
      account_suspended: `Conta suspensa - Ellosuit`,
      plan_upgraded: `Upgrade Confirmado - Plano ${allVars.nome_plano || "Business"}`,
      subscription_renewed: `Assinatura Renovada - Ellosuit`,
      payment_failed: `Falha no Pagamento - Acao Necessaria`,
      cancellation_confirmed: `Cancelamento Confirmado - Ellosuit`,
      new_contact: `Cadastro Recebido - ${allVars.nome_cliente}`,
      meeting_scheduled: `Reuniao Confirmada - ${allVars.titulo_reuniao || "Ellosuit"}`,
      meeting_reminder: `Lembrete: Reuniao em 30 minutos`,
      document_shared: `Documento Compartilhado - ${allVars.nome_documento || "Ellosuit"}`,
      proposal_sent: `Nova Proposta - ${allVars.numero_proposta || "Ellosuit"}`,
      refund_processed: `Reembolso Processado - Ellosuit`,
    };
    const subject = subjects[template_key] || template.name;

    // Send via the existing send-email function (uses Gmail API with alias)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        recipient_email,
        recipient_name: recipient_name || allVars.nome_cliente,
        subject,
        content_html: finalHtml,
        provider: "gmail",
        from_email: SYSTEM_FROM_EMAIL,
        from_name: SYSTEM_FROM_NAME,
        user_id: ADMIN_USER_ID,
        company_id: ADMIN_COMPANY_ID,
      }),
    });

    const sendResult = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[SYSTEM-EMAIL] Send failed:", sendResult);
      return new Response(
        JSON.stringify({ error: sendResult.error || "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SYSTEM-EMAIL] ✅ ${template_key} sent to ${recipient_email}`);

    return new Response(
      JSON.stringify({ success: true, email_id: sendResult.email_id, template: template_key }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[SYSTEM-EMAIL] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
