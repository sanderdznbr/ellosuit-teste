import { createClient } from "npm:@supabase/supabase-js@2";

// Reuse same user agent parser from track-email-open
function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer';

  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  if (ua.includes('Mobile') || ua.includes('iPhone')) deviceType = 'mobile';
  else if (ua.includes('iPad') || ua.includes('Tablet')) deviceType = 'tablet';

  return { browser, os, deviceType };
}

async function getGeoFromIP(ip: string): Promise<{ country: string; city: string } | null> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) { await response.text(); return null; }
    const data = await response.json();
    if (data.status === 'success') return { country: data.country || 'Unknown', city: data.city || 'Unknown' };
    return null;
  } catch { return null; }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get('t');

    if (!trackingId) {
      return new Response('Missing tracking id', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the tracked link
    const { data: linkData, error: linkError } = await supabase
      .from('email_tracked_links')
      .select('id, email_id, original_url, click_count')
      .eq('tracking_id', trackingId)
      .single();

    if (linkError || !linkData) {
      console.error('Link not found for tracking_id:', trackingId);
      return new Response('Link not found', { status: 404 });
    }

    // Extract metadata
    const userAgent = req.headers.get('user-agent') || '';
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const ipAddress = cfConnectingIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
    const referrer = req.headers.get('referer') || null;
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const geo = await getGeoFromIP(ipAddress);

    // Record click event
    await supabase.from('email_link_clicks').insert({
      tracked_link_id: linkData.id,
      email_id: linkData.email_id,
      user_agent: userAgent,
      ip_address: ipAddress === 'unknown' ? null : ipAddress,
      browser,
      os,
      device_type: deviceType,
      country: geo?.country || null,
      city: geo?.city || null,
      referrer,
    });

    // Increment click count
    await supabase
      .from('email_tracked_links')
      .update({ click_count: (linkData.click_count || 0) + 1 })
      .eq('id', linkData.id);

    // Also record as email event for unified timeline
    await supabase.from('email_events').insert({
      email_id: linkData.email_id,
      event_type: 'clicked',
      user_agent: userAgent,
      ip_address: ipAddress === 'unknown' ? null : ipAddress,
      timestamp: new Date().toISOString(),
      browser,
      os,
      device_type: deviceType,
      country: geo?.country || null,
      city: geo?.city || null,
      referrer,
      metadata: { url: linkData.original_url, tracking_id: trackingId },
    });

    console.log(`🔗 Link clicked: ${linkData.original_url} | ${browser} | ${os} | ${geo?.city || 'unknown'}`);

    // Redirect to original URL
    return new Response(null, {
      status: 302,
      headers: { 'Location': linkData.original_url },
    });

  } catch (error: any) {
    console.error('Error in track-email-link:', error);
    return new Response('Internal error', { status: 500 });
  }
};

Deno.serve(handler);
