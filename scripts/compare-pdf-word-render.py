#!/usr/bin/env python3
"""Renderiza PDF y DOCX con la misma resolución y calcula SSIM estricto."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def render_pdf(pdf_path: Path, output: Path, dpi: int, page_indexes: list[int] | None = None) -> list[Path]:
    output.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf_path)
    scale = dpi / 72
    rendered = []
    indexes = page_indexes if page_indexes is not None else list(range(len(document)))
    for output_index, page_index in enumerate(indexes):
        page = document[page_index]
        target = output / f"page-{output_index + 1:04d}.png"
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        target.write_bytes(pixmap.tobytes("png"))
        rendered.append(target)
    return rendered


def strict_ssim(reference: np.ndarray, candidate: np.ndarray) -> float:
    reference = reference.astype(np.float64)
    candidate = candidate.astype(np.float64)
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    mu_x = gaussian_filter(reference, 1.5, mode="reflect")
    mu_y = gaussian_filter(candidate, 1.5, mode="reflect")
    sigma_x = gaussian_filter(reference * reference, 1.5, mode="reflect") - mu_x * mu_x
    sigma_y = gaussian_filter(candidate * candidate, 1.5, mode="reflect") - mu_y * mu_y
    sigma_xy = gaussian_filter(reference * candidate, 1.5, mode="reflect") - mu_x * mu_y
    numerator = (2 * mu_x * mu_y + c1) * (2 * sigma_xy + c2)
    denominator = (mu_x * mu_x + mu_y * mu_y + c1) * (sigma_x + sigma_y + c2)
    return float(np.mean(numerator / np.maximum(denominator, 1e-12)))


def load_gray(path: Path, target_size: tuple[int, int] | None = None) -> np.ndarray:
    image = Image.open(path).convert("L")
    if target_size and image.size != target_size:
        image = image.resize(target_size, Image.Resampling.LANCZOS)
    return np.asarray(image)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference_pdf", type=Path)
    parser.add_argument("candidate_docx", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dpi", type=int, default=144)
    parser.add_argument("--pages", help="Páginas 1-based del PDF de referencia, p. ej. 1,12-13")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    converted = args.output / "converted"
    converted.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pdf-word-lo-") as profile:
        subprocess.run([
            "soffice",
            f"-env:UserInstallation=file://{profile}",
            "--headless", "--convert-to", "pdf",
            "--outdir", str(converted.resolve()), str(args.candidate_docx.resolve()),
        ], check=True, capture_output=True, text=True)
    candidate_pdf = converted / f"{args.candidate_docx.stem}.pdf"
    reference_indexes = None
    if args.pages:
        reference_indexes = []
        for part in args.pages.split(","):
            if "-" in part:
                start, end = (int(value) for value in part.split("-", 1))
                reference_indexes.extend(range(start - 1, end))
            else:
                reference_indexes.append(int(part) - 1)
    reference_pages = render_pdf(
        args.reference_pdf,
        args.output / "reference",
        args.dpi,
        reference_indexes,
    )
    candidate_pages = render_pdf(candidate_pdf, args.output / "candidate", args.dpi)
    count = min(len(reference_pages), len(candidate_pages))
    pages = []
    for page_index in range(count):
        reference_image = Image.open(reference_pages[page_index]).convert("L")
        reference = np.asarray(reference_image)
        candidate = load_gray(candidate_pages[page_index], reference_image.size)
        pages.append({
            "pageNumber": page_index + 1,
            "strictSsim": strict_ssim(reference, candidate),
            "meanAbsoluteError": float(np.mean(np.abs(reference.astype(float) - candidate.astype(float))) / 255),
        })
    result = {
        "referencePages": len(reference_pages),
        "candidatePages": len(candidate_pages),
        "comparedPages": count,
        "strictSsim": float(np.mean([page["strictSsim"] for page in pages])) if pages else 0,
        "pages": pages,
    }
    (args.output / "comparison.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
