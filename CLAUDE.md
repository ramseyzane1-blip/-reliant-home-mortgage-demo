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
demo/site/js/engines.js     Turntable (hero, live 3D with three.js) and Walk (walk-through)
demo/site/js/vendor/        three-hero.min.js: three.js r186, only what the hero uses
demo/site/js/db.js          DB.insert(table,row) via Supabase REST
demo/site/js/app.js         everything else: pages, tools, pre-qual, router
demo/site/images/           3D renders only (see tools/README.md) + logo.webp, logo-dark.webp (from tools/make_logo.py)
                            team/<name>.webp (160px face) and <name>-lg.webp (480px): the real staff
                            headshots from relianthomemtg.com/staff (the original site's own photos)
                            model/ (the hero's live 3D model: glb + baked webp textures, see below)
demo/site/fonts/            DM Serif Display + Public Sans, self-hosted woff2 (Latin, SIL OFL)
demo/site/brand/            favicon (32 + 192px PNG, the duck), apple-touch-icon, share.png (1200×630 link preview, no renders); all from tools/make_logo.py
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
tools/blender/              house_scene.py (the 3D model, rendered with Blender) + fetch_assets.py
tools/blender/web_model.py  makes the web version of the model (baked lighting); tools/pack_web_model.py packs it
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

## The hero turntable and the walk-through (`js/engines.js`)

**Turntable** (hero): a real 3D model of the house, drawn live in the page with three.js, so it
turns smoothly at any angle with no frames to switch between (client pick, September 2026; the
earlier versions turned 55, then 144 pre-rendered pictures and ticked or flickered between them;
they are in git history). The model is built in code in Blender (`tools/blender/house_scene.py`):
lap-board siding, real window openings with lit rooms, curtains and lamps, the glazed green front
door with sidelights and lanterns from the walk-through renders, a shingle roof with gutters, Poly
Haven (CC0) scanned trees and textures, and Geometry Nodes grass and shrubs. It floats on the page
with no card (client request); the house and plinth turn, the ring stays still.

The full scene is far too heavy for a browser (305,000 grass blades, tree crowns of 20 million
polygons each), so `tools/blender/web_model.py` makes a web version and bakes Blender's own
lighting (Cycles: the golden-hour sun, the sky, bounce light, soft shadows, the lit rooms) into its
textures, saved through the renders' color look (AgX, its look and exposure). The page only paints
the baked result (`MeshBasicMaterial`, no lights), so it looks close to the renders and costs little
to draw. The lighting turns with the house, like walking around a real house on a sunny afternoon.
Parts (`images/model/`, all with a `?v=` content version, `MODEL_V` in `js/app.js`):
- `house.glb` + `house.webp`: the house, patio set, simplified tree trunks and the dark crown
  cores, joined, unwrapped into one 2048px atlas and baked (75k triangles).
- `ground.webp`: the lawn disc baked flat (top-down UVs): the grass blades' green under the light
  that falls on the lawn, and the plain ground where no grass grows. Its alpha marks where grass
  grows; the page stacks 12 "shell" layers over the disc that keep the blades reaching their height,
  so the lawn has depth at this low camera and stops at the walk and beds.
- `cards.glb` + `twigs.webp`: every leafy twig of the crowns and shrubs (and the scanned trees' own
  leaves) as one card showing a photo of that twig (10 twig photos in one atlas), with baked light
  per card corner (26k cards). Color = vertex light x photo detail, graded to the renders' foliage
  (`Color(2.43,2.57,1.10)` in the engine).
- `ring.glb` + `ring.webp` (the ring, baked on its own, does not turn), `panes.glb` (the window glass,
  drawn as a faint warm reflection).
- `still.webp` (+ `sm/` 768px): the live model's own front view, shown until the model is in and
  without WebGL, so the hand-over is invisible. Preloaded with the page (the Largest Contentful Paint).

The engine (`Turntable` in `js/engines.js`) loads `js/vendor/three-hero.min.js` (three.js r186 with
only what the hero uses, plus GLTFLoader and the meshopt decoder: 626 KB, 131 KB as served) with a
dynamic import once the hero is about to scroll into view, then all parts at once (about 2.9 MB); it
draws nothing and the still picture stays until every part is in. Camera as in the renders: 60 m
away, 7 degrees up, 80mm lens. Per frame: 17 draw calls, about 144k triangles. Edge smoothing (MSAA)
only on screens under 1.5x density; drawing resolution is the screen's, capped at 2x, and steps
down (not below 1x) if frames stay slower than about 45 fps while it moves. On a throttled phone
profile (1.6 Mbps) the whole model is in after about 18 s (the still shows meanwhile); the picture
version it replaced loaded 11.8 MB for a full turn. About a second after the hero is well out of
view it frees every texture and geometry on the GPU (0 of each), and they are uploaded again on
return. Drag (inertia, at most 160 degrees a second), arrow keys (with a focus ring), or the idle
sway: whenever nobody is holding it, the house swings +-38 degrees around the front, 14 s a full
swing (`AMP`, `W`); a fraction of a second after a drag coasts to a stop (1.5 s after arrow keys)
it takes over from wherever the house is, starting at zero speed and easing back to the front.
Reduced motion turns the sway off. Without WebGL, or if the context is lost, the still stays and the
hero drops the drag and keyboard hints. Test hooks on `window.__turntable`: `ready()`, `angle()`,
`set(a)`, `draw(a)`, `sleep()`, `asleep()`, `info()` (draw calls, triangles, textures).

To change the house: edit `house_scene.py` (preview with
`python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270`; needs `pip install bpy`
and `python3 tools/blender/fetch_assets.py` once), then
`python3 tools/blender/web_model.py /tmp/web 2048 32` (about 20 minutes on 4 CPU cores; needs
`pip install OpenEXR`) and `python3 tools/pack_web_model.py /tmp/web` (needs node for
`@gltf-transform/cli`, and playwright for the still). `HOUSE_ONLY=1` bakes only the house, in about
a minute, for checking. See `tools/README.md`. The picture pipeline (`house_scene.py frames`,
`depth`, `tools/house_views.py`) is kept for renders; the page no longer uses it.

**Walk** (after the pre-qualification is submitted; client pick, September 2026, replacing the longer
WebGL walk with the knock): about 4 seconds. A slow push into the front door (`images/door.jpg`), the
door brightening into warm light as it dissolves (from 1.05s) into the living room with the fireplace
(`images/inside-2.jpg`, still easing in), then "Welcome home, [name]" with a house outline drawing
itself and a soft sweep of light, and "See my results" (focused) at 3.5s. Two photos, CSS transforms
and opacity only, run by the Web Animations API on the compositor, so it stays smooth on any phone.
Each photo covers the screen with its anchor (the door, the fireplace) as near the center as covering
allows, and scales about the anchor. Timeline: `T` in `Walk` in `js/engines.js`. Sound is synthesized
in `doorAudio()` in `app.js` (porch air, the latch and the door swing during the push, the fire inside);
`Walk` hands it timed cues through `opts.cue`. The Sound and Skip buttons, Escape, a route change
(Back, a link) and "See my results" end it and show the results; with `prefers-reduced-motion` it is
skipped. Test hooks on `window.__walk`: `seek(t)` (show the frame at t seconds), `render(t)`, `time()`,
`stop()`. Checks: `tools/walk_checks.py` (reduced motion, focus, Escape, route change, sound toggle
and audio context lifecycle, keyboard focus ring and Enter, 390/1280 light/dark screenshots).

The earlier versions are in git history: the WebGL walk with depth reliefs and a synthesized knock
(before this change on `main`), and an AI video knock (Seedance 2.0, branch `claude/knock-ai-video`
at c03840c), which the client dropped as too costly for what it added.

## Known issues / next up: make the 3D smooth

The client's feedback: "getting better, but clunky and not smooth." Planned fixes, in order:

1. Done: the hero turntable is a real 3D model rendered from every angle (see above).
2. Done: the walk-through is a short CSS animation (a push into the door, a dissolve to the room,
   the welcome), smooth on any device.
3. Keep `prefers-reduced-motion` behavior: no auto motion; the walk is skipped.

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

`tools/smoke_test.py` checks the hero turntable (the 3D model loads, turns when dragged), walks every page at 390px (no sideways scroll allowed), completes the
pre-qualification including an Edit from the review step, renders walk-through frames and
takes screenshots. It fails on any console or page error (third-party font CSS is stubbed so it is
hermetic). Run it before pushing visual changes, with `pip install playwright==1.56.0` (matches the
pre-installed Chromium). For the walk-through also run `tools/walk_checks.py`.

## Accessibility & quality bar

Every page must work at phone width with no horizontal scroll, in light and dark mode, with
keyboard focus visible and `prefers-reduced-motion` respected. Copy is plain and direct: no
em-dash asides, no urgency tactics, no "not X but Y".
