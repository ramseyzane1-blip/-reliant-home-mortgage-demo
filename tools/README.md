# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it). Use
  `pip install playwright==1.56.0`, which matches the pre-installed Chromium (chromium-1194).
- `blender/house_scene.py`: the 3D model of the house behind the hero turntable, built in code
  and rendered with Blender's Cycles (`pip install bpy`). `blender/fetch_assets.py` downloads the
  CC0 Poly Haven assets it uses into `blender/assets/` (not committed).
- `house_views.py`: converts the rendered frames into what the site loads, in one step.
- `site_audit.js`: measures any site page by page in a real browser (weight, requests, SEO basics,
  axe-core WCAG checks, phone-width checks, screenshots). Used for the audit in `audit/`.
- `export_pdfs.js`: exports the audit deck and report to PDF.

## Regenerating the hero turntable

```bash
python3 tools/blender/fetch_assets.py                                  # once
python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270  # test views (~1 min each)
python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64         # the turn (~80 min, 4 cores)
python3 tools/blender/house_scene.py angles 960 /tmp/mid/b 64 <the 108 rotations on the 2.5° grid that are not multiples of 10>   # ~2.3 min each
python3 tools/blender/house_scene.py depth 960 /tmp/depth <all 144 Blender rotations>   # depth (~15 s each)
python3 tools/blender/house_scene.py ringdepth 960 /tmp/depth/ring.exr # the ring alone (it stays still)
python3 tools/house_views.py /tmp/turn /tmp/mid /tmp/depth             # needs pip install OpenEXR
python3 tools/house_views.py depth /tmp/depth                          # only the depth, for the frames on the site
```

`house_views.py` writes into `demo/site/images/turn/`: `fixed.webp` (everything that looks the same
in every frame, drawn still on top), `turn-NNN.webp` (the frames with those parts cut out,
keeping a 2px overlap so no seam opens; transparent, 960×960, about 89 KB each), `sm/` copies
(768×768 for phones, about 64 KB), `depth-front.bin` and `depth-rest.bin` (each frame's depth
from the Cycles Z pass, median-filtered, sampled on a 121×121 mesh, uint8 between that frame's
near and far; background takes the depth of the nearest surface, and 255 marks the ring, found by
comparing with the ring rendered alone. The front file holds the views within `FRONT` = 40° of
the front and loads with the front frames, 112 KB brotli; the rest loads later, 382 KB brotli).
The page turns each frame in 3D with it. It stamps a `?v=` content version on those URLs in `index.html` and
`js/app.js` and sets `HOUSE_VIEWS` to the frame count. The house turns; the camera, lights and ring stay
fixed. `ZOOM="lens,x,z"` before `angles` renders a close-up for checking details.

## How the 3D images were prepared

The walk-through images in `demo/site/images/` are AI-generated renders of a fictional house
supplied by the client; the hero turntable is rendered from a 3D model of that house (above; a close match, not exact).
Rendered images are used **only** in the two 3D pieces (the hero turntable and the walk-through).
Don't use them anywhere else on the site.

- `turn/turn-NNN.webp` (144 frames, 2.5° apart) and `turn/depth-*.bin`: the hero turntable, rendered from the
  3D model in `tools/blender/house_scene.py` (Blender, Cycles) and converted by
  `tools/house_views.py`. The model uses CC0 assets from Poly Haven (a scanned tree, scanned
  siding, roof, stone and grass textures, a patio set); `tools/blender/fetch_assets.py`
  downloads them into `tools/blender/assets/`, which is not committed.
- `door.jpg` and `inside-2.jpg`: the walk-through (a push into the door, a dissolve to the living
  room). Each has an anchor rectangle in image pixels in `Walk.SHOTS` in `js/engines.js`: the door
  (found by detecting the dark green door slab) and the fireplace. The photo scales about it.
- `walk_checks.py` checks the walk-through's behaviour (see its docstring).

The source renders (PNG, ~1.5 MB each) are not in the repo. If you regenerate an image,
keep the framing, dusk lighting and camera height consistent, and re-measure its anchor
rectangle.

## Logo

`tools/make_logo.py` makes `logo.webp` and `logo-dark.webp` from the client's logo
(`tools/brand/logo-source.webp`, transparent background): cropped and sized for the 44px header
at 3x. The dark copy keeps the emblem as is and recolors the wordmark light.
It also makes the icons from the duck and swoosh alone (`brand/favicon-32.png` and
`favicon-192.png`, transparent; `apple-touch-icon.png` on white) and puts the dark-mode logo on
the link preview `brand/share.png`. Re-running it is safe.
