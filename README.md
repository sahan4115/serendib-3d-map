# Serendib — an interactive 3D map of Sri Lanka

An awwwards-style **Three.js / WebGL** experience: drift over a realistic 3D
island of Sri Lanka, then click any of eight iconic destinations to fly the
camera in and open a detail panel. Inspired by the explore.ownprimland.com
"explore the map" interaction.

> Built as a self-contained component you can drop into a site. `npm run dev` → http://localhost:5193

## The experience

1. **Loader → cinematic hero** over the clouded island.
2. **Explore** — the clouds part and the camera settles into a near top-down
   view. **Drag to drift** across the island; scroll to zoom.
3. **Markers** sit at each destination's real geographic position. Click one (or
   use the bottom *Explore Sri Lanka* menu) and the camera **flies in, tilting
   from top-down into a dramatic 3D angle**.
4. A **right-side drawer** slides in with the destination's photo, category,
   story and a CTA — step ← → through all eight, or close to return to the island.
5. **Day / night** toggle relights the whole scene; a compass tracks heading.

The eight destinations: **Anuradhapura, Sigiriya, Kandy, Nuwara Eliya, Ella,
Yala, Galle, Mirissa** — spanning Cultural Triangle / Hill Country / Wildlife /
Southern Coast.

## How the island is made (the interesting part)

The terrain is **stylised but built from real data**, baked offline by
[`tools/build_terrain.py`](tools/build_terrain.py):

1. Fetch real **elevation** (AWS Terrarium DEM) + **satellite** (ESRI World
   Imagery) tiles over Sri Lanka's bounding box, at the same zoom so they align.
2. The island shape falls straight out of *"elevation > sea level"* — so the
   coastline, the Jaffna peninsula and Adam's Bridge are all genuine.
3. Bake four maps the runtime loads from `public/terrain/`:
   - `albedo.jpg` — the satellite imagery, colour-graded to a richer tropical look
   - `height.png` — elevation encoded for GPU displacement
   - `normal.png` — DEM-derived normals for crisp relief lighting
   - `mask.png` — land/coast alpha that clips the mesh to the shore
   - `meta.json` — geo↔pixel mapping **and each destination's map position,
     computed from its real latitude/longitude** (so every marker lands correctly).

At runtime a high-res plane is displaced on the GPU from the heightmap, surfaced
with the albedo + normal map, clipped by the mask, and dropped into a custom
animated-water shader with fresnel sky-reflection and a moving sun glint.

Max elevation comes out at ~2,468 m — Sri Lanka's real central massif.

## Run

```bash
npm install
npm run dev        # http://localhost:5193
npm run build      # production build -> dist/

# regenerate terrain assets (needs Python + pillow/numpy; downloads map tiles):
python tools/build_terrain.py
```

## Architecture

```
src/
  Experience.js      # renderer, scene, loop, phase orchestration (event bus)
  CameraRig.js       # spherical target-orbit: drag-pan overview + GSAP fly-to
  Markers.js         # HTML markers projected from 3D each frame
  UI.js              # loader, hero, header, drawer, menu, compass, day/night
  state.js           # tiny shared state + pub/sub
  config.js          # world constants (size, vertical exaggeration)
  World/
    Terrain.js       # displaced island mesh + CPU getHeightAt() for markers
    Ocean.js         # custom water shader (fresnel + glint + horizon fade)
    Clouds.js        # drifting fbm cloud layer that "parts" on enter
    Environment.js   # sky gradient, sun, hemisphere light, fog, day/night
  data/destinations.js
tools/build_terrain.py
public/terrain/      # baked maps + meta.json
public/destinations/ # the 8 destination photos
```

Runs at ~120 fps with **4 draw calls** (terrain, ocean, clouds, sky).

## Notes / attribution

- **Elevation**: AWS Terrain Tiles (Terrarium) — open data.
- **Satellite imagery**: Esri World Imagery — © Esri and its data providers;
  used here for a demo and colour-graded. Add the required attribution before any
  public/production use.
- **Destination photos**: Wikimedia Commons (self-hosted in `public/destinations`).
- **Fonts**: Fraunces (serif) + Inter (sans), Google Fonts.
- Destination copy is original editorial written to match the brand voice.

### Possible next optimisations
- Convert `normal.png` / `albedo.jpg` to KTX2/WebP to cut the ~5 MB initial load.
- Re-bake `height.png` as 16-bit for perfectly smooth high peaks.
