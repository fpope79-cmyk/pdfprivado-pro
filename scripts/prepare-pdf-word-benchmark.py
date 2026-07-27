#!/usr/bin/env python3
"""Prepara páginas reales para probar el generador PDF→Word de la aplicación.

No contiene reglas por documento. Detecta texto nativo; si no existe, usa
Tesseract. Produce la misma geometría superior-izquierda que consume el motor
DOCX y dos rásteres: original y capa gráfica con el texto suprimido.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import statistics
import subprocess
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from scipy import ndimage


def clean_text(value: str) -> str:
    return " ".join(str(value or "").replace("\x00", "").split())


def derive_line_segments(runs: list[dict], line_font: float, page_median_font: float) -> list[dict]:
    items = sorted(
        [run for run in runs if clean_text(run.get("text", "")) and "x" in run and "width" in run],
        key=lambda run: float(run.get("x", 0)),
    )
    if not items:
        return []
    gaps = [
        float(items[index]["x"]) - (float(items[index - 1]["x"]) + float(items[index - 1]["width"]))
        for index in range(1, len(items))
    ]
    local_limit = max(12.0, max(4.0, line_font) * 1.8)
    observed = [gap for gap in gaps if 0 < gap <= local_limit]
    observed_space = statistics.median(observed) if observed else max(1.1, line_font * .28)
    expected_space = max(1.1, observed_space)
    split_threshold = max(
        7.5,
        max(4.0, line_font) * 3.7,
        max(4.0, page_median_font) * 1.18,
        expected_space * 3.1,
    )

    groups: list[dict] = []
    for index, item in enumerate(items):
        previous = items[index - 1] if index else None
        gap = (
            float(item["x"]) - (float(previous["x"]) + float(previous["width"]))
            if previous else 0.0
        )
        if not groups or (previous is not None and gap >= split_threshold):
            groups.append({"x": float(item["x"]), "width": float(item["width"]), "items": [item]})
        else:
            group = groups[-1]
            group["items"].append(item)
            group["width"] = max(
                float(group["width"]),
                float(item["x"]) + float(item["width"]) - float(group["x"]),
            )

    segments = []
    for group in groups:
        parts = []
        for index, item in enumerate(group["items"]):
            text = clean_text(item.get("text", ""))
            if not index:
                parts.append(text)
                continue
            previous = group["items"][index - 1]
            gap = float(item["x"]) - (float(previous["x"]) + float(previous["width"]))
            if gap > max(1.0, expected_space * .58):
                parts.append(" ")
            parts.append(text)
        segments.append({
            "text": clean_text("".join(parts)),
            "x": float(group["x"]),
            "width": float(group["width"]),
        })
    return [segment for segment in segments if segment["text"]]


def native_layout(page: fitz.Page) -> list[dict]:
    lines: list[dict] = []
    raw = page.get_text("dict", flags=fitz.TEXT_PRESERVE_LIGATURES)
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        for raw_line in block.get("lines", []):
            spans = [span for span in raw_line.get("spans", []) if clean_text(span.get("text", ""))]
            if not spans:
                continue
            x0 = min(float(span["bbox"][0]) for span in spans)
            y0 = min(float(span["bbox"][1]) for span in spans)
            x1 = max(float(span["bbox"][2]) for span in spans)
            y1 = max(float(span["bbox"][3]) for span in spans)
            sizes = [max(1.0, float(span.get("size", y1 - y0))) for span in spans]
            font_size = statistics.median(sizes)
            text = clean_text("".join(str(span.get("text", "")) for span in spans))
            styled_runs = []
            for span in spans:
                font = str(span.get("font", ""))
                flags = int(span.get("flags", 0))
                color = f"{int(span.get('color', 0)) & 0xFFFFFF:06X}"
                sx0, sy0, sx1, sy1 = [float(value) for value in span["bbox"]]
                styled_runs.append({
                    "text": str(span.get("text", "")),
                    "x": sx0,
                    "y": float(page.rect.height) - sy1,
                    "width": max(.1, sx1 - sx0),
                    "height": max(1.0, sy1 - sy0),
                    "fontName": font,
                    "resolvedFontName": font,
                    "fontFamily": font,
                    "fontSize": float(span.get("size", font_size)),
                    "bold": "bold" in font.lower() or bool(flags & 16),
                    "italic": "italic" in font.lower() or "oblique" in font.lower() or bool(flags & 2),
                    "color": color,
                })
            primary = styled_runs[0]
            lines.append({
                "text": text,
                "x": x0,
                "y": float(page.rect.height) - y0 - font_size * 0.82,
                "width": max(1.0, x1 - x0),
                "height": max(1.0, y1 - y0),
                "fontSize": font_size,
                "source": "native",
                "fontName": primary["fontName"],
                "resolvedFontName": primary["resolvedFontName"],
                "fontFamily": primary["fontFamily"],
                "bold": sum(len(run["text"]) for run in styled_runs if run["bold"]) >= len(text) / 2,
                "italic": sum(len(run["text"]) for run in styled_runs if run["italic"]) >= len(text) / 2,
                "color": primary["color"],
                "styledRuns": styled_runs,
                "segments": [],
            })
    median_font = statistics.median([line["fontSize"] for line in lines]) if lines else 10.0
    for line in lines:
        line["segments"] = derive_line_segments(line.get("styledRuns", []), line["fontSize"], median_font)
    return sorted(lines, key=lambda line: (page.rect.height - line["y"], line["x"]))


def run_tesseract(image_path: Path) -> list[dict]:
    completed = subprocess.run(
        ["tesseract", str(image_path), "stdout", "-l", "eng", "--psm", "3", "tsv"],
        check=True,
        capture_output=True,
        text=True,
    )
    rows = []
    reader = csv.DictReader(io.StringIO(completed.stdout), delimiter="\t")
    for row in reader:
        text = clean_text(row.get("text", ""))
        try:
            confidence = float(row.get("conf", "-1"))
        except ValueError:
            confidence = -1
        if text and confidence >= 0:
            rows.append({
                "text": text,
                "confidence": confidence,
                "left": int(row["left"]),
                "top": int(row["top"]),
                "width": int(row["width"]),
                "height": int(row["height"]),
                "key": (row["block_num"], row["par_num"], row["line_num"]),
            })
    return rows


def ocr_layout(words: list[dict], page_width: float, page_height: float, scale: float) -> list[dict]:
    grouped: dict[tuple, list[dict]] = {}
    for word in words:
        grouped.setdefault(word["key"], []).append(word)
    lines = []
    for group in grouped.values():
        group.sort(key=lambda word: word["left"])
        x0 = min(word["left"] for word in group) / scale
        top = min(word["top"] for word in group) / scale
        x1 = max(word["left"] + word["width"] for word in group) / scale
        bottom = max(word["top"] + word["height"] for word in group) / scale
        word_heights = [word["height"] / scale for word in group if word["height"] > 0]
        if not word_heights:
            continue
        font_size = max(4.0, statistics.median(word_heights) * 0.82)
        text = " ".join(word["text"] for word in group)
        confidence_weights = [
            (float(word.get("confidence", 0)), max(1, len(clean_text(word.get("text", "")))))
            for word in group
            if float(word.get("confidence", -1)) >= 0
        ]
        confidence_weight = sum(weight for _, weight in confidence_weights)
        line_confidence = (
            sum(value * weight for value, weight in confidence_weights) / confidence_weight
            if confidence_weight
            else None
        )
        styled_runs = []
        for word in group:
            word_x = word["left"] / scale
            word_top = word["top"] / scale
            word_width = max(0.1, word["width"] / scale)
            word_height = max(1.0, word["height"] / scale)
            styled_runs.append({
                "text": word["text"],
                "x": word_x,
                "y": page_height - (word_top + word_height),
                "width": word_width,
                "height": word_height,
                "fontSize": max(4.0, word_height * 0.82),
                "fontName": "",
                "resolvedFontName": "",
                "fontFamily": "",
                "bold": False,
                "italic": False,
                "color": "",
                "confidence": float(word.get("confidence", -1)) if float(word.get("confidence", -1)) >= 0 else None,
            })
        robust_bottom = statistics.median(
            (word["top"] + word["height"]) / scale
            for word in group
        )
        lines.append({
            "text": text,
            "x": x0,
            "y": page_height - robust_bottom,
            "width": max(1.0, x1 - x0),
            "height": max(1.0, bottom - top),
            "fontSize": font_size,
            "source": "ocr",
            "ocrTop": top,
            "ocrBottom": bottom,
            "ocrBaselineHint": robust_bottom,
            "fontName": "",
            "resolvedFontName": "",
            "fontFamily": "",
            "bold": False,
            "italic": False,
            "color": "",
            "confidence": line_confidence,
            # Replica el modelo real de la app: Tesseract produce palabras
            # individuales. La puerta headless debe ver esos runs aunque el
            # generador v13 los colapse de forma deliberada a una línea OCR
            # para preservar espacios y estilo visual inferido.
            "styledRuns": styled_runs,
            "segments": [],
        })
    median_font = statistics.median([line["fontSize"] for line in lines]) if lines else 10.0
    for line in lines:
        line["segments"] = derive_line_segments(line.get("styledRuns", []), line["fontSize"], median_font)
    return sorted(lines, key=lambda line: (page_height - line["y"], line["x"]))


def sample_background(
    pixels,
    width: int,
    height: int,
    box: tuple[int, int, int, int],
    percentile: float = .5,
) -> tuple[int, int, int]:
    left, top, right, bottom = box
    samples = []
    step_x = max(1, (right - left) // 18)
    step_y = max(1, (bottom - top) // 6)
    for x in range(left, right + 1, step_x):
        samples.append(pixels[min(width - 1, max(0, x)), min(height - 1, max(0, top - 2))])
        samples.append(pixels[min(width - 1, max(0, x)), min(height - 1, max(0, bottom + 2))])
    for y in range(top, bottom + 1, step_y):
        samples.append(pixels[min(width - 1, max(0, left - 2)), min(height - 1, max(0, y))])
        samples.append(pixels[min(width - 1, max(0, right + 2)), min(height - 1, max(0, y))])
    samples.sort(key=sum)
    index = int(len(samples) * max(0, min(.99, percentile)))
    return samples[index] if samples else (255, 255, 255)


def ocr_raster_protection_profile(lines: list[dict]) -> dict:
    values = sorted(
        float(line.get("fontSize", line.get("height", 0)))
        for line in lines
        if float(line.get("fontSize", line.get("height", 0))) > 0
    )
    median_font = statistics.median(values) if values else 0.0
    return {"medianFontSize": median_font, "lineCount": len(lines)}


def should_preserve_ocr_raster_line(line: dict, profile: dict) -> bool:
    confidence = line.get("confidence")
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        return False
    text = clean_text(line.get("text", ""))
    compact_length = len("".join(text.split()))
    if not compact_length:
        return False
    font_size = max(1.0, float(line.get("fontSize", line.get("height", 1))))
    median_font = max(1.0, float(profile.get("medianFontSize") or font_size))
    size_ratio = font_size / median_font
    if confidence < 12 and compact_length <= 16 and size_ratio >= 1.15:
        return True
    if confidence < 75 and size_ratio >= 3 and compact_length <= 18:
        return True
    if confidence < 35 and size_ratio >= 1.8 and compact_length <= 48:
        return True
    return False


def suppress_text(source: Image.Image, lines: list[dict], page_width: float, page_height: float) -> Image.Image:
    image = source.convert("RGB").copy()
    sx = image.width / page_width
    sy = image.height / page_height
    page_area = max(1.0, page_width * page_height)
    layout_coverage = sum(
        max(0.0, float(line.get("width", 0))) *
        max(0.0, float(line.get("height", line.get("fontSize", 0))))
        for line in lines
    ) / page_area
    # La clasificación por componentes se aplica a cualquier densidad para
    # preservar reglas y bordes; solo el crecimiento lateral se reserva a
    # páginas dispersas con geometría OCR suficientemente fiable.
    use_adaptive_growth = len(lines) <= 32 and layout_coverage >= .24
    protection_profile = ocr_raster_protection_profile(lines)
    for line in lines:
        if should_preserve_ocr_raster_line(line, protection_profile):
            continue
        font_size = max(1.0, float(line.get("fontSize", 9)))
        line_height = max(font_size * 1.08, float(line.get("height", font_size)))
        top_points = page_height - float(line.get("y", 0)) - line_height
        pad_x = max(0.65, font_size * 0.055)
        pad_y = max(0.50, font_size * 0.045)
        original_left = max(0, int((float(line.get("x", 0)) - pad_x) * sx))
        top = max(0, int((top_points - pad_y) * sy))
        original_right = min(
            image.width - 1,
            int((float(line.get("x", 0)) + float(line.get("width", 1)) + pad_x) * sx + 1),
        )
        bottom = min(image.height - 1, int((top_points + line_height + pad_y) * sy + 1))
        if original_right <= original_left or bottom <= top:
            continue

        # OCR boxes often miss the first/last antialiased pixels or a short word.
        # Grow only in the text direction and cap the search by the font size so
        # unrelated columns and nearby graphics cannot be swallowed.
        lateral_growth = max(2, round(font_size * sx * 2.5)) if use_adaptive_growth else 0
        left = max(0, original_left - lateral_growth)
        right = min(image.width - 1, original_right + lateral_growth)
        pixels = image.load()
        background = sample_background(
            pixels,
            image.width,
            image.height,
            (original_left, top, original_right, bottom),
            .75 if use_adaptive_growth else .5,
        )
        bg_lum = background[0] * .2126 + background[1] * .7152 + background[2] * .0722

        crop = np.asarray(image)[top:bottom + 1, left:right + 1, :].astype(np.int16)
        background_array = np.asarray(background, dtype=np.int16)
        luminance = crop[:, :, 0] * .2126 + crop[:, :, 1] * .7152 + crop[:, :, 2] * .0722
        distance = np.abs(crop - background_array).sum(axis=2)

        # A stricter core identifies ink; a weaker ring captures antialiasing.
        core = (distance > 24) & (luminance < bg_lum - 6)
        fringe = (distance > 9) & (luminance < bg_lum - 2)
        labels, component_count = ndimage.label(core, structure=np.ones((3, 3), dtype=np.uint8))
        accepted = np.zeros(core.shape, dtype=bool)
        band_height = core.shape[0]
        band_width = core.shape[1]
        original_x0 = original_left - left
        original_x1 = original_right - left

        for component_id in range(1, component_count + 1):
            ys, xs = np.nonzero(labels == component_id)
            if not len(xs):
                continue
            component_left = int(xs.min())
            component_right = int(xs.max()) + 1
            component_top = int(ys.min())
            component_bottom = int(ys.max()) + 1
            component_width = component_right - component_left
            component_height = component_bottom - component_top
            horizontal_rule = (
                component_width >= max(12, round(band_height * 5))
                and component_height <= max(2, round(band_height * .12))
            )
            vertical_rule = (
                component_height >= max(3, round(band_height * .88))
                and component_width <= max(2, round(band_height * .10))
            )
            close_to_ocr_box = (
                component_right >= original_x0 - round(band_height * 1.5)
                and component_left <= original_x1 + round(band_height * 1.5)
            )
            if close_to_ocr_box and not horizontal_rule and not vertical_rule:
                accepted[ys, xs] = True

        accepted = ndimage.binary_dilation(accepted, structure=np.ones((3, 3), dtype=bool)) & fringe
        if accepted.any():
            crop[accepted] = background_array
            mutable = np.asarray(image).copy()
            mutable[top:bottom + 1, left:right + 1, :] = crop.astype(np.uint8)
            image = Image.fromarray(mutable, mode="RGB")
    return image


def selected_pages(spec: str | None, page_count: int) -> list[int]:
    if not spec:
        return list(range(page_count))
    values = []
    for part in spec.split(","):
        if "-" in part:
            start, end = (int(value) for value in part.split("-", 1))
            values.extend(range(start - 1, end))
        else:
            values.append(int(part) - 1)
    return sorted({value for value in values if 0 <= value < page_count})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pages", help="Páginas 1-based, p. ej. 1,12-13")
    parser.add_argument("--dpi", type=int, default=144)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    document = fitz.open(args.pdf)
    scale = args.dpi / 72
    prepared_pages = []
    for page_index in selected_pages(args.pages, len(document)):
        page = document[page_index]
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        source_path = args.output / f"page-{page_index + 1:04d}-source.png"
        source_temporary = source_path.with_suffix(".png.tmp")
        source_temporary.write_bytes(pixmap.tobytes("png"))
        source_temporary.replace(source_path)
        source_image = Image.open(source_path).convert("RGB")
        native = native_layout(page)
        native_characters = sum(len(line["text"].replace(" ", "")) for line in native)
        if native_characters >= 160 or len(native) >= 8:
            source_kind = "native"
            layout = native
        else:
            source_kind = "ocr"
            layout = ocr_layout(run_tesseract(source_path), page.rect.width, page.rect.height, scale)
        graphics_path = args.output / f"page-{page_index + 1:04d}-graphics.png"
        graphics_buffer = io.BytesIO()
        suppress_text(
            source_image,
            layout,
            page.rect.width,
            page.rect.height,
        ).save(graphics_buffer, format="PNG")
        graphics_temporary = graphics_path.with_suffix(".png.tmp")
        graphics_temporary.write_bytes(graphics_buffer.getvalue())
        graphics_temporary.replace(graphics_path)
        prepared_pages.append({
            "pageNumber": page_index + 1,
            "width": float(page.rect.width),
            "height": float(page.rect.height),
            "source": source_kind,
            "text": "\n".join(line["text"] for line in layout),
            "layout": layout,
            "sourceImage": source_path.name,
            "graphicsImage": graphics_path.name,
        })
        print(f"{args.pdf.name} p{page_index + 1}: {source_kind}, {len(layout)} líneas")
    payload = {
        "document": {"sourceName": args.pdf.name},
        "pages": prepared_pages,
    }
    (args.output / "document.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
