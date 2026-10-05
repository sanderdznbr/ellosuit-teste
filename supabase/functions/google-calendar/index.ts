import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle POST requests (from frontend)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('📨 POST request received:', body);

      // Return Google Client ID
      if (body.action === 'get_client_id') {
        console.log('🔑 Returning Google Client ID');
        return new Response(JSON.stringify({
          client_id: googleClientId,
          success: true
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Get auth URL
      if (body.action === 'get_auth_url') {
        console.log('🔗 Generating Google OAuth URL');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}&` +
          `redirect_uri=${encodeURIComponent(`${supabaseUrl}/functions/v1/google-calendar`)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email')}&` +
          `state=google_calendar_auth&` +
          `access_type=offline&` +
          `prompt=consent`;

        return new Response(JSON.stringify({
          authUrl,
          success: true
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Process OAuth code exchange
      if (body.action === 'exchange_code') {
        const { code, user_id } = body;
        console.log('🔄 Processing OAuth code exchange for user:', user_id);

        if (!code || !user_id) {
          throw new Error('Code or user_id missing');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${supabaseUrl}/functions/v1/google-calendar`
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          console.error('❌ Token exchange error:', tokenData);
          throw new Error(`Token exchange failed: ${tokenData.error}`);
        }

        console.log('✅ Tokens obtained successfully');

        // Get user's company_id
        const { data: companyUser, error: companyError } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user_id)
          .single();

        if (companyError || !companyUser) {
          console.error('❌ Error getting user company:', companyError);
          throw new Error('User company not found');
        }

        // Calculate expiration timestamp
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Save to meeting_integrations table
        const { error: insertError } = await supabase
          .from('meeting_integrations')
          .upsert({
            user_id: user_id,
            company_id: companyUser.company_id,
            provider: 'google_meet',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
          });

        if (insertError) {
          console.error('❌ Error saving integration:', insertError);
          throw new Error(`Failed to save integration: ${insertError.message}`);
        }

        console.log('✅ Google Meet integration saved successfully');

        return new Response(JSON.stringify({
          success: true,
          message: 'Google Meet connected successfully'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Handle list_events action
      if (body.action === 'list_events') {
        const { timeMin, timeMax } = body;
        console.log('📅 Listing Google Calendar events...');

        // Get authorization header to extract user token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          throw new Error('Authorization header missing');
        }

        // Get user from JWT token
        const { data: { user }, error: userError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );

        if (userError || !user) {
          throw new Error('User not authenticated');
        }

        // Get user's Google integration
        const { data: integration, error: integrationError } = await supabase
          .from('meeting_integrations')
          .select('access_token, refresh_token, expires_at')
          .eq('user_id', user.id)
          .eq('provider', 'google_meet')
          .single();

        if (integrationError || !integration) {
          throw new Error('Google Calendar integration not found');
        }

        let accessToken = integration.access_token;

        // Check if token is expired and refresh if needed
        const expiresAt = new Date(integration.expires_at);
        const now = new Date();
        
        if (now >= expiresAt && integration.refresh_token) {
          console.log('🔄 Token expired, refreshing...');
          
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: integration.refresh_token,
              grant_type: 'refresh_token'
            })
          });

          const tokenData = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error('❌ Token refresh error:', tokenData);
            throw new Error(`Token refresh failed: ${tokenData.error}`);
          }

          accessToken = tokenData.access_token;

          // Update token in database
          const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
          await supabase
            .from('meeting_integrations')
            .update({
              access_token: accessToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('provider', 'google_meet');

          console.log('✅ Token refreshed successfully');
        }

        // Fetch events from Google Calendar
        const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        calendarUrl.searchParams.set('maxResults', '2500');
        calendarUrl.searchParams.set('singleEvents', 'true');
        calendarUrl.searchParams.set('orderBy', 'startTime');
        
        if (timeMin) {
          calendarUrl.searchParams.set('timeMin', timeMin);
        }
        if (timeMax) {
          calendarUrl.searchParams.set('timeMax', timeMax);
        }

        const eventsResponse = await fetch(calendarUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const eventsData = await eventsResponse.json();

        if (!eventsResponse.ok) {
          console.error('❌ Google Calendar API error:', eventsData);
          throw new Error(`Calendar API error: ${eventsData.error?.message || 'Unknown error'}`);
        }

        console.log(`✅ Successfully fetched ${eventsData.items?.length || 0} events from Google Calendar`);

        return new Response(JSON.stringify({
          success: true,
          events: eventsData.items || []
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Handle create_event action
      if (body.action === 'create_event') {
        const { eventData, accessToken } = body;
        console.log('📅 Creating Google Calendar event...');

        if (!accessToken || !eventData) {
          throw new Error('Access token or event data missing');
        }

        const calendarEvent = {
          summary: eventData.title,
          description: eventData.description,
          start: {
            dateTime: eventData.start_date,
            timeZone: 'UTC'
          },
          end: {
            dateTime: eventData.end_date,
            timeZone: 'UTC'
          },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: {
                type: 'hangoutsMeet'
              }
            }
          },
          attendees: eventData.attendees || []
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(calendarEvent)
        });

        const eventResult = await response.json();

        if (!response.ok) {
          console.error('❌ Google Calendar API error:', eventResult);
          throw new Error(`Calendar API error: ${eventResult.error?.message || 'Unknown error'}`);
        }

        const meetLink = eventResult.conferenceData?.entryPoints?.find(
          (entry: any) => entry.entryPointType === 'video'
        )?.uri;

        console.log('✅ Google Calendar event created with Meet link');

        return new Response(JSON.stringify({
          success: true,
          googleEventId: eventResult.id,
          meetLink: meetLink
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Handle delete_event action
      if (body.action === 'delete_event') {
        const { googleEventId, userId } = body;
        console.log('🗑️ Deleting Google Calendar event:', googleEventId, 'for user:', userId);

        if (!googleEventId || !userId) {
          throw new Error('Google event ID or user ID missing');
        }

        // Get user's access token
        const { data: integration, error: integrationError } = await supabase
          .from('meeting_integrations')
          .select('access_token, refresh_token, expires_at')
          .eq('user_id', userId)
          .eq('provider', 'google_meet')
          .single();

        if (integrationError || !integration) {
          console.error('❌ Error getting user integration:', integrationError);
          throw new Error('Google integration not found for user');
        }

        let accessToken = integration.access_token;

        // Check if token is expired and renew if necessary
        const expiresAt = new Date(integration.expires_at);
        const now = new Date();
        
        if (now >= expiresAt && integration.refresh_token) {
          console.log('🔄 Token expired, renewing before deletion...');
          
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: integration.refresh_token,
              grant_type: 'refresh_token'
            })
          });

          const tokenData = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error('❌ Token renewal error:', tokenData);
            throw new Error(`Token renewal failed: ${tokenData.error}`);
          }

          accessToken = tokenData.access_token;

          // Update token in database
          const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
          await supabase
            .from('meeting_integrations')
            .update({
              access_token: accessToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('provider', 'google_meet');

          console.log('✅ Token renewed successfully');
        }

        // Delete event from Google Calendar
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorText = await deleteResponse.text();
          console.error('❌ Google Calendar delete error:', deleteResponse.status, errorText);
          throw new Error(`Failed to delete event from Google Calendar: ${deleteResponse.status} ${errorText}`);
        }

        if (deleteResponse.status === 404) {
          console.log('⚠️ Event not found in Google Calendar (already deleted)');
        } else {
          console.log('✅ Event deleted from Google Calendar successfully');
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Event deleted from Google Calendar successfully'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Handle Gmail OAuth code exchange
      if (body.action === 'exchange_code_gmail') {
        const { code, user_id } = body;
        console.log('🔄 Processing Gmail OAuth code exchange for user:', user_id);

        if (!code || !user_id) {
          throw new Error('Code or user_id missing');
        }

        // Exchange code for tokens - using www.ellosuit.app/dashboard/email as redirect_uri
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: 'https://www.ellosuit.app/dashboard/email'
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          console.error('❌ Gmail token exchange error:', tokenData);
          throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
        }

        console.log('✅ Gmail tokens obtained successfully');

        // Get user email from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        const userInfo = await userInfoResponse.json();
        
        if (!userInfoResponse.ok) {
          console.error('❌ Failed to get user info:', userInfo);
          throw new Error('Failed to get user email from Google');
        }

        console.log('✅ Got user email:', userInfo.email);

        // Get user's company_id
        const { data: companyUser, error: companyError } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user_id)
          .single();

        if (companyError || !companyUser) {
          console.error('❌ Error getting user company:', companyError);
          throw new Error('User company not found');
        }

        // Calculate expiration timestamp
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Delete any existing Gmail account for this user
        await supabase
          .from('user_email_accounts')
          .delete()
          .eq('user_id', user_id)
          .eq('provider', 'gmail');

        // Save to user_email_accounts table (using correct column names)
        const { error: insertError } = await supabase
          .from('user_email_accounts')
          .insert({
            user_id: user_id,
            company_id: companyUser.company_id,
            provider: 'gmail',
            email: userInfo.email,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            connected_at: new Date().toISOString(),
            status: 'active'
          });

        if (insertError) {
          console.error('❌ Error saving Gmail account:', insertError);
          throw new Error(`Failed to save Gmail account: ${insertError.message}`);
        }

        console.log('✅ Gmail account saved successfully for:', userInfo.email);

        return new Response(JSON.stringify({
          success: true,
          email: userInfo.email,
          message: 'Gmail connected successfully'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // List Gmail sendAs aliases (for "Send As" feature)
      if (body.action === 'list_gmail_aliases') {
        const { user_id } = body;
        console.log('📋 Listing Gmail sendAs aliases for user:', user_id);

        if (!user_id) {
          throw new Error('user_id missing');
        }

        // Get user's Gmail account
        const { data: emailAccount, error: accountError } = await supabase
          .from('user_email_accounts')
          .select('*')
          .eq('user_id', user_id)
          .eq('provider', 'gmail')
          .single();

        if (accountError || !emailAccount) {
          throw new Error('Gmail account not found');
        }

        // Check/refresh token
        let accessToken = emailAccount.access_token;
        const now = new Date();
        const expiresAt = new Date(emailAccount.expires_at);

        if (now >= expiresAt && emailAccount.refresh_token) {
          console.log('⚠️ Token expired, refreshing...');
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: emailAccount.refresh_token,
              grant_type: 'refresh_token'
            })
          });
          const tokens = await tokenResponse.json();
          if (!tokenResponse.ok) {
            throw new Error('Failed to refresh token');
          }
          accessToken = tokens.access_token;
          const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          await supabase.from('user_email_accounts').update({
            access_token: accessToken,
            expires_at: newExpiry
          }).eq('id', emailAccount.id);
        }

        // Fetch sendAs aliases from Gmail API
        const aliasResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (!aliasResponse.ok) {
          const err = await aliasResponse.json();
          console.error('⚠️ Gmail sendAs API error (falling back to primary):', err);
          // Fallback: return primary email as only alias
          return new Response(JSON.stringify({
            success: true,
            aliases: [{
              email: emailAccount.email,
              displayName: emailAccount.display_name || emailAccount.email,
              isDefault: true,
              isPrimary: true,
              verificationStatus: 'accepted'
            }]
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const aliasData = await aliasResponse.json();
        const aliases = (aliasData.sendAs || []).map((a: any) => ({
          email: a.sendAsEmail,
          displayName: a.displayName || '',
          isDefault: a.isDefault || false,
          isPrimary: a.isPrimary || false,
          verificationStatus: a.verificationStatus || 'unknown'
        })).filter((a: any) => a.verificationStatus === 'accepted' || a.isPrimary);

        console.log(`✅ Found ${aliases.length} verified aliases`);

        return new Response(JSON.stringify({
          success: true,
          aliases
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle token renewal
      if (body.action === 'renew_token') {
        const { refreshToken, userId } = body;
        console.log('🔄 Renewing token for user:', userId);

        if (!refreshToken || !userId) {
          throw new Error('Refresh token or user ID missing');
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          console.error('❌ Token renewal error:', tokenData);
          throw new Error(`Token renewal failed: ${tokenData.error}`);
        }

        // Calculate new expiration
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Update the integration with new token
        const { error: updateError } = await supabase
          .from('meeting_integrations')
          .update({
            access_token: tokenData.access_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('provider', 'google_meet');

        if (updateError) {
          console.error('❌ Error updating token:', updateError);
          throw new Error(`Failed to update token: ${updateError.message}`);
        }

        console.log('✅ Token renewed successfully');

        return new Response(JSON.stringify({
          success: true,
          access_token: tokenData.access_token
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'Unknown action'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Handle GET requests (OAuth callback)
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('🔗 OAuth callback received:', {
      code: !!code,
      state,
      error
    });

    if (error) {
      console.error('❌ OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://www.ellosuit.app/dashboard?error=${error}`
        }
      });
    }

    if (!code) {
      console.error('❌ No code in callback');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://www.ellosuit.app/dashboard?error=no_code`
        }
      });
    }

    // Validate state parameter for security
    if (!state) {
      console.error('❌ No state parameter in callback');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://www.ellosuit.app/dashboard?error=invalid_state`
        }
      });
    }

    // Redirect back to dashboard with code and state for frontend processing
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://www.ellosuit.app/dashboard?code=${code}&state=${state}`
      }
    });

  } catch (error) {
    console.error('💥 Error in google-calendar function:', error);
    
    if (req.method === 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: (error as any).message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://www.ellosuit.app/dashboard?error=${encodeURIComponent((error as any).message)}`
      }
    });
  }
});