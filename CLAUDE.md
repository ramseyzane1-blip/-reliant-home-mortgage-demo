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
                            turn/turn-NNN.webp (Blender 360° turn) + turn/depth-*.bin for the hero
demo/site/fonts/            DM Serif Display + Public Sans, self-hosted woff2 (Latin, SIL OFL)
demo/site/brand/            favicon (SVG + PNG), apple-touch-icon, share.png (1200×630 link preview, no renders)
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
tools/blender/              house_scene.py (the 3D model, rendered with Blender) + fetch_assets.py
tools/house_views.py        turns the Blender frames into turn/*.webp + turn/depth-*.bin
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
  walk-through, nowhere else.
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
programs, Google reviews, glossary terms. Bios for Christina, Chase and Blaine are
placeholders here, and staff headshots and the team photo are placeholders. The original site does
have real headshots, a team photo and full bios for all five loan officers (at /staff/<name>,
inside an embedded listing), so replace the placeholders with those. See `audit/` for the
September 2026 audit of the original site.

## How the site leads to the pre-qualification

- **Home, top to bottom:** hero (one button, a real Google review under it, the office phone
  under the house) → "at a glance" strip → "What brings you here?" → **Try your numbers**
  (price and down payment sliders; the estimate uses the same math as the results page, and
  its button carries both numbers into the pre-qualification) → how it works → the team →
  reviews → closing band. At 1440×900 the top of the "at a glance" strip shows on the first screen,
  so the page never looks finished there.
- **Closing band:** its headline fits the page and its button presets the pre-qualification
  goal (`CTA` and `ctaFor()` in `app.js`), so refinancers skip the first question.
- **Pre-qualification:** named stages ("Your plans · Question 1 of 9"), a progress bar that
  moves faster early and never starts empty, number answers you can type ("250k" works),
  "your best guess is fine" help, a note that phone or email is enough, and the license
  line above "See my results". The header button and the phone quick bar hide on this page.
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
each; `sm/`, 768px copies for phones, about 64 KB each; each frame's depth from Blender on a
161×161 mesh in two files, `depth-front.bin` (the 9 views within ±40° of the front: 233 KB, 60 KB
as served, brotli) and `depth-rest.bin` (the other 46: 1.2 MB, 307 KB as served).
`HOUSE_VIEWS` in `js/app.js` lists the frames; `tools/house_views.py` writes all of it.

In the browser each frame is a relief: a mesh with its real depth, turned in 3D about the house's
axis to the exact angle (the camera matches `house_scene.py`), so things move with their real
parallax (a trunk in front of a wall) and nothing shows twice. This replaced an optical-flow morph
whose blends doubled trunks and columns and went soft between frames, which read as flicker when
spinning (frame-to-frame sharpness change in a fast spin: 4.5%, was 12%; slow: 3.5%, was 5.5%).
Next to a depth jump the mesh stretches across what the turn uncovers; there (marked in the
stencil) the other frame is drawn over it, fading in over the first 2° of turning. Between two
frames, each frame's turned picture is drawn offscreen and the two are mixed across the middle
half of the step (they line up, so the mix does not ghost); nearer a frame, that frame alone. The
ring does not turn: its pixels are found with a render of the ring alone and kept still. The house
never turns faster than 110°/s however hard it is flicked. The fixed layer goes on top, still
(drawn only over the tiles where it has content). The front frame and the fixed layer
are preloaded with the page as two stacked `<img>`s (the Largest Contentful Paint on desktop and
on phones where the hero shows above the fold: about 1.0 s on a slow-4G profile, was 3.8 s), with
`sizes` set so the browser picks the same copy the canvas uses. Everything else waits until the
hero is about to scroll into view: then the front depth and the two frames next to the front
(the hero is ready once those are in), then the rest of the 9 frames the idle sway uses (front
±40°), then the rest of the depth and the frames once those are in or the visitor starts turning.
Until a frame is in, the nearest frame that is in is turned to the angle instead. A depth that
lands while its frame is on screen waits until the turn moves on, so nothing pops. On a
throttled phone profile the hero is interactive after about 580 KB at 3.9 s.
Frames decode off the main thread (`createImageBitmap`) at the canvas's pixel size (re-decoded if
the canvas grows a lot) and upload one per animation frame, never during a drag unless the frame
on screen is missing; the decoded copy is released after upload. Every frame stays on the GPU
(a spin that has to wait for an evicted frame shows as a jump; a 16-frame cap made 19% of a fast
phone spin jump). Phones decode at most 672px (all 55: about 97 MB), devices reporting under 4 GB
(`navigator.deviceMemory`, Chromium only) 512px (about 55 MB). The drawing is heavier than the old
morph (up to four 51k-triangle mesh passes a frame), easy for any GPU, slow in software rendering.
About a second after the hero is well out of view (scrolled away, another page, or
the walk-through, which also puts it to sleep directly) it releases every texture and its
drawing buffer and the two `<img>`s show again; coming back, it re-uploads from the HTTP cache
(ready in about 0.2 s). At the walk's peak the hero holds nothing on the GPU. Failed
frames retry with backoff. Drag, arrow
keys (with a focus ring), or idle sway around the front; reduced motion turns the sway off;
without WebGL, or if the context is lost, the two `<img>`s stay as a still picture and the hero
drops the drag and keyboard hints.

To change the house: edit `house_scene.py`, preview with
`python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270` (needs `pip install bpy`
and `python3 tools/blender/fetch_assets.py` once), render with
`python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64` (about 80 minutes on 4 CPU
cores) plus the 5° in-betweens with `angles 960 /tmp/mid/b 64 <Blender rotations>` (the current set:
45 55 65 75 85 95 105 115 125 135 195 225 235 265 275 285 295 305 315), the depth of every frame
with `depth 960 /tmp/depth <all 55 rotations>` (about 40 s each) and `ringdepth 960
/tmp/depth/ring.exr`, then run `python3 tools/house_views.py /tmp/turn /tmp/mid /tmp/depth`
(needs `pip install OpenEXR`). See `tools/README.md`.

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

`tools/smoke_test.py` checks the hero turntable (loads with its depth, turns when dragged), walks every page at 390px (no sideways scroll allowed), completes the
pre-qualification including an Edit from the review step, renders walk-through frames and
takes screenshots. It fails on any console or page error (third-party font CSS is stubbed so it is
hermetic). Run it before pushing visual changes, with `pip install playwright==1.56.0` (matches the
pre-installed Chromium). For the walk also run `tools/walk_perf.py` and `tools/walk_checks.py`.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
