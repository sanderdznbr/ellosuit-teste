import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';

export const OMNI_COLOR = '#374DA4';
export const FLOW_COLOR = '#4D7CFF';
export const TRACK_COLOR = '#2ECC71';
export const SUITE_COLOR = '#374DA4';
 export const CONFIG_COLOR = '#64748B';
 export const MEET_COLOR = '#101010';
 export const DEFAULT_COLOR = '#374DA4';

const omniRoutes = [
  '/dashboard/omni',
  '/dashboard/crm-whatsapp',
  '/dashboard/crm-ello',
  '/dashboard/api-whatsapp',
  '/dashboard/chatbot',
  '/dashboard/chatbot-builder',
  '/dashboard/email',
  '/dashboard/email-templates',
  '/dashboard/email-builder',
  '/dashboard/bot-ia',
  '/dashboard/disparos',
  '/dashboard/automacoes',
];

const flowRoutes = [
  '/dashboard/flows',
  '/dashboard/agenda',
  '/dashboard/agenda-aberta',
  '/dashboard/tasks',
  '/dashboard/fluxos',
  
];

const trackRoutes = [
  '/dashboard/track',
  '/dashboard/rastreamento',
  '/dashboard/encurtador',
  '/dashboard/email-tracker',
  '/dashboard/leads',
];

const suiteRoutes = [
  '/dashboard/suite',
  '/dashboard/cadastros',
  '/dashboard/drive',
  '/dashboard/analytics',
  '/dashboard/ello-vision',
  '/dashboard/relatorios',
  '/dashboard/arquivos',
  '/dashboard/contratos',
  '/dashboard/habitos',
  '/dashboard/propostas',
  '/dashboard/recibos',
];

 const meetRoutes = [
   '/dashboard/meet-hub',
   '/dashboard/meet',
  '/dashboard/reunioes',
 ];
 
 const configRoutes = [
   '/dashboard/configuracoes',
   '/dashboard/seguranca',
   '/dashboard/suporte',
   '/dashboard/perfil',
   '/dashboard/assinatura',
   '/dashboard/minhassinatura',
   '/dashboard/reportar-problema',
 ];

 export type HubType = 'omni' | 'flow' | 'track' | 'suite' | 'config' | 'meet' | null;

export function useHubColor() {
  const location = useLocation();
  const { theme } = useTheme();
  const path = location.pathname;
  
  let color = DEFAULT_COLOR;
  let hub: HubType = null;

   if (configRoutes.some(route => path.startsWith(route))) {
     color = CONFIG_COLOR; hub = 'config';
    } else if (meetRoutes.some(route => path.startsWith(route))) {
      color = SUITE_COLOR; hub = 'meet';
   } else if (trackRoutes.some(route => path.startsWith(route))) {
     color = TRACK_COLOR; hub = 'track';
   } else if (omniRoutes.some(route => path.startsWith(route))) {
     color = OMNI_COLOR; hub = 'omni';
   } else if (flowRoutes.some(route => path.startsWith(route))) {
     color = FLOW_COLOR; hub = 'flow';
   } else if (suiteRoutes.some(route => path.startsWith(route))) {
     color = SUITE_COLOR; hub = 'suite';
   }

  const isDark = theme === 'dark';
  // Global chrome (PWA status bar, body background) uses the unified brand color
  // — no more hub-specific tinting bleeding into the system UI.
  const effectiveColor = isDark ? 'hsl(0, 0%, 8%)' : DEFAULT_COLOR;

  // Sync PWA theme-color meta tag and body background with current hub
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effectiveColor);
    
    const navMeta = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (navMeta) navMeta.setAttribute('content', effectiveColor);
    
    const tileMeta = document.querySelector('meta[name="msapplication-TileColor"]');
    if (tileMeta) tileMeta.setAttribute('content', effectiveColor);
    
    // Sync html/body bg for PWA status bar area
    document.documentElement.style.backgroundColor = isDark ? effectiveColor : 'white';
    document.body.style.backgroundColor = isDark ? effectiveColor : 'white';
  }, [effectiveColor]);

  return { color, hub, isDark };
}
