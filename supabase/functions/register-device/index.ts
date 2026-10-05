import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
      const { token } = await req.json();
      
      if (!token) {
        throw new Error('Device token is required');
      }

      console.log('📱 Registering device token:', token);

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from('device_tokens')
        .select('id')
        .eq('token', token)
        .single();

      if (existingToken) {
        console.log('✅ Device token already registered');
        return new Response(JSON.stringify({
          success: true,
          message: 'Device token already registered'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert new device token
      const { error } = await supabase
        .from('device_tokens')
        .insert({ token });

      if (error) {
        console.error('❌ Error registering device token:', error);
        throw error;
      }

      console.log('✅ Device token registered successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Device token registered successfully'
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
    console.error('💥 Error in register-device function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as any).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
