# Reliant Home Mortgage: redesign demo

A demo redesign of relianthomemtg.com for **Reliant Home Mortgage LLC**, a family-owned
mortgage **broker** (not a lender, not a real estate agency) in Middletown, Ohio, owned by
Kevin & Jennifer Barker and licensed in Ohio, Kentucky and Indiana. It was built by
Zane Ramsey (Greater Purpose Web) as a pitch.

Live URL: **https://reliant-home-mortgage.greaterpurposeweb.com/demo/site/**
(the root and `/demo` redirect there; see `vercel.json`).

## Run it locally

No build step and no dependencies. From the repo root:

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/demo/site/
```

Scripts are classic `defer` scripts that share globals, so load order in `index.html` matters:
`config → util → data → glossary-data → engines → db → app`.

## Layout

```
demo/site/index.html        all pages (hash-routed single page)
demo/site/css/site.css      design tokens + all styles (light and dark)
demo/site/js/config.js      Supabase URL + publishable key, demo flag
demo/site/js/util.js        $, usd, pmt, esc, reduced(), store (localStorage wrapper)
demo/site/js/data.js        TEAM, REVIEWS, loan programs (P), GLOSS, POSTS, LEGAL
demo/site/js/glossary-data.js  GX (example / why / related / lesson) + GSUG
demo/site/js/engines.js     Turntable (hero, WebGL) and Walk (walk-through)
demo/site/js/db.js          DB.insert(table,row) via Supabase REST
demo/site/js/app.js         everything else: pages, tools, pre-qual, router
demo/site/images/           3D renders only (see tools/README.md) + logo.png, logo-dark.png
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
```

## Decisions the client has made (don't undo these)

- **One goal: the pre-qualification.** "Get pre-qualified" is the only primary button. The
  secondary action is calling the office, phrased as "Call our Middletown office".
- **Menu:** Buy a home · Refinance · Learn · Local help · About us, plus Get pre-qualified.
  Each item is a different visitor goal. "How rates work" is a tab inside Learn; the
  personal rate quote is a checkbox in the pre-qualification. All 20 loans live at `#loans`,
  linked from Buy and Refinance.
- **Names:** use Kevin and Jennifer's names only where the original site does: team bios,
  license lines, reviews, and choosing a loan officer. Elsewhere say "our team" or
  "our Middletown office".
- **Financing, not real estate:** communicate it through what the site shows (loan steps,
  payments, rates), not with "we don't sell homes" disclaimers.
- **Photos only in the 3D pieces.** The AI renders appear in the hero turntable and the
  walk-through, nowhere else.
- **Look:** crisp white with cool gray sections, Reliant forest green (#1c4f33, from the
  logo wordmark) for every action, sand (#c3b69c, from the logo swoosh) as a quiet accent.
  No gold buttons (reads as money-focused). DM Serif Display headings, Public Sans body.
- **Demo behavior:** forms save to Supabase and then show a "this is a demo" notice (inline on
  the pre-qualification results, so nothing covers them; a modal for the other forms).
- Blog and newsletter are merged into "The Reliant Letter" on About us.

## Content sources

Everything factual comes from relianthomemtg.com: licenses (NMLS #2292251, OH RM.804827.000,
KY MB855092, IN 2292251), loan officer NMLS numbers, office address and phone, the 20 loan
programs, Google reviews, glossary terms. Bios for Christina, Chase and Blaine are
placeholders (the original site has no bio content). Staff headshots and the team photo are
placeholders.

## How the site leads to the pre-qualification

- **Home, top to bottom:** hero (one button, a real Google review under it, the office phone
  under the house) → "at a glance" strip → "What brings you here?" → **Try your numbers**
  (price and down payment sliders; the estimate uses the same math as the results page, and
  its button carries both numbers into the pre-qualification) → how it works → the team →
  reviews → closing band. The first screen should always show the top of the next section.
- **Closing band:** its headline fits the page and its button presets the pre-qualification
  goal (`CTA` and `ctaFor()` in `app.js`), so refinancers skip the first question.
- **Pre-qualification:** named stages ("Your plans · Question 1 of 9"), a progress bar that
  moves faster early and never starts empty, number answers you can type ("250k" works),
  "your best guess is fine" help, a note on who calls from which number, and the license
  line above "See my results". The header button and the phone quick bar hide on this page.
- **Phone quick bar** (≤760px) slides away while any "Get pre-qualified" button is on screen.
- NN/g finds scroll-triggered reveal animations slow people down, so the site doesn't use them.

## The two 3D pieces (`js/engines.js`)

**Turntable** (hero): 12 views around the house (`HOUSE_VIEWS` in `app.js`; `house-10.jpg` is a
copy of `house-09.jpg` and isn't used as a view, see below). Each view is drawn on a WebGL mesh with its
own depth relief (`images/house-depth.bin`, made by `tools/turntable_depth.py`, one grid per file;
each view's `d` picks its grid; real depth on the
house and plinth, the ring and backdrop stay flat), rotated up to ±22° and cross-dissolved with the
next view in a narrow window at the midpoint. Until the depth loads it uses the old simple model
(house plane, sloped lawn, ±17°). All textures load up front and upload one per frame after the
first paint, resized to 1024 off the main thread and mipmapped (the files are already 1024×1024).
Drag, arrow keys, or idle sway around the front. In dark mode the card is dimmed slightly with a
vignette (CSS only).

**Walk** (after the pre-qualification is submitted): WebGL, one canvas. Each render is a 3D relief:
a mesh with per-vertex depth from Depth Anything V2 (`images/walk-depth.bin`, made by
`tools/walk_depth.py`), normalized so the shot's anchor (door or fireplace) is at depth 1. The camera
follows the anchor; zooming in is turned into walking forward through the relief (`DOLLY`), and
walking bob, breathing and the pointer move the head (real parallax). Each shot enters exactly as
rendered. Handoffs: a shot waits until it is sharp and the camera has lined it up (the camera steers
so both shots can put the anchor on the same pixel, which matters on tall phones), then it is
revealed from the anchor outward while the outgoing shot keeps dollying to the depth where it best
matches (`THRU`, fit to SIFT matches). Exposure is graded like one camera (`CORR`, `NATIVE`). The door
leaf is a perspective quad hinged on the left, with the open-door render in the doorway. The door
sequence: three knocks (each nudges the camera and the door), the hall light warms the door glass,
footsteps, the lock turns, the door cracks open with a line of light, then swings wide on an
underdamped spring. All sound is synthesized in `doorAudio()` in `app.js` (porch air, knocks,
footsteps, deadbolt, latch, door swing, fire inside); `Walk` hands it timed cues through `opts.cue`.
It ends in a look-around in the last room (mouse, drag or arrows turn the view and move the head)
until the visitor clicks "See my results". Timeline constants are in `T` inside `Walk.play`.
Without WebGL the walk is skipped.

## Known issues / next up: make the 3D smooth

The client's feedback: "getting better, but clunky and not smooth." Planned fixes, in order:

1. Done: turntable textures up front, 1024 + mipmaps.
2. Done for the walk: depth reliefs, steering, center-out handoffs and one exposure grade. What is
   left there comes from the renders themselves (for example, the porch lantern differs between
   approach shots); fixing that needs consistent re-renders. The turntable now uses depth too;
   its side and back views are 45° apart, so a short blend remains right at each midpoint.
3. Done: the walk is WebGL.
4. Keep `prefers-reduced-motion` behavior: no auto motion; the walk is skipped.

## Supabase

Project `anzwofziyceeytcaumja` (the client-owner's existing project). Tables:

- `reliant_prequal`: goal, `answers` (jsonb keyed by question label), first_name, phone,
  email, loan_officer, wants_quote.
- `reliant_form_submissions`: form (`Question` or `Reliant Letter signup`), `fields` jsonb.

RLS is on with insert-only policies for `anon`; there are no select policies, so the browser
can never read submissions. View them in the Supabase dashboard. Migration:
`supabase/migrations/20260929000000_reliant_demo_submissions.sql`.

## Deploy

Vercel project linked to this repo, framework "Other", no build command, output = repo root.
Pushing to `main` deploys. Domain `reliant-home-mortgage.greaterpurposeweb.com` is added to
the project; greaterpurposeweb.com is the account's existing domain.

## Testing

`tools/smoke_test.py` walks every page at 390px (no sideways scroll allowed), completes the
pre-qualification including an Edit from the review step, renders walk-through frames and
takes screenshots. Run it before pushing visual changes.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
