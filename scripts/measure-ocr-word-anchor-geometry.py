#!/usr/bin/env python3
from __future__ import annotations

import json
import statistics
from functools import lru_cache
from pathlib import Path
from PIL import ImageFont

BANK_ROOT = Path('/mnt/data/pdfprivado-v14-bank')
FONT_PATH = '/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf'
FONT_SIZE = 100
FONT = ImageFont.truetype(FONT_PATH, FONT_SIZE)
TWIP = 1 / 20

@lru_cache(maxsize=30000)
def text_width(text: str) -> float:
    box = FONT.getbbox(text or '')
    return max(.01, float(box[2] - box[0]))

def clean(value) -> str:
    return ' '.join(str(value or '').split())

def derive_segments(runs, line_font, page_median):
    items = sorted(
        [run for run in runs if clean(run.get('text')) and 'x' in run and 'width' in run],
        key=lambda run: float(run.get('x', 0)),
    )
    if not items:
        return []
    gaps = [
        float(items[index]['x']) - (float(items[index - 1]['x']) + float(items[index - 1]['width']))
        for index in range(1, len(items))
    ]
    local_limit = max(12.0, max(4.0, line_font) * 1.8)
    observed = [gap for gap in gaps if 0 < gap <= local_limit]
    expected = max(1.1, statistics.median(observed) if observed else line_font * .28)
    threshold = max(
        7.5,
        max(4.0, line_font) * 3.7,
        max(4.0, page_median) * 1.18,
        expected * 3.1,
    )
    groups = []
    for index, item in enumerate(items):
        previous = items[index - 1] if index else None
        gap = (
            float(item['x']) - (float(previous['x']) + float(previous['width']))
            if previous else 0.0
        )
        if not groups or (previous is not None and gap >= threshold):
            groups.append([item])
        else:
            groups[-1].append(item)
    return groups

def predict_group(group):
    texts = [clean(run.get('text')) for run in group]
    full = ' '.join(texts)
    total = text_width(full)
    start = float(group[0]['x'])
    end = max(float(run['x']) + float(run['width']) for run in group)
    target = max(.1, end - start)
    result = []
    prefix = ''
    for index, text in enumerate(texts):
        if index:
            prefix += ' '
        result.append(start + text_width(prefix) / total * target)
        prefix += text
    return result

def evaluate_line(line, page_median):
    runs = sorted(
        [run for run in line.get('styledRuns', []) if clean(run.get('text')) and 'x' in run and 'width' in run],
        key=lambda run: float(run['x']),
    )
    if len(runs) < 2:
        return None
    actual = [float(run['x']) for run in runs]
    predicted = []
    groups = derive_segments(runs, float(line.get('fontSize', 8)), page_median)
    for group in groups:
        predicted.extend(predict_group(group))
    if len(predicted) != len(actual):
        return None
    errors = [abs(a - b) for a, b in zip(actual, predicted)]
    mae14 = sum(errors) / len(errors)
    max14 = max(errors)
    confidence = float(line.get('confidence') or 0)
    display_font = max(4.0, float(line.get('fontSize', 8)))
    mean_threshold = max(.75, display_font * .075)
    max_threshold = max(1.8, display_font * .17)
    increasing = all(actual[index] > actual[index - 1] + .35 for index in range(1, len(actual)))
    compact = sum(len(clean(run.get('text')).replace(' ', '')) for run in runs)
    enabled = (
        confidence >= 75
        and 2 <= len(runs) <= 28
        and compact >= 5
        and increasing
        and (mae14 >= mean_threshold or max14 >= max_threshold)
    )
    if enabled:
        origin = actual[0]
        quantized = [origin]
        for value in actual[1:]:
            relative = round((value - origin) / TWIP) * TWIP
            quantized.append(origin + relative)
        errors15 = [abs(a - b) for a, b in zip(actual, quantized)]
    else:
        errors15 = errors
    return {
        'mae14': mae14,
        'mae15': sum(errors15) / len(errors15),
        'max14': max14,
        'max15': max(errors15),
        'enabled': enabled,
        'words': len(runs),
        'confidence': confidence,
    }

def main():
    rows = []
    per_doc = {}
    ocr_pages = 0
    for directory in sorted(BANK_ROOT.iterdir()):
        if not directory.is_dir():
            continue
        candidate = directory / 'document.json'
        geometry = directory / 'document-geometry.json'
        path = candidate if candidate.exists() else geometry if geometry.exists() else None
        if path is None:
            continue
        data = json.loads(path.read_text(encoding='utf8'))
        document_rows = []
        for page in data.get('pages', []):
            if page.get('source') != 'ocr':
                continue
            ocr_pages += 1
            sizes = [float(line.get('fontSize', 0)) for line in page.get('layout', []) if float(line.get('fontSize', 0)) > 0]
            median_font = statistics.median(sizes) if sizes else 8.0
            for line in page.get('layout', []):
                measured = evaluate_line(line, median_font)
                if not measured:
                    continue
                measured.update(
                    doc=directory.name,
                    page=page.get('pageNumber'),
                    text=clean(line.get('text'))[:140],
                )
                rows.append(measured)
                document_rows.append(measured)
        if document_rows:
            per_doc[directory.name] = document_rows

    def mean(key, values=rows):
        return sum(row[key] for row in values) / len(values) if values else 0

    enabled = [row for row in rows if row['enabled']]
    improved = [row for row in rows if row['mae15'] + 1e-9 < row['mae14']]
    regressed = [row for row in rows if row['mae15'] > row['mae14'] + 1e-9]
    summary = {
        'documents': len(per_doc),
        'ocrPages': ocr_pages,
        'lines': len(rows),
        'anchoredLines': len(enabled),
        'anchoredWords': sum(row['words'] for row in enabled),
        'meanMaeV14': mean('mae14'),
        'meanMaeV15': mean('mae15'),
        'meanRelativeReduction': 1 - mean('mae15') / mean('mae14') if mean('mae14') else 0,
        'anchoredMeanMaeV14': mean('mae14', enabled),
        'anchoredMeanMaeV15': mean('mae15', enabled),
        'anchoredRelativeReduction': 1 - mean('mae15', enabled) / mean('mae14', enabled) if mean('mae14', enabled) else 0,
        'improvedLines': len(improved),
        'regressedLines': len(regressed),
        'worstRegressions': sorted(regressed, key=lambda row: row['mae15'] - row['mae14'], reverse=True)[:10],
        'bestImprovements': sorted(improved, key=lambda row: row['mae14'] - row['mae15'], reverse=True)[:12],
    }
    output = Path('benchmark/v15-word-anchor-geometry.json')
    output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
