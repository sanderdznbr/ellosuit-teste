import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse user agent to extract browser, OS, and device type
function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // Browser detection
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Vivaldi')) browser = 'Vivaldi';
  else if (ua.includes('Brave')) browser = 'Brave';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer';
  // Email client detection
  else if (ua.includes('Thunderbird')) browser = 'Thunderbird';
  else if (ua.includes('Outlook')) browser = 'Outlook';
  else if (ua.includes('Apple Mail') || ua.includes('AppleWebKit')) browser = 'Apple Mail';
  else if (ua.includes('GoogleImageProxy')) browser = 'Gmail';
  else if (ua.includes('Yahoo')) browser = 'Yahoo Mail';

  // OS detection
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('CrOS')) os = 'ChromeOS';

  // Device type detection
  if (ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android') && !ua.includes('Tablet')) {
    deviceType = 'mobile';
  } else if (ua.includes('iPad') || ua.includes('Tablet')) {
    deviceType = 'tablet';
  } else if (ua.includes('GoogleImageProxy') || ua.includes('Yahoo')) {
    deviceType = 'email_proxy';
  }

  return { browser, os, deviceType };
}

// Get geolocation from IP using free API
async function getGeoFromIP(ip: string): Promise<{ country: string; city: string } | null> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (!response.ok) {
      await response.text(); // consume body
      return null;
    }
    
    const data = await response.json();
    if (data.status === 'success') {
      return { country: data.country || 'Unknown', city: data.city || 'Unknown' };
    }
    return null;
  } catch {
    return null;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pixel_id = url.searchParams.get('pixel_id');

    if (!pixel_id) {
      return new Response('Missing pixel_id', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find email by tracking_pixel_id
    const { data: emailData, error: emailError } = await supabase
      .from('emails')
      .select('id, open_count')
      .eq('tracking_pixel_id', pixel_id)
      .single();

    if (emailError || !emailData) {
      console.error('Email not found for pixel_id:', pixel_id);
      return returnPixel();
    }

    // Extract all available data
    const userAgent = req.headers.get('user-agent') || '';
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const ipAddress = cfConnectingIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
    const referrer = req.headers.get('referer') || req.headers.get('referrer') || null;
    const acceptLanguage = req.headers.get('accept-language') || null;

    // Parse user agent
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Get geolocation (non-blocking, with timeout)
    const geo = await getGeoFromIP(ipAddress);

    const currentCount = (emailData.open_count || 0) + 1;
    const now = new Date().toISOString();

    // Record EVERY open event (not just the first one)
    await supabase
      .from('email_events')
      .insert({
        email_id: emailData.id,
        event_type: 'opened',
        user_agent: userAgent,
        ip_address: ipAddress === 'unknown' ? null : ipAddress,
        timestamp: now,
        browser,
        os,
        device_type: deviceType,
        country: geo?.country || null,
        city: geo?.city || null,
        referrer,
        open_count: currentCount,
        metadata: {
          accept_language: acceptLanguage,
          is_first_open: currentCount === 1,
        }
      });

    // Update email record with open stats
    const updateData: Record<string, any> = {
      open_count: currentCount,
      last_opened_at: now,
    };

    // Set opened_at only on first open
    if (currentCount === 1) {
      updateData.opened_at = now;
    }

    await supabase
      .from('emails')
      .update(updateData)
      .eq('id', emailData.id);

    console.log(`📧 Email opened (${currentCount}x):`, emailData.id, `| ${browser} | ${os} | ${deviceType} | ${geo?.city || 'unknown'}, ${geo?.country || 'unknown'}`);

    return returnPixel();

  } catch (error: any) {
    console.error('Error in track-email-open function:', error);
    return returnPixel();
  }
};

function returnPixel(): Response {
  // 1x1 transparent GIF
  const pixelData = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B
  ]);

  return new Response(pixelData, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

Deno.serve(handler);
