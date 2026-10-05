import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const userClient = createClient(supabaseUrl, anonKey!, { global: { headers: { Authorization: authHeader || '' } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { proposal_id, send_method, scope_message } = await req.json();

    if (!proposal_id || !send_method) {
      return new Response(JSON.stringify({ error: 'proposal_id e send_method são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load proposal with client
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*, clients(name, email, phone, whatsapp, company_name)')
      .eq('id', proposal_id)
      .single();

    if (propError || !proposal) {
      return new Response(JSON.stringify({ error: 'Proposta não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const client = proposal.clients as any;
    if (!client) {
      return new Response(JSON.stringify({ error: 'Cliente não vinculado à proposta' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load items
    const { data: items } = await supabase
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposal_id)
      .order('position');

    // Load company
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', proposal.company_id)
      .single();

    const results: any = { email: null, whatsapp: null };
    const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Build items HTML for email
    const itemsHtml = (items || []).map((it: any) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${it.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmtBRL(it.unit_price)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmtBRL(it.total_price)}</td>
      </tr>`
    ).join('');

    const primaryColor = (proposal.custom_colors as any)?.primary || '#3000E3';

    const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:${primaryColor};padding:24px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">${proposal.title}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0">${company?.name || ''}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0">
        ${scope_message ? `<p style="color:#374151;margin-bottom:20px;line-height:1.6">${scope_message.replace(/\n/g, '<br>')}</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0">` : ''}
        <p style="color:#6B7280;font-size:14px">Proposta: <strong>${proposal.proposal_number || ''}</strong></p>
        <p style="color:#6B7280;font-size:14px">Cliente: <strong>${client.name}</strong></p>
        ${proposal.valid_until ? `<p style="color:#6B7280;font-size:14px">Válida até: <strong>${new Date(proposal.valid_until).toLocaleDateString('pt-BR')}</strong></p>` : ''}
        
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left;font-size:13px;color:#6B7280">Item</th>
            <th style="padding:8px;text-align:center;font-size:13px;color:#6B7280">Qtd</th>
            <th style="padding:8px;text-align:right;font-size:13px;color:#6B7280">Unitário</th>
            <th style="padding:8px;text-align:right;font-size:13px;color:#6B7280">Total</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align:right;padding:12px;background:#f9fafb;border-radius:8px;margin-top:8px">
          <p style="font-size:18px;font-weight:bold;color:${primaryColor};margin:0">Total: ${fmtBRL(proposal.total || 0)}</p>
        </div>

        ${proposal.notes ? `<div style="margin-top:16px;padding:12px;background:#f0f9ff;border-radius:8px"><p style="font-size:13px;color:#374151;margin:0"><strong>Observações:</strong><br>${proposal.notes}</p></div>` : ''}
        ${proposal.custom_terms ? `<div style="margin-top:12px;padding:12px;background:#fefce8;border-radius:8px"><p style="font-size:12px;color:#374151;margin:0"><strong>Termos:</strong><br>${proposal.custom_terms}</p></div>` : ''}
      </div>
      <div style="background:${primaryColor};padding:16px;border-radius:0 0 12px 12px;text-align:center">
        <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0">${company?.name || 'Proposta Comercial'}</p>
      </div>
    </div>`;

    // Send email
    if (send_method === 'email' || send_method === 'both') {
      if (!client.email) {
        results.email = { success: false, error: 'Cliente sem email cadastrado' };
      } else {
        try {
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              recipient_email: client.email,
              recipient_name: client.name,
              subject: `Proposta: ${proposal.title}`,
              content_html: emailHtml,
              content_text: `Proposta ${proposal.title} - Total: ${fmtBRL(proposal.total || 0)}`,
              from_name: company?.name || 'Proposta Comercial',
              user_id: user.id,
            }),
          });
          const emailResult = await emailRes.json();
          results.email = { success: emailRes.ok, ...emailResult };
        } catch (e: any) {
          results.email = { success: false, error: e.message };
        }
      }
    }

    // Send WhatsApp
    if (send_method === 'whatsapp' || send_method === 'both') {
      const phone = client.whatsapp || client.phone;
      if (!phone) {
        results.whatsapp = { success: false, error: 'Cliente sem telefone/WhatsApp cadastrado' };
      } else {
        try {
          // Get company WhatsApp session
          const { data: sessions } = await supabase
            .from('whatsapp_sessions')
            .select('id, baileys_server_url, instance_name')
            .eq('company_id', proposal.company_id)
            .eq('status', 'connected')
            .limit(1);

          const session = sessions?.[0];
          if (!session?.baileys_server_url) {
            results.whatsapp = { success: false, error: 'Nenhuma sessão WhatsApp conectada' };
          } else {
            // Clean phone
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
              cleanPhone = '55' + cleanPhone;
            }
            const jid = `${cleanPhone}@s.whatsapp.net`;

            // Build text message
            let whatsappText = scope_message ? `${scope_message}\n\n---\n\n` : '';
            whatsappText += `📋 *${proposal.title}*\n`;
            whatsappText += `${company?.name || ''}\n\n`;
            whatsappText += `👤 Cliente: ${client.name}\n`;
            if (proposal.proposal_number) whatsappText += `📄 Nº: ${proposal.proposal_number}\n`;
            if (proposal.valid_until) whatsappText += `📅 Válida até: ${new Date(proposal.valid_until).toLocaleDateString('pt-BR')}\n`;
            whatsappText += `\n*Itens:*\n`;
            (items || []).forEach((it: any) => {
              whatsappText += `• ${it.name} (${it.quantity}x) — ${fmtBRL(it.total_price)}\n`;
            });
            whatsappText += `\n💰 *Total: ${fmtBRL(proposal.total || 0)}*`;
            if (proposal.notes) whatsappText += `\n\n📝 ${proposal.notes}`;

            const sendRes = await fetch(`${session.baileys_server_url}/api/message/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jid,
                message: whatsappText,
                instanceName: session.instance_name,
              }),
            });
            const sendResult = await sendRes.json();
            results.whatsapp = { success: sendRes.ok, ...sendResult };
          }
        } catch (e: any) {
          results.whatsapp = { success: false, error: e.message };
        }
      }
    }

    // Update proposal status to 'enviada'
    await supabase.from('proposals').update({ status: 'enviada' }).eq('id', proposal_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('send-proposal error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
