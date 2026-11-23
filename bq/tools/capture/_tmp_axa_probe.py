import json
from pathlib import Path

base = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\www-axa-be--nl-particulieren")

ds = json.loads((base / "detected-sections.json").read_text(encoding="utf-8"))
print("=== detected-sections.json ===")
print("image", ds.get("image"))
print("css", ds.get("css"))
print("mapping", ds.get("mapping"))
print("section count", len(ds.get("sections", [])))
for s in ds.get("sections", []):
    h = (s.get("y1", 0) - s.get("y0", 0))
    print(
        f"  #{s.get('index')} {s.get('cmsName')} track={s.get('track')} "
        f"y={s.get('y0')}-{s.get('y1')} h={h} sel={(s.get('selector') or '')[:70]}"
    )

print("\n=== section folders ===")
sec = base / "sections"
for d in sorted(sec.iterdir()):
    if not d.is_dir() or not d.name.startswith("section-"):
        continue
    files = sorted(p.name for p in d.iterdir() if p.is_file())
    info = d / "section-information.json"
    html = d / "section.html"
    html_len = html.stat().st_size if html.exists() else -1
    meta = json.loads(info.read_text(encoding="utf-8")) if info.exists() else {}
    errs = meta.get("errors") or []
    outs = meta.get("outputs") or {}
    missing = []
    for k, v in outs.items():
        if isinstance(v, dict) and v.get("path"):
            p2 = base / v["path"].replace("\\", "/")
            local = d / Path(v["path"]).name
            if not p2.exists() and not local.exists():
                missing.append(k)
        elif v is None:
            missing.append(f"{k}(null)")
    print(
        f"{d.name}: cms={meta.get('cmsName')} track={meta.get('track')} "
        f"hash={str(meta.get('contentHash', ''))[:12]} htmlBytes={html_len} "
        f"files={files} missingOut={missing} errors={errs} reused={meta.get('reused')}"
    )

# y gaps in content bands
print("\n=== y gaps (content tracks) ===")
content = [s for s in ds.get("sections", []) if s.get("track") != "overlay"]
content = sorted(content, key=lambda s: s.get("y0", 0))
for a, b in zip(content, content[1:]):
    gap = b["y0"] - a["y1"]
    if abs(gap) > 5:
        print(
            f"  gap {gap}px between #{a.get('index')} {a.get('cmsName')} "
            f"(y1={a.get('y1')}) and #{b.get('index')} {b.get('cmsName')} (y0={b.get('y0')})"
        )

# compare renault section file completeness
rbase = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\nl-renault-be\nl-renault-be--home")
print("\n=== renault section folders (sample) ===")
rsec = rbase / "sections"
if rsec.exists():
    for d in sorted(rsec.iterdir()):
        if not d.is_dir() or not d.name.startswith("section-"):
            continue
        files = sorted(p.name for p in d.iterdir() if p.is_file())
        info = d / "section-information.json"
        meta = json.loads(info.read_text(encoding="utf-8")) if info.exists() else {}
        html = d / "section.html"
        html_len = html.stat().st_size if html.exists() else -1
        print(
            f"{d.name}: cms={meta.get('cmsName')} track={meta.get('track')} "
            f"htmlBytes={html_len} nFiles={len(files)} errors={meta.get('errors')}"
        )

# log tail
log = Path(r"c:\Projects\SE12\se12-jbe-showcase\.bq\captures\www-axa-be\capture.log")
if log.exists():
    text = log.read_text(encoding="utf-8", errors="replace")
    print("\n=== capture.log (relevant lines) ===")
    keys = (
        "section",
        "hybrid",
        "overlay",
        "cookie",
        "consent",
        "warn",
        "error",
        "fail",
        "detect",
        "Trust",
        "tc-privacy",
        "particulieren",
        "reuse",
        "Export",
    )
    for line in text.splitlines():
        low = line.lower()
        if any(k.lower() in low for k in keys):
            print(line[:240])
else:
    print("no capture.log")
