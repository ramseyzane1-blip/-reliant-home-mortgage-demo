# Website audit (September 2026)

An audit of relianthomemtg.com and the reasoning behind the redesign, prepared for Kevin and
Jennifer Barker. Served at `/audit/` on the demo domain (noindex, like the rest of the project).

| File | What it is |
|---|---|
| `index.html` | The slide deck (23 slides, 1920×1080). Arrow keys, click or swipe to move; Esc for all slides. |
| `report.html` | The same audit as a written report. |
| `Reliant-Website-Audit-Slides.pdf`, `Reliant-Website-Audit-Report.pdf` | PDF exports of both, for email. |
| `img/` | Screenshots of the current site (`o-*`) and the redesign (`n-*`), cropped for the slides. |
| `data/measurements.json` | The raw measurements behind every number in the deck and report. |
| `private/email-draft.md` | Cover email to the client. Excluded from deploys by `.vercelignore`. |

## How the numbers were measured

29 September 2026, Chromium 141 via Playwright 1.56, at 1440×900 and 390×844. axe-core 4.13
(WCAG 2.0/2.1/2.2 A and AA) on each page's main document. Lighthouse 12.8.2: phone preset three
times per site (median reported) and desktop once. No forms on the current site were submitted.
Lab numbers from a cloud machine, useful for comparing the two sites, not field data.

## Editing

The deck and report are plain HTML with no build step. After editing, re-export the PDFs:

```bash
python3 -m http.server 8765 &
NODE_PATH=$(npm root -g) node tools/export_pdfs.js
```

To re-run the measurements (for example after the client makes the quick fixes), see
`tools/site_audit.js`.

Copy follows the project's rules in `CLAUDE.md`: plain and direct, no em-dash asides, and fair to
the current site. Every claim about the current site was checked in a real browser; keep it that way.
