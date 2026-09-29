# Tools

- `smoke_test.py`: end-to-end browser test (see the docstring for how to run it). Use
  `pip install playwright==1.56.0`, which matches the pre-installed Chromium (chromium-1194).
- `blender/house_scene.py`: the 3D model of the house behind the hero turntable, built in code
  and rendered with Blender's Cycles (`pip install bpy`). `blender/fetch_assets.py` downloads the
  CC0 Poly Haven assets it uses into `blender/assets/` (not committed).
- `blender/web_model.py`: the web version of the model for the live 3D hero, with Blender's
  lighting baked into its textures; `pack_web_model.py` compresses it into `demo/site/images/model/`.
- `house_views.py`: converts rendered frames into a picture turntable (the earlier hero; unused now).
- `site_audit.js`: measures any site page by page in a real browser (weight, requests, SEO basics,
  axe-core WCAG checks, phone-width checks, screenshots). Used for the audit in `audit/`.
- `export_pdfs.js`: exports the audit deck and report to PDF.

## Regenerating the hero's 3D model

```bash
python3 tools/blender/fetch_assets.py                                  # once
python3 tools/blender/house_scene.py angles 640 /tmp/p 48 0 90 180 270  # test views (~1 min each)
python3 tools/blender/web_model.py /tmp/web 2048 32                    # bake the web model (~20 min, 4 cores; pip install OpenEXR)
HOUSE_ONLY=1 python3 tools/blender/web_model.py /tmp/web 2048 16       # just the house, ~1 min, for checking
python3 tools/pack_web_model.py /tmp/web                               # compress into demo/site/images/model/ (node + playwright)
```

`web_model.py` builds the scene with `house_scene.py` and writes: `house.glb` + `house.png` (the
house, patio set, simplified trunks and crown cores joined, smart-UV unwrapped, Cycles COMBINED bake
into one atlas, saved through the scene's view transform so the colors match the renders),
`ground.png` (the lawn disc baked top-down: blade green x the light on the lawn where grass grows,
the ground as rendered elsewhere; alpha = where grass grows), `cards.glb` + `twigs.png` (every
leafy twig as a card with a photo of the twig; light baked per card corner into 4x4 px cells of a
lighting image, then written as vertex colors), `ring.glb` + `ring.png`, `panes.glb`. Things it
works around in Blender 5.0: `view_layer.objects` misses some objects (it uses `scene.objects`);
a lighting-only DIFFUSE bake right after another bake crashes (the lawn's light is a COMBINED bake
of the disc painted white); a transparent point bakes no light (the cards are solid for their own
light bake, see-through for shadows); faces pointing inward bake black (normals are recalculated).
`pack_web_model.py` compresses the glbs with Meshopt (16-bit positions, 14-bit UVs), converts the
textures to WebP, photographs the live model's front view on the page for `still.webp`, and
stamps a `?v=` content version in `index.html` and `js/app.js` (`MODEL_V`).

## How the 3D images were prepared

The client supplied AI-generated renders of a fictional house; the hero is a 3D model of that
house (above; a close match, not exact). The renders themselves are no longer on the site.

- `model/`: the hero's live 3D model, made from the 3D model in `tools/blender/house_scene.py`
  (Blender, Cycles lighting baked in) by `tools/blender/web_model.py` and
  `tools/pack_web_model.py`. The model uses CC0 assets from Poly Haven (a scanned tree, scanned
  siding, roof, stone and grass textures, a patio set); `tools/blender/fetch_assets.py`
  downloads them into `tools/blender/assets/`, which is not committed.
- The door walk-through after the pre-qualification (`door.jpg`, `inside-2.jpg`, `Walk` in
  `js/engines.js`, `walk_checks.py`) was removed; it is in git history.

## Logo

`tools/make_logo.py` makes `logo.webp` and `logo-dark.webp` from the client's logo
(`tools/brand/logo-source.webp`, transparent background): cropped and sized for the 44px header
at 3x. The dark copy keeps the emblem as is and recolors the wordmark light.
It also makes the icons from the duck and swoosh alone (`brand/favicon-32.png` and
`favicon-192.png`, transparent; `apple-touch-icon.png` on white) and puts the dark-mode logo on
the link preview `brand/share.png`. Re-running it is safe.
