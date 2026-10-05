// App configuration constants
// Canonical production host for public-facing meeting links. Any URL persisted
// (calendar_events.meeting_link) or sent to participants (WhatsApp/email/copy)
// MUST start with this exact prefix. Anything else is rejected.
export const ALLOWED_MEETING_URL_PREFIX = 'https://www.ellosuit.app';

export const APP_CONFIG = {
  // Production domain for meeting links and public URLs
  PRODUCTION_URL: 'https://www.ellosuit.app',

  // Public-facing URLs (meetings, agendamentos, dashboard) SEMPRE devem
  // apontar para o domínio de produção. Nunca cair para
  // `window.location.origin`, senão previews/publicações do Lovable
  // vazam links em `*.lovable.app` / `*.lovableproject.com` que ficam
  // salvos em eventos, convites de reunião e disparos para o cliente.
  getMeetingUrl: (roomCode: string) =>
    `${ALLOWED_MEETING_URL_PREFIX}/meet/${roomCode}`,

  getBookingUrl: (slug: string) =>
    `${ALLOWED_MEETING_URL_PREFIX}/agendamentos/${slug}`,

  getDashboardUrl: () => `${ALLOWED_MEETING_URL_PREFIX}/dashboard`,
};

/**
 * Returns true when the meeting link is safe to persist or send.
 * Empty/nullish values are allowed (event without link).
 * External providers (Google Meet, Zoom, Teams, Whereby) are allowed.
 * Any link pointing to our own product must use the canonical host.
 */
export function isAllowedMeetingUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const trimmed = String(url).trim();
  if (!trimmed) return true;

  // Whitelisted external meeting providers
  const externalHosts = [
    'https://meet.google.com/',
    'https://zoom.us/',
    'https://us02web.zoom.us/',
    'https://us04web.zoom.us/',
    'https://us05web.zoom.us/',
    'https://us06web.zoom.us/',
    'https://teams.microsoft.com/',
    'https://teams.live.com/',
    'https://whereby.com/',
  ];
  if (externalHosts.some((h) => trimmed.startsWith(h))) return true;

  return trimmed.startsWith(ALLOWED_MEETING_URL_PREFIX + '/');
}

/**
 * Rewrites known-bad hosts (previews, staging, legacy .online) that point at
 * our /meet/<code> route back to the canonical host. Returns the sanitized URL
 * when possible, or throws when the link cannot be reconciled — callers should
 * surface a toast and abort the save/send.
 */
export function sanitizeMeetingUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';

  if (isAllowedMeetingUrl(trimmed)) return trimmed;

  // Try to rescue our own /meet/<code> links coming from previews or the
  // legacy ellosuit.online host.
  try {
    const parsed = new URL(trimmed);
    const meetMatch = parsed.pathname.match(/\/meet\/([^/?#]+)/);
    if (meetMatch) {
      return `${ALLOWED_MEETING_URL_PREFIX}/meet/${meetMatch[1]}`;
    }
  } catch {
    // fall through
  }

  throw new Error(
    `Link de reunião inválido. Só é permitido salvar/enviar links iniciados por ${ALLOWED_MEETING_URL_PREFIX}.`,
  );
}

export default APP_CONFIG;
