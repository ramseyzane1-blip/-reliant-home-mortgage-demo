# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it). Use
  `pip install playwright==1.56.0`, which matches the pre-installed Chromium (chromium-1194).
- `blender/house_scene.py`: the 3D model of the house behind the hero turntable, built in code
  and rendered with Blender's Cycles (`pip install bpy`). `blender/fetch_assets.py` downloads the
  CC0 Poly Haven assets it uses into `blender/assets/` (not committed).
- `house_views.py`: converts the rendered frames into what the site loads, in one step.

## Regenerating the hero turntable

```bash
python3 tools/blender/fetch_assets.py                                  # once
python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270  # test views (~1 min each)
python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64         # the turn (~80 min, 4 cores)
python3 tools/blender/house_scene.py angles 960 /tmp/mid/b 64 45 55 65 75 85 95 105 115 125 135 195 225 235 265 275 285 295 305 315
python3 tools/house_views.py /tmp/turn /tmp/mid                        # in-betweens where 10° ghosted
```

`house_views.py` writes into `demo/site/images/turn/`: `fixed.webp` (everything that looks the same
in every frame, drawn still on top), `turn-NNN.webp` (the frames with those parts cut out,
keeping a 2px overlap so no seam opens; transparent, 960×960, about 89 KB each), `sm/` copies
(768×768 for phones, about 64 KB), `flow-front.bin` and `flow-rest.bin` (optical flow between
neighboring frames on a 33×33 grid, forward-backward checked, smoothed where the match is poor
and held at zero on the fixed parts; int8 with one scale per field. The front file holds the
pairs within `FRONT` = 40° of the front and loads with the front frames, 35 KB, 18 KB brotli;
the rest loads later, 205 KB, 90 KB brotli). It stamps a `?v=` content version on those URLs in `index.html` and
`js/app.js` and sets `HOUSE_VIEWS` to the frame count. `GRID=49` or `65` morphs a little better
but costs frame time. The house turns; the camera, lights and ring stay
fixed. `ZOOM="lens,x,z"` before `angles` renders a close-up for checking details.

## How the 3D images were prepared

The walk-through images in `demo/site/images/` are AI-generated renders of a fictional house
supplied by the client; the hero turntable is rendered from a 3D model of that house (above; a close match, not exact).
Rendered images are used **only** in the two 3D pieces (the hero turntable and the walk-through).
Don't use them anywhere else on the site.

- `turn/turn-NNN.webp` (55 frames) and `turn/flow-*.bin`: the hero turntable, rendered from the
  3D model in `tools/blender/house_scene.py` (Blender, Cycles) and converted by
  `tools/house_views.py`. The model uses CC0 assets from Poly Haven (a scanned tree, scanned
  siding, roof, stone and grass textures, a patio set); `tools/blender/fetch_assets.py`
  downloads them into `tools/blender/assets/`, which is not committed.
- `approach-2…4.jpg`, `door.jpg`: the walk up to the front door. Each has a door rectangle
  (in image pixels) in `Walk.SHOTS` in `js/engines.js`, found by detecting the dark green
  door slab. `approach-1.jpg` (a wide shot of a different porch design) was dropped so the whole
  approach is one house, and `approach-2.jpg` has the porch pendant from `approach-3.jpg` added
  (aligned with a SIFT homography, color-matched, soft mask), since every other shot has it.
- `door-open.jpg`: the same door open, with the doorway and fireplace rectangles.
- `inside-1…4.jpg`: the walk inside, anchored on the fireplace rectangle. The `inside-*`
  rectangles are chained from the door-open fireplace rectangle with a scale + offset fit to SIFT
  matches between each pair of neighbors (OpenCV, RANSAC inliers, about 2px median error).
- `walk-depth.bin`: 1/depth on a mesh grid for every walk image, from `walk_depth.py` (Depth
  Anything V2 Base, ONNX; see its docstring). Re-run it whenever a walk image or anchor changes,
  and paste the printed index into `DEPTH` in `js/engines.js`.
- The exposure grade (`CORR`, `NATIVE` in `js/engines.js`) comes from `walk_grade.py`; re-run it
  when a walk image changes.
- `walk_perf.py` measures the walk: frame pacing (also at 4x CPU throttle), audio sync, and a
  30fps scrub for pops and stray blends.

The source renders (PNG, ~1.5 MB each) are not in the repo. If you regenerate an image,
keep the framing, dusk lighting and camera height consistent, and re-measure its anchor
rectangle.

## Logo

`logo-dark.png` is made from `logo.png`: the emblem sits on a cream disc and the wordmark is
recolored light, for dark mode.
