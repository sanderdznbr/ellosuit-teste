import { createClient } from "npm:@supabase/supabase-js@2";
import * as jose from "npm:jose@5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apnsBundleId = Deno.env.get('APNS_BUNDLE_ID');
const apnsTeamId = Deno.env.get('APNS_TEAM_ID');
const apnsKeyId = Deno.env.get('APNS_KEY_ID');
const apnsKey = Deno.env.get('APNS_KEY');

// Function to create JWT for APNs authentication
async function createApnsJwt() {
  if (!apnsKey || !apnsKeyId || !apnsTeamId) {
    throw new Error('APNs credentials not configured');
  }

  try {
    // Decode the base64 private key
    const privateKeyPem = apnsKey.replace(/\\n/g, '\n');
    
    // Import the private key
    const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');
    
    const payload = {
      iss: apnsTeamId,
      iat: Math.floor(Date.now() / 1000)
    };

    // Create and sign the JWT
    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: apnsKeyId })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    console.log('🔑 APNs JWT created successfully for team:', apnsTeamId);
    return jwt;
  } catch (error) {
    console.error('💥 Error creating APNs JWT:', error);
    throw error;
  }
}

function isNativeToken(token: string): boolean {
  // Tokens nativos são hexadecimais de 64 caracteres
  return /^[a-fA-F0-9]{64}$/.test(token);
}

async function sendApnsPushNotification(deviceToken: string, title: string, body: string) {
  try {
    const isNative = isNativeToken(deviceToken);
    console.log(`📱 Enviando notificação para token ${isNative ? 'nativo' : 'simulado'}:`, deviceToken.substring(0, 20) + '...');

    if (!isNative) {
      console.log('⚠️ Token simulado detectado, enviando resposta simulada');
      return { success: true, simulation: true, message: 'Simulação para desenvolvimento web' };
    }

    if (!apnsBundleId || !apnsTeamId || !apnsKeyId || !apnsKey) {
      console.log('⚠️ APNs credentials incomplete, cannot send real notification');
      return { success: false, error: 'APNs credentials not configured' };
    }

    const jwt = await createApnsJwt();
    
    const payload = {
      aps: {
        alert: {
          title: title,
          body: body
        },
        sound: "default",
        badge: 1,
        "mutable-content": 1
      },
      data: {
        type: "reminder",
        timestamp: Date.now()
      }
    };

    // APNs endpoint (production)
    const apnsUrl = `https://api.push.apple.com/3/device/${deviceToken}`;
    
    console.log('📤 Enviando para APNs:', apnsUrl);
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(apnsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apns-topic': apnsBundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('📥 APNs Response Status:', response.status);
    console.log('📥 APNs Response:', responseText);

    if (response.ok) {
      console.log('✅ APNs notification sent successfully');
      return { success: true, simulation: false, apnsResponse: responseText };
    } else {
      console.error('❌ APNs error:', response.status, responseText);
      return { 
        success: false, 
        error: `APNs error: ${response.status} - ${responseText}`,
        apnsStatus: response.status,
        apnsResponse: responseText
      };
    }
  } catch (error) {
    console.error('💥 Error sending APNs notification:', error);
    return { success: false, error: (error as any).message };
  }
}

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
      const { title, body, deviceToken } = await req.json();
      
      if (!title || !body) {
        throw new Error('Title and body are required');
      }

      console.log('📲 Sending push notification:', { title, body });

      // Get all device tokens if no specific token provided
      let tokens = [];
      if (deviceToken) {
        tokens = [deviceToken];
      } else {
        const { data: deviceTokens, error } = await supabase
          .from('device_tokens')
          .select('token');

        if (error) {
          console.error('❌ Error fetching device tokens:', error);
          throw error;
        }

        tokens = deviceTokens?.map(dt => dt.token) || [];
      }

      if (tokens.length === 0) {
        console.log('⚠️ No device tokens found');
        return new Response(JSON.stringify({
          success: true,
          message: 'No devices to send notifications to',
          sent: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📱 Sending to ${tokens.length} device(s)`);

      let sentCount = 0;
      const results = [];

      for (const token of tokens) {
        try {
          const result = await sendApnsPushNotification(token, title, body);
          
          results.push({
            token: token.substring(0, 10) + '...',
            success: result.success,
            simulation: result.simulation || false,
            error: result.error,
            apnsStatus: result.apnsStatus,
            isNative: isNativeToken(token)
          });
          
          if (result.success) {
            sentCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to send to token ${token}:`, error);
          results.push({
            token: token.substring(0, 10) + '...',
            success: false,
            error: (error as any).message,
            isNative: isNativeToken(token)
          });
        }
      }

      console.log(`✅ Push notifications processed: ${sentCount}/${tokens.length} sent`);

      return new Response(JSON.stringify({
        success: true,
        message: `Notifications sent to ${sentCount}/${tokens.length} devices`,
        sent: sentCount,
        total: tokens.length,
        results: results,
        apnsConfigured: !!(apnsBundleId && apnsTeamId && apnsKeyId && apnsKey)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in send-push function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as any).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
