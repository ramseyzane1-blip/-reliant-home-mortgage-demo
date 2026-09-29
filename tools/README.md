# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it).
- `site_audit.js`: measures any site page by page in a real browser (weight, requests, SEO basics,
  axe-core WCAG checks, phone-width checks, screenshots). Used for the audit in `audit/`.
- `export_pdfs.js`: exports the audit deck and report to PDF.

## How the 3D images were prepared

All images in `demo/site/images/` are AI-generated renders of a fictional house supplied by
the client. They are used **only** in the two 3D pieces (the hero turntable and the
walk-through). Don't use them anywhere else on the site.

- `house-00.jpg` … `house-12.jpg`: 13 views of the model home on its plinth, 1100×1100,
  ordered by camera angle. The angles are in `HOUSE_VIEWS` in `js/app.js`
  (0° front, 90° right side, 180° back, 270° left side).
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
