"""
Build stylised-realistic Sri Lanka terrain assets for the Three.js map.

Pipeline:
  1. Fetch real elevation (Terrarium DEM) + satellite (ESRI World Imagery) tiles
     over a Sri Lanka bounding box, at the same zoom so they align perfectly.
  2. Decode elevation; the island shape falls out of "elevation > sea level".
  3. Crop tightly to the island, then bake:
        albedo.jpg   - graded/stylised satellite surface
        height.png   - 24-bit RGB-encoded elevation for precise displacement
        normal.png   - tangent-space normal map from the DEM (fine relief)
        mask.png     - land/coast alpha (soft coastline)
        meta.json    - geo<->pixel mapping + the 8 destinations' UV positions
Outputs to ../public/terrain/.
"""
import math, io, os, json, sys
import concurrent.futures as cf
import urllib.request
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

Image.MAX_IMAGE_PIXELS = None

Z = 10
# generous Sri Lanka bbox (incl. a little ocean margin)
LAT_MIN, LAT_MAX = 5.70, 10.02
LON_MIN, LON_MAX = 79.40, 82.05
N = 2 ** Z
TILE = 256

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'terrain')
os.makedirs(OUT, exist_ok=True)

DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
SAT_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

UA = {"User-Agent": "Mozilla/5.0 (terrain-builder)"}

# Classic 8 destinations (lat, lon)
DESTS = {
    "anuradhapura": (8.3114, 80.4037),
    "sigiriya":     (7.9570, 80.7603),
    "kandy":        (7.2906, 80.6337),
    "nuwaraeliya":  (6.9497, 80.7891),
    "ella":         (6.8750, 81.0467),
    "yala":         (6.3720, 81.5160),
    "galle":        (6.0535, 80.2210),
    "mirissa":      (5.9483, 80.4589),
}


def lon2x(lon): return (lon + 180.0) / 360.0 * N
def lat2y(lat):
    r = math.radians(lat)
    return (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * N


def fetch(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=20) as r:
                return Image.open(io.BytesIO(r.read())).convert('RGB')
        except Exception as e:
            if t == tries - 1:
                print("  FAIL", url, e)
                return Image.new('RGB', (TILE, TILE), (0, 0, 0))


def tile_range():
    x0, x1 = lon2x(LON_MIN), lon2x(LON_MAX)
    y0, y1 = lat2y(LAT_MAX), lat2y(LAT_MIN)  # lat max -> smaller y
    return (int(math.floor(x0)), int(math.floor(x1)),
            int(math.floor(y0)), int(math.floor(y1)))


def mosaic(url_tmpl, tx0, tx1, ty0, ty1, label):
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    img = Image.new('RGB', (cols * TILE, rows * TILE))
    jobs = []
    print(f"[{label}] {cols}x{rows} = {cols*rows} tiles")
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for j, ty in enumerate(range(ty0, ty1 + 1)):
            for i, tx in enumerate(range(tx0, tx1 + 1)):
                url = url_tmpl.format(z=Z, x=tx, y=ty)
                jobs.append((i, j, ex.submit(fetch, url)))
        done = 0
        for i, j, fut in jobs:
            img.paste(fut.result(), (i * TILE, j * TILE))
            done += 1
            if done % 30 == 0:
                print(f"  {label} {done}/{len(jobs)}")
    return img


def box_blur(a, r):
    """Cheap separable box blur on a float array (no scipy dependency)."""
    if r < 1:
        return a
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0)), mode='edge'), axis=0)
    a = (c[k:, :] - c[:-k, :]) / k
    c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r)), mode='edge'), axis=1)
    a = (c[:, k:] - c[:, :-k]) / k
    return a


def main():
    tx0, tx1, ty0, ty1 = tile_range()
    print("tiles x", tx0, tx1, "y", ty0, ty1)

    dem = np.asarray(mosaic(DEM_URL, tx0, tx1, ty0, ty1, "DEM")).astype(np.float64)
    sat = mosaic(SAT_URL, tx0, tx1, ty0, ty1, "SAT")

    # decode terrarium elevation (metres)
    elev = (dem[:, :, 0] * 256.0 + dem[:, :, 1] + dem[:, :, 2] / 256.0) - 32768.0
    H, W = elev.shape
    print("mosaic px", W, "x", H, "elev range", round(elev.min()), round(elev.max()))

    # land mask from sea level; light blur to despeckle coastline
    landf = box_blur((elev > 0.6).astype(np.float64), 1)
    land = landf > 0.5

    # crop to island + margin
    ys, xs = np.where(land)
    pad = 48
    ry0, ry1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
    rx0, rx1 = max(0, xs.min() - pad), min(W, xs.max() + pad)
    elev = elev[ry0:ry1, rx0:rx1]
    land = land[ry0:ry1, rx0:rx1]
    sat = sat.crop((rx0, ry0, rx1, ry1))
    ch, cw = elev.shape
    print("crop px", cw, "x", ch)

    # world-pixel origin of the crop (for geo mapping)
    ox = tx0 * TILE + rx0
    oy = ty0 * TILE + ry0

    def lonlat_to_uv(lon, lat):
        px = lon2x(lon) * TILE - ox
        py = lat2y(lat) * TILE - oy
        return px / cw, py / ch

    # ---- elevation -> smoothed, sea-clamped, normalised ----
    e = np.maximum(elev, 0.0)
    e = box_blur(e, 2)                      # de-noise for smooth slopes
    e *= land                              # zero out ocean
    maxE = float(e.max())
    norm = np.clip(e / maxE, 0, 1)

    # ---- height.png : 24-bit RGB encoding (resize NORM first, then encode) ----
    hsize = (1024, int(1024 * ch / cw))
    nimg = Image.fromarray((norm * 255).astype(np.uint8)).resize(hsize, Image.BILINEAR)
    nrm = np.asarray(nimg).astype(np.float64) / 255.0
    v = np.clip(np.round(nrm * 16777215), 0, 16777215).astype(np.uint32)
    rgb = np.stack([(v >> 16) & 255, (v >> 8) & 255, v & 255], -1).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(os.path.join(OUT, 'height.png'))

    # ---- normal.png from DEM gradients ----
    midlat = (LAT_MIN + LAT_MAX) / 2
    mpp = 156543.03 * math.cos(math.radians(midlat)) / N   # metres per source px
    EXAG = 1.8
    gy, gx = np.gradient(box_blur(e, 1))
    nx = -gx / mpp * EXAG
    ny = -gy / mpp * EXAG
    nz = np.ones_like(nx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nmap = np.stack([(nx / ln * 0.5 + 0.5),
                     (-ny / ln * 0.5 + 0.5),   # GL convention (Y up)
                     (nz / ln * 0.5 + 0.5)], -1)
    nimg = Image.fromarray((nmap * 255).astype(np.uint8), 'RGB')
    nimg = nimg.resize((2048, int(2048 * ch / cw)), Image.BILINEAR)
    nimg.save(os.path.join(OUT, 'normal.png'))

    # ---- mask.png : soft land/coast alpha ----
    m = Image.fromarray((land * 255).astype(np.uint8), 'L')
    m = m.resize((2048, int(2048 * ch / cw)), Image.BILINEAR).filter(ImageFilter.GaussianBlur(2.2))
    m.save(os.path.join(OUT, 'mask.png'))

    # ---- albedo.jpg : graded / stylised satellite ----
    alb = sat
    long_side = 4096
    alb = alb.resize((long_side, int(long_side * ch / cw)), Image.LANCZOS)
    alb = ImageEnhance.Color(alb).enhance(1.28)      # richer tropical greens
    alb = ImageEnhance.Contrast(alb).enhance(1.06)
    alb = ImageEnhance.Brightness(alb).enhance(1.03)
    # subtle warm golden lift
    r, g, b = alb.split()
    r = r.point(lambda i: min(255, int(i * 1.03)))
    b = b.point(lambda i: int(i * 0.98))
    alb = Image.merge('RGB', (r, g, b))
    alb.save(os.path.join(OUT, 'albedo.jpg'), quality=86)

    # ---- meta.json ----
    dest_uv = {k: dict(zip(("u", "v"), lonlat_to_uv(lon, lat)))
               for k, (lat, lon) in DESTS.items()}
    meta = {
        "zoom": Z, "tile": TILE,
        "crop_px": [cw, ch],
        "origin_world_px": [ox, oy],
        "bbox_uv_geo": {"lon0": (ox) / (N * TILE) * 360 - 180},
        "max_elev_m": maxE,
        "metres_per_px": mpp,
        "aspect": cw / ch,
        "vertical_exaggeration_hint": 2.4,
        "destinations": dest_uv,
    }
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=2)

    # small previews for inspection
    Image.fromarray((norm * 255).astype(np.uint8)).resize((512, int(512 * ch / cw))).save('C:/tmp/prev_height.png')
    alb.resize((900, int(900 * ch / cw))).save('C:/tmp/prev_albedo.jpg', quality=85)
    m.resize((512, int(512 * ch / cw))).save('C:/tmp/prev_mask.png')

    print("DONE. aspect(w/h)=%.3f maxElev=%.0fm crop=%dx%d" % (cw / ch, maxE, cw, ch))
    print("dest UVs:", {k: (round(v['u'], 3), round(v['v'], 3)) for k, v in dest_uv.items()})


if __name__ == "__main__":
    main()
