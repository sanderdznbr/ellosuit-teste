import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ error: 'Telefone e código são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cleanPhone = phone.replace(/\D/g, '');

    // First check if the code exists at all (regardless of expiry)
    const { data: anyMatch } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('code', code)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!anyMatch) {
      return new Response(JSON.stringify({ error: 'Código inválido. Verifique e tente novamente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if it's expired
    if (new Date(anyMatch.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Código expirado. Solicite um novo código e tente novamente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as verified
    await supabase
      .from('phone_verifications')
      .update({ verified: true })
      .eq('id', anyMatch.id);

    return new Response(JSON.stringify({ success: true, message: 'Telefone verificado com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VERIFY-CODE] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
