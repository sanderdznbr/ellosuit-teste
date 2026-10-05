import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    
    console.log('Received Pagar.me webhook:', JSON.stringify(body, null, 2));

    const { type, data } = body;
    const subscriptionId = data?.subscription?.id || data?.id;
    const metadata = data?.subscription?.metadata || data?.metadata;

    if (!subscriptionId) {
      console.log('No subscription ID found in webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyId = metadata?.company_id;
    
    if (!companyId) {
      console.log('No company_id in metadata, skipping');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing webhook type: ${type} for company: ${companyId}`);

    switch (type) {
      case 'subscription.created':
        console.log('Subscription created:', subscriptionId);
        break;

      case 'subscription.activated':
      case 'subscription.renewed':
        // Subscription is now active (trial ended or payment successful)
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
        
        console.log('Subscription activated for company:', companyId);

        // Send renewal email
        if (type === 'subscription.renewed') {
          try {
            const { data: renewUser } = await supabase.from('company_users').select('user_id').eq('company_id', companyId).eq('role', 'admin').limit(1).single();
            if (renewUser) {
              const { data: renewAuth } = await supabase.auth.admin.getUserById(renewUser.user_id);
              if (renewAuth?.user?.email) {
                await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}` },
                  body: JSON.stringify({
                    template_key: 'subscription_renewed',
                    recipient_email: renewAuth.user.email,
                    recipient_name: renewAuth.user.user_metadata?.username || renewAuth.user.email.split('@')[0],
                    invoice_data: { plan_name: 'Business', amount: metadata?.billing_cycle === 'yearly' ? 2497 : 297, billing_cycle: metadata?.billing_cycle || 'monthly' },
                  }),
                }).catch(e => console.error('Renewal email error:', e));
              }
            }
          } catch (e) { console.error('Renewal email error:', e); }
        }
        break;

      case 'subscription.canceled':
      case 'subscription.expired':
        // Subscription canceled or expired
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        // Deactivate all modules
        await supabase
          .from('subscription_modules')
          .update({ is_active: false })
          .eq('company_id', companyId);
        
        console.log('Subscription canceled for company:', companyId);

        // Send cancelation + suspension emails
        try {
          const { data: cancelUser } = await supabase.from('company_users').select('user_id').eq('company_id', companyId).eq('role', 'admin').limit(1).single();
          if (cancelUser) {
            const { data: cancelAuth } = await supabase.auth.admin.getUserById(cancelUser.user_id);
            if (cancelAuth?.user?.email) {
              const cancelName = cancelAuth.user.user_metadata?.username || cancelAuth.user.email.split('@')[0];
              // Cancellation confirmed email
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}` },
                body: JSON.stringify({
                  template_key: 'cancellation_confirmed',
                  recipient_email: cancelAuth.user.email,
                  recipient_name: cancelName,
                  invoice_data: { plan_name: 'Business', billing_cycle: metadata?.billing_cycle || 'monthly' },
                }),
              }).catch(e => console.error('Cancel email error:', e));
              // Account suspended email
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}` },
                body: JSON.stringify({
                  template_key: 'account_suspended',
                  recipient_email: cancelAuth.user.email,
                  recipient_name: cancelName,
                }),
              }).catch(e => console.error('Suspension email error:', e));
            }
          }
        } catch (e) { console.error('Cancel email error:', e); }
        break;

      case 'subscription.pending':
      case 'subscription.overdue':
        // Payment pending or overdue
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
        
        console.log('Subscription past_due for company:', companyId);

        // Send payment pending email
        try {
          const { data: pendingUser } = await supabase
            .from('company_users')
            .select('user_id')
            .eq('company_id', companyId)
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (pendingUser) {
            const { data: pendingAuth } = await supabase.auth.admin.getUserById(pendingUser.user_id);
            if (pendingAuth?.user?.email) {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}`,
                },
                body: JSON.stringify({
                  template_key: 'payment_pending',
                  recipient_email: pendingAuth.user.email,
                  recipient_name: pendingAuth.user.user_metadata?.username || pendingAuth.user.email.split('@')[0],
                  invoice_data: {
                    plan_name: 'Business',
                    amount: metadata?.billing_cycle === 'yearly' ? 2497 : 297,
                    billing_cycle: metadata?.billing_cycle || 'monthly',
                  },
                }),
              }).catch(e => console.error('Pending email error:', e));
            }
          }
        } catch (emailErr) {
          console.error('Error sending pending email:', emailErr);
        }

        break;

      case 'charge.paid':
        // Individual charge paid - update period dates
        const paidAt = data?.paid_at || new Date().toISOString();
        const nextBillingDate = new Date(paidAt);
        
        // Check billing cycle from metadata
        if (metadata?.billing_cycle === 'yearly') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: paidAt,
            current_period_end: nextBillingDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
        
        console.log('Charge paid for company:', companyId);

        // Send payment confirmation email + auto-create receipt
        try {
          const chargeAmount = data?.amount ? (data.amount / 100) : (metadata?.billing_cycle === 'yearly' ? 2497 : 297);
          const paymentMethod = data?.payment_method || data?.last_transaction?.payment_method || 'Cartao de Credito';
          const transactionId = data?.last_transaction?.id || data?.id || '';

          // Get user email from company
          const { data: companyUser } = await supabase
            .from('company_users')
            .select('user_id')
            .eq('company_id', companyId)
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (companyUser) {
            const { data: authUser } = await supabase.auth.admin.getUserById(companyUser.user_id);
            if (authUser?.user?.email) {
              const userName = authUser.user.user_metadata?.username || authUser.user.email.split('@')[0];
              
              // Create receipt record
              const planName = metadata?.billing_cycle === 'yearly' ? 'Business (Anual)' : 'Business (Mensal)';
               const planName = metadata?.billing_cycle === 'yearly' ? 'Business (Anual)' : 'Business (Mensal)';
               
               // 1. Create payment log for Audit Panel
               await supabase.from('subscription_payments').insert({
                 company_id: companyId,
                 amount: chargeAmount,
                 currency: 'BRL',
                 status: 'paid',
                 payment_method: paymentMethod,
                 description: `Assinatura ${planName} via Pagar.me`,
                 pagarme_charge_id: transactionId,
                 paid_at: paidAt,
                 metadata: { ...metadata, transaction_id: transactionId }
               }).then(() => console.log('Subscription payment logged for company:', companyId))
                 .catch(e => console.error('Payment log error:', e));

               // 2. Create system notification for real-time tracking
               await supabase.from('system_notifications_log').insert({
                 event_type: 'payment_success',
                 event_title: 'Pagamento Confirmado',
                 event_description: `Recebido R$ ${chargeAmount} de ${userName} (${planName})`,
                 company_name: userName,
                 metadata: { amount: chargeAmount, plan: planName, transaction_id: transactionId }
               }).catch(e => console.error('System notification log error:', e));

               // 3. Create receipt record
               await supabase.from('receipts').insert({
                 company_id: companyId,
                 created_by: companyUser.user_id,
                 title: `Pagamento - Plano ${planName}`,
                 amount: chargeAmount,
                 payment_method: paymentMethod,
                 description: `Pagamento do plano ${planName}. ID Transacao: ${transactionId}. Proxima cobranca: ${nextBillingDate.toLocaleDateString('pt-BR')}.`,
                 client_name: userName,
                 client_document: authUser.user.user_metadata?.document || null,
                 status: 'pago',
                 notes: `Pagar.me Transaction: ${transactionId}`,
                 sent_at: new Date().toISOString(),
               }).then(() => console.log('Receipt created for company:', companyId))
                 .catch(e => console.error('Receipt creation error:', e));

              // Send payment confirmation email
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}`,
                },
                body: JSON.stringify({
                  template_key: 'payment_confirmed',
                  recipient_email: authUser.user.email,
                  recipient_name: userName,
                  invoice_data: {
                    plan_name: 'Business',
                    amount: chargeAmount,
                    payment_method: paymentMethod,
                    transaction_id: transactionId,
                    billing_cycle: metadata?.billing_cycle || 'monthly',
                    next_billing_date: nextBillingDate.toISOString(),
                  },
                }),
              }).catch(e => console.error('Payment email error:', e));

              console.log('Payment confirmation email sent to:', authUser.user.email);
            }
          }
        } catch (emailErr) {
          console.error('Error sending payment email:', emailErr);
        }

        break;

      case 'charge.payment_failed':
      case 'charge.refunded':
        // Payment failed or refunded
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
        
        console.log('Charge failed/refunded for company:', companyId);
        break;

      case 'order.paid':
        // Order/invoice paid
        console.log('Order paid, subscription should be active');
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);
        break;

      default:
        console.log('Unhandled webhook type:', type);
    }

    // Log the webhook event
    await supabase.from('webhook_logs').insert({
      provider: 'pagarme',
      event_type: type,
      payload: body,
      processed_at: new Date().toISOString(),
    }).catch(err => {
      // Table might not exist, ignore
      console.log('Could not log webhook:', err.message);
    });

    return new Response(
      JSON.stringify({ received: true, type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
