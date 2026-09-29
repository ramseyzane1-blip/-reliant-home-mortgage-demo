// Export the audit deck and report to PDF.
// Usage (from the repo root, with the repo served on :8765):
//   python3 -m http.server 8765 &
//   NODE_PATH=$(npm root -g) node tools/export_pdfs.js
const path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8765/audit/';
const OUT = path.join(__dirname, '..', 'audit');
const JOBS = [
  ['', 'Reliant-Website-Audit-Slides.pdf', { width: '1920px', height: '1080px' }],
  ['report.html', 'Reliant-Website-Audit-Report.pdf', { format: 'Letter' }],
];
(async () => {
  const b = await chromium.launch();
  for (const [page, file, size] of JOBS) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto(BASE + page, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: path.join(OUT, file), printBackground: true, preferCSSPageSize: true, ...size });
    console.log('wrote audit/' + file);
    await p.close();
  }
  await b.close();
})();
