#!/usr/bin/env python3
"""Trim leading/trailing foreign edge strips from a section PNG (generic)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def row_mean(img: np.ndarray, y: int) -> np.ndarray:
    return img[y].mean(axis=0).astype(np.float64)


def row_uniformity(img: np.ndarray, y: int) -> float:
    row = img[y].astype(np.float64)
    return float(row.std())


def color_dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def trim_edges(img: np.ndarray, *, chrome: bool) -> tuple[np.ndarray, dict]:
    h, w = img.shape[:2]
    if h < 24 or w < 24:
        return img, {"trimmedTop": 0, "trimmedBottom": 0}

    # Interior reference: median of means for rows in [8, min(24, h//4)]
    y0 = 8
    y1 = max(y0 + 1, min(24, max(9, h // 4)))
    interior = np.median(np.stack([row_mean(img, y) for y in range(y0, y1)], axis=0), axis=0)

    top_trim = 0
    max_top = min(28, h // 5)
    for y in range(max_top):
        m = row_mean(img, y)
        uni = row_uniformity(img, y)
        dist = color_dist(m, interior)
        # Nearly uniform row that differs strongly from interior → previous-section bleed
        if uni < 18.0 and dist > 28.0:
            top_trim = y + 1
            continue
        break

    bottom_trim = 0
    if chrome:
        # Chrome fill reference: top third after top_trim
        chrome_y0 = top_trim
        chrome_y1 = min(h, top_trim + max(12, (h - top_trim) // 3))
        if chrome_y1 > chrome_y0 + 2:
            chrome_ref = np.median(
                np.stack([row_mean(img, y) for y in range(chrome_y0, chrome_y1)], axis=0),
                axis=0,
            )
            max_bot = min(40, (h - top_trim) // 3)
            for i in range(max_bot):
                y = h - 1 - i
                if y <= chrome_y1:
                    break
                m = row_mean(img, y)
                uni = row_uniformity(img, y)
                dist_chrome = color_dist(m, chrome_ref)
                # Trailing rows that look unlike chrome fill (page behind)
                if uni < 22.0 and dist_chrome > 22.0:
                    bottom_trim = i + 1
                    continue
                break

    y_start = top_trim
    y_end = h - bottom_trim
    if y_end - y_start < 16:
        return img, {"trimmedTop": 0, "trimmedBottom": 0}
    out = img[y_start:y_end, :]
    return out, {"trimmedTop": top_trim, "trimmedBottom": bottom_trim}


def main() -> int:
    parser = argparse.ArgumentParser(description="Trim foreign edges from section PNG.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--chrome", action="store_true")
    args = parser.parse_args()

    image = cv2.imread(str(args.input))
    if image is None:
        print(json.dumps({"error": f"Could not read {args.input}"}), file=sys.stderr)
        return 1

    trimmed, meta = trim_edges(image, chrome=bool(args.chrome))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(out), trimmed)
    if not ok:
        print(json.dumps({"error": f"Could not write {out}"}), file=sys.stderr)
        return 1
    print(json.dumps({"path": str(out.resolve()), **meta}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
