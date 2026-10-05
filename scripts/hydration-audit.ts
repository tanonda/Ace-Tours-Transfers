/**
 * Loads prerendered pages the way a phone does (CPU 4x slower) and fails if the
 * page ever goes blank during load or React reports a hydration mismatch.
 *
 *   BASE=http://localhost:5055 npx tsx scripts/hydration-audit.ts
 */
import { chromium, type Browser } from 'playwright';

const BASE = (process.env.BASE ?? 'http://localhost:5055').replace(/\/+$/, '');
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 8000);

type Scenario = 'default' | 'en-AU' | 'fr' | 'dark' | 'stateless';
const SCENARIOS: Scenario[] = (process.env.SCENARIOS?.split(',') as Scenario[] | undefined) ?? [
  'default',
  'en-AU',
  'fr',
  'dark',
  'stateless',
];
const HYDRATION_ERROR = /\[hydration\]|Hydration failed|hydrat|Minified React error #(418|419|421|423|425)/i;

async function routes(): Promise<string[]> {
  if (process.env.ROUTES) return process.env.ROUTES.split(',');
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const pick = (re: RegExp) => all.find((p) => re.test(p));
  return [
    '/',
    pick(/^\/tours\/[^/]+$/),
    pick(/^\/transfers\/[^/]+$/),
    '/port-vila-airport-transfers',
    pick(/^\/blog\/[^/]+$/),
  ].filter((p): p is string => Boolean(p));
}

async function audit(browser: Browser, route: string, scenario: Scenario) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    isMobile: true,
    locale: scenario === 'en-AU' ? 'en-AU' : 'en-US',
  });
  // Init scripts are strings: tsx would inject its __name helper into functions,
  // which doesn't exist in the page.
  if (scenario === 'fr') await context.addInitScript("localStorage.setItem('i18nextLng', 'fr')");
  if (scenario === 'dark') await context.addInitScript("localStorage.setItem('ace-theme', 'dark')");
  const page = await context.newPage();
  if (scenario === 'stateless') {
    // Simulates a snapshot seeded from an older deploy: no state block.
    await page.route(`${BASE}${route}`, async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/<script type="application\/json" id="__ACE_QUERY_STATE__">[\s\S]*?<\/script>/, '');
      await r.fulfill({ response: res, body });
    });
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const problems: string[] = [];
  page.on('console', (m) => {
    if ((m.type() === 'warning' || m.type() === 'error') && HYDRATION_ERROR.test(m.text())) problems.push(m.text().slice(0, Number(process.env.MSG_LEN ?? 300)));
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));

  await page.addInitScript(`
    window.__minLen = Infinity;
    window.__seen = false;
    window.__h1Seen = false;
    window.__h1Lost = false;
    (function tick() {
      const root = document.getElementById('root');
      const len = root ? root.innerText.length : 0;
      if (len > 0) window.__seen = true;
      if (window.__seen) window.__minLen = Math.min(window.__minLen, len);
      // The header and footer keep the text length up on their own; the page's main
      // content disappearing (e.g. a loading spinner) shows up as its <h1> going away.
      const h1 = document.querySelector('#root h1');
      if (h1 && h1.textContent.trim()) window.__h1Seen = true;
      else if (window.__h1Seen) window.__h1Lost = true;
      setTimeout(tick, 20);
    })();
  `);

  await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(SETTLE_MS);
  const result: { minLen: number; h1Lost: boolean; lang: string; dark: boolean; hasState: boolean; finalLen: number } =
    await page.evaluate(`({
      minLen: window.__minLen,
      h1Lost: window.__h1Lost,
      lang: document.documentElement.lang,
      dark: document.documentElement.classList.contains('dark'),
      hasState: Boolean(document.getElementById('__ACE_QUERY_STATE__')),
      finalLen: document.getElementById('root')?.innerText.length ?? 0,
    })`);
  await context.close();

  // The stateless path (a snapshot without state, e.g. copied from the previous deploy)
  // keeps the snapshot on screen while the app renders behind it, so it must not blank either.
  if (result.minLen === 0) problems.push('root went blank during load');
  if (result.h1Lost) problems.push('page content (h1) disappeared during load');
  if (result.finalLen === 0) problems.push('page empty after load');
  if (scenario === 'fr' && !result.lang.startsWith('fr')) problems.push(`expected lang fr, got "${result.lang}"`);
  if (scenario === 'dark' && !result.dark) problems.push('expected dark theme');
  if (scenario !== 'stateless' && !result.hasState) problems.push('snapshot has no state block');
  return problems;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
let failed = 0;
for (const route of await routes()) {
  for (const scenario of SCENARIOS) {
    const problems = await audit(browser, route, scenario);
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${route} [${scenario}]${problems.length ? ' — ' + problems.join(' | ') : ''}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
