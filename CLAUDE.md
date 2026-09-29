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
- **Demo behavior:** forms save to Supabase and then show a "this is a demo" notice.
- Blog and newsletter are merged into "The Reliant Letter" on About us.

## Content sources

Everything factual comes from relianthomemtg.com: licenses (NMLS #2292251, OH RM.804827.000,
KY MB855092, IN 2292251), loan officer NMLS numbers, office address and phone, the 20 loan
programs, Google reviews, glossary terms. Bios for Christina, Chase and Blaine are
placeholders (the original site has no bio content). Staff headshots and the team photo are
placeholders.

## The two 3D pieces (`js/engines.js`)

**Turntable** (hero): 13 renders around the house. Each view is drawn on a WebGL mesh with a
simple depth model (house plane, lawn sloping toward the viewer, a per-vertex weight that
keeps the outer ring fixed), rotated up to ±17° and cross-dissolved with the next view.
Drag, arrow keys, or idle sway around the front.

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

1. **Turntable textures.** Upload all 13 textures up front, one per frame after first paint,
   instead of on demand (the texImage2D hitch during a drag is the main stutter). Resize
   renders to 1024×1024 so they can mipmap.
2. Done for the walk: depth reliefs, steering, center-out handoffs, one exposure grade and a
   consistent approach (the far shot `approach-1`, a different porch design, was dropped; the
   porch pendant was added to `approach-2`). The turntable still cross-dissolves; it belongs to
   the turntable work (`claude/admiring-maxwell-trn3ea`).
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
takes screenshots. It fails on any console or page error (third-party font CSS is stubbed so it is
hermetic). Run it before pushing visual changes, with `pip install playwright==1.56.0` (matches the
pre-installed Chromium). For the walk also run `tools/walk_perf.py` and `tools/walk_checks.py`.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
