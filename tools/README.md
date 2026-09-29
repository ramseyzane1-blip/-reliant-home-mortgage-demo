# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it).

## How the 3D images were prepared

All images in `demo/site/images/` are AI-generated renders of a fictional house supplied by
the client. They are used **only** in the two 3D pieces (the hero turntable and the
walk-through). Don't use them anywhere else on the site.

- `house-00.jpg` … `house-12.jpg`: 13 renders of the model home on its plinth, 1024×1024 so the
  turntable can mipmap them, ordered by camera angle. The angles are in `HOUSE_VIEWS` in
  `js/app.js` (0° front, 90° right side, 180° back, 270° left side). `house-10.jpg` is a
  byte-for-byte copy of `house-09.jpg`, so it isn't used as a view (it doubled the house between
  318° and 327°); `turntable_depth.py` still reads all 13 files, and each view's `d` in
  `HOUSE_VIEWS` points at its grid in `house-depth.bin`.
- `house-depth.bin`: the turntable's per-view depth relief, from `turntable_depth.py`.
- `approach-1…4.jpg`, `door.jpg`: the walk up to the front door. Each has a door rectangle
  (in image pixels) in `Walk.SHOTS` in `js/engines.js`, found by detecting the dark green
  door slab.
- `door-open.jpg`: the same door open, with the doorway and fireplace rectangles.
- `inside-1…4.jpg`: the walk inside, anchored on the fireplace rectangle. The `inside-*`
  rectangles are chained from the door-open fireplace rectangle with a scale + offset fit to SIFT
  matches between each pair of neighbors (OpenCV, RANSAC inliers, about 2px median error).
- `walk-depth.bin`: 1/depth on a mesh grid for every walk image, from `walk_depth.py` (Depth
  Anything V2 Base, ONNX; see its docstring). Re-run it whenever a walk image or anchor changes,
  and paste the printed index into `DEPTH` in `js/engines.js`.

The source renders (PNG, ~1.5 MB each) are not in the repo. If you regenerate an image,
keep the framing, dusk lighting and camera height consistent, and re-measure its anchor
rectangle.

## Logo

`logo-dark.png` is made from `logo.png`: the emblem sits on a cream disc and the wordmark is
recolored light, for dark mode.
