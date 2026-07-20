/* PDFPRIVADO_WATERMARK_CORE_V1_1 */
export const WATERMARK_POSITIONS = Object.freeze({
  "top-left": { vertical: "top", horizontal: "left" },
  "top-center": { vertical: "top", horizontal: "center" },
  "top-right": { vertical: "top", horizontal: "right" },
  "middle-left": { vertical: "middle", horizontal: "left" },
  "center": { vertical: "middle", horizontal: "center" },
  "middle-right": { vertical: "middle", horizontal: "right" },
  "bottom-left": { vertical: "bottom", horizontal: "left" },
  "bottom-center": { vertical: "bottom", horizontal: "center" },
  "bottom-right": { vertical: "bottom", horizontal: "right" },
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function parseHexColor(value, fallback = "#64748b") {
  const text = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  return {
    r: parseInt(text.slice(1, 3), 16) / 255,
    g: parseInt(text.slice(3, 5), 16) / 255,
    b: parseInt(text.slice(5, 7), 16) / 255,
  };
}

export function parsePageExpression(expression, pageCount) {
  const result = new Set();
  const max = Math.max(0, Number(pageCount) || 0);
  for (const raw of String(expression || "").split(",")) {
    const token = raw.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let start = Number(range[1]);
      let end = Number(range[2]);
      if (start > end) [start, end] = [end, start];
      for (let page = start; page <= end; page += 1) {
        if (page >= 1 && page <= max) result.add(page);
      }
      continue;
    }
    const page = Number(token);
    if (Number.isInteger(page) && page >= 1 && page <= max) result.add(page);
  }
  return result;
}

export function selectedPagesForMode(mode, pageCount, expression = "") {
  const total = Math.max(0, Number(pageCount) || 0);
  if (mode === "range") return parsePageExpression(expression, total);
  if (mode === "even") return new Set(Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 === 0));
  if (mode === "odd") return new Set(Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 === 1));
  return new Set(Array.from({ length: total }, (_, i) => i + 1));
}

export function rotatedTextBounds(textWidth, textHeight, rotationDegrees) {
  const angle = Number(rotationDegrees || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [0, 0],
    [textWidth, 0],
    [0, textHeight],
    [textWidth, textHeight],
  ].map(([x, y]) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }));

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function resolveWatermarkPlacement(page, textWidth, textHeight, options = {}) {
  const { width, height } = page.getSize();
  const marginX = clamp(options.marginX, 0, width / 2);
  const marginY = clamp(options.marginY, 0, height / 2);
  const position = WATERMARK_POSITIONS[options.position] || WATERMARK_POSITIONS.center;
  const bounds = rotatedTextBounds(textWidth, textHeight, options.rotation);

  const availableWidth = Math.max(0, width - bounds.width);
  const availableHeight = Math.max(0, height - bounds.height);

  let boxX = marginX;
  if (position.horizontal === "center") boxX = availableWidth / 2;
  if (position.horizontal === "right") boxX = width - marginX - bounds.width;

  let boxY = marginY;
  if (position.vertical === "middle") boxY = availableHeight / 2;
  if (position.vertical === "top") boxY = height - marginY - bounds.height;

  boxX = Math.min(availableWidth, Math.max(0, boxX));
  boxY = Math.min(availableHeight, Math.max(0, boxY));

  return {
    x: boxX - bounds.minX,
    y: boxY - bounds.minY,
    boxX,
    boxY,
    boxWidth: bounds.width,
    boxHeight: bounds.height,
    width,
    height,
    bounds,
  };
}

export async function applyTextWatermark(sourceBytes, options = {}) {
  if (!window.PDFLib?.PDFDocument) throw new Error("El motor PDF local no está disponible.");

  const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
  const pdf = await PDFDocument.load(sourceBytes.slice(), {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  const font = await pdf.embedFont(options.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const selected = selectedPagesForMode(options.pageMode, pages.length, options.pageExpression);
  const text = String(options.text || "").trim();
  if (!text) throw new Error("Escribe el texto de la marca de agua.");

  const fontSize = clamp(options.fontSize, 8, 180);
  const opacity = clamp(options.opacity, 0.03, 1);
  const rotation = clamp(options.rotation, -180, 180);
  const color = parseHexColor(options.color);
  let applied = 0;

  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    if (!selected.has(pageNumber)) continue;

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize, { descender: false });
    const placement = resolveWatermarkPlacement(page, textWidth, textHeight, {
      ...options,
      rotation,
    });

    page.drawText(text, {
      x: placement.x,
      y: placement.y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotation),
    });
    applied += 1;
  }

  pdf.setCreator("PDFPrivado Pro");
  pdf.setProducer("PDFPrivado Pro");
  const bytes = await pdf.save({ addDefaultPage: false, useObjectStreams: true });
  return { bytes, pageCount: pages.length, applied, selectedCount: selected.size };
}

export async function verifyWatermarkedPdf(bytes, expectedPageCount) {
  if (!window.PDFLib?.PDFDocument) throw new Error("El motor PDF local no está disponible.");
  const pdf = await window.PDFLib.PDFDocument.load(bytes.slice(), {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const pageCount = pdf.getPageCount();
  return { ok: pageCount === Number(expectedPageCount), pageCount, byteLength: bytes.byteLength };
}
