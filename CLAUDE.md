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
                            house-NN.webp cut-outs + house-flow.bin for the turntable
supabase/migrations/        tables for submissions
tools/smoke_test.py         Playwright end-to-end test
tools/house_views.py        builds the turntable cut-outs and flow from tools/house-src/
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

**Turntable** (hero): 12 renders around the house, cut out of their studio background so the
house, plinth and ring float on the page with no card (client request). Between neighboring
views each image is drawn on a 41×41 WebGL mesh displaced along precomputed optical flow
(`images/house-flow.bin`) while the two blend across the whole interval, so the house moves
into the next view instead of flashing. All textures load up front, one GPU upload per frame.
Drag, arrow keys, or idle sway around the front. Rebuild the images and flow with
`python3 tools/house_views.py`.

**Walk** (after the pre-qualification is submitted): DOM layers with CSS transforms. One
camera follows the door (outside) then the fireplace (inside); each image takes over when it
has enough resolution for the current distance. The door leaf is a CSS 3D quad hinged on the
left, with the open-door render showing through the doorway. Two soft synthesized knocks.
It ends in a look-around (mouse, drag or arrows) until the visitor clicks "See my results".
Timeline constants are in `T` inside `Walk.play`.

## Known issues / next up: make the 3D smooth

The client's feedback: "getting better, but clunky and not smooth." Planned fixes, in order:

1. ~~Turntable textures~~ and 2. ~~optical-flow morphing~~ are done (see above). The front
   views (11–14° apart) morph cleanly; the sides and back are 45–54° apart and still show
   some blending mid-turn. More renders at those angles would fix that best.
3. **Move the walk to WebGL.** Scaling large DOM layers that contain CSS 3D children forces
   re-rasterization every frame. Render every shot as a textured quad on one canvas, draw the
   door leaf as a real perspective quad, and apply the same flow morphing at each handoff
   (align the pair by their anchor rectangles first, then compute flow on the overlap).
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
