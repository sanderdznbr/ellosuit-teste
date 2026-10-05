# Project rules

- Public API actions live in `whatsapp-public-api` (single POST endpoint, `action` field, `X-API-Key`); new actions go in `extended.ts` — keeps one auth/rate-limit path for external systems.
- Post-approval client replies are routed by `whatsapp-webhook` to `whatsapp-public-api` with header `x-internal-route: approval-reply` + service key — the external Supabase project rejected deploying new edge functions.
- Shared post-approval logic (WhatsApp send, signed webhooks, IG/FB publish) lives in `supabase/functions/_shared/post-approval.ts` — reused by API and reply handler.
- Incoming WhatsApp messages are forwarded by `whatsapp-webhook` as signed `message.received` events to every active API key with a webhook on that session — lets external systems run their own bots via the public API.
