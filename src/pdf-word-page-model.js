/**
 * PDFPrivado Pro - modelo normalizado de página para PDF -> Word.
 *
 * Este módulo no genera DOCX. Su única responsabilidad es convertir la
 * geometría nativa/OCR y las métricas gráficas de una página a un modelo
 * estable, independiente del documento concreto. El generador Word debe
 * consumir este modelo en lugar de trabajar directamente con PDF.js/OCR.
 */

const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function overlap1d(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function overlapRatioX(a, b) {
  const overlap = overlap1d(a.x, a.x + a.width, b.x, b.x + b.width);
  return overlap / Math.max(EPSILON, Math.min(a.width, b.width));
}

function unionBounds(items = []) {
  if (!items.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x0 = Math.min(...items.map((item) => item.x));
  const y0 = Math.min(...items.map((item) => item.y));
  const x1 = Math.max(...items.map((item) => item.x + item.width));
  const y1 = Math.max(...items.map((item) => item.y + item.height));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

function fontFlags(fontName = "", fontFamily = "") {
  const descriptor = `${fontName} ${fontFamily}`;
  return {
    bold: /bold|black|semibold|demi|heavy/iu.test(descriptor),
    italic: /italic|oblique/iu.test(descriptor),
  };
}

function normalizedFontDescriptor(value = "") {
  return String(value)
    .replace(/^[A-Z]{6}\+/u, "")
    .replace(/[,_-]+/gu, " ")
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
    .replace(/\s+/gu, " ")
    .trim();
}

export function enrichPdfTextStyles(styles = {}, resolvedFonts = {}) {
  const enriched = {};
  for (const [fontName, rawStyle] of Object.entries(styles || {})) {
    const style = rawStyle && typeof rawStyle === "object" ? rawStyle : {};
    const resolved = resolvedFonts?.[fontName] && typeof resolvedFonts[fontName] === "object"
      ? resolvedFonts[fontName]
      : {};
    const resolvedName = normalizedFontDescriptor(
      resolved.resolvedName ||
      resolved.name ||
      resolved.loadedName ||
      style.resolvedName ||
      style.fontFamily ||
      fontName
    );
    const family = normalizedFontDescriptor(
      resolved.family ||
      resolved.fontFamily ||
      style.fontFamily ||
      resolvedName
    );
    const flags = fontFlags(
      `${fontName} ${resolvedName} ${resolved.weight || ""}`,
      `${family} ${resolved.style || ""}`
    );
    enriched[fontName] = {
      ...style,
      ...resolved,
      resolvedName,
      fontFamily: family,
      bold: Boolean(resolved.bold ?? style.bold ?? flags.bold),
      italic: Boolean(resolved.italic ?? style.italic ?? flags.italic),
      ascent: finite(resolved.ascent, finite(style.ascent, null)),
      descent: finite(resolved.descent, finite(style.descent, null)),
    };
  }
  for (const [fontName, resolved] of Object.entries(resolvedFonts || {})) {
    if (enriched[fontName]) continue;
    const value = resolved && typeof resolved === "object" ? resolved : {};
    const resolvedName = normalizedFontDescriptor(value.resolvedName || value.name || fontName);
    const family = normalizedFontDescriptor(value.family || value.fontFamily || resolvedName);
    const flags = fontFlags(`${fontName} ${resolvedName} ${value.weight || ""}`, family);
    enriched[fontName] = {
      ...value,
      resolvedName,
      fontFamily: family,
      bold: Boolean(value.bold ?? flags.bold),
      italic: Boolean(value.italic ?? flags.italic),
      ascent: finite(value.ascent, null),
      descent: finite(value.descent, null),
    };
  }
  return enriched;
}

export function normalizeNativeTextItems(items = [], styles = {}, page = {}) {
  const pageWidth = Math.max(1, finite(page.width, 595.28));
  const pageHeight = Math.max(1, finite(page.height, 841.89));
  const normalized = [];

  for (const [index, item] of items.entries()) {
    const text = String(item?.str ?? "").replace(/\u0000/gu, "");
    if (!text.trim()) continue;

    const transform = Array.isArray(item?.transform) && item.transform.length >= 6
      ? item.transform.map((value) => finite(value))
      : [1, 0, 0, 1, 0, 0];
    const fontSize = Math.max(
      1,
      Math.hypot(transform[2], transform[3]) ||
      Math.hypot(transform[0], transform[1]) ||
      finite(item?.height, 10)
    );
    const x = finite(transform[4]);
    const baselinePdfY = finite(transform[5]);
    const itemHeight = Math.max(1, finite(item?.height, fontSize));
    const width = Math.max(0.1, finite(item?.width, text.length * fontSize * 0.45));
    const top = pageHeight - baselinePdfY - Math.max(itemHeight, fontSize * 0.82);
    const fontName = String(item?.fontName || "");
    const style = styles?.[fontName] || {};
    const resolvedName = normalizedFontDescriptor(style?.resolvedName || style?.fontFamily || fontName);
    const family = normalizedFontDescriptor(style?.fontFamily || resolvedName);
    const flags = fontFlags(`${fontName} ${resolvedName}`, family);

    normalized.push({
      id: `n${index}`,
      source: "native",
      text,
      x: clamp(x, -pageWidth, pageWidth * 2),
      y: clamp(top, -pageHeight, pageHeight * 2),
      width,
      height: Math.max(itemHeight, fontSize),
      baseline: pageHeight - baselinePdfY,
      fontSize,
      fontName,
      resolvedFontName: resolvedName,
      fontFamily: family,
      bold: Boolean(style?.bold ?? flags.bold),
      italic: Boolean(style?.italic ?? flags.italic),
      ascent: finite(style?.ascent, null),
      descent: finite(style?.descent, null),
      color: String(item?.color || style?.color || ""),
      dir: String(item?.dir || "ltr"),
      hasEOL: Boolean(item?.hasEOL),
      rawIndex: index,
    });
  }

  return normalized;
}

function collectOcrWords(record) {
  if (Array.isArray(record?.words) && record.words.length) return record.words;
  const words = [];
  for (const block of record?.blocks || []) {
    for (const paragraph of block?.paragraphs || []) {
      for (const line of paragraph?.lines || []) {
        for (const word of line?.words || []) words.push(word);
      }
    }
  }
  return words;
}

export function normalizeOcrWords(record, page = {}) {
  const pageWidth = Math.max(1, finite(page.width, 595.28));
  const pageHeight = Math.max(1, finite(page.height, 841.89));
  const imageWidth = Math.max(1, finite(
    record?.pageImageWidth ?? record?.sourceImageWidth ?? record?.imageWidth,
    pageWidth
  ));
  const imageHeight = Math.max(1, finite(
    record?.pageImageHeight ?? record?.sourceImageHeight ?? record?.imageHeight,
    pageHeight
  ));
  const cropX = Math.max(0, finite(record?.cropX));
  const cropY = Math.max(0, finite(record?.cropY));
  const sx = pageWidth / imageWidth;
  const sy = pageHeight / imageHeight;

  return collectOcrWords(record).map((word, index) => {
    const bbox = word?.bbox || word?.boundingBox || {};
    const x0 = finite(bbox.x0 ?? bbox.left) + cropX;
    const y0 = finite(bbox.y0 ?? bbox.top) + cropY;
    const x1 = finite(bbox.x1 ?? bbox.right, x0 + 1 - cropX) + cropX;
    const y1 = finite(bbox.y1 ?? bbox.bottom, y0 + 1 - cropY) + cropY;
    const height = Math.max(1, (y1 - y0) * sy);
    return {
      id: `o${index}`,
      source: "ocr",
      text: String(word?.text ?? word?.str ?? "").replace(/\u0000/gu, ""),
      x: x0 * sx,
      y: y0 * sy,
      width: Math.max(0.1, (x1 - x0) * sx),
      height,
      baseline: y1 * sy,
      // La altura de tinta es solo una estimación inicial. El generador DOCX
      // recupera después el cuerpo real mediante el ancho medido de la línea,
      // que resulta mucho más estable entre resoluciones y motores OCR.
      fontSize: Math.max(4, height * 0.82),
      fontName: "",
      fontFamily: "",
      bold: false,
      italic: false,
      dir: "ltr",
      confidence: finite(word?.confidence, finite(word?.conf, null)),
      rawIndex: index,
    };
  }).filter((item) => item.text.trim());
}

export function normalizeAlreadyPositionedItems(items = []) {
  return items.map((item, index) => ({
    id: String(item?.id || `p${index}`),
    source: String(item?.source || "native"),
    text: String(item?.text ?? item?.str ?? ""),
    x: finite(item?.x),
    y: finite(item?.y),
    width: Math.max(0.1, finite(item?.width, 1)),
    height: Math.max(1, finite(item?.height, finite(item?.fontSize, 10))),
    baseline: finite(item?.baseline, finite(item?.y) + finite(item?.height, 10)),
    fontSize: Math.max(1, finite(item?.fontSize, finite(item?.height, 10))),
    fontName: String(item?.fontName || ""),
    resolvedFontName: String(item?.resolvedFontName || item?.fontName || ""),
    fontFamily: String(item?.fontFamily || ""),
    bold: Boolean(item?.bold),
    italic: Boolean(item?.italic),
    ascent: Number.isFinite(Number(item?.ascent)) ? Number(item.ascent) : null,
    descent: Number.isFinite(Number(item?.descent)) ? Number(item.descent) : null,
    color: String(item?.color || ""),
    dir: String(item?.dir || "ltr"),
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    rawIndex: index,
  })).filter((item) => item.text.trim());
}

function areSameLine(a, b) {
  const size = Math.max(4, Math.min(a.fontSize || a.height, b.fontSize || b.height));
  const baselineDelta = Math.abs(a.baseline - b.baseline);
  const centerDelta = Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
  return baselineDelta <= Math.max(1.6, size * 0.38) || centerDelta <= Math.max(1.8, size * 0.42);
}

function appendTextWithSpacing(parts, item) {
  if (!parts.length) return item.text;
  const previous = parts[parts.length - 1];
  const previousEnd = previous.x + previous.width;
  const gap = item.x - previousEnd;
  const typicalSpace = Math.max(1.3, ((previous.fontSize + item.fontSize) / 2) * 0.24);
  return `${gap > typicalSpace ? " " : ""}${item.text}`;
}

export function groupItemsIntoLines(items = []) {
  const sorted = [...items].sort((a, b) => (a.baseline - b.baseline) || (a.x - b.x));
  const lines = [];

  for (const item of sorted) {
    let best = null;
    let bestDistance = Infinity;
    for (const line of lines) {
      const representative = line.items[0];
      if (!areSameLine(representative, item)) continue;
      const distance = Math.abs(line.baseline - item.baseline);
      if (distance < bestDistance) {
        best = line;
        bestDistance = distance;
      }
    }
    if (!best) {
      best = { items: [], baseline: item.baseline };
      lines.push(best);
    }
    best.items.push(item);
    best.baseline = median(best.items.map((entry) => entry.baseline));
  }

  return lines
    .map((line, index) => {
      line.items.sort((a, b) => a.x - b.x);
      let text = "";
      for (const item of line.items) text += appendTextWithSpacing(line.items.slice(0, line.items.indexOf(item)), item);
      // indexOf in the loop above is safe but wasteful; rebuild robustly below.
      text = line.items.map((item, i) => {
        if (!i) return item.text;
        const previous = line.items[i - 1];
        const gap = item.x - (previous.x + previous.width);
        const typicalSpace = Math.max(1.3, ((previous.fontSize + item.fontSize) / 2) * 0.24);
        return `${gap > typicalSpace ? " " : ""}${item.text}`;
      }).join("");
      const bounds = unionBounds(line.items);
      const sizes = line.items.map((item) => item.fontSize);
      const totalChars = line.items.reduce((sum, item) => sum + item.text.length, 0);
      const boldChars = line.items.reduce((sum, item) => sum + (item.bold ? item.text.length : 0), 0);
      const italicChars = line.items.reduce((sum, item) => sum + (item.italic ? item.text.length : 0), 0);
      const confidenceEntries = line.items
        .map((item) => ({
          value: Number(item?.confidence),
          weight: Math.max(1, String(item?.text || "").replace(/\s+/gu, "").length),
        }))
        .filter((entry) => Number.isFinite(entry.value));
      const confidenceWeight = confidenceEntries.reduce((sum, entry) => sum + entry.weight, 0);
      const confidence = confidenceWeight
        ? confidenceEntries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / confidenceWeight
        : null;
      const primary = line.items[0] || {};
      return {
        id: `l${index}`,
        text: text.trim(),
        items: line.items,
        ...bounds,
        baseline: line.baseline,
        fontSize: median(sizes),
        source: primary.source || "native",
        fontName: primary.fontName || "",
        resolvedFontName: primary.resolvedFontName || "",
        fontFamily: primary.fontFamily || "",
        ascent: Number.isFinite(primary.ascent) ? primary.ascent : null,
        descent: Number.isFinite(primary.descent) ? primary.descent : null,
        color: primary.color || "",
        confidence,
        boldRatio: totalChars ? boldChars / totalChars : 0,
        italicRatio: totalChars ? italicChars / totalChars : 0,
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

function lineStartsList(line) {
  return /^\s*(?:[•·▪◦✓✔✗×!]|[-–—]\s|\(?\d+[.)]\s|[A-Za-z][.)]\s)/u.test(line.text);
}

function verticalGap(a, b) {
  return b.y - (a.y + a.height);
}

function sameTextColumn(a, b) {
  const overlap = overlapRatioX(a, b);
  const leftDelta = Math.abs(a.x - b.x);
  const typical = Math.max(6, Math.min(a.fontSize, b.fontSize) * 1.8);
  return overlap >= 0.32 || leftDelta <= typical;
}

export function groupLinesIntoBlocks(lines = [], page = {}) {
  const pageWidth = Math.max(1, finite(page.width, 595.28));
  const sorted = [...lines].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const blocks = [];

  for (const line of sorted) {
    const candidate = [...blocks].reverse().find((block) => {
      const previous = block.lines[block.lines.length - 1];
      const gap = verticalGap(previous, line);
      const lineHeight = median([previous.height, line.height, previous.fontSize, line.fontSize]);
      const maxGap = Math.max(3, lineHeight * (lineStartsList(line) ? 1.25 : 0.9));
      return gap >= -lineHeight * 0.35 && gap <= maxGap && sameTextColumn(previous, line);
    });

    if (!candidate) {
      blocks.push({ lines: [line] });
    } else {
      candidate.lines.push(line);
    }
  }

  return blocks.map((block, index) => {
    const bounds = unionBounds(block.lines);
    const sizes = block.lines.map((line) => line.fontSize);
    const text = block.lines.map((line) => line.text).join("\n");
    const listLines = block.lines.filter(lineStartsList).length;
    const center = bounds.x + bounds.width / 2;
    return {
      id: `b${index}`,
      lines: block.lines,
      text,
      ...bounds,
      fontSize: median(sizes),
      listRatio: block.lines.length ? listLines / block.lines.length : 0,
      centerX: center,
      relativeX: bounds.x / pageWidth,
      relativeWidth: bounds.width / pageWidth,
    };
  }).sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

function clusterColumns(blocks, pageWidth) {
  if (!blocks.length) return [];
  const centers = blocks
    .filter((block) => block.width < pageWidth * 0.78)
    .map((block) => block.centerX)
    .sort((a, b) => a - b);
  if (centers.length < 2) return [{ center: pageWidth / 2, count: blocks.length }];

  const clusters = [];
  const tolerance = pageWidth * 0.12;
  for (const center of centers) {
    const cluster = clusters.find((entry) => Math.abs(entry.center - center) <= tolerance);
    if (cluster) {
      cluster.values.push(center);
      cluster.center = cluster.values.reduce((sum, value) => sum + value, 0) / cluster.values.length;
    } else {
      clusters.push({ center, values: [center] });
    }
  }
  return clusters
    .map((cluster) => ({ center: cluster.center, count: cluster.values.length }))
    .filter((cluster) => cluster.count >= 2)
    .sort((a, b) => a.center - b.center);
}

function rowAlignmentScore(lines, pageWidth) {
  if (lines.length < 4) return 0;
  const groups = [];
  for (const line of lines) {
    const row = groups.find((candidate) => Math.abs(candidate.y - line.y) <= Math.max(3, line.height * 0.65));
    if (row) row.lines.push(line);
    else groups.push({ y: line.y, lines: [line] });
  }
  const multi = groups.filter((row) => row.lines.length >= 2);
  const aligned = multi.filter((row) => {
    const sorted = [...row.lines].sort((a, b) => a.x - b.x);
    const gaps = sorted.slice(1).map((line, i) => line.x - (sorted[i].x + sorted[i].width));
    return gaps.some((gap) => gap > pageWidth * 0.035);
  });
  return groups.length ? aligned.length / groups.length : 0;
}

function inferBlockRole(block, medianFont, page) {
  const upper = block.text.toLocaleUpperCase();
  const fontRatio = medianFont ? block.fontSize / medianFont : 1;
  if (fontRatio >= 1.45 || (fontRatio >= 1.2 && block.lines.some((line) => line.boldRatio > 0.65))) return "heading";
  if (block.listRatio >= 0.35) return "list";
  if (/^(PÁGINA|PAGE)\s+\d+/iu.test(block.text.trim()) && block.y > page.height * 0.8) return "footer";
  if (/^(SOLICITUD|REF\.|DATOS|RESUMEN|INFORMACIÓN|SEGURO\b)/iu.test(upper) && block.lines.length <= 3) return "label";
  return "paragraph";
}

export function classifyPageModel({
  page,
  source = "native",
  items = [],
  lines = [],
  blocks = [],
  graphics = {},
} = {}) {
  const width = Math.max(1, finite(page?.width, 595.28));
  const height = Math.max(1, finite(page?.height, 841.89));
  const area = width * height;
  const textBounds = unionBounds(items);
  const textArea = Math.min(area, Math.max(0, textBounds.width * textBounds.height));
  const textCoverage = textArea / area;
  const columns = clusterColumns(blocks, width);
  const rowScore = rowAlignmentScore(lines, width);
  const vectorOperations = Math.max(0, finite(graphics?.vectorOperations ?? graphics?.drawingCount));
  const imageOperations = Math.max(0, finite(graphics?.imageOperations ?? graphics?.imageCount));
  const graphicCoverage = clamp(Math.max(
    finite(graphics?.coverageRatio ?? graphics?.graphicCoverage),
    finite(graphics?.imageCoverageRatio)
  ), 0, 1);
  const horizontalRules = Math.max(0, finite(graphics?.horizontalRules));
  const verticalRules = Math.max(0, finite(graphics?.verticalRules));
  const filledRects = Math.max(0, finite(graphics?.filledRects));
  const textChars = items.reduce((sum, item) => sum + item.text.length, 0);
  const medianFont = median(items.map((item) => item.fontSize));
  const largeText = items.filter((item) => item.fontSize >= Math.max(12, medianFont * 1.45)).length;
  const ruleScore = Math.min(1, (horizontalRules + verticalRules) / 12);
  const gridScore = Math.max(rowScore, Math.min(1, ruleScore * 0.7 + rowScore * 0.6));
  const graphicComplexity = Math.min(1, graphicCoverage * 1.55 + Math.min(0.40, vectorOperations / 120) + Math.min(0.22, filledRects / 12) + Math.min(0.18, imageOperations / 4));

  let kind = "mixed";
  const reasons = [];

  if (textChars < 24 && graphicCoverage >= 0.45) {
    kind = "scan";
    reasons.push("imagen-dominante-con-texto-nativo-escaso");
  } else if ((!items.length || textChars < 8) && source === "ocr") {
    kind = "scan";
    reasons.push("ocr-sin-texto-nativo");
  } else if ((!items.length || textChars < 8) && (imageOperations > 0 || graphicCoverage > 0.45)) {
    kind = "scan";
    reasons.push("pagina-raster-o-sin-texto");
  } else if (gridScore >= 0.34 && (horizontalRules >= 3 || verticalRules >= 2 || rowScore >= 0.42)) {
    kind = "table-form";
    reasons.push("alineaciones-repetidas", "reglas-o-columnas-tabulares");
  } else if (
    graphicComplexity >= 0.28 &&
    (columns.length >= 2 || filledRects >= 2 || largeText >= 2) &&
    textChars >= 40
  ) {
    kind = "infographic";
    reasons.push("graficos-significativos", "regiones-independientes");
  } else if (graphicComplexity < 0.22 && columns.length <= 1 && rowScore < 0.25) {
    kind = "text";
    reasons.push("flujo-textual-dominante");
  } else {
    reasons.push("composicion-mixta");
  }

  return {
    kind,
    reasons,
    metrics: {
      textChars,
      itemCount: items.length,
      lineCount: lines.length,
      blockCount: blocks.length,
      columnCount: columns.length,
      columns,
      textCoverage,
      graphicCoverage,
      graphicComplexity,
      vectorOperations,
      imageOperations,
      filledRects,
      horizontalRules,
      verticalRules,
      rowAlignmentScore: rowScore,
      gridScore,
      medianFontSize: medianFont,
      largeTextItems: largeText,
    },
  };
}

export function buildNormalizedPageModel({
  pageNumber = 1,
  width = 595.28,
  height = 841.89,
  rotation = 0,
  source = "native",
  nativeItems = null,
  nativeStyles = {},
  ocrRecord = null,
  normalizedItems = null,
  graphics = {},
} = {}) {
  const page = {
    pageNumber: Math.max(1, Math.trunc(finite(pageNumber, 1))),
    width: Math.max(1, finite(width, 595.28)),
    height: Math.max(1, finite(height, 841.89)),
    rotation: finite(rotation, 0),
  };

  let items = [];
  if (Array.isArray(normalizedItems)) {
    items = normalizeAlreadyPositionedItems(normalizedItems);
  } else if (source === "ocr" && ocrRecord) {
    items = normalizeOcrWords(ocrRecord, page);
  } else {
    items = normalizeNativeTextItems(nativeItems || [], nativeStyles || {}, page);
  }

  const lines = groupItemsIntoLines(items);
  const blocks = groupLinesIntoBlocks(lines, page);
  const medianFont = median(items.map((item) => item.fontSize));
  const enrichedBlocks = blocks.map((block) => ({
    ...block,
    role: inferBlockRole(block, medianFont, page),
  }));
  const classification = classifyPageModel({
    page,
    source,
    items,
    lines,
    blocks: enrichedBlocks,
    graphics,
  });

  return {
    schemaVersion: 2,
    page,
    source,
    classification,
    graphics: {
      coverageRatio: clamp(Math.max(
        finite(graphics?.coverageRatio ?? graphics?.graphicCoverage),
        finite(graphics?.imageCoverageRatio)
      ), 0, 1),
      imageCoverageRatio: clamp(graphics?.imageCoverageRatio ?? 0, 0, 1),
      vectorOperations: Math.max(0, finite(graphics?.vectorOperations ?? graphics?.drawingCount)),
      imageOperations: Math.max(0, finite(graphics?.imageOperations ?? graphics?.imageCount)),
      filledRects: Math.max(0, finite(graphics?.filledRects)),
      horizontalRules: Math.max(0, finite(graphics?.horizontalRules)),
      verticalRules: Math.max(0, finite(graphics?.verticalRules)),
    },
    items,
    lines,
    blocks: enrichedBlocks,
  };
}

export function validateNormalizedPageModel(model) {
  const errors = [];
  const warnings = [];
  const width = finite(model?.page?.width);
  const height = finite(model?.page?.height);
  if (!(width > 0 && height > 0)) errors.push("dimensiones-de-pagina-invalidas");
  if (!Array.isArray(model?.items)) errors.push("items-no-array");
  if (!Array.isArray(model?.lines)) errors.push("lines-no-array");
  if (!Array.isArray(model?.blocks)) errors.push("blocks-no-array");
  if (!model?.classification?.kind) errors.push("clasificacion-ausente");

  for (const item of model?.items || []) {
    if (![item.x, item.y, item.width, item.height, item.fontSize].every(Number.isFinite)) {
      errors.push(`geometria-invalida:${item.id}`);
      continue;
    }
    if (item.width <= 0 || item.height <= 0 || item.fontSize <= 0) {
      errors.push(`tamano-invalido:${item.id}`);
    }
    if (item.x + item.width < -2 || item.x > width + 2 || item.y + item.height < -2 || item.y > height + 2) {
      warnings.push(`fuera-de-pagina:${item.id}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function robustPositiveMedian(values = []) {
  const positive = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!positive.length) return 0;
  const middle = Math.floor(positive.length / 2);
  return positive.length % 2
    ? positive[middle]
    : (positive[middle - 1] + positive[middle]) / 2;
}

export function deriveLineSegments(line, { pageMedianFont = null } = {}) {
  const items = Array.isArray(line?.items)
    ? [...line.items].filter((item) => String(item?.text || "").trim()).sort((a, b) => a.x - b.x)
    : [];
  if (!items.length) return [];

  const gaps = items.slice(1).map((item, index) =>
    item.x - (items[index].x + items[index].width)
  );
  const positiveGaps = gaps.filter((gap) => Number.isFinite(gap) && gap > 0);
  const observedSpace = robustPositiveMedian(
    positiveGaps.filter((gap) => gap <= Math.max(12, (Number(line?.fontSize) || 8) * 1.8))
  );
  const lineFont = Math.max(4, Number(line?.fontSize) || Number(pageMedianFont) || 8);
  const medianFont = Math.max(4, Number(pageMedianFont) || lineFont);
  const expectedSpace = Math.max(1.1, observedSpace || lineFont * 0.28);
  const splitThreshold = Math.max(
    7.5,
    lineFont * 3.7,
    medianFont * 1.18,
    expectedSpace * 3.1
  );

  const groups = [];
  for (const [index, item] of items.entries()) {
    const previousItem = index ? items[index - 1] : null;
    const gap = previousItem ? item.x - (previousItem.x + previousItem.width) : 0;
    const shouldSplit = Boolean(previousItem) && gap >= splitThreshold;
    if (!groups.length || shouldSplit) {
      groups.push({ x: item.x, width: item.width, items: [item] });
    } else {
      const group = groups.at(-1);
      group.items.push(item);
      group.width = Math.max(group.width, item.x + item.width - group.x);
    }
  }

  return groups.map((group) => ({
    text: group.items.map((item, index) => {
      if (!index) return item.text;
      const previous = group.items[index - 1];
      const gap = item.x - (previous.x + previous.width);
      return `${gap > Math.max(1.0, expectedSpace * 0.58) ? " " : ""}${item.text}`;
    }).join("").replace(/\s+/gu, " ").trim(),
    x: group.x,
    width: group.width,
  })).filter((segment) => segment.text);
}

function lineStyledRuns(line) {
  return (line?.items || []).map((item) => ({
    text: item.text,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fontSize: item.fontSize,
    fontName: item.fontName,
    resolvedFontName: item.resolvedFontName,
    fontFamily: item.fontFamily,
    bold: item.bold,
    italic: item.italic,
    color: item.color,
    confidence: item.confidence,
  }));
}

export function pageModelToLegacyLayout(model) {
  const pageHeight = Math.max(1, finite(model?.page?.height, 841.89));
  const pageWidth = Math.max(1, finite(model?.page?.width, 595.28));
  const allSizes = (model?.lines || []).map((line) => line.fontSize).filter(Number.isFinite);
  const medianFont = median(allSizes) || 10;
  return (model?.lines || []).map((line) => {
    const primary = line.items?.[0] || {};
    const lineSource = String(line?.source || primary.source || model?.source || "native");
    const yPdf = pageHeight - finite(line.baseline, line.y + line.height);
    const segments = deriveLineSegments(line, { pageMedianFont: medianFont });
    const containingBlock = (model?.blocks || []).find((block) =>
      block.lines?.some((candidate) => candidate.id === line.id)
    );
    const centered = Math.abs(
      (line.x + line.width / 2) - pageWidth / 2
    ) < pageWidth * 0.08;
    return {
      text: line.text,
      x: line.x,
      y: yPdf,
      width: line.width,
      height: line.height,
      fontSize: line.fontSize,
      source: lineSource,
      ocrTop: lineSource === "ocr" ? line.y : null,
      ocrBottom: lineSource === "ocr" ? line.y + line.height : null,
      // `line.baseline` es la mediana robusta de los fondos de palabra OCR.
      // El extremo inferior de la caja unión puede quedar arrastrado varios
      // puntos por una única g/y/p, un sello o ruido. Conservar esta referencia
      // permite al generador Word alinear la línea a una señal de baseline
      // mucho más estable sin perder la caja completa para clipping/gráficos.
      ocrBaselineHint: lineSource === "ocr" ? finite(line.baseline, null) : null,
      fontName: primary.fontName || "",
      resolvedFontName: primary.resolvedFontName || "",
      fontFamily: primary.fontFamily || "",
      bold: line.boldRatio >= 0.5,
      italic: line.italicRatio >= 0.5,
      color: primary.color || "",
      confidence: Number.isFinite(Number(line.confidence)) ? Number(line.confidence) : null,
      kind: containingBlock?.role || "paragraph",
      centered,
      rtl: primary.dir === "rtl",
      segments,
      styledRuns: lineStyledRuns(line),
    };
  });
}

export const buildNormalizedPdfWordPageModel = buildNormalizedPageModel;
export const validateNormalizedPdfWordPageModel = validateNormalizedPageModel;
