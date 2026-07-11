export function normalizeRotation(value) {
  const angle = Number(value) || 0;
  return ((angle % 360) + 360) % 360;
}

export function parsePageExpression(expression, pageCount) {
  const total = Number(pageCount);
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("El documento no contiene páginas válidas.");
  }

  const text = String(expression || "").trim();
  if (!text) {
    throw new Error("Escribe al menos una página o un rango.");
  }

  const pages = new Set();
  const tokens = text.split(/[;,\s]+/).filter(Boolean);

  for (const token of tokens) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let start = Number(range[1]);
      let end = Number(range[2]);
      if (start < 1 || end < 1 || start > total || end > total) {
        throw new Error(`El rango ${token} está fuera de las páginas 1-${total}.`);
      }
      if (start > end) [start, end] = [end, start];
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }

    if (!/^\d+$/.test(token)) {
      throw new Error(`No se reconoce «${token}». Usa formatos como 1-5, 8, 12.`);
    }

    const page = Number(token);
    if (page < 1 || page > total) {
      throw new Error(`La página ${page} está fuera del documento (1-${total}).`);
    }
    pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
}

export function resolvePageScope({ scope, pageCount, currentPage, selectedPages, expression }) {
  const total = Number(pageCount);
  switch (scope) {
    case "current":
      return [Number(currentPage)];
    case "selected": {
      const pages = [...(selectedPages || [])].map(Number).sort((a, b) => a - b);
      if (!pages.length) throw new Error("Selecciona al menos una página en las miniaturas.");
      return pages;
    }
    case "range":
      return parsePageExpression(expression, total);
    case "all":
      return Array.from({ length: total }, (_, index) => index + 1);
    case "odd":
      return Array.from({ length: total }, (_, index) => index + 1).filter((page) => page % 2 === 1);
    case "even":
      return Array.from({ length: total }, (_, index) => index + 1).filter((page) => page % 2 === 0);
    default:
      throw new Error("Elige un ámbito de páginas válido.");
  }
}

export function sanitizePdfName(name, suffix = "editado") {
  const base = String(name || "documento.pdf")
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 110) || "documento";
  return `${base}_${suffix}.pdf`;
}

export function changedRotationPages(rotations) {
  return [...rotations.entries()]
    .filter(([, angle]) => normalizeRotation(angle) !== 0)
    .map(([page]) => Number(page))
    .sort((a, b) => a - b);
}
