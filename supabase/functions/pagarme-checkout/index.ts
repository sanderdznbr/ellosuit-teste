import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  plan_id: 'omni' | 'flow' | 'track' | 'business';
  billing_cycle: 'monthly' | 'yearly';
  payment_method: 'credit_card' | 'pix';
  card?: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  };
  customer: {
    name: string;
    email: string;
    document: string;
    phone: string;
  };
}

// Plan pricing configuration
const PLANS = {
  omni: { monthly: 19700, yearly: 197000, name: 'Omni - Comunicação' },
  flow: { monthly: 14700, yearly: 147000, name: 'Flow - Produtividade' },
  track: { monthly: 9700, yearly: 97000, name: 'Track - Rastreamento' },
  business: { monthly: 29700, yearly: 297000, name: 'Business - Completo' },
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
    const userEmail = claimsData.user.email;

    // Get user's company
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single();

    if (companyError || !companyUser) {
      throw new Error('Company not found for user');
    }

    const body: CheckoutRequest = await req.json();
    const { plan_id, billing_cycle, payment_method, card, customer } = body;

    if (!PLANS[plan_id]) {
      throw new Error('Invalid plan');
    }

    const plan = PLANS[plan_id];
    const amount = billing_cycle === 'yearly' ? plan.yearly : plan.monthly;
    const interval = billing_cycle === 'yearly' ? 'year' : 'month';

    console.log(`Creating subscription for user ${userId}, plan: ${plan_id}, method: ${payment_method}`);

    // Base64 encode the secret key for Basic Auth
    const authToken = btoa(`${PAGARME_SECRET_KEY}:`);

    // Step 1: Create or get customer in Pagar.me
    let pagarmeCustomerId: string;

    // Check if customer already exists in our database
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('pagarme_customer_id')
      .eq('company_id', companyUser.company_id)
      .not('pagarme_customer_id', 'is', null)
      .single();

    if (existingSubscription?.pagarme_customer_id) {
      pagarmeCustomerId = existingSubscription.pagarme_customer_id;
      console.log('Using existing Pagar.me customer:', pagarmeCustomerId);
    } else {
      // Create new customer
      const customerResponse = await fetch('https://api.pagar.me/core/v5/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customer.name,
          email: customer.email || userEmail,
          document: customer.document.replace(/\D/g, ''),
          type: customer.document.replace(/\D/g, '').length > 11 ? 'company' : 'individual',
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: customer.phone.replace(/\D/g, '').substring(0, 2),
              number: customer.phone.replace(/\D/g, '').substring(2),
            },
          },
        }),
      });

      const customerData = await customerResponse.json();
      
      if (!customerResponse.ok) {
        console.error('Pagar.me customer error:', customerData);
        throw new Error(customerData.message || 'Failed to create customer');
      }

      pagarmeCustomerId = customerData.id;
      console.log('Created Pagar.me customer:', pagarmeCustomerId);
    }

    // Step 2: Create subscription with 7-day trial
    const subscriptionPayload: any = {
      customer_id: pagarmeCustomerId,
      plan_id: null, // We use "avulsa" subscription (without pre-created plan)
      payment_method: payment_method,
      interval: interval,
      interval_count: 1,
      billing_type: 'prepaid',
      minimum_price: null,
      installments: 1,
      statement_descriptor: 'ELLOSUIT',
      currency: 'BRL',
      items: [
        {
          description: plan.name,
          quantity: 1,
          pricing_scheme: {
            scheme_type: 'unit',
            price: amount,
          },
        },
      ],
      metadata: {
        company_id: companyUser.company_id,
        user_id: userId,
        plan_id: plan_id,
        billing_cycle: billing_cycle,
      },
    };

    // Add credit card for trial (required for 7-day trial)
    if (payment_method === 'credit_card' && card) {
      subscriptionPayload.card = {
        number: card.number.replace(/\D/g, ''),
        holder_name: card.holder_name,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        cvv: card.cvv,
        billing_address: {
          line_1: 'Endereço do cliente',
          zip_code: '00000000',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        },
      };
      
      // 7-day free trial - only for credit card
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      subscriptionPayload.start_at = trialEnd.toISOString();
    }

    console.log('Creating subscription with payload:', JSON.stringify(subscriptionPayload, null, 2));

    const subscriptionResponse = await fetch('https://api.pagar.me/core/v5/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      console.error('Pagar.me subscription error:', subscriptionData);
      throw new Error(subscriptionData.message || 'Failed to create subscription');
    }

    console.log('Created Pagar.me subscription:', subscriptionData.id);

    // Step 3: Update our database
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Update or create subscription in our database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .upsert({
        company_id: companyUser.company_id,
        plan_type: plan_id === 'business' ? 'business' : 'base',
        billing_cycle: billing_cycle,
        status: 'trialing',
        monthly_price: amount / 100,
        trial_ends_at: trialEndsAt.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndsAt.toISOString(),
        pagarme_subscription_id: subscriptionData.id,
        pagarme_customer_id: pagarmeCustomerId,
      }, {
        onConflict: 'company_id',
      });

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    // Activate the appropriate module
    if (plan_id !== 'business') {
      await supabase.from('subscription_modules').upsert({
        company_id: companyUser.company_id,
        module_type: plan_id,
        is_active: true,
        activated_at: new Date().toISOString(),
        monthly_price: amount / 100,
      }, {
        onConflict: 'company_id,module_type',
      });
    } else {
      // Business plan: activate all modules
      for (const moduleType of ['omni', 'flow', 'track']) {
        await supabase.from('subscription_modules').upsert({
          company_id: companyUser.company_id,
          module_type: moduleType,
          is_active: true,
          activated_at: new Date().toISOString(),
          monthly_price: 0, // Included in business
        }, {
          onConflict: 'company_id,module_type',
        });
      }
    }

    // Auto-create receipt for trial activation
    try {
      const planName = PLANS[plan_id as keyof typeof PLANS]?.name || 'Business';
      const receiptTitle = `Ativacao Trial 7 Dias - ${planName}`;
      
      await supabase.from('receipts').insert({
        company_id: companyUser.company_id,
        created_by: userId,
        title: receiptTitle,
        amount: 0,
        payment_method: 'Trial Gratuito',
        description: `Periodo de teste gratuito de 7 dias do plano ${planName}. Valido ate ${trialEndsAt.toLocaleDateString('pt-BR')}.`,
        client_name: body.customer.name,
        client_document: body.customer.document,
        status: 'pago',
        notes: `Assinatura Pagar.me: ${subscriptionData.id}`,
      });

      console.log('Trial receipt created for company:', companyUser.company_id);

      // Send trial started email
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
      
      await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          template_key: 'trial_started',
          recipient_email: body.customer.email,
          recipient_name: body.customer.name,
          variables: {
            nome_plano: planName,
          },
        }),
      }).catch(e => console.error('Trial email error:', e));

      console.log('Trial email sent to:', body.customer.email);
    } catch (receiptErr) {
      console.error('Error creating trial receipt:', receiptErr);
    }

    // Return success with PIX QR code if applicable
    let pixData = null;
    if (payment_method === 'pix' && subscriptionData.current_cycle?.current_invoice?.charges?.[0]?.last_transaction) {
      const transaction = subscriptionData.current_cycle.current_invoice.charges[0].last_transaction;
      pixData = {
        qr_code: transaction.qr_code,
        qr_code_url: transaction.qr_code_url,
        expires_at: transaction.expires_at,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscriptionData.id,
        status: subscriptionData.status,
        trial_ends_at: trialEndsAt.toISOString(),
        pix: pixData,
        message: payment_method === 'credit_card' 
          ? 'Assinatura criada com 7 dias de teste grátis!' 
          : 'Aguardando pagamento PIX',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Checkout failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
