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
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('🔄 Sync request received:', body);

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

      console.log('👤 Syncing for user:', user.id);

      // Get user's company_id
      const { data: companyData, error: companyError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyError || !companyData?.company_id) {
        throw new Error('User company not found');
      }

      console.log('🏢 Company ID:', companyData.company_id);

      // Get user's Google integration
      const { data: integration, error: integrationError } = await supabase
        .from('meeting_integrations')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'google_meet')
        .single();

      if (integrationError || !integration) {
        console.log('❌ Google Calendar integration not found for user');
        return new Response(JSON.stringify({
          success: false,
          error: 'Google Calendar not connected'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
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
            client_id: googleClientId as string,
            client_secret: googleClientSecret as string,
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

      // Get sync timeframe - last 6 months to next 12 months
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 6);
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 12);

      console.log('📅 Fetching events from Google Calendar...', {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString()
      });

      // Fetch events from Google Calendar with pagination
      let allEvents = [];
      let nextPageToken = null;
      
      do {
        const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        calendarUrl.searchParams.set('maxResults', '2500');
        calendarUrl.searchParams.set('singleEvents', 'true');
        calendarUrl.searchParams.set('orderBy', 'startTime');
        calendarUrl.searchParams.set('timeMin', timeMin.toISOString());
        calendarUrl.searchParams.set('timeMax', timeMax.toISOString());
        
        if (nextPageToken) {
          calendarUrl.searchParams.set('pageToken', nextPageToken);
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

        if (eventsData.items) {
          allEvents.push(...eventsData.items);
        }

        nextPageToken = eventsData.nextPageToken;
        console.log(`📄 Fetched ${eventsData.items?.length || 0} events (page)`);
        
      } while (nextPageToken);

      console.log(`📅 Total events fetched: ${allEvents.length}`);

      if (allEvents.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No events found',
          synced: 0,
          updated: 0,
          deleted: 0
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Get existing events from database
      const { data: existingEvents, error: existingError } = await supabase
        .from('calendar_events')
        .select('id, google_event_id, title, start_date, end_date, description, updated_at')
        .eq('company_id', companyData.company_id)
        .not('google_event_id', 'is', null);

      if (existingError) {
        console.error('❌ Error fetching existing events:', existingError);
        throw new Error('Failed to fetch existing events');
      }

      // Create maps for efficient comparison
      const existingEventsMap = new Map();
      const existingEventIds = new Set();
      
      existingEvents?.forEach(event => {
        existingEventsMap.set(event.google_event_id, event);
        existingEventIds.add(event.google_event_id);
      });

      const googleEventIds = new Set(allEvents.map(event => event.id));

      // Find events to create, update, and delete
      const eventsToCreate = [];
      const eventsToUpdate = [];
      let syncedCount = 0;
      let updatedCount = 0;

      // Process Google events
      for (const googleEvent of allEvents) {
        const existingEvent = existingEventsMap.get(googleEvent.id);
        
        // Determine meeting provider based on meeting link
        let meetingProvider = null;
        if (googleEvent.hangoutLink) {
          meetingProvider = 'google_meet';
        }

        const eventData = {
          title: googleEvent.summary || 'Evento sem título',
          description: googleEvent.description || '',
          start_date: googleEvent.start?.dateTime || googleEvent.start?.date,
          end_date: googleEvent.end?.dateTime || googleEvent.end?.date,
          event_type: 'meeting',
          meeting_link: googleEvent.hangoutLink || null,
          meeting_provider: meetingProvider,
          attendees: googleEvent.attendees ? googleEvent.attendees.map((a: any) => a.email) : [],
          is_all_day: !googleEvent.start?.dateTime,
          google_event_id: googleEvent.id,
          company_id: companyData.company_id,
          created_by: user.id,
          color: '#4285F4',
          updated_at: new Date().toISOString()
        };

        if (!existingEvent) {
          // New event
          eventsToCreate.push(eventData);
          syncedCount++;
        } else {
          // Check if event needs update
          const googleUpdated = new Date(googleEvent.updated).toISOString();
          const localUpdated = new Date(existingEvent.updated_at).toISOString();
          
          if (googleUpdated > localUpdated || 
              existingEvent.title !== eventData.title ||
              existingEvent.description !== eventData.description ||
              existingEvent.start_date !== eventData.start_date ||
              existingEvent.end_date !== eventData.end_date) {
            
            eventsToUpdate.push({
              id: existingEvent.id,
              ...eventData
            });
            updatedCount++;
          }
        }
      }

      // Find events to delete (exist locally but not in Google)
      const eventsToDelete = existingEvents?.filter(event => 
        !googleEventIds.has(event.google_event_id)
      ) || [];

      console.log(`📊 Sync summary: ${eventsToCreate.length} to create, ${eventsToUpdate.length} to update, ${eventsToDelete.length} to delete`);

      // Execute database operations in batches
      const batchSize = 50;

      // Create new events
      if (eventsToCreate.length > 0) {
        for (let i = 0; i < eventsToCreate.length; i += batchSize) {
          const batch = eventsToCreate.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(batch);

          if (insertError) {
            console.error('❌ Error inserting events batch:', insertError);
          } else {
            console.log(`✅ Inserted ${batch.length} events`);
          }
        }
      }

      // Update existing events
      if (eventsToUpdate.length > 0) {
        for (const event of eventsToUpdate) {
          const { id, ...updateData } = event;
          
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            console.error('❌ Error updating event:', updateError);
          }
        }
        console.log(`✅ Updated ${eventsToUpdate.length} events`);
      }

      // Delete removed events
      if (eventsToDelete.length > 0) {
        const deleteIds = eventsToDelete.map(event => event.id);
        
        const { error: deleteError } = await supabase
          .from('calendar_events')
          .delete()
          .in('id', deleteIds);

        if (deleteError) {
          console.error('❌ Error deleting events:', deleteError);
        } else {
          console.log(`✅ Deleted ${eventsToDelete.length} events`);
        }
      }

      console.log('✅ Google Calendar sync completed successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Google Calendar synced successfully',
        synced: syncedCount,
        updated: updatedCount,
        deleted: eventsToDelete.length,
        total_processed: allEvents.length
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('💥 Error in sync-google-calendar function:', error);
    
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
});