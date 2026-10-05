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
    const { phone, email, newPassword } = await req.json();

    if (!phone || !newPassword) {
      return new Response(JSON.stringify({ error: 'Telefone e nova senha são obrigatórios' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cleanPhone = phone.replace(/\D/g, '');

    // Check that the phone was recently verified
    const { data: verification } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return new Response(JSON.stringify({ error: 'Telefone não verificado. Verifique seu número primeiro.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check verification is recent (within 30 minutes)
    const verifiedAt = new Date(verification.created_at);
    if (Date.now() - verifiedAt.getTime() > 30 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'Verificação expirada. Verifique seu número novamente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find user - prefer email lookup if provided (more reliable)
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      console.error('[RESET] Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro interno ao buscar usuário.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetUser = null;

    // First try email match
    if (email) {
      targetUser = usersData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
    }

    // Fallback to phone match
    if (!targetUser) {
      targetUser = usersData?.users?.find((u: any) => {
        const userPhone = (u.user_metadata?.phone || '').replace(/\D/g, '');
        return userPhone === cleanPhone || 
               userPhone === `55${cleanPhone}` || 
               `55${userPhone}` === cleanPhone ||
               userPhone.replace(/^55(\d{2})9/, '55$1') === cleanPhone.replace(/^55(\d{2})9/, '55$1');
      });
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'Nenhuma conta encontrada com este email/telefone.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset the password
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[RESET] Error updating password:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao redefinir senha. Tente novamente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up used verification
    await supabase.from('phone_verifications').delete().eq('id', verification.id);

    console.log(`[RESET] Password reset for user ${targetUser.email} via phone ${cleanPhone}`);

    return new Response(JSON.stringify({ 
      success: true, 
      email: targetUser.email,
      message: 'Senha redefinida com sucesso' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[RESET] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
