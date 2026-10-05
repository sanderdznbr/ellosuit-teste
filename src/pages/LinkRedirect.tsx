import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

const LinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!code) {
        setError('Código do link inválido');
        return;
      }

      try {
        // Fetch the link by short_code
        const { data: link, error: fetchError } = await supabase
          .from('tracked_links')
          .select('id, original_url, is_active')
          .eq('short_code', code)
          .eq('is_active', true)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching link:', fetchError);
          setError('Erro ao buscar link');
          return;
        }

        if (!link) {
          setError('Link não encontrado ou desativado');
          return;
        }

        // Record the click
        const userAgent = navigator.userAgent;
        const referrer = document.referrer || null;

        // Detect device type
        const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
        const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
        const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

        // Detect browser
        let browser = 'Unknown';
        if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';
        else if (userAgent.includes('Opera')) browser = 'Opera';

        // Detect OS
        let os = 'Unknown';
        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) os = 'Android';
        else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) os = 'iOS';

        // Insert click record
        await supabase.from('link_clicks').insert({
          link_id: link.id,
          user_agent: userAgent,
          referrer: referrer,
          device_type: deviceType,
          browser: browser,
          os: os,
        });

        // Redirect to the original URL
        let redirectUrl = link.original_url;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          redirectUrl = 'https://' + redirectUrl;
        }
        
        window.location.href = redirectUrl;
      } catch (err) {
        console.error('Error in redirect:', err);
        setError('Erro ao processar redirecionamento');
      }
    };

    handleRedirect();
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Link não encontrado</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <h1 className="text-xl font-semibold mb-2">Redirecionando...</h1>
          <p className="text-muted-foreground">Aguarde um momento</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkRedirect;
