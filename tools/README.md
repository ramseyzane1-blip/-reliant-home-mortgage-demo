# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it).

## How the 3D images were prepared

All images in `demo/site/images/` are AI-generated renders of a fictional house supplied by
the client. They are used **only** in the two 3D pieces (the hero turntable and the
walk-through). Don't use them anywhere else on the site.

- `house-NN.webp` (12 views) and `house-flow.bin`: built by `python3 tools/house_views.py`
  from the renders in `tools/house-src/` (1100×1100 JPEG, ordered by camera angle; the angles
  are in `HOUSE_VIEWS` in `js/app.js`, 0° front, 90° right side, 180° back, 270° left side).
  The script cuts each view out of its cream background (keeping the plinth and ring, dropping
  floor shadows) and computes optical flow between neighboring views for the morph. The
  original set had a duplicate render at 318°/327°; it was dropped.
- `approach-1…4.jpg`, `door.jpg`: the walk up to the front door. Each has a door rectangle
  (in image pixels) in `Walk.SHOTS` in `js/engines.js`, found by detecting the dark green
  door slab.
- `door-open.jpg`: the same door open, with the doorway and fireplace rectangles.
- `inside-1…4.jpg`, `look-left.jpg`, `look-right.jpg`: the walk inside, anchored on the
  fireplace rectangle.

The source renders (PNG, ~1.5 MB each) are not in the repo. If you regenerate an image,
keep the framing, dusk lighting and camera height consistent, and re-measure its anchor
rectangle.
