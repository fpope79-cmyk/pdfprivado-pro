/* PDFPRIVADO_PAGE_NUMBERING_CORE_V1 */
export const PAGE_POSITIONS = Object.freeze({
  "top-left": { vertical: "top", horizontal: "left" },
  "top-center": { vertical: "top", horizontal: "center" },
  "top-right": { vertical: "top", horizontal: "right" },
  "bottom-left": { vertical: "bottom", horizontal: "left" },
  "bottom-center": { vertical: "bottom", horizontal: "center" },
  "bottom-right": { vertical: "bottom", horizontal: "right" },
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function parseHexColor(value, fallback = "#334155") {
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

export function selectedPagesForMode(mode, pageCount, expression = "", manual = new Set()) {
  const total = Math.max(0, Number(pageCount) || 0);
  if (mode === "range") return parsePageExpression(expression, total);
  if (mode === "even") return new Set(Array.from({ length: total }, (_, index) => index + 1).filter((page) => page % 2 === 0));
  if (mode === "odd") return new Set(Array.from({ length: total }, (_, index) => index + 1).filter((page) => page % 2 === 1));
  if (mode === "manual") return new Set([...manual].filter((page) => page >= 1 && page <= total));
  return new Set(Array.from({ length: total }, (_, index) => index + 1));
}

export function numberingValueForPage(pageNumber, options) {
  const restartPage = Math.max(1, Number(options.restartPage) || 1);
  const initialNumber = Number(options.initialNumber) || 1;
  return initialNumber + Math.max(0, pageNumber - restartPage);
}

export function toRoman(value) {
  let number = Math.max(1, Math.floor(Number(value) || 1));
  const parts = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [amount, symbol] of parts) {
    while (number >= amount) {
      result += symbol;
      number -= amount;
    }
  }
  return result;
}

export function toAlphabetic(value) {
  let number = Math.max(1, Math.floor(Number(value) || 1));
  let result = "";
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + (number % 26)) + result;
    number = Math.floor(number / 26);
  }
  return result;
}

export function sequenceValue(value, options = {}) {
  const format = options.format || "number";
  const digits = Math.max(1, Number(options.digits) || 1);
  if (format === "padded") return String(value).padStart(digits, "0");
  if (format === "roman-upper") return toRoman(value);
  if (format === "roman-lower") return toRoman(value).toLowerCase();
  if (format === "alpha-upper") return toAlphabetic(value);
  if (format === "alpha-lower") return toAlphabetic(value).toLowerCase();
  return String(value);
}

export function templateVariables(pageNumber, totalPages, options = {}) {
  const value = numberingValueForPage(pageNumber, options);
  const number = sequenceValue(value, options);
  const now = options.now instanceof Date ? options.now : new Date();
  const fileName = String(options.fileName || "Documento.pdf").replace(/\.pdf$/i, "");
  return {
    numero: number,
    total: String(totalPages),
    pagina: String(pageNumber),
    nombre: fileName,
    fecha: now.toLocaleDateString("es-ES"),
    hora: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function applyTemplate(template, variables) {
  return String(template || "").replace(
    /\{(numero|total|pagina|nombre|fecha|hora)\}/g,
    (_, key) => variables[key] ?? ""
  );
}

export function formatPageLabel(pageNumber, totalPages, options) {
  const variables = templateVariables(pageNumber, totalPages, options);
  let body = variables.numero;
  if (options.format === "page") body = `Página ${variables.numero}`;
  if (options.format === "page-total") body = `Página ${variables.numero} de ${totalPages}`;
  if (options.format === "custom-template") {
    body = applyTemplate(options.template || "{numero}", variables);
  }
  const prefix = applyTemplate(options.prefix || "", variables);
  const suffix = applyTemplate(options.suffix || "", variables);
  return `${prefix}${body}${suffix}`;
}

export function resolvePlacement(page, textWidth, textHeight, options) {
  const { width, height } = page.getSize();
  const marginX = clamp(options.marginX, 0, Math.max(0, width / 2));
  const marginY = clamp(options.marginY, 0, Math.max(0, height / 2));
  const position = PAGE_POSITIONS[options.position] || PAGE_POSITIONS["bottom-center"];

  let x = marginX;
  if (position.horizontal === "center") x = (width - textWidth) / 2;
  if (position.horizontal === "right") x = width - marginX - textWidth;

  let y = marginY;
  if (position.vertical === "top") y = height - marginY - textHeight;

  const maxX = Math.max(0, width - textWidth);
  const maxY = Math.max(0, height - textHeight);

  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
    width,
    height,
  };
}

export async function applyPageNumbering(sourceBytes, options) {
  if (!window.PDFLib?.PDFDocument) throw new Error("El motor PDF local no está disponible.");
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false, updateMetadata: false });
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  const selected = selectedPagesForMode(options.pageMode, pages.length, options.pageExpression, options.manualPages);
  const textColor = parseHexColor(options.color);
  const backgroundColor = parseHexColor(options.backgroundColor, "#ffffff");
  const font = options.bold ? bold : regular;
  const fontSize = clamp(options.fontSize, 6, 72);
  const opacity = clamp(options.opacity, 0.05, 1);
  let applied = 0;

  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    if (!selected.has(pageNumber)) continue;
    if (options.skipCover && pageNumber === 1) continue;
    if (pageNumber < Math.max(1, Number(options.restartPage) || 1)) continue;

    const label = formatPageLabel(pageNumber, pages.length, options);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const textHeight = font.heightAtSize(fontSize, { descender: false });
    const placement = resolvePlacement(page, textWidth, textHeight, options);
    const padX = clamp(options.paddingX, 0, 40);
    const padY = clamp(options.paddingY, 0, 30);

    if (options.background) {
      page.drawRectangle({
        x: Math.max(0, placement.x - padX),
        y: Math.max(0, placement.y - padY),
        width: textWidth + padX * 2,
        height: textHeight + padY * 2,
        color: rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b),
        opacity: clamp(options.backgroundOpacity, 0.05, 1),
        borderWidth: options.border ? clamp(options.borderWidth, 0.25, 8) : 0,
        borderColor: rgb(textColor.r, textColor.g, textColor.b),
        borderOpacity: opacity,
      });
    }

    page.drawText(label, {
      x: placement.x,
      y: placement.y,
      size: fontSize,
      font,
      color: rgb(textColor.r, textColor.g, textColor.b),
      opacity,
    });
    applied += 1;
  }

  pdf.setCreator("PDFPrivado Pro");
  pdf.setProducer("PDFPrivado Pro");
  const bytes = await pdf.save({ addDefaultPage: false, useObjectStreams: true });
  return { bytes, pageCount: pages.length, applied, selectedCount: selected.size };
}

export async function verifyNumberedPdf(bytes, expectedPageCount) {
  if (!window.PDFLib?.PDFDocument) throw new Error("El motor PDF local no está disponible.");
  const pdf = await window.PDFLib.PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
  const pageCount = pdf.getPageCount();
  return {
    ok: pageCount === Number(expectedPageCount),
    pageCount,
    byteLength: bytes.byteLength,
  };
}
