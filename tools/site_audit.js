// Audit a site in a real browser: weight, requests, SEO basics, axe-core WCAG checks, phone-width checks,
// screenshots. Never submits forms. Output goes to tools/out/<label>/ (git-ignored).
// Usage: npm i --no-save axe-core@4 && NODE_PATH=$(npm root -g):node_modules node tools/site_audit.js <label> <baseUrl> <path,path,...>
// e.g.   ... node tools/site_audit.js current https://www.relianthomemtg.com /,/todays-rates/,/staff/
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const [label, base, pathsArg] = process.argv.slice(2);
const PATHS = pathsArg.split(',');
const OUT = path.join(__dirname, 'out', label);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const slug = p => (p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home');

async function netTracker(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const reqs = new Map(); const st = { bytes: 0, count: 0, byType: {}, hosts: {}, failed: [] };
  cdp.on('Network.requestWillBeSent', e => { if (!reqs.has(e.requestId)) st.count++; reqs.set(e.requestId, { url: e.request.url, type: e.type }); });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; } });
  cdp.on('Network.loadingFinished', e => {
    const r = reqs.get(e.requestId); if (!r) return; st.bytes += e.encodedDataLength;
    const t = r.type || 'Other'; st.byType[t] = (st.byType[t] || 0) + e.encodedDataLength;
    try { const h = new URL(r.url).hostname; st.hosts[h] = (st.hosts[h] || 0) + 1; } catch {}
    if (r.status >= 400) st.failed.push(r.status + ' ' + r.url.slice(0, 140));
  });
  cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r && !e.canceled) st.failed.push('FAILED ' + e.errorText + ' ' + r.url.slice(0, 140)); });
  return st;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

const INIT = () => {
  window.__lcp = 0; window.__cls = 0;
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
};

async function pageFacts(page) {
  return page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
    const meta = n => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
    const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(h => h.tagName + ' ' + h.innerText.trim().replace(/\s+/g, ' ').slice(0, 90));
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { const j = JSON.parse(s.textContent); const arr = Array.isArray(j) ? j : (j['@graph'] || [j]); return arr.map(x => x['@type']).flat().join('/'); } catch { return 'invalid'; } });
    const imgs = [...document.images];
    const generic = /^(learn more|get started|click here|read more|more|here|submit)$/i;
    const links = [...document.querySelectorAll('a[href]')].filter(vis);
    const text = (document.querySelector('main,#fl-main-content,.fl-page-content,body')?.innerText || '').replace(/\s+/g, ' ').trim();
    const forms = [...document.querySelectorAll('form')].map(f => [...f.querySelectorAll('input,select,textarea')].filter(i => i.type !== 'hidden').length);
    return {
      title: document.title, description: meta('description'), ogImage: meta('og:image'), canonical: document.querySelector('link[rel=canonical]')?.href || null,
      lang: document.documentElement.lang || null, viewportMeta: meta('viewport'), h1: heads.filter(h => h.startsWith('H1')).length, headings: heads,
      jsonLd: ld, images: imgs.length, imgNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length, imgEmptyAlt: imgs.filter(i => i.getAttribute('alt') === '').length,
      genericLinks: links.filter(a => generic.test(a.innerText.trim())).map(a => a.innerText.trim()),
      iframes: [...document.querySelectorAll('iframe')].map(f => f.src.slice(0, 120)), forms,
      words: text.split(' ').length, textSample: text.slice(0, 1500),
      scripts: document.scripts.length, stylesheets: document.querySelectorAll('link[rel=stylesheet]').length,
      height: document.documentElement.scrollHeight,
      timing: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })(),
      lcp: Math.round(window.__lcp || 0), cls: +(window.__cls || 0).toFixed(3),
    };
  });
}

async function mobileFacts(page) {
  return page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const W = window.innerWidth;
    const textEls = [...document.querySelectorAll('p,li,a,span,td,label,button,small,div')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2));
    const sizes = textEls.map(e => parseFloat(getComputedStyle(e).fontSize));
    const targets = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,[role=button]')].filter(vis).filter(e => !(e.tagName === 'A' && e.closest('p')));
    const small = targets.filter(e => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; });
    const under44 = targets.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44; });
    const aboveFold = [...document.querySelectorAll('a,button')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }).map(e => e.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 12);
    const bodyText = document.querySelector('p');
    return {
      scrollWidth: document.documentElement.scrollWidth, innerWidth: W, overflow: document.documentElement.scrollWidth > W,
      textEls: sizes.length, under12: sizes.filter(s => s < 12).length, under14: sizes.filter(s => s < 14).length, under16: sizes.filter(s => s < 16).length,
      paragraphFont: bodyText ? getComputedStyle(bodyText).fontSize : null,
      targets: targets.length, targetsUnder24: small.length, targetsUnder44: under44.length,
      smallTargetSamples: small.slice(0, 8).map(e => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
      aboveFold, height: document.documentElement.scrollHeight,
    };
  });
}

async function frameFields(page) {
  const out = [];
  for (const f of page.frames()) {
    try {
      const n = await f.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')].filter(i => i.type !== 'hidden' && i.getBoundingClientRect().height > 0).map(i => i.tagName.toLowerCase() + ':' + (i.type || '') + ':' + (i.labels?.[0]?.innerText || i.placeholder || i.getAttribute('aria-label') || i.innerText || i.name || '').trim().slice(0, 40)));
      if (n.length) out.push({ frame: f.url().slice(0, 100), fields: n.slice(0, 40), count: n.length });
    } catch {}
  }
  return out;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = {};
  for (const p of PATHS) {
    const url = base + p; const s = slug(p); const r = { url };
    // Desktop
    const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const d = await dctx.newPage(); await d.addInitScript(INIT);
    const consoleErr = []; d.on('pageerror', e => consoleErr.push(String(e).slice(0, 160))); d.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 160)); });
    const net = await netTracker(d);
    const t0 = Date.now();
    try { await d.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { r.error = String(e).slice(0, 200); }
    r.wallLoadMs = Date.now() - t0;
    await d.waitForTimeout(3500);
    await d.screenshot({ path: path.join(OUT, 'shots', `${s}-desktop.png`) });
    await scrollThrough(d); await d.waitForTimeout(1500);
    r.desktop = await pageFacts(d);
    r.fields = await frameFields(d);
    await d.screenshot({ path: path.join(OUT, 'shots', `${s}-desktop-full.png`), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(r.desktop.height, 9000) } });
    r.net = { requests: net.count, kb: Math.round(net.bytes / 1024), byTypeKb: Object.fromEntries(Object.entries(net.byType).map(([k, v]) => [k, Math.round(v / 1024)])), hosts: net.hosts, failed: net.failed.slice(0, 15) };
    r.consoleErrors = consoleErr.slice(0, 10);
    try {
      await d.evaluate(AXE);
      const ax = await d.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }));
      r.axe = ax.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, samples: v.nodes.slice(0, 3).map(n => (n.target.join(' ') + ' | ' + (n.failureSummary || '').replace(/\s+/g, ' ')).slice(0, 220)) }));
    } catch (e) { r.axe = 'error ' + String(e).slice(0, 120); }
    await dctx.close();
    // Phone
    const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
    const m = await mctx.newPage();
    try { await m.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { r.mobileError = String(e).slice(0, 200); }
    await m.waitForTimeout(3500);
    await m.screenshot({ path: path.join(OUT, 'shots', `${s}-phone.png`) });
    await scrollThrough(m); await m.waitForTimeout(1000);
    r.phone = await mobileFacts(m);
    await m.screenshot({ path: path.join(OUT, 'shots', `${s}-phone-full.png`), fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.min(r.phone.height, 7000) } });
    await mctx.close();
    results[p] = r;
    console.log(`${p}: ${r.net.requests} req, ${r.net.kb} KB, axe ${Array.isArray(r.axe) ? r.axe.length : r.axe}, phone overflow ${r.phone.overflow}, words ${r.desktop.words}`);
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  await b.close();
})();
