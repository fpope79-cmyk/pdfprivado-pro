import { normalizeRotation } from "./viewer-core.js";
import { foldSearchText, normalizeExtractedText } from "./search-core.js";

export const OCR_RENDER_LIMITS = Object.freeze({
  dpi: 200,
  maxPixels: 8_000_000,
  maxDimension: 3200,
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export async function renderPageForOcr(page, entry, {
  dpi = OCR_RENDER_LIMITS.dpi,
  maxPixels = OCR_RENDER_LIMITS.maxPixels,
  maxDimension = OCR_RENDER_LIMITS.maxDimension,
  onRenderTask,
  isCancelled,
} = {}) {
  if (!page) throw new Error("No se pudo preparar la página para OCR.");

  const rotation = normalizeRotation((page.rotate || 0) + (entry?.rotation || 0));
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const requestedScale = Math.max(1, Number(dpi) || OCR_RENDER_LIMITS.dpi) / 72;
  const dimensionScale = Math.min(
    maxDimension / Math.max(1, baseViewport.width),
    maxDimension / Math.max(1, baseViewport.height)
  );
  const pixelScale = Math.sqrt(
    Math.max(1, maxPixels) /
      Math.max(1, baseViewport.width * baseViewport.height)
  );
  const scale = clamp(Math.min(requestedScale, dimensionScale, pixelScale), 0.01, requestedScale);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  if (!context) throw new Error("No se pudo crear la imagen temporal para OCR.");

  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  if (isCancelled?.()) throw new DOMException("OCR cancelado", "AbortError");
  const task = page.render({
    canvasContext: context,
    viewport,
    background: "rgb(255,255,255)",
  });
  onRenderTask?.(task);
  try {
    await task.promise;
  } finally {
    onRenderTask?.(null);
  }
  if (isCancelled?.()) throw new DOMException("OCR cancelado", "AbortError");

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    rotation,
    effectiveDpi: Math.round(scale * 72),
  };
}

function validBbox(bbox) {
  return Boolean(
    bbox &&
      Number.isFinite(bbox.x0) &&
      Number.isFinite(bbox.y0) &&
      Number.isFinite(bbox.x1) &&
      Number.isFinite(bbox.y1) &&
      bbox.x1 > bbox.x0 &&
      bbox.y1 > bbox.y0
  );
}

function collectWords(blocks) {
  const collected = [];
  for (const block of blocks || []) {
    for (const paragraph of block?.paragraphs || []) {
      for (const line of paragraph?.lines || []) {
        for (const word of line?.words || []) {
          const text = normalizeExtractedText(word?.text || "");
          if (!text || !validBbox(word?.bbox)) continue;
          collected.push({
            text,
            bbox: {
              x0: Number(word.bbox.x0),
              y0: Number(word.bbox.y0),
              x1: Number(word.bbox.x1),
              y1: Number(word.bbox.y1),
            },
            confidence: Number.isFinite(word?.confidence) ? Number(word.confidence) : null,
          });
        }
      }
    }
  }
  return collected;
}

export function buildOcrRecord(data, {
  imageWidth,
  imageHeight,
  language,
  languageLabel,
  rotation,
  effectiveDpi,
} = {}) {
  const sourceWords = collectWords(data?.blocks);
  const words = [];
  let text = "";

  for (const sourceWord of sourceWords) {
    if (text) text += " ";
    const start = text.length;
    text += sourceWord.text;
    words.push({
      ...sourceWord,
      start,
      end: text.length,
    });
  }

  if (!text) text = normalizeExtractedText(data?.text || "");
  const confidenceValues = words
    .map((word) => word.confidence)
    .filter((value) => Number.isFinite(value));
  const confidence = Number.isFinite(data?.confidence)
    ? Number(data.confidence)
    : confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;

  return {
    text,
    folded: foldSearchText(text),
    hasText: Boolean(text),
    words,
    confidence,
    language,
    languageLabel,
    imageWidth: Math.max(1, Number(imageWidth) || 1),
    imageHeight: Math.max(1, Number(imageHeight) || 1),
    rotation: normalizeRotation(rotation || 0),
    effectiveDpi: Math.max(1, Number(effectiveDpi) || OCR_RENDER_LIMITS.dpi),
    createdAt: Date.now(),
  };
}

export function locateOcrWordRanges(record, start = 0, length = 0) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, safeStart + Math.max(0, Number(length) || 0));
  const ranges = [];

  for (const word of record?.words || []) {
    const overlapStart = Math.max(safeStart, word.start);
    const overlapEnd = Math.min(safeEnd, word.end);
    if (overlapEnd <= overlapStart) continue;
    const characters = Math.max(1, word.end - word.start);
    ranges.push({
      word,
      startRatio: clamp((overlapStart - word.start) / characters, 0, 1),
      endRatio: clamp((overlapEnd - word.start) / characters, 0, 1),
    });
  }

  return ranges;
}
