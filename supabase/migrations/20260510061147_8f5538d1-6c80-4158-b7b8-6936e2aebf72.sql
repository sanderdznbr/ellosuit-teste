
-- =========================
-- gift_keys
-- =========================
DROP POLICY IF EXISTS "Users can lookup available gift keys" ON public.gift_keys;
DROP POLICY IF EXISTS "Users can redeem gift keys" ON public.gift_keys;

-- Scope redemption to the user redeeming, only on still-available keys
CREATE POLICY "Users can redeem available keys for themselves"
ON public.gift_keys
FOR UPDATE
TO authenticated
USING (status = 'available' AND (redeemed_by IS NULL OR redeemed_by = auth.uid()))
WITH CHECK (redeemed_by = auth.uid());

-- =========================
-- ellocontent_settings
-- =========================
DROP POLICY IF EXISTS "Anyone can read settings" ON public.ellocontent_settings;

CREATE POLICY "Authenticated users can read settings"
ON public.ellocontent_settings
FOR SELECT
TO authenticated
USING (true);

-- =========================
-- room_active_skills
-- =========================
DROP POLICY IF EXISTS "Users can view active skills in their rooms" ON public.room_active_skills;
DROP POLICY IF EXISTS "Users can activate skills in their rooms" ON public.room_active_skills;
DROP POLICY IF EXISTS "Users can deactivate skills in their rooms" ON public.room_active_skills;

CREATE POLICY "Authenticated users can view room skills"
ON public.room_active_skills
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can activate skills as themselves"
ON public.room_active_skills
FOR INSERT
TO authenticated
WITH CHECK (activated_by = auth.uid());

CREATE POLICY "Users can deactivate skills they activated"
ON public.room_active_skills
FOR DELETE
TO authenticated
USING (activated_by = auth.uid());

-- =========================
-- Explicit deny policies for sensitive server-only tables
-- (RLS already enabled with no policies; we add explicit deny so the
--  scanner sees the intent and no role can read/modify these from the API.
--  Service role bypasses RLS and continues to work.)
-- =========================

-- phone_verifications
CREATE POLICY "Deny all client access to phone verifications"
ON public.phone_verifications
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- email_send_log
CREATE POLICY "Deny all client access to email send log"
ON public.email_send_log
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- email_send_state
CREATE POLICY "Deny all client access to email send state"
ON public.email_send_state
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- suppressed_emails
CREATE POLICY "Deny all client access to suppressed emails"
ON public.suppressed_emails
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- email_unsubscribe_tokens
CREATE POLICY "Deny all client access to unsubscribe tokens"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- webhook_logs
CREATE POLICY "Deny all client access to webhook logs"
ON public.webhook_logs
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
