import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { token, name, email, phone, company_name, notes } = body;

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
      return new Response(JSON.stringify({ error: 'Nome é obrigatório (máx 200 caracteres)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate optional fields
    if (email && (typeof email !== 'string' || email.length > 255)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (phone && (typeof phone !== 'string' || phone.length > 30)) {
      return new Response(JSON.stringify({ error: 'Telefone inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('form_integration_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Token inválido ou desativado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert the client
    const { error: insertError } = await supabaseAdmin.from('clients').insert({
      name: name.trim().substring(0, 200),
      email: email?.trim().substring(0, 255) || null,
      phone: phone?.trim().substring(0, 30) || null,
      company_name: company_name?.trim().substring(0, 200) || null,
      notes: notes?.trim().substring(0, 1000) || null,
      client_type: tokenData.contact_type || 'prospecto',
      status: 'prospect',
      company_id: tokenData.company_id,
      created_by: tokenData.created_by,
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao salvar contato' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Contato cadastrado com sucesso' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
