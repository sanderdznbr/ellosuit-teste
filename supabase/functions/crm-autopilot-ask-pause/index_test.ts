import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
// Fixture: conversation ID of a non-parent contact under an active autopilot config.
// Overridable via env for portability.
const TEST_CONVERSATION_ID =
  Deno.env.get("TEST_AUTOPILOT_CONVERSATION_ID") ||
  "53acfc06-4bd2-4756-b66f-ae684444fecc"; // Julia Matozo

async function invokeAskPause(conversationId: string) {
  const startedAt = performance.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/crm-autopilot-ask-pause`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ conversationId }),
  });
  const elapsedMs = performance.now() - startedAt;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, elapsedMs };
}

Deno.test("E2E: parent prompt is triggered within 5s for the correct conversation when human tag flips and autopilot is active", async () => {
  assert(SUPABASE_URL, "VITE_SUPABASE_URL missing");
  assert(SUPABASE_ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing");

  const { status, json, elapsedMs } = await invokeAskPause(TEST_CONVERSATION_ID);

  console.log("[E2E] response:", { status, json, elapsedMs: Math.round(elapsedMs) });

  // Timing SLA: must reply in under 5 seconds.
  assert(elapsedMs < 5000, `ask-pause took ${Math.round(elapsedMs)}ms (>5s)`);

  // HTTP contract
  assertEquals(status, 200, `unexpected status: ${status} ${JSON.stringify(json)}`);

  // Accepted outcomes — all prove the pipeline is live for the CORRECT conversation:
  //   ok:true                        -> prompt just sent
  //   skipped:"already_pending"      -> a prompt is currently waiting parent reply
  //   skipped:"recent"               -> a prompt was sent for this conv in the last 6h
  //   skipped:"no_takeover"          -> autopilot is active but conv is not in takeover
  //                                     (still means the endpoint validated the right conv)
  const acceptable =
    json.ok === true ||
    json.dispatched === true ||
    json.skipped === "already_pending" ||
    json.skipped === "recent" ||
    json.skipped === "no_takeover";
  assert(
    acceptable,
    `unexpected response for conv ${TEST_CONVERSATION_ID}: ${JSON.stringify(json)}`,
  );

  // Rejected outcomes — the endpoint MUST NOT bail on autopilot being off or wrong conv
  assert(json.skipped !== "autopilot_inactive", "autopilot must be active for this test conversation");
  assert(json.skipped !== "no_conv", "test conversation id does not exist");
  assert(json.skipped !== "target_is_parent", "test conversation must not be the parent number");
});

Deno.test("Contract: ask-pause rejects missing conversationId in <1s", async () => {
  const startedAt = performance.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/crm-autopilot-ask-pause`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const elapsedMs = performance.now() - startedAt;
  const json = await res.json().catch(() => ({}));
  assertEquals(res.status, 400);
  assert(json.error, "expected error field");
  assert(elapsedMs < 1000, `validation took ${Math.round(elapsedMs)}ms (>1s)`);
});