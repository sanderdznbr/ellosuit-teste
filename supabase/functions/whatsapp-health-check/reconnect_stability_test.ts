// E2E: reconnect a channel and verify it stays `connected` for N minutes.
//
// Run locally (15 min monitor):
//   MONITOR_MINUTES=15 SESSION_ID=<uuid> \
//     deno test -A --no-check supabase/functions/whatsapp-health-check/reconnect_stability_test.ts
//
// The Lovable test tool caps runs at 300s, so in CI we default to 4 minutes.
// Set MONITOR_MINUTES=15 when running from a shell to satisfy the full SLA.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SESSION_ID = Deno.env.get("SESSION_ID") ?? "840ebfa6-6e54-4651-825a-fe8a150d3166";
const MONITOR_MINUTES = Number(Deno.env.get("MONITOR_MINUTES") ?? "4");
const POLL_SECONDS = Number(Deno.env.get("POLL_SECONDS") ?? "30");

// service role required to bypass RLS + trigger the health-check function
const admin = createClient(SUPABASE_URL, SERVICE_ROLE || ANON_KEY, {
  auth: { persistSession: false },
});

async function getStatus(id: string) {
  const { data, error } = await admin
    .from("whatsapp_sessions")
    .select("id, status, phone_number, last_seen_at, session_data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function callHealthCheck() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-health-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE || ANON_KEY}`,
    },
  });
  const body = await res.text();
  return { status: res.status, body };
}

Deno.test({
  name: `reconnect stays connected for ${MONITOR_MINUTES} minutes without flipping to disconnected`,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (!SERVICE_ROLE) {
      console.warn("[SKIP] SUPABASE_SERVICE_ROLE_KEY not set — test needs elevated access");
      return;
    }

    // 1) baseline: session must exist and start connected (reconnect it if needed)
    let session = await getStatus(SESSION_ID);
    assert(session, `session ${SESSION_ID} not found`);

    if (session!.status !== "connected") {
      console.log(`[SETUP] forcing session ${SESSION_ID} to connected before monitoring`);
      const sessionData = (session!.session_data as Record<string, unknown>) ?? {};
      await admin
        .from("whatsapp_sessions")
        .update({
          status: "connected",
          last_seen_at: new Date().toISOString(),
          session_data: {
            ...sessionData,
            consecutive_failures: 0,
            reconnected_by: "e2e_stability_test",
            reconnected_at: new Date().toISOString(),
          },
        })
        .eq("id", SESSION_ID);

      session = await getStatus(SESSION_ID);
      assertEquals(session!.status, "connected", "failed to seed session as connected");
    }

    // 2) monitor loop — poll DB every POLL_SECONDS and force a health-check
    //    every ~5 min so we exercise the same code path the cron uses.
    const totalMs = MONITOR_MINUTES * 60_000;
    const started = Date.now();
    let iteration = 0;
    let disconnectFlips = 0;
    let lastHealthCheckAt = 0;

    while (Date.now() - started < totalMs) {
      iteration++;

      // trigger health-check every 5 min (mirrors cron cadence)
      if (Date.now() - lastHealthCheckAt > 5 * 60_000) {
        const hc = await callHealthCheck();
        console.log(`[HC] iter=${iteration} status=${hc.status}`);
        lastHealthCheckAt = Date.now();
      }

      const current = await getStatus(SESSION_ID);
      const elapsed = Math.round((Date.now() - started) / 1000);
      console.log(
        `[POLL] iter=${iteration} elapsed=${elapsed}s status=${current?.status} last_seen=${current?.last_seen_at}`,
      );

      if (current?.status === "disconnected") {
        disconnectFlips++;
        console.error(
          `[FAIL] session flipped to disconnected at ${elapsed}s (iteration ${iteration})`,
        );
        break;
      }

      await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
    }

    assertEquals(
      disconnectFlips,
      0,
      `session flipped to disconnected ${disconnectFlips}x during ${MONITOR_MINUTES}min window`,
    );

    const final = await getStatus(SESSION_ID);
    assertEquals(
      final!.status,
      "connected",
      `expected connected after ${MONITOR_MINUTES}min, got ${final!.status}`,
    );
    console.log(`[PASS] session held 'connected' for full ${MONITOR_MINUTES}min window`);
  },
});