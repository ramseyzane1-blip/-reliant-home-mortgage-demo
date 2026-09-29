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
demo/site/images/           3D renders only (see tools/README.md) + logo.png
                            turn/turn-NNN.webp (Blender 360° turn) + turn/flow-*.bin for the hero
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
tools/blender/              house_scene.py (the 3D model, rendered with Blender) + fetch_assets.py
tools/house_views.py        turns the Blender frames into turn/*.webp + turn/flow-*.bin
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
- **Demo behavior:** forms save to Supabase and then show a "this is a demo" notice.
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
placeholders (the original site has no bio content). Staff headshots and the team photo are
placeholders.

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

1. Done: the hero turntable is a real 3D model rendered from every angle (see above).
2. Done for the walk: depth reliefs, steering, center-out handoffs and one exposure grade. What is
   left there comes from the renders themselves (for example, the porch lantern differs between
   approach shots); fixing that needs consistent re-renders.
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
takes screenshots. Run it before pushing visual changes.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
