import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser(token)
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders })
    }

    const adminUserId = user.id
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: adminCheck } = await serviceClient
      .from('company_users')
      .select('role')
      .eq('user_id', adminUserId)
      .eq('role', 'adminmaster')
      .single()

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden: adminmaster role required' }), { status: 403, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'impersonate'

    // ── IMPERSONATE ──
    if (action === 'impersonate') {
      const { targetUserId, reason } = await req.json()
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'targetUserId required' }), { status: 400, headers: corsHeaders })
      }

      const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(targetUserId)
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders })
      }

      await serviceClient.from('admin_impersonation_logs').insert({
        admin_user_id: adminUserId,
        target_user_id: targetUserId,
        reason: reason || 'Admin investigation',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      })

      const { data: sessionData, error: sessionError } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email!,
      })

      if (sessionError) {
        return new Response(JSON.stringify({ error: 'Failed to generate impersonation link' }), { status: 500, headers: corsHeaders })
      }

      return new Response(JSON.stringify({
        success: true,
        link: sessionData.properties?.action_link,
        user: { id: userData.user.id, email: userData.user.email }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── STATS (enhanced) ──
    if (action === 'stats') {
      const [companies, subscriptions, users, tickets, bugs] = await Promise.all([
        serviceClient.from('companies').select('id, name, created_at', { count: 'exact' }),
        serviceClient.from('subscriptions').select('*'),
        serviceClient.from('company_users').select('user_id, role, company_id, created_at', { count: 'exact' }),
        serviceClient.from('support_tickets').select('id, status', { count: 'exact' }),
        serviceClient.from('bug_reports').select('id, status', { count: 'exact' }),
      ])

      const allSubs = subscriptions.data || []
       const activeSubs = allSubs.filter(s => s.status === 'active' && s.plan_type !== 'partner')
      const trialingSubs = allSubs.filter(s => s.status === 'trialing')
      const canceledSubs = allSubs.filter(s => s.status === 'canceled')
      const pastDueSubs = allSubs.filter(s => s.status === 'past_due')
      const monthlyRevenue = activeSubs.reduce((sum, s) => sum + Number(s.monthly_price || 0), 0)

      // Plan breakdown
      const planBreakdown: Record<string, number> = {}
      allSubs.forEach(s => {
        planBreakdown[s.plan_type] = (planBreakdown[s.plan_type] || 0) + 1
      })

      // Recent signups (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const recentCompanies = (companies.data || []).filter(c => c.created_at >= thirtyDaysAgo)

      // Open tickets/bugs
      const openTickets = (tickets.data || []).filter(t => t.status === 'open').length
      const openBugs = (bugs.data || []).filter(b => b.status === 'open' || b.status === 'in_progress').length

      // Registration trend (last 7 days)
      const registrationTrend: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        registrationTrend[key] = 0
      }
      ;(companies.data || []).forEach(c => {
        const day = c.created_at.split('T')[0]
        if (registrationTrend[day] !== undefined) {
          registrationTrend[day]++
        }
      })

       const recentUsersRaw = (users.data || [])
         .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
         .slice(0, 15)

       const recentUsers = await Promise.all(
         recentUsersRaw.map(async (u) => {
           try {
             const { data: authUser } = await serviceClient.auth.admin.getUserById(u.user_id)
             return { ...u, email: authUser?.user?.email || 'N/A' }
           } catch {
             return { ...u, email: 'N/A' }
           }
         })
       )

      // Enrich most recent subscriptions with company name and owner email
      const companiesById: Record<string, any> = {}
      ;(companies.data || []).forEach((c: any) => { companiesById[c.id] = c })

      const recentSubsRaw = [...allSubs]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)

      const recentSubscriptionsDetailed = await Promise.all(
        recentSubsRaw.map(async (s: any) => {
          const company = companiesById[s.company_id]
          let ownerEmail = 'N/A'
          let ownerName: string | null = null
          try {
            const { data: cu } = await serviceClient
              .from('company_users')
              .select('user_id, role')
              .eq('company_id', s.company_id)
              .order('created_at', { ascending: true })
              .limit(5)
            const owner = (cu || []).find((u: any) => u.role === 'adminmaster' || u.role === 'admin') || (cu || [])[0]
            if (owner?.user_id) {
              const { data: authUser } = await serviceClient.auth.admin.getUserById(owner.user_id)
              ownerEmail = authUser?.user?.email || 'N/A'
              ownerName = (authUser?.user?.user_metadata as any)?.full_name || null
            }
          } catch {}
          return {
            ...s,
            company_name: company?.name || null,
            owner_email: ownerEmail,
            owner_name: ownerName,
          }
        })
      )

       return new Response(JSON.stringify({
         totalCompanies: companies.count || 0,
         totalUsers: users.count || 0,
         activeSubscriptions: activeSubs.length,
         trialingSubscriptions: trialingSubs.length,
         canceledSubscriptions: canceledSubs.length,
         pastDueSubscriptions: pastDueSubs.length,
         monthlyRevenue,
         planBreakdown,
         recentSignups: recentCompanies.length,
         openTickets,
         openBugs,
         registrationTrend,
         subscriptions: allSubs,
         recentSubscriptionsDetailed,
         recentCompanies: (companies.data || []).slice(0, 20),
        allCompanies: (companies.data || []).map(c => ({ id: c.id, name: c.name })),
         recentUsers,
       }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── COMPANY DETAILS (enhanced with user emails) ──
    if (action === 'company-details') {
      const companyId = url.searchParams.get('companyId')
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'companyId required' }), { status: 400, headers: corsHeaders })
      }

      const [company, companyUsers, clients, events, agents, flows, subscription, modules] = await Promise.all([
        serviceClient.from('companies').select('*').eq('id', companyId).single(),
        serviceClient.from('company_users').select('*').eq('company_id', companyId),
        serviceClient.from('clients').select('id', { count: 'exact' }).eq('company_id', companyId),
        serviceClient.from('calendar_events').select('id', { count: 'exact' }).eq('company_id', companyId),
        serviceClient.from('ai_agents').select('id, name, is_active').eq('company_id', companyId),
        serviceClient.from('chatbot_flows').select('id, name, is_active').eq('company_id', companyId),
        serviceClient.from('subscriptions').select('*').eq('company_id', companyId).maybeSingle(),
        serviceClient.from('subscription_modules').select('*').eq('company_id', companyId),
      ])

      // Fetch user emails from auth
      const usersWithEmail = await Promise.all(
        (companyUsers.data || []).map(async (cu) => {
          try {
            const { data } = await serviceClient.auth.admin.getUserById(cu.user_id)
            return { ...cu, email: data?.user?.email || 'N/A', last_sign_in: data?.user?.last_sign_in_at }
          } catch {
            return { ...cu, email: 'N/A', last_sign_in: null }
          }
        })
      )

      return new Response(JSON.stringify({
        company: company.data,
        users: usersWithEmail,
        clientsCount: clients.count || 0,
        eventsCount: events.count || 0,
        agents: agents.data || [],
        flows: flows.data || [],
        subscription: subscription.data,
        modules: modules.data || [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── ALL COMPANIES ──
    if (action === 'all-companies') {
      const { data: allCompanies } = await serviceClient
        .from('companies')
        .select('id, name, domain, created_at')
        .order('created_at', { ascending: false })

      const { data: userCounts } = await serviceClient
        .from('company_users')
        .select('company_id')

      const { data: allSubs } = await serviceClient
        .from('subscriptions')
        .select('company_id, plan_type, status, monthly_price')

      const companyCounts: Record<string, number> = {}
      ;(userCounts || []).forEach(u => {
        companyCounts[u.company_id] = (companyCounts[u.company_id] || 0) + 1
      })

      const subMap: Record<string, any> = {}
      ;(allSubs || []).forEach(s => {
        subMap[s.company_id] = s
      })

      const enriched = (allCompanies || []).map(c => ({
        ...c,
        userCount: companyCounts[c.id] || 0,
        subscription: subMap[c.id] || null,
      }))

      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── MODIFY SUBSCRIPTION ──
    if (action === 'modify-subscription') {
      const { companyId, planType, status, modules: newModules, billingCycle } = await req.json()
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'companyId required' }), { status: 400, headers: corsHeaders })
      }

      const updates: any = {}
      if (planType) updates.plan_type = planType
      if (status) updates.status = status
      if (billingCycle) updates.billing_cycle = billingCycle

      // Special handling for Partner: full access, no charge, no expiry
      if (planType === 'partner') {
        updates.status = 'active'
        updates.monthly_price = 0
        updates.trial_ends_at = null
        updates.current_period_start = new Date().toISOString()
        // Far future period end (10 years) so nothing expires
        updates.current_period_end = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
      } else if (planType === 'free') {
        updates.monthly_price = 0
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await serviceClient
          .from('subscriptions')
          .update(updates)
          .eq('company_id', companyId)
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
        }
      }

      // Sync companies.is_partner flag (used by consume_ai_credits and access gates)
      if (planType === 'partner') {
        await serviceClient.from('companies').update({ is_partner: true }).eq('id', companyId)
        // Give partner unlimited-ish limits
        await serviceClient.from('subscription_limits').upsert({
          company_id: companyId,
          max_users: 999,
          max_storage_gb: 999,
          max_emails_month: 999999,
          max_ai_agents: 999,
          max_whatsapp_sessions: 999,
          max_chatbot_flows: 999,
          max_booking_links: 999,
          max_meeting_participants: 999,
          max_meeting_hours: 999,
          max_tracked_docs: 999999,
          max_tracked_links: 999999,
          max_tracked_videos: 999999,
        }, { onConflict: 'company_id' })
      } else if (planType === 'free' || planType === 'pro') {
        await serviceClient.from('companies').update({ is_partner: false }).eq('id', companyId)
      }

      // Update modules if provided
      if (newModules && Array.isArray(newModules)) {
        // Get subscription id
        const { data: sub } = await serviceClient
          .from('subscriptions')
          .select('id')
          .eq('company_id', companyId)
          .single()
        
        if (sub) {
          // Deactivate all current modules
          await serviceClient
            .from('subscription_modules')
            .update({ is_active: false })
            .eq('company_id', companyId)

          // Activate requested modules
          for (const mod of newModules) {
            const { data: existing } = await serviceClient
              .from('subscription_modules')
              .select('id')
              .eq('company_id', companyId)
              .eq('module_type', mod)
              .maybeSingle()

            if (existing) {
              await serviceClient
                .from('subscription_modules')
                .update({ is_active: true })
                .eq('id', existing.id)
            } else {
              await serviceClient
                .from('subscription_modules')
                .insert({
                  subscription_id: sub.id,
                  company_id: companyId,
                  module_type: mod,
                  is_active: true,
                  monthly_price: 0,
                })
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── CHANGE USER ROLE ──
    if (action === 'change-role') {
      const { userId, companyId, newRole } = await req.json()
      if (!userId || !companyId || !newRole) {
        return new Response(JSON.stringify({ error: 'userId, companyId, and newRole required' }), { status: 400, headers: corsHeaders })
      }

      const { error } = await serviceClient
        .from('company_users')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('company_id', companyId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

     // ── DELETE COMPANY & DATA ──
     if (action === 'delete-company') {
       const { companyId } = await req.json()
       if (!companyId) {
         return new Response(JSON.stringify({ error: 'companyId required' }), { status: 400, headers: corsHeaders })
       }
 
       // 1. Get all users of this company
       const { data: users } = await serviceClient
         .from('company_users')
         .select('user_id')
         .eq('company_id', companyId)
 
       // 2. Delete data from various tables (cascade should handle most, but we list critical ones)
       // We rely on service role to bypass RLS
       // The order matters if there are no cascade deletes
       
       // 3. Delete the company (this should cascade to company_users, clients, agents, flows, subscriptions, etc.)
       const { error: deleteError } = await serviceClient
         .from('companies')
         .delete()
         .eq('id', companyId)
 
       if (deleteError) {
         return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: corsHeaders })
       }
 
       // 4. Delete users from Auth (optional/dangerous? User asked to delete user together with company)
       // If a user belongs to OTHER companies, we should NOT delete them from auth.
       // We only delete users who only belonged to this company.
       if (users && users.length > 0) {
         for (const u of users) {
           const { count } = await serviceClient
             .from('company_users')
             .select('id', { count: 'exact', head: true })
             .eq('user_id', u.user_id)
           
           if (count === 0) {
             // No other company associations, safe to delete from auth
             await serviceClient.auth.admin.deleteUser(u.user_id)
           }
         }
       }
 
       return new Response(JSON.stringify({ success: true }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     }
 
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
