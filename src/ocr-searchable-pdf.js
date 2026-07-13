import { normalizeRotation } from "./viewer-core.js";

const SUPPORTED_ROTATIONS = new Set([0, 90, 180, 270]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 1) {
  return Math.max(Number.EPSILON, finite(value, fallback));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function validateSearchableOcrRecord(record) {
  if (!record || typeof record !== "object") {
    return { valid: false, reason: "Falta el registro OCR." };
  }

  const imageWidth = finite(record.imageWidth);
  const imageHeight = finite(record.imageHeight);
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { valid: false, reason: "El registro OCR no contiene dimensiones válidas." };
  }

  const words = Array.isArray(record.words) ? record.words : [];
  if (!words.length) {
    return { valid: false, reason: "El registro OCR no contiene palabras posicionadas." };
  }

  const usableWords = words.filter((word) => {
    const bbox = word?.bbox;
    return Boolean(
      String(word?.text || "").trim() &&
      bbox &&
      Number.isFinite(Number(bbox.x0)) &&
      Number.isFinite(Number(bbox.y0)) &&
      Number.isFinite(Number(bbox.x1)) &&
      Number.isFinite(Number(bbox.y1)) &&
      Number(bbox.x1) > Number(bbox.x0) &&
      Number(bbox.y1) > Number(bbox.y0)
    );
  });

  if (!usableWords.length) {
    return { valid: false, reason: "El registro OCR no contiene palabras utilizables." };
  }

  const rotation = normalizeRotation(record.rotation || 0);
  if (!SUPPORTED_ROTATIONS.has(rotation)) {
    return { valid: false, reason: `Rotación OCR no compatible: ${rotation}°.` };
  }

  return {
    valid: true,
    imageWidth,
    imageHeight,
    rotation,
    words: usableWords,
  };
}

export function mapOcrPointToPdf({
  x,
  y,
  imageWidth,
  imageHeight,
  pdfWidth,
  pdfHeight,
  rotation = 0,
}) {
  const safeImageWidth = positive(imageWidth);
  const safeImageHeight = positive(imageHeight);
  const safePdfWidth = positive(pdfWidth);
  const safePdfHeight = positive(pdfHeight);
  const normalizedRotation = normalizeRotation(rotation || 0);

  const normalizedX = clamp(finite(x) / safeImageWidth, 0, 1);
  const normalizedY = clamp(finite(y) / safeImageHeight, 0, 1);

  switch (normalizedRotation) {
    case 90:
      return {
        x: normalizedY * safePdfWidth,
        y: normalizedX * safePdfHeight,
      };
    case 180:
      return {
        x: (1 - normalizedX) * safePdfWidth,
        y: normalizedY * safePdfHeight,
      };
    case 270:
      return {
        x: (1 - normalizedY) * safePdfWidth,
        y: (1 - normalizedX) * safePdfHeight,
      };
    default:
      return {
        x: normalizedX * safePdfWidth,
        y: (1 - normalizedY) * safePdfHeight,
      };
  }
}

export function mapOcrBboxToPdf(bbox, options) {
  const x0 = finite(bbox?.x0);
  const y0 = finite(bbox?.y0);
  const x1 = finite(bbox?.x1);
  const y1 = finite(bbox?.y1);

  const corners = [
    mapOcrPointToPdf({ ...options, x: x0, y: y0 }),
    mapOcrPointToPdf({ ...options, x: x1, y: y0 }),
    mapOcrPointToPdf({ ...options, x: x0, y: y1 }),
    mapOcrPointToPdf({ ...options, x: x1, y: y1 }),
  ];

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);

  return {
    x: left,
    y: bottom,
    width: Math.max(Number.EPSILON, right - left),
    height: Math.max(Number.EPSILON, top - bottom),
    rotation: normalizeRotation(options?.rotation || 0),
  };
}

export function buildSearchableTextPlacements(record, {
  pdfWidth,
  pdfHeight,
  minimumFontSize = 1,
  maximumFontSize = 96,
  minimumConfidence = null,
} = {}) {
  const validation = validateSearchableOcrRecord(record);
  if (!validation.valid) {
    return {
      placements: [],
      skipped: 0,
      valid: false,
      reason: validation.reason,
    };
  }

  const placements = [];
  let skipped = 0;

  for (const word of validation.words) {
    const confidence = Number.isFinite(Number(word.confidence))
      ? Number(word.confidence)
      : null;

    if (
      Number.isFinite(Number(minimumConfidence)) &&
      confidence !== null &&
      confidence < Number(minimumConfidence)
    ) {
      skipped += 1;
      continue;
    }

    const box = mapOcrBboxToPdf(word.bbox, {
      imageWidth: validation.imageWidth,
      imageHeight: validation.imageHeight,
      pdfWidth,
      pdfHeight,
      rotation: validation.rotation,
    });

    const fontSize = clamp(
      box.height * 0.82,
      positive(minimumFontSize),
      positive(maximumFontSize, 96)
    );

    placements.push({
      text: String(word.text || "").trim(),
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fontSize,
      rotation: box.rotation,
      confidence,
    });
  }

  return {
    placements,
    skipped,
    valid: true,
    reason: "",
  };
}

export function summarizeSearchableTextPlacements(result) {
  if (!result?.valid) {
    return {
      usable: false,
      words: 0,
      skipped: Number(result?.skipped) || 0,
      reason: result?.reason || "Registro OCR no válido.",
    };
  }

  return {
    usable: result.placements.length > 0,
    words: result.placements.length,
    skipped: Number(result.skipped) || 0,
    reason: result.placements.length ? "" : "No quedaron palabras utilizables.",
  };
}
