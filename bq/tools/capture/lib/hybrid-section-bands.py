#!/usr/bin/env python3
"""
HybridSectionDetector — Python OpenCV section boundaries (desktop screenshot).

Algorithm adapted from a ChatGPT/OpenCV desktop prototype:
  LAB row-colour change + Canny edge change + uniform-row separators,
  percentile threshold, NMS with min gap, cap ~14 sections.

Usage:
  python hybrid-section-bands.py --input path/to/desktop-clean.png
  python hybrid-section-bands.py --input desktop-clean.png --out-dir out --write-artifacts

Band JSON is printed on stdout (consumed by HybridSectionDetector). Optional --write-artifacts
writes section-bands.{json,png} + preview.jpg for debugging only.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def normalise(values: np.ndarray) -> np.ndarray:
    lo, hi = np.percentile(values, [10, 99])
    return np.clip((values - lo) / max(hi - lo, 1e-6), 0, 1)


def merge_short_segments(
    boundaries: list[int],
    score: np.ndarray,
    min_height: int,
) -> list[int]:
    """Drop boundaries that only create tiny leftover bands (keep stronger edge)."""
    bounds = sorted(int(y) for y in boundaries)
    h = bounds[-1]
    changed = True
    while changed and len(bounds) > 2:
        changed = False
        for i in range(len(bounds) - 1):
            top, bottom = bounds[i], bounds[i + 1]
            if bottom - top >= min_height:
                continue
            # Prefer removing the weaker interior boundary.
            left = bounds[i]
            right = bounds[i + 1]
            candidates = []
            if left not in (0, h):
                candidates.append(left)
            if right not in (0, h):
                candidates.append(right)
            if not candidates:
                continue
            drop = min(candidates, key=lambda y: float(score[min(y, len(score) - 1)]))
            bounds.remove(drop)
            changed = True
            break
    return bounds


def detect_section_boundaries(
    image: np.ndarray,
    *,
    min_section_height: int = 90,
    max_sections: int = 22,
) -> tuple[list[int], np.ndarray]:
    h, w = image.shape[:2]
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Reduce individual text and image details into robust horizontal signals.
    row_colour = lab.mean(axis=1)
    colour_change = np.linalg.norm(
        np.diff(row_colour, axis=0, prepend=row_colour[:1]), axis=1
    )
    colour_change = cv2.GaussianBlur(colour_change[:, None], (1, 31), 0).ravel()

    edges = cv2.Canny(gray, 70, 180)
    edge_density = edges.mean(axis=1) / 255.0
    edge_change = np.abs(np.diff(edge_density, prepend=edge_density[0]))
    edge_change = cv2.GaussianBlur(edge_change[:, None], (1, 31), 0).ravel()

    # Rows that are nearly uniform often form deliberate separators.
    row_std = gray.std(axis=1)
    uniform = (row_std < 8).astype(np.float32)
    uniform = cv2.GaussianBlur(uniform[:, None], (1, 61), 0).ravel()

    score = (
        0.60 * normalise(colour_change)
        + 0.25 * normalise(edge_change)
        + 0.15 * uniform
    )
    threshold = np.percentile(score, 91)

    # Non-maximum suppression. Min gap used to be ~2.5% of page height (~193px on
    # a 7.7k screenshot), which swallowed short CMS bands (CTA ~126px, footer rows).
    # Use a tighter floor so adjacent short full-width blocks can still split.
    candidates = np.where(score >= threshold)[0]
    ranked = sorted(candidates, key=lambda y: score[y], reverse=True)
    boundaries = [0, h]
    min_gap = max(56, int(h * 0.008))
    for y in ranked:
        y = int(y)
        if all(abs(y - existing) >= min_gap for existing in boundaries):
            boundaries.append(y)
    boundaries.sort()

    # Cap section count, keeping the strongest boundaries.
    max_bounds = max_sections + 1
    if len(boundaries) > max_bounds:
        inner = sorted(
            boundaries[1:-1],
            key=lambda y: score[min(y, h - 2)],
            reverse=True,
        )[: max_sections - 1]
        boundaries = sorted([0, h, *inner])

    boundaries = merge_short_segments(boundaries, score, min_section_height)
    return boundaries, score


def draw_preview(image: np.ndarray, boundaries: list[int], preview_width: int = 900) -> tuple[np.ndarray, np.ndarray]:
    h, w = image.shape[:2]
    canvas = image.copy()
    # Distinct BGR palette — adjacent OpenCV bands get clearly different colors.
    palette = [
        (40, 40, 255),
        (40, 180, 40),
        (255, 140, 0),
        (0, 200, 255),
        (255, 0, 220),
        (0, 220, 180),
        (0, 120, 255),
        (200, 80, 255),
        (80, 220, 80),
        (255, 180, 40),
        (40, 90, 220),
        (220, 220, 0),
        (180, 60, 160),
        (60, 255, 160),
        (100, 100, 255),
        (255, 100, 100),
        (0, 165, 255),
        (255, 255, 0),
        (128, 0, 255),
        (0, 255, 128),
    ]
    overlay = canvas.copy()
    border = max(3, w // 450)
    for i, (top, bottom) in enumerate(zip(boundaries[:-1], boundaries[1:]), start=1):
        colour = palette[(i - 1) % len(palette)]
        cv2.rectangle(overlay, (3, top + 2), (w - 4, bottom - 2), colour, thickness=-1)
    cv2.addWeighted(overlay, 0.14, canvas, 0.86, 0, canvas)

    for i, (top, bottom) in enumerate(zip(boundaries[:-1], boundaries[1:]), start=1):
        colour = palette[(i - 1) % len(palette)]
        cv2.rectangle(
            canvas,
            (3, top + 2),
            (w - 4, bottom - 2),
            colour,
            border,
        )
        cv2.rectangle(canvas, (0, top), (8, bottom), colour, thickness=-1)
        label = f"Section {i}  y={top}-{bottom}"
        scale = max(0.65, w / 1800)
        thickness = max(2, w // 900)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
        y_text = min(bottom - 8, top + th + 14)
        cv2.rectangle(
            canvas,
            (8, y_text - th - 8),
            (18 + tw, y_text + 6),
            (20, 20, 20),
            -1,
        )
        cv2.rectangle(
            canvas,
            (8, y_text - th - 8),
            (18 + tw, y_text + 6),
            colour,
            2,
        )
        cv2.putText(
            canvas,
            label,
            (13, y_text),
            cv2.FONT_HERSHEY_SIMPLEX,
            scale,
            colour,
            thickness,
            cv2.LINE_AA,
        )

    preview = cv2.resize(
        canvas,
        (preview_width, round(h * preview_width / w)),
        interpolation=cv2.INTER_AREA,
    )
    return canvas, preview


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect page sections with OpenCV (Python).")
    parser.add_argument("--input", required=True, help="Full-page desktop PNG (prefer desktop-clean.png)")
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Directory for optional debug artifacts (requires --write-artifacts)",
    )
    parser.add_argument(
        "--write-artifacts",
        action="store_true",
        help="Write section-bands.json/.png + preview.jpg (debug only; default off)",
    )
    parser.add_argument("--min-height", type=int, default=90, help="Merge/drop bands shorter than this (px)")
    parser.add_argument("--max-sections", type=int, default=22, help="Maximum number of OpenCV sections")
    args = parser.parse_args()

    source = Path(args.input)

    image = cv2.imread(str(source))
    if image is None:
        print(json.dumps({"error": f"Could not read {source}"}), file=sys.stderr)
        return 1

    h, w = image.shape[:2]
    boundaries, score = detect_section_boundaries(
        image,
        min_section_height=args.min_height,
        max_sections=args.max_sections,
    )

    bands = []
    for i, (top, bottom) in enumerate(zip(boundaries[:-1], boundaries[1:]), start=1):
        height = int(bottom - top)
        if height < args.min_height:
            continue
        mid = min(max(int(top), 0), h - 1)
        bands.append(
            {
                "index": i,
                "y0": int(top),
                "y1": int(bottom),
                "height": height,
                "score": float(score[min(mid, h - 2)]),
            }
        )

    payload = {
        "source": str(source.resolve()),
        "imageWidth": int(w),
        "imageHeight": int(h),
        "sectionCount": len(bands),
        "boundaries": [int(y) for y in boundaries],
        "bands": bands,
        "annotatedPath": None,
        "previewPath": None,
        "jsonPath": None,
        "engine": "opencv-python",
        "opencvVersion": cv2.__version__,
    }

    if args.write_artifacts:
        if not args.out_dir:
            print(json.dumps({"error": "--out-dir is required with --write-artifacts"}), file=sys.stderr)
            return 1
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        annotated, preview = draw_preview(image, boundaries)
        annotated_path = out_dir / "section-bands.png"
        preview_path = out_dir / "section-bands-preview.jpg"
        json_path = out_dir / "section-bands.json"
        cv2.imwrite(str(annotated_path), annotated)
        cv2.imwrite(str(preview_path), preview, [cv2.IMWRITE_JPEG_QUALITY, 88])
        payload["annotatedPath"] = str(annotated_path.resolve())
        payload["previewPath"] = str(preview_path.resolve())
        payload["jsonPath"] = str(json_path.resolve())
        json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    # HybridSectionDetector reads band payload from stdout (no disk artifact required).
    print(json.dumps(payload, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
