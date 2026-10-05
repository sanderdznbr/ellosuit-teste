import { assert, assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";

const TEST_COMPANY_ID = Deno.env.get("TEST_WHATSAPP_QR_COMPANY_ID") || "";
const TEST_USER_ID = Deno.env.get("TEST_WHATSAPP_QR_USER_ID") || "";

async function invokeWhatsAppApi(body: Record<string, unknown>) {
  const startedAt = performance.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const elapsedMs = performance.now() - startedAt;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, elapsedMs };
}

Deno.test("E2E: WhatsApp QR is generated as a renderable PNG data URL", async () => {
  assert(SUPABASE_URL, "SUPABASE_URL/VITE_SUPABASE_URL missing");
  assert(SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY missing");
  assert(TEST_COMPANY_ID, "TEST_WHATSAPP_QR_COMPANY_ID missing");
  assert(TEST_USER_ID, "TEST_WHATSAPP_QR_USER_ID missing");

  const instanceName = `whatsapp-e2e-qr-${Date.now()}`;
  let sessionId = "";

  try {
    const create = await invokeWhatsAppApi({
      action: "create_instance",
      instanceName,
      companyId: TEST_COMPANY_ID,
      userId: TEST_USER_ID,
    });

    assertEquals(create.status, 200, `create_instance failed: ${JSON.stringify(create.json)}`);
    sessionId = create.json?.session?.id;
    assert(sessionId, `create_instance did not return session id: ${JSON.stringify(create.json)}`);

    let last: Awaited<ReturnType<typeof invokeWhatsAppApi>> | null = null;
    for (let attempt = 1; attempt <= 40; attempt++) {
      last = await invokeWhatsAppApi({ action: "get_qr_code", sessionId });
      if (last.status === 200 && typeof last.json?.qrCode === "string") break;
      // Log progresso
      if (last.json?.status === "initializing" || last.json?.status === "generating") {
        console.log(`    ... state=${last.json.status} (attempt ${attempt}, age ${last.json.sessionAge || '?'}s)`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    assert(last, "get_qr_code was not called");
    assertEquals(last.status, 200, `get_qr_code failed: ${JSON.stringify(last.json)}`);
    assertEquals(last.json.status, "waiting_qr", `unexpected QR status: ${JSON.stringify(last.json)}`);
    assertMatch(last.json.qrCode, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    assert(last.json.qrCode.length > 1000, "QR data URL is too small to be a real image");
    assert(last.elapsedMs < 30000, `QR generation took ${Math.round(last.elapsedMs)}ms (>30s)`);
  } finally {
    if (sessionId) {
      await invokeWhatsAppApi({ action: "delete_session", sessionId });
    }
  }
});
