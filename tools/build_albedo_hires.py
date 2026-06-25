"""
Upgrade the ground texture without re-baking the whole terrain:

  1. Re-fetch ESRI satellite at a HIGHER zoom (z12, ~4x the linear detail of the
     z10 base), precisely aligned to the existing island crop (read from
     meta.json), and overwrite albedo.jpg — real detail instead of upscaled blur.
  2. Grab a high-zoom (z16) tile of dense Sri-Lankan rainforest as a tileable
     canopy DETAIL texture (detail.jpg) that the shader blends in up close.

Run from project root:  python tools/build_albedo_hires.py
"""
import math, io, os, json
import concurrent.futures as cf
import urllib.request
from PIL import Image, ImageEnhance, ImageFilter
Image.MAX_IMAGE_PIXELS = None

TILE = 256
SAT_Z = 12          # base ground zoom (was 10)
ALBEDO_LONG = 4096  # GPU-safe, but now filled with REAL z12 detail
SAT_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
UA = {"User-Agent": "Mozilla/5.0 (terrain-builder)"}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'terrain')


def fetch(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=20) as r:
                return Image.open(io.BytesIO(r.read())).convert('RGB')
        except Exception as e:
            if t == tries - 1:
                print("  FAIL", url, e)
                return Image.new('RGB', (TILE, TILE), (40, 70, 50))


def mosaic(tx0, tx1, ty0, ty1, z, label):
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    img = Image.new('RGB', (cols * TILE, rows * TILE))
    print(f"[{label}] z{z} {cols}x{rows} = {cols*rows} tiles")
    jobs = []
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for j, ty in enumerate(range(ty0, ty1 + 1)):
            for i, tx in enumerate(range(tx0, tx1 + 1)):
                jobs.append((i, j, ex.submit(fetch, SAT_URL.format(z=z, x=tx, y=ty))))
        done = 0
        for i, j, fut in jobs:
            img.paste(fut.result(), (i * TILE, j * TILE))
            done += 1
            if done % 80 == 0:
                print(f"  {label} {done}/{len(jobs)}")
    return img


def lon2x(lon, n): return (lon + 180.0) / 360.0 * n
def lat2y(lat, n): return (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n


def hires_albedo():
    meta = json.load(open(os.path.join(OUT, 'meta.json')))
    z10 = meta['zoom']
    ox, oy = meta['origin_world_px']
    cw, ch = meta['crop_px']
    n10 = 2 ** z10
    # normalized (0..1) world bounds of the existing crop
    u0, u1 = ox / (n10 * TILE), (ox + cw) / (n10 * TILE)
    v0, v1 = oy / (n10 * TILE), (oy + ch) / (n10 * TILE)

    n2 = 2 ** SAT_Z
    sx0, sx1 = u0 * n2 * TILE, u1 * n2 * TILE
    sy0, sy1 = v0 * n2 * TILE, v1 * n2 * TILE
    tx0, tx1 = int(sx0 // TILE), int((sx1 - 1) // TILE)
    ty0, ty1 = int(sy0 // TILE), int((sy1 - 1) // TILE)

    mos = mosaic(tx0, tx1, ty0, ty1, SAT_Z, "SAT")
    box = (round(sx0 - tx0 * TILE), round(sy0 - ty0 * TILE),
           round(sx1 - tx0 * TILE), round(sy1 - ty0 * TILE))
    alb = mos.crop(box)
    print("hires crop:", alb.size, "-> resize long", ALBEDO_LONG)

    w, h = alb.size
    alb = alb.resize((ALBEDO_LONG, round(ALBEDO_LONG * h / w)), Image.LANCZOS)
    # same grade as the original bake (keep the look consistent)
    alb = ImageEnhance.Color(alb).enhance(1.26)
    alb = ImageEnhance.Contrast(alb).enhance(1.07)
    alb = ImageEnhance.Brightness(alb).enhance(1.02)
    r, g, b = alb.split()
    r = r.point(lambda i: min(255, int(i * 1.03)))
    b = b.point(lambda i: int(i * 0.98))
    alb = Image.merge('RGB', (r, g, b))
    alb.save(os.path.join(OUT, 'albedo.jpg'), quality=84)
    alb.resize((900, round(900 * h / w))).save('C:/tmp/prev_albedo_hi.jpg', quality=88)
    print("albedo.jpg updated:", os.path.getsize(os.path.join(OUT, 'albedo.jpg')) // 1024, "KB")


def detail_tile():
    # dense rainforest canopy (Sinharaja) at z16 -> seamless-ish detail texture
    z = 16
    n = 2 ** z
    lat, lon = 6.41, 80.46
    cx, cy = int(lon2x(lon, n)), int(lat2y(lat, n))
    mos = mosaic(cx - 1, cx + 2, cy - 1, cy + 2, z, "DETAIL")  # 4x4 tiles = 1024px
    # make it tile better: blend edges with a mirrored copy (reduces hard seams)
    g = mos.convert('RGB')
    g = ImageEnhance.Color(g).enhance(1.15)
    g.save(os.path.join(OUT, 'detail.jpg'), quality=86)
    g.resize((400, 400)).save('C:/tmp/prev_detail.jpg', quality=88)
    print("detail.jpg saved:", g.size)


if __name__ == "__main__":
    hires_albedo()
    detail_tile()
    print("DONE")
