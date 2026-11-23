import struct, json
from pathlib import Path

def png_size(p):
    with open(p, "rb") as f:
        sig = f.read(8)
        if sig[:4] != b"\x89PNG":
            return None
        f.read(4)  # len
        f.read(4)  # IHDR
        w, h = struct.unpack(">II", f.read(8))
        return w, h

base = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\www-axa-be--nl-particulieren")
print("=== AXA PNG dimensions ===")
for d in sorted((base / "sections").iterdir()):
    if not d.is_dir() or not d.name.startswith("section-"):
        continue
    info = json.loads((d / "section-information.json").read_text(encoding="utf-8"))
    dims = []
    for p in sorted(d.glob("*.png")):
        dims.append(f"{p.name}={png_size(p)}")
    print(f"{d.name} {info.get('cmsName')}: {', '.join(dims)}")

# full page shots
print("\n=== full page ===")
for name in ["desktop.png", "desktop-clean.png", "tablet.png", "tablet-clean.png", "mobile.png", "mobile-clean.png"]:
    p = base / "screenshots" / name
    if p.exists():
        print(f"  {name}: {png_size(p)}")

# log ascii-safe
log = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\capture.log")
text = log.read_text(encoding="utf-8", errors="replace")
print("\n=== capture.log filtered ===")
for line in text.splitlines():
    low = line.lower()
    if any(k in low for k in ("consent", "cookie", "hybrid", "section", "overlay", "warn", "error", "fail", "detect", "export", "reuse", "accept")):
        print(line.encode("ascii", "replace").decode("ascii")[:240])

# check if topbar selector is ambiguous
html = (base / "html")
candidates = list(html.glob("*.html")) if html.exists() else []
print("\nhtml files", [c.name for c in candidates[:5]])
# peek page.html for main-content / footer / topbar structure
for name in ["page.html", "rendered.html", "document.html"]:
    p = base / "html" / name
    if not p.exists():
        p = base / name
    if p.exists():
        raw = p.read_text(encoding="utf-8", errors="replace")
        print(f"\n=== structure peek from {p.name} ({len(raw)} bytes) ===")
        for needle in ["main-content", "class=\"head", "topbar", "tc-privacy", "brocom", "<footer", "id=\"main"]:
            print(f"  count({needle})={raw.lower().count(needle.lower())}")
        break

# renault section-01 for comparison
rbase = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\nl-renault-be\nl-renault-be--home")
print("\n=== Renault section PNG dims (first 5) ===")
for d in sorted((rbase / "sections").iterdir())[:6]:
    if not d.is_dir():
        continue
    info_p = d / "section-information.json"
    cms = "?"
    if info_p.exists():
        cms = json.loads(info_p.read_text(encoding="utf-8")).get("cmsName")
    dims = [f"{p.name}={png_size(p)}" for p in sorted(d.glob("*.png"))[:3]]
    print(f"{d.name} {cms}: {dims}")
