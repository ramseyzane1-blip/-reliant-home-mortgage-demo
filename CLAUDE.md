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
demo/site/images/           3D renders only (see tools/README.md) + logo.webp, logo-dark.webp (from tools/make_logo.py)
                            team/<name>.webp (160px face) and <name>-lg.webp (480px): the real staff
                            headshots from relianthomemtg.com/staff (the original site's own photos)
                            turn/turn-NNN.webp (Blender 360° turn) + turn/flow-*.bin for the hero
demo/site/fonts/            DM Serif Display + Public Sans, self-hosted woff2 (Latin, SIL OFL)
demo/site/brand/            favicon (SVG + PNG), apple-touch-icon, share.png (1200×630 link preview, no renders)
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
tools/blender/              house_scene.py (the 3D model, rendered with Blender) + fetch_assets.py
tools/house_views.py        turns the Blender frames into turn/*.webp + turn/flow-*.bin
tools/site_audit.js         page-by-page audit of any site (used for audit/)
audit/                      client audit: slide deck (index.html), written report, PDFs, evidence
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
  walk-through, nowhere else. The one other kind of photo is the team's real headshots
  (`images/team/`), which carry the family feel.
- **Look:** crisp white with cool gray sections, Reliant forest green (#1c4f33, from the
  logo wordmark) for every action, sand (#c3b69c, from the logo swoosh) as a quiet accent.
  No gold buttons (reads as money-focused). DM Serif Display headings, Public Sans body.
  Both are self-hosted and preloaded, with size-matched fallback faces (no layout shift on swap).
- **Demo behavior:** forms save to Supabase and then show a "this is a demo" notice (inline on
  the pre-qualification results, so nothing covers them; a modal for the other forms).
- Blog and newsletter are merged into "The Reliant Letter" on About us.

**Proposed, pending client sign-off:** the hero turntable now shows a 3D model of the same house
(rendered in Blender, see below) instead of the AI renders, so it can turn a full 360° without
ghosting. The walk-through still uses the AI renders; the model matches them closely (siding,
trim, roof, windows, portico, glazed green door with sidelights and lanterns) but not exactly
(for example, round portico columns instead of square). Renders still appear only in the two 3D
pieces.

## Content sources

Everything factual comes from relianthomemtg.com: licenses (NMLS #2292251, OH RM.804827.000,
KY MB855092, IN 2292251), loan officer NMLS numbers, office address and phone, the 20 loan
programs, Google reviews, glossary terms. The five loan officers' headshots, titles and bios come
from their pages on the original site (/staff/<name>, inside an embedded listing); the bios are
shortened into plain third person but every detail (years in lending, family, pets, specialties)
is theirs. Chase Barker's relationship to Kevin and Jennifer isn't stated on the original site, so
the demo doesn't state one. See `audit/` for the
September 2026 audit of the original site.

## How the site leads to the pre-qualification

- **Home, top to bottom:** hero (headline "Home loans, from our family to yours.", a lede that says
  a husband and wife have run it since 1996, one button, "About 2 minutes. No credit check.", the
  five real faces with "Five loan officers, one family-owned office on Breiel Boulevard.", then a
  real Google review and the office phone) → "What brings you here?" → **Try your numbers**
  (price and down payment sliders; the estimate uses the same math as the results page, and
  its button carries both numbers into the pre-qualification) → how it works (no button of its own) →
  the team (Kevin and Jennifer's photos, family details from their bios, all five faces) with three
  Google reviews in the same section → closing band. Kept deliberately calm:
  research on visual complexity (Tuch et al. 2012) and NN/g's homepage guidelines say busy pages and
  repeated elements lower trust, so decoration isn't repeated; real faces (content, not decoration) appear in
  the hero and the team section, not the footer.
- **Color:** green is for actions (buttons, sliders, progress). Cards and placeholders are neutral
  (white or warm sand in light mode, warm charcoal `#151412`-`#2a2823` in dark mode, never green-tinted).
  The light closing band is the one green block.
- **Closing band:** its headline fits the page and its button presets the pre-qualification
  goal (`CTA` and `ctaFor()` in `app.js`), so refinancers skip the first question.
- **Pre-qualification:** named stages ("Your plans · Question 1 of 11"), a progress bar that
  moves faster early and never starts empty (fast-to-slow bars cut drop-off in a 32-experiment
  meta-analysis; constant ones don't), number answers you can type ("250k" works),
  "your best guess is fine" help, a note that phone or email is enough, and the license
  line above "See my results". The header button and the phone quick bar hide on this page.
  Buyers are asked household income and monthly debts, so the results can lead with "What you may
  be able to afford" (the Learn calculator's math: housing up to 43% of gross income, less debts).
  Answers that depend on each other are kept possible (down payment at most the price, balance at
  most the home's value). The down payment help says many loans need far less than 20% down (Fannie
  Mae: 90% of people overstate or don't know the minimum). "What happens next" says the loan officer
  calls the phone or emails the address the visitor gave, and that mortgage credit checks within 45
  days count as one (CFPB). Answers and results survive a reload in the same tab (sessionStorage).
- **Reviews:** every star rating is offered the Google review link; 1 to 3 stars also get "Tell us
  what happened". Asking only happy clients for public reviews ("review gating") breaks Google's
  review policy.
- **Other forms** (Question, Reliant Letter) check required fields before saving, with the message
  under the field, and use autocomplete.
- **Phone quick bar** (≤760px) slides away while any "Get pre-qualified" button is on screen.
- NN/g finds scroll-triggered reveal animations slow people down, so the site doesn't use them.

## The two 3D pieces (`js/engines.js`)

**Turntable** (hero): a real 3D model of the house, built in code in Blender
(`tools/blender/house_scene.py`) and rendered as a 360° turn: 55 frames, every 10° around the front
and every 5° on the sides and back (where 10° steps ghosted mid-morph), with a transparent background so the house, plinth and ring float on the page with no card (client
request). The house and plinth turn; the ring, camera and golden-hour lighting stay fixed. The
model has lap-board siding, real window openings with lit rooms, curtains and lamps, the glazed
green front door with sidelights and lanterns from the walk-through renders, a shingle roof with
gutters, Poly Haven (CC0) scanned trees and textures, and Geometry Nodes grass and shrubs.

Files (`images/turn/`, all with a `?v=` content version so caches never mix renders):
`fixed.webp` (19 KB), the parts that look the same in every frame (most of the ring and the front
of the round plinth); `turn-NNN.webp`, the frames with those parts cut out, 960px, about 89 KB
each; `sm/`, 768px copies for phones, about 64 KB each; the optical flow in two files,
`flow-front.bin` (the 8 pairs within ±40° of the front: 35 KB, 18 KB as served, brotli) and
`flow-rest.bin` (the other 47: 205 KB, 90 KB as served). `HOUSE_VIEWS` in `js/app.js` lists the frames; `tools/house_views.py` writes all of it.

In the browser, each pair of neighboring frames is drawn on a 33×33 WebGL mesh displaced along
precomputed optical flow while they blend; the fixed layer goes on top, still (drawn only over
the tiles where it has content), so the ring never ghosts. The front frame and the fixed layer
are preloaded with the page as two stacked `<img>`s (the Largest Contentful Paint on desktop and
on phones where the hero shows above the fold: about 1.0 s on a slow-4G profile, was 3.8 s), with
`sizes` set so the browser picks the same copy the canvas uses. Everything else waits until the
hero is about to scroll into view: then the front flow and the two frames next to the front
(the hero is ready once those are in), then the rest of the 9 frames the idle sway uses (front
±40°), then the rest of the flow and the frames once those are in or the visitor starts turning.
A pair whose flow has not arrived yet simply crossfades; a flow that lands while its pair is on
screen waits until the turn moves on, so nothing pops. On a throttled phone profile the hero is
interactive after about 430 KB at 3.2 s (one flow file: 650 KB at 4.6 to 5.2 s).
Frames decode off the main thread (`createImageBitmap`) at the canvas's pixel size (re-decoded if
the canvas grows a lot) and upload one per animation frame, never during a drag unless the frame
on screen is missing; the decoded copy is released after upload. Touch devices and devices
reporting under 4 GB (`navigator.deviceMemory`, Chromium only) keep the 16 nearest on the GPU
(about 29 MB on a 390px phone); the others are fetched into the HTTP cache and decoded again
when needed. About a second after the hero is well out of view (scrolled away, another page, or
the walk-through, which also puts it to sleep directly) it releases every texture and its
drawing buffer and the two `<img>`s show again; coming back, it re-uploads from the HTTP cache
(ready in about 0.2 s). At the walk's peak on a 390px phone that leaves only the walk's textures
on the GPU (73 MB with drawing buffers; was 139 MB with the hero's 63 MB still held). Failed
frames retry with backoff. Drag, arrow
keys (with a focus ring), or idle sway around the front; reduced motion turns the sway off;
without WebGL, or if the context is lost, the two `<img>`s stay as a still picture and the hero
drops the drag and keyboard hints.

To change the house: edit `house_scene.py`, preview with
`python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270` (needs `pip install bpy`
and `python3 tools/blender/fetch_assets.py` once), render with
`python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64` (about 80 minutes on 4 CPU
cores) plus the 5° in-betweens with `angles 960 /tmp/mid/b 64 <Blender rotations>` (the current set:
45 55 65 75 85 95 105 115 125 135 195 225 235 265 275 285 295 305 315), then run
`python3 tools/house_views.py /tmp/turn /tmp/mid`. See `tools/README.md`.

**Walk** (after the pre-qualification is submitted): WebGL (WebGL2 where available), one canvas.
Each render is a 3D relief: a mesh with per-vertex depth from Depth Anything V2
(`images/walk-depth.bin`, made by `tools/walk_depth.py`), normalized so the shot's anchor (door or
fireplace) is at depth 1. The camera follows the anchor; zooming in is turned into walking forward
through the relief (`DOLLY`), and walking bob, breathing and the pointer move the head (real
parallax). Shots: `approach-2…4`, `door` (wide screens), `door-open`, `inside-1…4`. Each shot enters
exactly as rendered, once it is sharp and the camera has lined it up (on tall screens the camera
steers, on a critically damped spring, so both shots can put the anchor on the same pixel), and is
revealed from the anchor outward while the outgoing shot dollies to the depth where it best matches
(`THRU`). One fade at a time: approach .55s, door to open door .75s, rooms .85s. Exposure is graded
like one camera (`CORR`, `NATIVE`, from `tools/walk_grade.py`). The vignette, caption scrim, warm
spill and the fade in from black are applied inside the shaders, so nothing in the page blends over
the canvas (the page beneath is hidden while the overlay is opaque).

On tall screens (height > 1.1 × width) the approach ends on the porch shot `approach-4` and the door
opens there (the close-up would fill the width); you knock from a step back, then step up while the
footsteps come. The door rig (leaf as a perspective quad hinged on the left, the open-door render in
the doorway, the crack of light, spill, hall-light glow on the glass) scales to whichever shot ends
the approach. The door sequence: three knocks (each nudges the camera and the door), the hall light
warms the door glass, footsteps, the lock turns, the door cracks open, then swings wide on an
underdamped spring. All sound is synthesized in `doorAudio()` in `app.js` (porch air, knocks,
footsteps, deadbolt, latch, door swing, fire inside); `Walk` hands it timed cues through `opts.cue`,
scheduled against the audio clock (measured within ~15ms of the visual beat). It ends in a
look-around in the last room (mouse, drag or arrow keys turn the view and move the head) until the
visitor clicks "See my results". Timeline constants are in `T` inside `Walk.play`. Without WebGL, or
with `prefers-reduced-motion`, the walk is skipped. If the WebGL context is lost, the route changes (Back, a link) or
Escape is pressed, the walk ends and the results show. Turning the phone before the threshold rebuilds
the walk at the same moment (`startAt`): shots that are already sharp show at once, and cues that
already sounded stay done.

Performance and memory: a software renderer (SwiftShader, llvmpipe) is detected and drawn at .3
scale with a coarse mesh and mipmaps; a GPU draws at full resolution (device pixel ratio capped at
2). There is no frame-time governor: a rAF-capped 60Hz loop can't tell spare headroom, and iOS Low
Power Mode caps rAF at 30fps, which would read as a slow GPU. Low-end phone GPUs are untested. Every shot is drawn once behind
the loading overlay (warm-up), and the walk starts once the overlay has faded in. Textures: the approach, door and doorway view upload at start; the
rooms stream in during the knock (four bands, one per frame, decoded off the main thread); each
shot is freed once passed. Test hooks on `window.__walk`: `render(t)`, `stop()`, `time()`,
`scale(v)`, `mem()`, `look()`, `probe()`, `shots()`.

Tools: `tools/walk_perf.py` (frame pacing unthrottled and at 4× CPU throttle, audio sync, texture
memory, a 30fps scrub for pops and stray blends) and `tools/walk_checks.py` (reduced motion, sound
toggle and audio context lifecycle, keyboard look-around, focus ring, 390/1280 light/dark).

## Known issues / next up: make the 3D smooth

The client's feedback: "getting better, but clunky and not smooth." Planned fixes, in order:

1. Done: the hero turntable is a real 3D model rendered from every angle (see above).
2. Done for the walk: depth reliefs, steering, center-out handoffs, one exposure grade and a
   consistent approach (the far shot `approach-1`, a different porch design, was dropped; the
   porch pendant was added to `approach-2`).
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

`tools/smoke_test.py` checks the hero turntable (loads with its flow, turns when dragged), walks every page at 390px (no sideways scroll allowed), completes the
pre-qualification including an Edit from the review step, renders walk-through frames and
takes screenshots. It fails on any console or page error (third-party font CSS is stubbed so it is
hermetic). Run it before pushing visual changes, with `pip install playwright==1.56.0` (matches the
pre-installed Chromium). For the walk also run `tools/walk_perf.py` and `tools/walk_checks.py`.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
