import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PAGARME_SECRET_KEY = Deno.env.get('PAGARME_SECRET_KEY');
    if (!PAGARME_SECRET_KEY) {
      throw new Error('PAGARME_SECRET_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;

    // Get user's company
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .single();

    if (companyError || !companyUser) {
      throw new Error('Company not found for user');
    }

    // Only admins can cancel subscriptions
    if (companyUser.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can cancel subscriptions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('pagarme_subscription_id')
      .eq('company_id', companyUser.company_id)
      .single();

    if (subError || !subscription?.pagarme_subscription_id) {
      throw new Error('No active subscription found');
    }

    const authToken = btoa(`${PAGARME_SECRET_KEY}:`);

    // Cancel subscription in Pagar.me
    const cancelResponse = await fetch(
      `https://api.pagar.me/core/v5/subscriptions/${subscription.pagarme_subscription_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_pending_invoices: true,
        }),
      }
    );

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json();
      console.error('Pagar.me cancel error:', errorData);
      throw new Error(errorData.message || 'Failed to cancel subscription');
    }

    console.log('Canceled Pagar.me subscription:', subscription.pagarme_subscription_id);

    // Update our database
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyUser.company_id);

    // Deactivate all modules
    await supabase
      .from('subscription_modules')
      .update({ is_active: false })
      .eq('company_id', companyUser.company_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura cancelada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cancel error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Cancel failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
