import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role key to bypass RLS for tracking
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const {
        documentId,
        sessionId,
        eventType,
        pageNumber,
        data,
        visitorId
      } = await req.json();

      // Get client info
      const userAgent = req.headers.get('user-agent');
      const forwardedFor = req.headers.get('x-forwarded-for');
      const realIP = req.headers.get('x-real-ip');
      const ipAddress = forwardedFor?.split(',')[0] || realIP || 'unknown';

      console.log('Tracking event:', {
        documentId,
        sessionId,
        eventType,
        pageNumber,
        data,
        visitorId,
        userAgent: userAgent?.substring(0, 200), // Limit length
        ipAddress
      });

      // Insert tracking event
      const { error } = await supabase
        .from('document_tracking_events')
        .insert({
          document_id: documentId,
          session_id: sessionId,
          event_type: eventType,
          page_number: pageNumber,
          data: data || {},
          user_agent: userAgent?.substring(0, 200),
          ip_address: ipAddress,
          visitor_id: visitorId
        });

      if (error) {
        console.error('Error inserting tracking event:', error);
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const documentId = url.searchParams.get('documentId');

      if (!documentId) {
        throw new Error('documentId is required for GET requests');
      }

      // Get document stats
      const { data: stats, error } = await supabase
        .from('document_tracking_events')
        .select(`
          event_type,
          page_number,
          data,
          timestamp,
          visitor_id,
          session_id
        `)
        .eq('document_id', documentId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching tracking stats:', error);
        throw error;
      }

      // Process detailed session data
      const sessionIds = [...new Set(stats?.map(s => s.session_id))];
      const uniqueVisitors = [...new Set(stats?.filter(s => s.visitor_id).map(s => s.visitor_id))];
      
      // Process sessions with detailed page data
      const sessionData: Record<string, any> = {};
      
      sessionIds.forEach(sessionId => {
        const sessionEvents = stats?.filter(s => s.session_id === sessionId) || [];
        const visitorId = sessionEvents.find(e => e.visitor_id)?.visitor_id;
        
        // Get document open event for session start time
        const documentOpen = sessionEvents.find(e => e.event_type === 'document_open');
        const sessionStart = documentOpen ? new Date(documentOpen.timestamp).getTime() : null;
        
        // Get session end event
        const sessionEnd = sessionEvents.find(e => e.event_type === 'session_end');
        const sessionEndTime = sessionEnd ? new Date(sessionEnd.timestamp).getTime() : null;
        
        // Calculate time spent per page in this session
        const pageTimeData: Record<number, number> = {};
        const pageSequence: Array<{page: number, timestamp: string, duration?: number}> = [];
        
        // Group time_spent events by page
        const timeSpentEvents = sessionEvents.filter(e => e.event_type === 'time_spent');
        timeSpentEvents.forEach(event => {
          const page = event.page_number || 1;
          const duration = event.data?.duration || 0;
          pageTimeData[page] = Math.max(pageTimeData[page] || 0, duration);
        });
        
        // Create page sequence from page_view and page_navigation events
        const navigationEvents = sessionEvents.filter(e => 
          ['page_view', 'page_navigation'].includes(e.event_type)
        ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        navigationEvents.forEach(event => {
          const page = event.page_number || 1;
          const duration = pageTimeData[page] ? Math.round(pageTimeData[page] / 1000) : 0;
          pageSequence.push({
            page,
            timestamp: event.timestamp,
            duration
          });
        });
        
        sessionData[sessionId] = {
          sessionId,
          visitorId,
          startTime: sessionStart,
          endTime: sessionEndTime,
          duration: sessionEndTime && sessionStart ? sessionEndTime - sessionStart : null,
          pageSequence,
          totalPagesVisited: [...new Set(sessionEvents.map(e => e.page_number).filter(Boolean))].length,
          totalEvents: sessionEvents.length,
          events: sessionEvents.slice(0, 20) // Limit events per session
        };
      });

      // Process overall page statistics
      const pageViews = stats?.filter(s => s.event_type === 'page_view') || [];
      const pageStats = pageViews.reduce((acc, view) => {
        const page = view.page_number || 1;
        if (!acc[page]) {
          acc[page] = { views: 0, timeSpent: 0, visitors: new Set() };
        }
        acc[page].views++;
        if (view.visitor_id) {
          acc[page].visitors.add(view.visitor_id);
        }
        return acc;
      }, {} as Record<number, { views: number, timeSpent: number, visitors: Set<string> }>);

      // Calculate time spent per page across all sessions
      const timeSpentEvents = stats?.filter(s => s.event_type === 'time_spent') || [];
      const timeByPage = timeSpentEvents.reduce((acc, event) => {
        const page = event.page_number || 1;
        const duration = event.data?.duration || 0;
        const sessionId = event.session_id;
        
        if (!acc[page]) {
          acc[page] = { totalTime: 0, sessions: new Map() };
        }
        
        // Store max time per session for this page
        const currentSessionTime = acc[page].sessions.get(sessionId) || 0;
        acc[page].sessions.set(sessionId, Math.max(currentSessionTime, duration));
        
        return acc;
      }, {} as Record<number, { totalTime: number, sessions: Map<string, number> }>);

      // Calculate average time per page
      Object.entries(timeByPage).forEach(([page, data]) => {
        const pageNum = parseInt(page);
        const sessionTimes = Array.from(data.sessions.values());
        const avgTime = sessionTimes.length > 0 
          ? sessionTimes.reduce((sum, time) => sum + time, 0) / sessionTimes.length 
          : 0;
        
        if (pageStats[pageNum]) {
          pageStats[pageNum].timeSpent = Math.round(avgTime / 1000); // Convert to seconds
        } else {
          pageStats[pageNum] = {
            views: 0,
            timeSpent: Math.round(avgTime / 1000),
            visitors: new Set()
          };
        }
      });

      // Convert page stats for JSON serialization
      const processedPageStats = Object.entries(pageStats).map(([page, data]) => ({
        page: parseInt(page),
        views: data.views,
        uniqueVisitors: data.visitors.size,
        timeSpent: data.timeSpent
      })).sort((a, b) => b.timeSpent - a.timeSpent);

      const response = {
        totalSessions: sessionIds.length,
        uniqueVisitors: uniqueVisitors.length,
        totalEvents: stats?.length || 0,
        pageStats: processedPageStats,
        sessions: Object.values(sessionData).sort((a, b) => 
          new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
        ).slice(0, 20), // Limit to last 20 sessions
        recentEvents: stats?.slice(0, 50) || []
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in document-tracking function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});