import {
  buildNormalizedPageModel,
  enrichPdfTextStyles,
  pageModelToLegacyLayout,
} from "./pdf-word-page-model.js";

export const EXPORT_FORMATS = Object.freeze(["txt", "json", "html", "markdown"]);

export function normalizePageExpression(value = "") {
  return String(value)
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "");
}

export function parsePageExpression(value, pageCount) {
  const total = Math.max(0, Number.parseInt(pageCount, 10) || 0);
  const expression = normalizePageExpression(value);

  if (!expression) {
    return { pages: [], errors: ["Indica al menos una página o rango."] };
  }

  const pages = new Set();
  const errors = [];

  for (const token of expression.split(",").filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    const single = token.match(/^(\d+)$/);

    if (range) {
      let start = Number.parseInt(range[1], 10);
      let end = Number.parseInt(range[2], 10);

      if (start > end) [start, end] = [end, start];

      if (start < 1 || end > total) {
        errors.push(`El rango ${token} queda fuera de 1-${total}.`);
        continue;
      }

      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }

    if (single) {
      const page = Number.parseInt(single[1], 10);
      if (page < 1 || page > total) {
        errors.push(`La página ${page} queda fuera de 1-${total}.`);
      } else {
        pages.add(page);
      }
      continue;
    }

    errors.push(`No se reconoce "${token}".`);
  }

  return { pages: [...pages].sort((a, b) => a - b), errors };
}

export function resolveExportPages({
  mode = "all",
  pageCount = 0,
  currentPage = 1,
  selectedPages = [],
  expression = "",
} = {}) {
  const total = Math.max(0, Number.parseInt(pageCount, 10) || 0);

  if (!total) return { pages: [], errors: ["El documento no contiene páginas."] };

  if (mode === "current") {
    const page = Math.min(total, Math.max(1, Number.parseInt(currentPage, 10) || 1));
    return { pages: [page], errors: [] };
  }

  if (mode === "selected") {
    const pages = [...new Set(
      [...selectedPages]
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => value >= 1 && value <= total)
    )].sort((a, b) => a - b);

    return pages.length
      ? { pages, errors: [] }
      : { pages: [], errors: ["No hay páginas seleccionadas."] };
  }

  if (mode === "range") return parsePageExpression(expression, total);

  return {
    pages: Array.from({ length: total }, (_, index) => index + 1),
    errors: [],
  };
}

function appendText(target, value) {
  const text = String(value ?? "").replace(/\u0000/g, "");
  if (!text) return;

  const previous = target.value;
  if (!previous) {
    target.value = text;
    return;
  }

  const needsSpace =
    !/[\s\u00ad]$/.test(previous) &&
    !/^[\s,.;:!?)}\]]/.test(text);

  target.value += needsSpace ? ` ${text}` : text;
}

export function textItemsToStructuredText(items = []) {
  const target = { value: "" };

  for (const item of items) {
    appendText(target, item?.str || "");
    if (item?.hasEOL) target.value = target.value.replace(/[ \t]+$/g, "") + "\n";
  }

  return target.value
    .replace(/\u00ad(?=\n|$)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text = "") {
  const normalized = String(text).trim();
  if (!normalized) return 0;

  try {
    return [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(normalized)]
      .filter((part) => part.isWordLike).length;
  } catch {
    return normalized.split(/\s+/u).filter(Boolean).length;
  }
}

function normalizedComparableText(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function comparableTokens(value = "") {
  return new Set(normalizedComparableText(value).split(/\s+/u).filter(Boolean));
}

function tokenOverlapScore(a = "", b = "") {
  const left = comparableTokens(a);
  const right = comparableTokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(1, Math.min(left.size, right.size));
}

function legacyLayoutTop(line = {}, pageHeight = 842) {
  const source = String(line?.source || "native").toLocaleLowerCase();
  const ocrTop = Number(line?.ocrTop);
  if (source === "ocr" && Number.isFinite(ocrTop)) return ocrTop;
  const fontSize = Math.max(1, Number(line?.fontSize) || Number(line?.height) || 10);
  const y = Number(line?.y);
  if (Number.isFinite(y)) return Math.max(0, Number(pageHeight || 842) - y - fontSize * 0.82);
  return Math.max(0, Number(line?.top) || 0);
}

function legacyLayoutBox(line = {}, pageHeight = 842) {
  const x = Number(line?.x) || 0;
  const top = legacyLayoutTop(line, pageHeight);
  const width = Math.max(0.1, Number(line?.width) || 1);
  const height = Math.max(1, Number(line?.height) || Number(line?.fontSize) || 10);
  return { x, top, right: x + width, bottom: top + height, width, height };
}

function oneDimensionalOverlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * Une texto PDF nativo y OCR sin duplicar las líneas que el OCR vuelve a leer
 * del propio texto nativo. El OCR solo aporta regiones visuales que no están
 * ya representadas por la capa de texto del PDF (capturas, escaneos parciales,
 * imágenes incrustadas, etc.).
 */
export function mergeNativeAndOcrLayouts(nativeLayout = [], ocrLayout = [], {
  pageHeight = 842,
} = {}) {
  const native = (Array.isArray(nativeLayout) ? nativeLayout : [])
    .filter((line) => String(line?.text || "").trim())
    .map((line) => ({ ...line, source: "native" }));
  const ocr = (Array.isArray(ocrLayout) ? ocrLayout : [])
    .filter((line) => String(line?.text || "").trim())
    .map((line) => ({ ...line, source: "ocr" }));

  const extraOcr = ocr.filter((candidate) => {
    const cb = legacyLayoutBox(candidate, pageHeight);
    const cCenterY = (cb.top + cb.bottom) / 2;
    const candidateText = normalizedComparableText(candidate.text);

    return !native.some((existing) => {
      const nb = legacyLayoutBox(existing, pageHeight);
      const nCenterY = (nb.top + nb.bottom) / 2;
      const verticalOverlap = oneDimensionalOverlap(cb.top, cb.bottom, nb.top, nb.bottom);
      const horizontalOverlap = oneDimensionalOverlap(cb.x, cb.right, nb.x, nb.right);
      const verticalRatio = verticalOverlap / Math.max(1, Math.min(cb.height, nb.height));
      const horizontalRatio = horizontalOverlap / Math.max(1, Math.min(cb.width, nb.width));
      const fontScale = Math.max(4, Number(candidate?.fontSize) || Number(existing?.fontSize) || 10);
      const sameBand = Math.abs(cCenterY - nCenterY) <= Math.max(2.5, fontScale * 0.72);
      const overlapText = tokenOverlapScore(candidate.text, existing.text);
      const nativeText = normalizedComparableText(existing.text);
      const compactContains = candidateText.length >= 5 && nativeText.length >= 5 &&
        (candidateText.includes(nativeText) || nativeText.includes(candidateText));

      return (
        sameBand && horizontalRatio >= 0.28 && (overlapText >= 0.44 || compactContains)
      ) || (
        verticalRatio >= 0.72 && horizontalRatio >= 0.72 && overlapText >= 0.25
      );
    });
  });

  return [...native, ...extraOcr].sort((a, b) => {
    const topA = legacyLayoutTop(a, pageHeight);
    const topB = legacyLayoutTop(b, pageHeight);
    return (topA - topB) || ((Number(a?.x) || 0) - (Number(b?.x) || 0));
  });
}

export function layoutToStructuredText(layout = [], { pageHeight = 842 } = {}) {
  const lines = (Array.isArray(layout) ? layout : [])
    .filter((line) => String(line?.text || "").trim())
    .sort((a, b) => {
      const topA = legacyLayoutTop(a, pageHeight);
      const topB = legacyLayoutTop(b, pageHeight);
      return (topA - topB) || ((Number(a?.x) || 0) - (Number(b?.x) || 0));
    });
  return lines.map((line) => String(line.text).trim()).join("\n").trim();
}

export function buildPageRecord({
  pageNumber,
  text = "",
  source = "native",
  width = null,
  height = null,
  language = null,
  layout = null,
} = {}) {
  const normalized = String(text).replace(/\r\n?/g, "\n").trim();

  return {
    pageNumber: Number.parseInt(pageNumber, 10) || 0,
    source: normalized ? source : "empty",
    text: normalized,
    words: countWords(normalized),
    characters: normalized.length,
    charactersWithoutSpaces: normalized.replace(/\s/gu, "").length,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    language: language || null,
    layout: Array.isArray(layout) ? layout : null,
  };
}

export function calculateExportStatistics(pages = [], requestedPages = pages.length) {
  const records = Array.isArray(pages) ? pages : [];

  return records.reduce((stats, page) => {
    stats.processedPages += 1;
    stats.words += Number(page?.words) || 0;
    stats.characters += Number(page?.characters) || 0;
    stats.charactersWithoutSpaces += Number(page?.charactersWithoutSpaces) || 0;

    if (page?.source === "ocr") stats.ocrPages += 1;
    else if (page?.source === "hybrid") stats.hybridPages += 1;
    else if (page?.source === "native") stats.nativePages += 1;
    else stats.emptyPages += 1;

    return stats;
  }, {
    requestedPages: Number(requestedPages) || 0,
    processedPages: 0,
    nativePages: 0,
    ocrPages: 0,
    hybridPages: 0,
    emptyPages: 0,
    words: 0,
    characters: 0,
    charactersWithoutSpaces: 0,
  });
}

export function buildExportDocument({
  sourceName = "documento.pdf",
  totalPages = 0,
  exportedPages = [],
  textMode = "native",
  readingOrder = "native",
  pages = [],
  elapsedMs = 0,
} = {}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    document: {
      sourceName,
      totalPages: Number(totalPages) || 0,
      exportedPages: [...exportedPages],
    },
    options: {
      textMode,
      readingOrder,
    },
    pages: [...pages],
    statistics: {
      ...calculateExportStatistics(pages, exportedPages.length),
      elapsedMs: Math.max(0, Math.round(Number(elapsedMs) || 0)),
    },
  };
}

export function safeBaseName(fileName = "documento.pdf") {
  const withoutExtension = String(fileName).replace(/\.[^.]+$/u, "");
  const safe = withoutExtension
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/gu, "")
    .trim();

  return safe || "documento";
}




function ocrWordBox(word = {}) {
  const box = word.bbox || word.box || word.boundingBox || {};
  const x0 = Number(box.x0 ?? box.left ?? word.x0 ?? word.left);
  const y0 = Number(box.y0 ?? box.top ?? word.y0 ?? word.top);
  const x1 = Number(box.x1 ?? box.right ?? word.x1 ?? word.right);
  const y1 = Number(box.y1 ?? box.bottom ?? word.y1 ?? word.bottom);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

export function ocrRecordToLayout(record = {}, pageWidth = 0, pageHeight = 0) {
  return pageModelToLegacyLayout(buildNormalizedPageModel({
    width: Math.max(1, Number(pageWidth) || Number(record?.imageWidth) || 595.28),
    height: Math.max(1, Number(pageHeight) || Number(record?.imageHeight) || 841.89),
    source: "ocr",
    ocrRecord: record,
  }));
}
export function textItemsToLayout(items = [], styles = {}, pageWidth = 0, pageHeight = 0) {
  return pageModelToLegacyLayout(buildNormalizedPageModel({
    width: Math.max(1, Number(pageWidth) || 595.28),
    height: Math.max(1, Number(pageHeight) || 841.89),
    source: "native",
    nativeItems: items,
    nativeStyles: enrichPdfTextStyles(styles),
  }));
}
