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

export function buildPageRecord({
  pageNumber,
  text = "",
  source = "native",
  width = null,
  height = null,
  language = null,
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
    else if (page?.source === "native") stats.nativePages += 1;
    else stats.emptyPages += 1;

    return stats;
  }, {
    requestedPages: Number(requestedPages) || 0,
    processedPages: 0,
    nativePages: 0,
    ocrPages: 0,
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
