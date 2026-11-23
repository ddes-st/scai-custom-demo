#!/usr/bin/env python3
"""Crop a rectangular region from a full-page PNG."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2


def main() -> int:
    parser = argparse.ArgumentParser(description="Crop a PNG rectangle.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--x0", type=int, required=True)
    parser.add_argument("--y0", type=int, required=True)
    parser.add_argument("--x1", type=int, required=True)
    parser.add_argument("--y1", type=int, required=True)
    args = parser.parse_args()

    image = cv2.imread(str(args.input))
    if image is None:
        print(json.dumps({"error": f"Could not read {args.input}"}), file=sys.stderr)
        return 1

    h, w = image.shape[:2]
    x0 = max(0, min(w - 1, args.x0))
    y0 = max(0, min(h - 1, args.y0))
    x1 = max(x0 + 1, min(w, args.x1))
    y1 = max(y0 + 1, min(h, args.y1))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(out), image[y0:y1, x0:x1])
    if not ok:
        print(json.dumps({"error": f"Could not write {out}"}), file=sys.stderr)
        return 1
    print(str(out.resolve()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
