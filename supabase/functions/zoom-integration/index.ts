import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log('📨 Zoom request body:', JSON.stringify(requestBody, null, 2));
    
    const { action, ...payload } = requestBody;
    console.log('🎯 Zoom Integration Action:', action);

    switch (action) {
      case 'get_auth_url': {
        const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
        if (!zoomClientId) {
          throw new Error('ZOOM_CLIENT_ID não configurado');
        }

        // Usar a URL correta do ellosuit
        const redirectUri = 'https://www.ellosuit.app/dashboard';
        const authUrl = `https://zoom.us/oauth/authorize?` +
          `client_id=${zoomClientId}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=meeting:write&` +
          `state=zoom_auth`;

        return new Response(JSON.stringify({ authUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'exchange_code': {
        const { code, user_id } = payload;
        console.log('🔄 Processando exchange_code para Zoom...', { code: code ? 'presente' : 'ausente', user_id });
        
        const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
        const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

        if (!zoomClientId || !zoomClientSecret) {
          console.error('❌ Credenciais Zoom não configuradas');
          throw new Error('Credenciais Zoom não configuradas');
        }

        const redirectUri = 'https://www.ellosuit.app/dashboard';
        
        const tokenResponse = await fetch('https://zoom.us/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
          })
        });

        const tokenData = await tokenResponse.json();
        console.log('📡 Resposta do token Zoom:', { 
          ok: tokenResponse.ok, 
          status: tokenResponse.status,
          hasAccessToken: !!tokenData.access_token,
          error: tokenData.error 
        });
        
        if (!tokenResponse.ok) {
          console.error('❌ Erro ao obter token Zoom:', tokenData);
          throw new Error(`Erro ao obter token: ${tokenData.error || 'Erro desconhecido'}`);
        }

        // Obter informações do usuário
        const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        const userData = await userResponse.json();
        console.log('👤 Dados do usuário Zoom:', { 
          id: userData.id, 
          email: userData.email,
          status: userResponse.status 
        });

        if (!userResponse.ok) {
          console.error('❌ Erro ao obter dados do usuário Zoom:', userData);
          throw new Error('Erro ao obter dados do usuário Zoom');
        }

        // Obter company_id do usuário
        const { data: companyData } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user_id)
          .single();

        if (!companyData?.company_id) {
          console.error('❌ Usuário não associado a empresa:', { user_id });
          throw new Error('Usuário não está associado a uma empresa');
        }

        console.log('🏢 Company ID encontrado:', companyData.company_id);

        // Salvar integração
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        
        const { error } = await supabase
          .from('meeting_integrations')
          .upsert({
            user_id: user_id,
            company_id: companyData.company_id,
            provider: 'zoom',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt.toISOString(),
            provider_user_id: userData.id,
            provider_email: userData.email
          }, {
            onConflict: 'user_id,provider'
          });

        if (error) {
          console.error('❌ Erro ao salvar integração Zoom:', error);
          throw error;
        }

        console.log('✅ Integração Zoom salva com sucesso');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create_meeting': {
        const { accessToken, eventData } = payload;
        
        console.log('🔍 Creating Zoom meeting with:', { accessToken: accessToken ? 'present' : 'missing', eventData });
        
        if (!accessToken) {
          console.error('❌ Access token missing for Zoom meeting creation');
          throw new Error('Access token is required for creating Zoom meetings');
        }
        
        if (!eventData || !eventData.title || !eventData.start_date) {
          console.error('❌ Invalid event data:', eventData);
          throw new Error('Missing required event data (title, start_date)');
        }
        
        const meetingData = {
          topic: eventData.title,
          type: 2, // Scheduled meeting
          start_time: eventData.start_date,
          duration: 60, // default 60 minutes
          agenda: eventData.description || '',
          settings: {
            join_before_host: true,
            mute_participants_upon_entry: true
          }
        };

        const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(meetingData)
        });

        const meeting = await response.json();
        
        if (!response.ok) {
          throw new Error(`Erro ao criar reunião Zoom: ${meeting.message}`);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          meetingLink: meeting.join_url,
          meetingId: meeting.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'renew_token': {
        const { refreshToken, user_id } = payload;
        const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
        const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

        const tokenResponse = await fetch('https://zoom.us/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
          })
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok) {
          throw new Error(`Erro ao renovar token: ${tokenData.error}`);
        }

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        
        const { error } = await supabase
          .from('meeting_integrations')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || refreshToken,
            expires_at: expiresAt.toISOString()
          })
          .eq('user_id', user_id)
          .eq('provider', 'zoom');

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          access_token: tokenData.access_token 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

  } catch (error) {
    console.error('💥 Erro na integração Zoom:', error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
