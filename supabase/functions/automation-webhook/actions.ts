// Action executors for each automation block type

// Field label -> DB column mapping
export const FIELD_LABEL_TO_COLUMN: Record<string, string> = {
  "Nome": "name",
  "Email": "email",
  "Telefone": "phone",
  "WhatsApp": "whatsapp",
  "Status": "status",
  "CPF/CNPJ": "cnpj_cpf",
  "Empresa": "company_name",
  "Tipo": "client_type",
  "Profissão": "profession",
  "Nascimento": "birth_date",
  "Rua": "address_street",
  "Número": "address_number",
  "Cidade": "address_city",
  "Estado": "address_state",
  "CEP": "address_zip",
  "Indústria": "industry",
  "Porte": "company_size",
  "Faturamento": "annual_revenue",
  "Website": "website",
  "LinkedIn": "linkedin",
  "Instagram": "instagram",
  "Facebook": "facebook",
  "Anotações": "notes",
  "Tags": "tags",
  // Purchase fields are stored in notes, not as separate columns
  "Item Comprado (lista)": "_purchase_items",
  "Data da Compra": "_purchase_date",
  "Valor Total da Compra": "_purchase_total",
};

export interface ExecutionContext {
  supabase: any;
  automation: any;
  incomingData: Record<string, unknown>;
  resolveValue: (path: string) => unknown;
  resolveTemplate: (text: string) => string;
  createdClientData?: Record<string, unknown>;
}

// ==================== CREATE CLIENT ====================
export async function executeCreateClient(
  ctx: ExecutionContext,
  node: any,
  edges: any[],
) {
  const { supabase, automation, incomingData, resolveValue } = ctx;
  const config = node.config || {};

  const clientData: Record<string, unknown> = {
    company_id: automation.company_id,
    created_by: automation.created_by,
    status: config.defaultStatus || "lead",
  };

  const purchaseInfo: string[] = [];

  for (const edge of edges) {
    if (edge.sourceField && edge.targetField) {
      const dbColumn = FIELD_LABEL_TO_COLUMN[edge.targetField];
      if (dbColumn) {
        const value = resolveValue(edge.sourceField);
        if (value !== null && value !== undefined) {
          // Handle virtual purchase fields -> store in notes
          if (dbColumn.startsWith("_purchase")) {
            if (dbColumn === "_purchase_items") {
              purchaseInfo.push(`Itens: ${String(value)}`);
            } else if (dbColumn === "_purchase_date") {
              purchaseInfo.push(`Data da Compra: ${String(value)}`);
            } else if (dbColumn === "_purchase_total") {
              purchaseInfo.push(`Valor Total: ${String(value)}`);
            }
          } else if (dbColumn === "tags" && typeof value === "string") {
            clientData[dbColumn] = value.split(",").map((t: string) => t.trim());
          } else if (dbColumn === "annual_revenue") {
            clientData[dbColumn] = typeof value === "number" ? value : parseFloat(String(value)) || null;
          } else {
            clientData[dbColumn] = String(value);
          }
        }
      }
    } else if (!edge.sourceField && !edge.targetField) {
      for (const [key, val] of Object.entries(incomingData)) {
        const lk = key.toLowerCase();
        if ((lk.includes("nome") || lk === "name") && !clientData.name) clientData.name = String(val);
        if ((lk.includes("email") || lk === "email") && !clientData.email) clientData.email = String(val);
        if ((lk.includes("telefone") || lk.includes("phone") || lk.includes("celular")) && !clientData.phone) clientData.phone = String(val);
        if ((lk.includes("cpf") || lk.includes("cnpj")) && !clientData.cnpj_cpf) clientData.cnpj_cpf = String(val);
        if ((lk.includes("whatsapp") || lk === "wpp") && !clientData.whatsapp) clientData.whatsapp = String(val);
      }
    }
  }

  // Append purchase info to notes if present
  if (purchaseInfo.length > 0) {
    clientData.notes = `${clientData.notes || ""}${clientData.notes ? "\n" : ""}📦 Compra:\n${purchaseInfo.join("\n")}`.trim();
  }

  if (!clientData.name) {
    clientData.name = (incomingData["name"] || incomingData["nome"] || incomingData["nome_completo"] || "Contato via Webhook") as string;
  }

  if (config.clientOrigin) {
    const origin = config.clientOrigin === "outro" ? (config.clientOriginCustom || "outro") : config.clientOrigin;
    clientData.notes = `${clientData.notes || ""}${clientData.notes ? "\n" : ""}Origem: ${origin}`.trim();
  }

  if (config.autoNotes) {
    let notes = config.autoNotes as string;
    notes = notes.replace(/\{\{data\.(.+?)\}\}/g, (_: string, field: string) => String(resolveValue(field) || ""));
    clientData.notes = `${clientData.notes || ""}${clientData.notes ? "\n" : ""}${notes}`.trim();
  }

  if (config.autoTags && Array.isArray(config.autoTags) && config.autoTags.length > 0) {
    const existing = Array.isArray(clientData.tags) ? clientData.tags : [];
    clientData.tags = [...new Set([...existing, ...config.autoTags])];
  }

  if (config.clientType) clientData.client_type = config.clientType;

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert(clientData)
    .select("id, name, email, phone, whatsapp")
    .single();

  if (error) throw new Error(`Failed to create client: ${error.message}`);

  // Store created client data for downstream nodes
  ctx.createdClientData = { ...clientData, id: newClient?.id };

  if (config.addToGroupId && newClient?.id) {
    const phone = (clientData.phone || clientData.whatsapp || "") as string;
    if (phone) {
      await supabase.from("contact_group_members").insert({
        group_id: config.addToGroupId,
        client_id: newClient.id,
        phone,
        name: clientData.name as string,
      });
    }
  }

  console.log("Client created:", newClient?.id);
  return { clientId: newClient?.id, ...clientData };
}

// ==================== SEND EMAIL ====================
export async function executeSendEmail(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate } = ctx;
  const config = node.config || {};

  const to = resolveTemplate(config.to || "");
  const subject = resolveTemplate(config.subject || "");
  let body = resolveTemplate(config.body || "");

  // If a template ID is provided, fetch the template content from DB
  if (config.templateId && config.templateId !== '_none') {
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", config.templateId)
      .single();

    if (tpl?.html_content) {
      body = resolveTemplate(tpl.html_content);
    }
  }

  if (!to) throw new Error("Destinatário de email não configurado");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      recipient_email: to,
      recipient_name: resolveTemplate(config.recipientName || ""),
      subject,
      content_html: body || `<p>${subject}</p>`,
      user_id: automation.created_by,
      company_id: automation.company_id,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Falha ao enviar email");

  console.log("Email sent to:", to);
  return { to, subject, emailId: result.email_id };
}

// ==================== SEND WHATSAPP ====================
export async function executeSendWhatsApp(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate } = ctx;
  const config = node.config || {};

  const to = resolveTemplate(config.to || "");
  const message = resolveTemplate(config.message || "");

  if (!to) throw new Error("Número de WhatsApp não configurado");
  if (!message) throw new Error("Mensagem não configurada");

  // Find an active WhatsApp session for this company
  const { data: sessions } = await supabase
    .from("whatsapp_sessions")
    .select("id, instance_name")
    .eq("company_id", automation.company_id)
    .eq("status", "connected")
    .limit(1);

  if (!sessions || sessions.length === 0) {
    throw new Error("Nenhuma sessão WhatsApp conectada");
  }

  const session = sessions[0];
  const baileysUrl = 'https://baileys-server-novo-production.up.railway.app';

  // Clean phone number
  let phone = to.replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "55" + phone.substring(1);
  if (!phone.startsWith("55") && phone.length <= 11) phone = "55" + phone;

  const res = await fetch(`${baileysUrl}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: session.id,
      instanceName: session.instance_name,
      to: phone,
      text: message,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Falha ao enviar WhatsApp");

  console.log("WhatsApp sent to:", phone);
  return { to: phone, message: message.substring(0, 100) };
}

// ==================== UPDATE CLIENT ====================
export async function executeUpdateClient(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate, resolveValue } = ctx;
  const config = node.config || {};

  const identifier = resolveTemplate(config.clientIdentifier || "");
  if (!identifier) throw new Error("Identificador do cliente não configurado");

  let updateFields: Record<string, unknown> = {};
  try {
    const raw = resolveTemplate(config.updateFields || "{}");
    updateFields = JSON.parse(raw);
  } catch {
    throw new Error("JSON de campos inválido");
  }

  // Try to find client by email, phone, or ID
  let query = supabase.from("clients").select("id").eq("company_id", automation.company_id);
  if (identifier.includes("@")) {
    query = query.eq("email", identifier);
  } else if (identifier.match(/^[0-9a-f-]{36}$/i)) {
    query = query.eq("id", identifier);
  } else {
    query = query.or(`phone.eq.${identifier},whatsapp.eq.${identifier},cnpj_cpf.eq.${identifier}`);
  }

  const { data: clients } = await query.limit(1);
  if (!clients || clients.length === 0) throw new Error(`Cliente não encontrado: ${identifier}`);

  const { error } = await supabase
    .from("clients")
    .update(updateFields)
    .eq("id", clients[0].id);

  if (error) throw new Error(`Falha ao atualizar: ${error.message}`);

  console.log("Client updated:", clients[0].id);
  return { clientId: clients[0].id, updatedFields: Object.keys(updateFields) };
}

// ==================== CREATE TASK ====================
export async function executeCreateTask(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate } = ctx;
  const config = node.config || {};

  const title = resolveTemplate(config.title || "Tarefa da automação");
  const description = resolveTemplate(config.description || "");
  const dueDays = parseInt(config.dueDays) || 3;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + dueDays);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      company_id: automation.company_id,
      created_by: automation.created_by,
      title,
      description,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      event_type: "task",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao criar tarefa: ${error.message}`);

  console.log("Task created:", data?.id);
  return { taskId: data?.id, title, dueDate: startDate.toISOString() };
}

// ==================== HTTP REQUEST ====================
export async function executeHttpRequest(ctx: ExecutionContext, node: any) {
  const { resolveTemplate } = ctx;
  const config = node.config || {};

  const url = resolveTemplate(config.url || "");
  if (!url) throw new Error("URL não configurada");

  const method = config.method || "POST";
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  try {
    if (config.headers) {
      const parsed = JSON.parse(resolveTemplate(config.headers));
      headers = { ...headers, ...parsed };
    }
  } catch { /* ignore header parse errors */ }

  const fetchOptions: RequestInit = { method, headers };

  if (method !== "GET" && config.body) {
    fetchOptions.body = resolveTemplate(config.body);
  }

  const res = await fetch(url, fetchOptions);
  let responseData: any;
  try {
    responseData = await res.json();
  } catch {
    responseData = await res.text();
  }

  console.log("HTTP request:", method, url, "->", res.status);
  return { url, method, status: res.status, response: responseData };
}

// ==================== CREATE PROPOSAL ====================
export async function executeCreateProposal(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate } = ctx;
  const config = node.config || {};

  const title = resolveTemplate(config.proposalTitle || "Proposta automática");

  // Find client if available
  let clientId = null;
  if (ctx.createdClientData?.id) {
    clientId = ctx.createdClientData.id;
  }

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      company_id: automation.company_id,
      created_by: automation.created_by,
      title,
      client_id: clientId,
      status: "draft",
      template_id: config.templateId || null,
      items: [],
    })
    .select("id, proposal_number")
    .single();

  if (error) throw new Error(`Falha ao criar proposta: ${error.message}`);

  console.log("Proposal created:", data?.id);
  return { proposalId: data?.id, proposalNumber: data?.proposal_number, title };
}


// ==================== CREATE RECEIPT ====================
export async function executeCreateReceipt(ctx: ExecutionContext, node: any) {
  const { supabase, automation, resolveTemplate } = ctx;
  const config = node.config || {};

  const title = resolveTemplate(config.title || "Recibo automático");
  const amount = parseFloat(resolveTemplate(config.amount || "0")) || 0;
  const description = resolveTemplate(config.description || "");
  const paymentMethod = config.payment_method || "PIX";
  const sendMethod = config.send_method || "none";

  // Find client
  let clientId = null;
  let clientName = null;
  let clientDocument = null;
  if (ctx.createdClientData?.id) {
    clientId = ctx.createdClientData.id as string;
    clientName = ctx.createdClientData.name as string;
    clientDocument = ctx.createdClientData.cnpj_cpf as string;
  }

  const { data, error } = await supabase
    .from("receipts")
    .insert({
      company_id: automation.company_id,
      created_by: automation.created_by,
      title,
      amount,
      description: description || null,
      payment_method: paymentMethod,
      client_id: clientId,
      client_name: clientName,
      client_document: clientDocument,
      notes: resolveTemplate(config.notes || "") || null,
      status: sendMethod !== "none" ? "enviado" : "rascunho",
    })
    .select("id, receipt_number")
    .single();

  if (error) throw new Error(`Falha ao criar recibo: ${error.message}`);

  console.log("Receipt created:", data?.id);

  // Send if configured
  if (sendMethod !== "none" && clientId) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    // Get client details
    const { data: client } = await supabase
      .from("clients")
      .select("name, email, phone, whatsapp")
      .eq("id", clientId)
      .single();

    if (client) {
      const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      const receiptText = `🧾 *Recibo ${data.receipt_number}*\n\n📋 ${title}\n💰 Valor: ${fmtBRL(amount)}\n💳 Pagamento: ${paymentMethod}${description ? `\n📝 ${description}` : ""}`;

      if ((sendMethod === "email" || sendMethod === "both") && client.email) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              recipient_email: client.email,
              recipient_name: client.name,
              subject: `Recibo: ${title}`,
              content_html: `<div style="font-family:Arial;max-width:500px;margin:0 auto;padding:20px"><div style="background:#059669;padding:20px;border-radius:12px 12px 0 0;color:white"><h2 style="margin:0">Recibo ${data.receipt_number}</h2></div><div style="background:white;border:1px solid #eee;border-top:0;padding:20px"><h3>${title}</h3><p style="font-size:24px;font-weight:bold;color:#059669">${fmtBRL(amount)}</p><p>Forma de pagamento: ${paymentMethod}</p>${description ? `<p>${description}</p>` : ""}</div></div>`,
            }),
          });
        } catch (e) { console.error("Email receipt error:", e); }
      }

      if ((sendMethod === "whatsapp" || sendMethod === "both") && (client.whatsapp || client.phone)) {
        try {
          const { data: sessions } = await supabase
            .from("whatsapp_sessions")
            .select("id, baileys_server_url, instance_name")
            .eq("company_id", automation.company_id)
            .eq("status", "connected")
            .limit(1);

          const session = sessions?.[0];
          if (session?.baileys_server_url) {
            let cleanPhone = (client.whatsapp || client.phone).replace(/\D/g, "");
            if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = "55" + cleanPhone;
            await fetch(`${session.baileys_server_url}/api/message/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jid: `${cleanPhone}@s.whatsapp.net`, message: receiptText, instanceName: session.instance_name }),
            });
          }
        } catch (e) { console.error("WhatsApp receipt error:", e); }
      }
    }
  }

  return { receiptId: data?.id, receiptNumber: data?.receipt_number, title, amount };
}

// ==================== CONDITION ====================
export function evaluateCondition(ctx: ExecutionContext, node: any): boolean {
  const config = node.config || {};
  const fieldValue = String(ctx.resolveTemplate(config.field || "") || "");
  const compareValue = String(config.value || "");
  const operator = config.operator || "equals";

  switch (operator) {
    case "equals": return fieldValue === compareValue;
    case "not_equals": return fieldValue !== compareValue;
    case "contains": return fieldValue.includes(compareValue);
    case "greater": return parseFloat(fieldValue) > parseFloat(compareValue);
    case "less": return parseFloat(fieldValue) < parseFloat(compareValue);
    case "exists": return fieldValue !== "" && fieldValue !== "null" && fieldValue !== "undefined";
    default: return false;
  }
}

// ==================== FILTER ====================
export function evaluateFilter(ctx: ExecutionContext, node: any): boolean {
  const config = node.config || {};
  const fieldValue = String(ctx.resolveTemplate(config.filterField || "") || "");
  const operator = config.filterOperator || "not_empty";
  const compareValue = String(config.filterValue || "");

  switch (operator) {
    case "not_empty": return fieldValue !== "" && fieldValue !== "null" && fieldValue !== "undefined";
    case "is_empty": return fieldValue === "" || fieldValue === "null" || fieldValue === "undefined";
    case "equals": return fieldValue === compareValue;
    case "contains": return fieldValue.includes(compareValue);
    default: return true;
  }
}
