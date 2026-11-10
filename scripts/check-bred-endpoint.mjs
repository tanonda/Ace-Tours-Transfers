#!/usr/bin/env node
/**
 * BRED / PayZen endpoint checker.
 *
 * Verifies, against a running deployment, that the pieces PayZen depends on are
 * reachable and answering correctly:
 *
 *   1. public gateway list   — the API is up and JSON; reports whether BRED is visible
 *   2. CSP form-action       — the browser is allowed to POST the signed form to PayZen
 *   3. unsigned webhook      — the IPN route is reachable and rejects unsigned calls
 *   4. signed webhook        — with the TEST key, a correctly signed notification is
 *                              accepted by the signature check and (for an unknown order)
 *                              answered with a clean 400, changing nothing
 *
 * Nothing is charged and no payment is modified: the signed probe uses a random
 * order reference, so it can only exercise signature verification and rejection.
 *
 * Usage:
 *   node scripts/check-bred-endpoint.mjs --base-url https://staging.example.com \
 *     [--shop-id 12345678] [--ctx-mode TEST] [--payment-url https://secure.payzen.eu/vads-payment/]
 *
 * The TEST key is read from BRED_TEST_KEY (recommended) or --test-key. Only pass the
 * TEST key — never the production key — and prefer the environment variable so it
 * does not land in shell history.
 *
 * Exit code: 0 = no failures (warnings allowed), 1 = at least one failure.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";

const HELP = `BRED / PayZen endpoint checker

  --base-url <url>        Deployment to check (default: https://acetoursvanuatu.com)
  --shop-id <8 digits>    PayZen Shop ID saved in Admin -> Payments (default: BRED_SHOP_ID)
  --ctx-mode <mode>       TEST or PRODUCTION, matching the saved credentials (default: TEST)
  --payment-url <url>     Optional hosted page URL; checks CSP allows its origin
  --test-key <key>        PayZen TEST key (default: BRED_TEST_KEY). Prefer the env var.
  --help                  Show this help

Environment: BRED_SHOP_ID, BRED_TEST_KEY, BRED_CTX_MODE
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "help" || key === "h") {
      args.help = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const baseUrl = String(args["base-url"] || "https://acetoursvanuatu.com").replace(/\/+$/, "");
const shopId = String(args["shop-id"] || process.env.BRED_SHOP_ID || "").trim();
const ctxMode = String(args["ctx-mode"] || process.env.BRED_CTX_MODE || "TEST").trim();
const testKey = String(args["test-key"] || process.env.BRED_TEST_KEY || "").trim();
const expectedPaymentUrl = args["payment-url"] ? String(args["payment-url"]) : "";

const timeout = AbortSignal.timeout(20_000);
const webhookUrl = `${baseUrl}/api/payments/webhook/bred-bank`;

const results = [];
const record = (status, name, detail) => {
  results.push({ status, name, detail });
  const icon = status === "PASS" ? "PASS" : status === "WARN" ? "WARN" : "FAIL";
  console.log(`[${icon}] ${name} — ${detail}`);
};
const pass = (name, detail) => record("PASS", name, detail);
const warn = (name, detail) => record("WARN", name, detail);
const fail = (name, detail) => record("FAIL", name, detail);

const truncate = (value, max = 160) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const httpsOrigin = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
};

/** Same algorithm as server/infrastructure/payments/payzen-signature.ts. */
function payzenSignature(fields, key) {
  const values = Object.keys(fields)
    .filter((name) => name.startsWith("vads_"))
    .sort()
    .map((name) => fields[name]);
  const message = [...values, key].join("+");
  return createHmac("sha256", key).update(message, "utf8").digest("base64");
}

const utcTimestamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const randomTransId = () => randomBytes(3).toString("hex"); // 6 chars, [a-z0-9]

async function checkPublicGatewayList() {
  try {
    const res = await fetch(`${baseUrl}/api/payment-gateways`, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: timeout,
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (res.status !== 200 || !Array.isArray(body)) {
      fail("Public gateway list", `HTTP ${res.status}: ${truncate(text)}`);
      return;
    }
    const slugs = body.map((gateway) => gateway.slug).filter(Boolean);
    const bredNote = slugs.includes("bred-bank")
      ? "bred-bank is visible to guests"
      : "bred-bank hidden from guests (expected while inactive or in TEST mode)";
    pass("Public gateway list", `HTTP 200, ${slugs.length} visible (${slugs.join(", ") || "none"}) — ${bredNote}`);
  } catch (error) {
    fail("Public gateway list", `${error.message} — is the site reachable over HTTPS?`);
  }
}

async function checkCsp() {
  try {
    const res = await fetch(`${baseUrl}/`, { redirect: "manual", signal: timeout });
    const csp = res.headers.get("content-security-policy") || "";
    const match = csp.match(/form-action ([^;]+)/i);
    const sources = match ? match[1].trim() : "";

    const problems = [];
    if (!match) problems.push("no form-action directive");
    if (!csp.includes("https://secure.payzen.eu")) problems.push("standard PayZen page not allowed");
    if (expectedPaymentUrl) {
      const origin = httpsOrigin(expectedPaymentUrl);
      if (!origin) problems.push(`--payment-url must be https (${expectedPaymentUrl})`);
      else if (!sources.includes(origin)) problems.push(`configured origin ${origin} not allowed`);
    }

    if (problems.length) {
      fail("CSP form-action", `${problems.join("; ")} — got: ${truncate(sources) || "(none)"}`);
    } else {
      pass("CSP form-action", truncate(sources));
    }
  } catch (error) {
    fail("CSP form-action", `${error.message} — could not fetch the site's CSP header.`);
  }
}

async function postWebhook(fields) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
    signal: timeout,
  });
  return { status: res.status, type: res.headers.get("content-type") || "", text: await res.text() };
}

async function checkUnsignedWebhook() {
  try {
    const { status, type, text } = await postWebhook({ vads_site_id: "00000000" });
    const isPlainText = type.includes("text/plain");
    if (status === 400 && isPlainText) {
      const note = /Gateway is not active/i.test(text)
        ? " (gateway inactive — activate BRED in Admin → Payments for the signature check)"
        : "";
      pass("Unsigned webhook rejected", `400 text/plain "${truncate(text)}"${note}`);
      return;
    }
    if (status === 404) {
      fail("Unsigned webhook rejected", "404 — wrong host or path; is the deployment serving /api?");
      return;
    }
    if (status === 405) {
      fail("Unsigned webhook rejected", "405 — the bred-bank webhook route is not mounted for this gateway.");
      return;
    }
    fail("Unsigned webhook rejected", `HTTP ${status} (${truncate(type)}) — expected 400 text/plain: ${truncate(text)}`);
  } catch (error) {
    fail("Unsigned webhook rejected", `${error.message} — the webhook route could not be reached.`);
  }
}

async function checkSignedWebhook() {
  if (!shopId || !testKey) {
    warn("Signed webhook", "skipped — pass --shop-id/BRED_SHOP_ID and BRED_TEST_KEY (TEST key only).");
    return;
  }
  if (!/^\d{8}$/.test(shopId)) {
    fail("Signed webhook", `Shop ID must be exactly 8 digits; got "${shopId}".`);
    return;
  }

  const fields = {
    vads_amount: "100",
    vads_ctx_mode: ctxMode,
    vads_currency: "548",
    vads_operation_type: "DEBIT",
    vads_order_id: `conn-check-${Date.now()}`,
    vads_site_id: shopId,
    vads_trans_date: utcTimestamp(),
    vads_trans_id: randomTransId(),
    vads_trans_status: "AUTHORISED",
    vads_trans_uuid: randomUUID(),
    vads_hash: "connection-check",
    vads_url_check_src: "PAY",
  };
  fields.signature = payzenSignature(fields, testKey);

  try {
    const { status, type, text } = await postWebhook(fields);
    const plainText = type.includes("text/plain");

    if (status === 400 && plainText && /Payment not found/i.test(text)) {
      pass(
        "Signed webhook accepted",
        `400 text/plain "${truncate(text)}" — signature verified, unknown order left untouched.`,
      );
      return;
    }
    if (/different PayZen shop/i.test(text)) {
      fail("Signed webhook accepted", `Shop ID mismatch — ${truncate(text)} Check --shop-id against Admin → Payments.`);
      return;
    }
    if (/does not match shop mode/i.test(text)) {
      fail("Signed webhook accepted", `Mode mismatch — ${truncate(text)} Save ${ctxMode} on the gateway or pass --ctx-mode.`);
      return;
    }
    if (/Invalid PayZen IPN signature/i.test(text)) {
      fail("Signed webhook accepted", `Signature rejected — the TEST key does not match the saved Test Key (or a non-TEST key was used).`);
      return;
    }
    if (/Gateway is not active/i.test(text)) {
      warn("Signed webhook accepted", `Gateway inactive — ${truncate(text)} Activate BRED in Admin → Payments, then re-run.`);
      return;
    }
    if (status === 500) {
      fail("Signed webhook accepted", `HTTP 500 — ${truncate(text)} Deploy the build with the unknown-order guard and retry.`);
      return;
    }
    fail("Signed webhook accepted", `HTTP ${status} (${truncate(type)}) — ${truncate(text)}`);
  } catch (error) {
    fail("Signed webhook accepted", `${error.message} — the signed notification could not be sent.`);
  }
}

console.log(`BRED / PayZen endpoint check — ${baseUrl}`);
console.log(`  mode: ${ctxMode}   shop: ${shopId || "(not supplied)"}   key: ${testKey ? "(supplied)" : "(not supplied)"}`);
console.log("");

await checkPublicGatewayList();
await checkCsp();
await checkUnsignedWebhook();
await checkSignedWebhook();

const passed = results.filter((r) => r.status === "PASS").length;
const warned = results.filter((r) => r.status === "WARN").length;
const failed = results.filter((r) => r.status === "FAIL").length;

console.log("");
console.log(`Result: ${passed} passed, ${warned} warning(s), ${failed} failed.`);
if (failed > 0) {
  console.error("Endpoint check FAILED — fix the items marked FAIL above before accepting card payments.");
  process.exitCode = 1;
}
