import json
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    Image = None

base = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\www-axa-be--nl-particulieren")
hs = json.loads((base / "screenshots" / "hybrid-summary.json").read_text(encoding="utf-8"))

print("=== hybrid kept (with heights) ===")
prev = None
for s in hs["kept"]:
    o = s.get("opencv") or {}
    h = o.get("height") or ((o.get("y1") or 0) - (o.get("y0") or 0))
    print(f"  {s['cmsName']:16} track={s['track']:8} y={o.get('y0')}-{o.get('y1')} h={h:4} sel={s['selector']}")
    if prev:
        gap = (o.get("y0") or 0) - (prev.get("y1") or 0)
        if abs(gap) > 8:
            print(f"    ^^ gap/overlap vs prev: {gap}px")
    prev = o

print("\n=== overlays ===")
for o in hs.get("overlays", []):
    h = (o.get("cssBottom") or 0) - (o.get("cssTop") or 0)
    print(f"  {o['cmsName']:16} h={h:4} top={o.get('cssTop')} sel={o['selector']}")

print("\n=== PNG sizes ===")
for d in sorted((base / "sections").iterdir()):
    if not d.is_dir() or not d.name.startswith("section-"):
        continue
    info = json.loads((d / "section-information.json").read_text(encoding="utf-8"))
    rect = info.get("rect") or {}
    rh = (rect.get("y1") or 0) - (rect.get("y0") or 0)
    pngs = list(d.glob("*.png"))
    sizes = []
    for p in pngs:
        if Image:
            im = Image.open(p)
            sizes.append(f"{p.name}:{im.size[0]}x{im.size[1]}")
        else:
            sizes.append(f"{p.name}:{p.stat().st_size}b")
    print(f"{d.name} cms={info.get('cmsName')} rectH={rh} track={info.get('track')} | {', '.join(sizes)}")

# detected-sections.json keys for first section
ds = json.loads((base / "detected-sections.json").read_text(encoding="utf-8"))
print("\n=== detected-sections.json sample keys ===")
print(list(ds.keys()))
s0 = ds["sections"][0]
print("section0 keys:", sorted(s0.keys()))
print("section0:", {k: s0.get(k) for k in sorted(s0.keys()) if k in ("index","cmsName","track","selector","x0","y0","x1","y1","rect","heading","folderName")})
# find any with y0
with_y = [s for s in ds["sections"] if "y0" in s or (s.get("rect") or {}).get("y0") is not None]
print("sections with y0 field:", len(with_y), "of", len(ds["sections"]))

# renault hybrid gaps
rbase = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\nl-renault-be\nl-renault-be--home")
rhs = json.loads((rbase / "screenshots" / "hybrid-summary.json").read_text(encoding="utf-8"))
print("\n=== renault hybrid kept heights ===")
prev = None
for s in rhs["kept"]:
    o = s.get("opencv") or {}
    h = o.get("height")
    print(f"  {s['cmsName']:16} track={s['track']:8} h={h:4} sel={s['selector'][:50]}")
    if prev:
        gap = (o.get("y0") or 0) - (prev.get("y1") or 0)
        if abs(gap) > 8:
            print(f"    ^^ gap/overlap: {gap}px")
    prev = o

# capture log
log = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\capture.log")
if log.exists():
    text = log.read_text(encoding="utf-8", errors="replace")
    print("\n=== capture.log last 120 lines ===")
    lines = text.splitlines()
    for line in lines[-120:]:
        print(line[:220])
