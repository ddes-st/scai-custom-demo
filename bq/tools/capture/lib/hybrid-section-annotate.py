#!/usr/bin/env python3
"""
Draw numbered rectangles for HybridSection detections on a screenshot.

Usage:
  python hybrid-section-annotate.py --input desktop.png --sections detected-sections.json --out detected-sections.png

Labels are numeric indices only (1, 2, 3…) — names live in the JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

# Distinct BGR palette — high-contrast hues so adjacent sections never look alike.
SECTION_PALETTE: list[tuple[int, int, int]] = [
    (40, 40, 255),  # red
    (40, 180, 40),  # green
    (255, 140, 0),  # blue/orange-ish (BGR: strong blue)
    (0, 200, 255),  # amber/yellow
    (255, 0, 220),  # magenta
    (0, 220, 180),  # teal/cyan
    (0, 120, 255),  # orange
    (200, 80, 255),  # pink/violet
    (80, 220, 80),  # lime
    (255, 180, 40),  # sky blue
    (40, 90, 220),  # brick
    (220, 220, 0),  # cyan
    (180, 60, 160),  # purple
    (60, 255, 160),  # spring green
    (100, 100, 255),  # light red
    (255, 100, 100),  # periwinkle
    (0, 165, 255),  # pure orange
    (255, 255, 0),  # aqua
    (128, 0, 255),  # hot pink
    (0, 255, 128),  # chartreuse-ish
]


def color_for_index(index_zero_based: int) -> tuple[int, int, int]:
    return SECTION_PALETTE[index_zero_based % len(SECTION_PALETTE)]


def draw_sections(image: np.ndarray, sections: list[dict]) -> np.ndarray:
    canvas = image.copy()
    h, w = canvas.shape[:2]
    overlay = canvas.copy()
    border = max(4, w // 400)

    for i, sec in enumerate(sections):
        x0 = int(max(0, min(w - 1, sec.get("x0", 6))))
        x1 = int(max(x0 + 1, min(w, sec.get("x1", w - 6))))
        y0 = int(max(0, min(h - 1, sec.get("y0", 0))))
        y1 = int(max(y0 + 1, min(h, sec.get("y1", y0 + 1))))
        color = color_for_index(i)
        cv2.rectangle(overlay, (x0, y0), (x1, y1), color, thickness=-1)

    cv2.addWeighted(overlay, 0.18, canvas, 0.82, 0, canvas)

    for i, sec in enumerate(sections):
        n = i + 1
        x0 = int(max(0, min(w - 1, sec.get("x0", 6))))
        x1 = int(max(x0 + 1, min(w, sec.get("x1", w - 6))))
        y0 = int(max(0, min(h - 1, sec.get("y0", 0))))
        y1 = int(max(y0 + 1, min(h, sec.get("y1", y0 + 1))))
        box_h = max(1, y1 - y0)
        box_w = max(1, x1 - x0)
        color = color_for_index(i)
        cv2.rectangle(canvas, (x0, y0), (x1, y1), color, thickness=border)

        # Full-width content bands get a left edge accent; floating overlays keep a tight box.
        if x0 <= 8 and x1 >= w - 8:
            cv2.rectangle(canvas, (0, y0), (10, y1), color, thickness=-1)

        # Number badge only (names live in detected-sections.json).
        font = cv2.FONT_HERSHEY_SIMPLEX
        compact = box_h < 72 or box_w < 120
        badge_r = max(18, w // 80)
        if compact:
            cx = max(badge_r + 6, min(x0 + badge_r + 4, w - badge_r - 6))
            cy = max(badge_r + 6, y0 - badge_r - 6) if y0 > badge_r * 2 + 8 else min(h - badge_r - 6, y1 + badge_r + 6)
        else:
            cx = max(badge_r + 6, min(x0 + badge_r + 8, w - badge_r - 6))
            cy = min(max(y0 + 12 + badge_r, badge_r + 6), h - badge_r - 6)
        cv2.circle(canvas, (cx, cy), badge_r, color, thickness=-1)
        cv2.circle(canvas, (cx, cy), badge_r, (255, 255, 255), thickness=2)
        num = str(n)
        scale = 0.75 if n < 10 else 0.6
        (nw, nh), _ = cv2.getTextSize(num, font, scale, 2)
        cv2.putText(
            canvas,
            num,
            (cx - nw // 2, cy + nh // 2),
            font,
            scale,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description="Annotate HybridSection CMS sections on a screenshot.")
    parser.add_argument("--input", required=True, help="Full-page PNG")
    parser.add_argument("--sections", required=True, help="JSON list of {label,y0,y1,track,heading}")
    parser.add_argument("--out", required=True, help="Output annotated PNG path")
    args = parser.parse_args()

    image = cv2.imread(str(args.input))
    if image is None:
        print(json.dumps({"error": f"Could not read {args.input}"}), file=sys.stderr)
        return 1

    raw = Path(args.sections).read_text(encoding="utf-8")
    payload = json.loads(raw)
    sections = payload if isinstance(payload, list) else payload.get("sections") or []

    annotated = draw_sections(image, sections)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), annotated)
    print(str(out.resolve()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
