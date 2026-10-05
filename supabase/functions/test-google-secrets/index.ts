// Test Google Secrets

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Testando secrets do Google...');
    
    // Verificar se as secrets estão disponíveis
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('📋 Status das variáveis de ambiente:');
    console.log('- GOOGLE_CLIENT_ID:', googleClientId ? `Presente (${googleClientId.length} chars)` : 'AUSENTE');
    console.log('- GOOGLE_CLIENT_SECRET:', googleClientSecret ? `Presente (${googleClientSecret.length} chars)` : 'AUSENTE');
    console.log('- SUPABASE_URL:', supabaseUrl ? 'Presente' : 'AUSENTE');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Presente' : 'AUSENTE');
    
    const result = {
      timestamp: new Date().toISOString(),
      secrets: {
        GOOGLE_CLIENT_ID: {
          exists: !!googleClientId,
          length: googleClientId?.length || 0,
          preview: googleClientId ? googleClientId.substring(0, 20) + '...' : null
        },
        GOOGLE_CLIENT_SECRET: {
          exists: !!googleClientSecret,
          length: googleClientSecret?.length || 0,
          preview: googleClientSecret ? googleClientSecret.substring(0, 10) + '...' : null
        },
        SUPABASE_URL: {
          exists: !!supabaseUrl
        },
        SUPABASE_SERVICE_ROLE_KEY: {
          exists: !!supabaseServiceKey
        }
      },
      allSecretsAvailable: !!(googleClientId && googleClientSecret && supabaseUrl && supabaseServiceKey)
    };
    
    console.log('✅ Resultado do teste:', result);
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Erro no teste de secrets:', error);
    
    return new Response(JSON.stringify({ 
      error: (error as any).message,
      stack: (error as any).stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});