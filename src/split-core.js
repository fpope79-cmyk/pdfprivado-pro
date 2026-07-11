const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function uniqueSortedPages(values, pageCount) {
  const max = Math.max(0, Number(pageCount) || 0);
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= max))]
    .sort((a, b) => a - b);
}

export function parsePageExpression(expression, pageCount) {
  const max = Math.max(0, Number(pageCount) || 0);
  const source = String(expression ?? "").trim();
  const pages = [];
  const invalidTokens = [];
  const outOfRange = [];

  if (!source) {
    return { pages: [], invalidTokens, outOfRange };
  }

  const tokens = source
    .split(/[;,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const numberMatch = token.match(/^\d+$/);

    if (rangeMatch) {
      let start = Number(rangeMatch[1]);
      let end = Number(rangeMatch[2]);
      const step = start <= end ? 1 : -1;

      for (let page = start; step > 0 ? page <= end : page >= end; page += step) {
        if (page < 1 || page > max) {
          outOfRange.push(page);
        } else {
          pages.push(page);
        }
      }
      continue;
    }

    if (numberMatch) {
      const page = Number(token);
      if (page < 1 || page > max) {
        outOfRange.push(page);
      } else {
        pages.push(page);
      }
      continue;
    }

    invalidTokens.push(token);
  }

  return {
    pages: uniqueSortedPages(pages, max),
    invalidTokens: [...new Set(invalidTokens)],
    outOfRange: [...new Set(outOfRange)].sort((a, b) => a - b),
  };
}

export function parseRangeGroups(text, pageCount) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const groups = [];
  const errors = [];

  lines.forEach((line, index) => {
    const parsed = parsePageExpression(line, pageCount);
    if (parsed.invalidTokens.length || parsed.outOfRange.length || parsed.pages.length === 0) {
      errors.push({ line: index + 1, source: line, ...parsed });
      return;
    }
    groups.push(parsed.pages);
  });

  return { groups, errors };
}

export function allPages(pageCount) {
  return Array.from({ length: Math.max(0, Number(pageCount) || 0) }, (_, index) => index + 1);
}

export function splitEveryN(pageCount, every) {
  const pages = allPages(pageCount);
  const size = Math.max(1, Math.floor(Number(every) || 1));
  const groups = [];
  for (let index = 0; index < pages.length; index += size) {
    groups.push(pages.slice(index, index + size));
  }
  return groups;
}

export function splitBalanced(pageCount, requestedParts) {
  const total = Math.max(0, Number(pageCount) || 0);
  const parts = Math.max(1, Math.min(total || 1, Math.floor(Number(requestedParts) || 1)));
  const baseSize = Math.floor(total / parts);
  const remainder = total % parts;
  const groups = [];
  let cursor = 1;

  for (let index = 0; index < parts; index += 1) {
    const groupSize = baseSize + (index < remainder ? 1 : 0);
    const group = [];
    for (let offset = 0; offset < groupSize; offset += 1) {
      group.push(cursor);
      cursor += 1;
    }
    if (group.length) groups.push(group);
  }

  return groups;
}

export function splitAtPages(pageCount, cutPages, placement = "before") {
  const total = Math.max(0, Number(pageCount) || 0);
  const cuts = uniqueSortedPages(cutPages, total).filter((page) =>
    placement === "after" ? page < total : page > 1
  );
  const boundaries = new Set();

  for (const page of cuts) {
    boundaries.add(placement === "after" ? page : page - 1);
  }

  const groups = [];
  let current = [];
  for (let page = 1; page <= total; page += 1) {
    current.push(page);
    if (boundaries.has(page)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

export function splitByApproximateSize(pageCount, sourceBytes, targetMegabytes) {
  const total = Math.max(0, Number(pageCount) || 0);
  if (!total) return [];
  const bytes = Math.max(1, Number(sourceBytes) || 1);
  const targetBytes = Math.max(1, Number(targetMegabytes) || 1) * 1024 * 1024;
  const averageBytesPerPage = bytes / total;
  const pagesPerGroup = Math.max(1, Math.floor(targetBytes / averageBytesPerPage));
  return splitEveryN(total, pagesPerGroup);
}

export function complementPages(selectedPages, pageCount) {
  const selected = new Set(uniqueSortedPages(selectedPages, pageCount));
  return allPages(pageCount).filter((page) => !selected.has(page));
}

export function removePagesFromGroups(groups, excludedPages) {
  const excluded = new Set(excludedPages.map(Number));
  return groups
    .map((group) => group.filter((page) => !excluded.has(page)))
    .filter((group) => group.length > 0);
}

export function buildSplitPlan(options) {
  const {
    mode,
    pageCount,
    selectedPages = [],
    rangesText = "",
    every = 1,
    parts = 2,
    cutExpression = "",
    blankPages = [],
    excludeBlankPages = false,
    sourceBytes = 0,
    targetMegabytes = 5,
  } = options ?? {};

  const total = Math.max(0, Number(pageCount) || 0);
  const selected = uniqueSortedPages(selectedPages, total);
  const blank = uniqueSortedPages(blankPages, total);
  let groups = [];
  let errors = [];

  switch (mode) {
    case "selected-one":
      groups = selected.length ? [selected] : [];
      break;
    case "selected-each":
      groups = selected.map((page) => [page]);
      break;
    case "selected-and-rest": {
      const rest = complementPages(selected, total);
      groups = [selected, rest].filter((group) => group.length);
      break;
    }
    case "remove-selected": {
      const rest = complementPages(selected, total);
      groups = rest.length ? [rest] : [];
      break;
    }
    case "all-each":
      groups = allPages(total).map((page) => [page]);
      break;
    case "ranges": {
      const parsed = parseRangeGroups(rangesText, total);
      groups = parsed.groups;
      errors = parsed.errors;
      break;
    }
    case "every-n":
      groups = splitEveryN(total, every);
      break;
    case "balanced":
      groups = splitBalanced(total, parts);
      break;
    case "before": {
      const parsed = parsePageExpression(cutExpression, total);
      errors = parsed.invalidTokens.length || parsed.outOfRange.length ? [{ line: 1, source: cutExpression, ...parsed }] : [];
      groups = splitAtPages(total, parsed.pages, "before");
      break;
    }
    case "after": {
      const parsed = parsePageExpression(cutExpression, total);
      errors = parsed.invalidTokens.length || parsed.outOfRange.length ? [{ line: 1, source: cutExpression, ...parsed }] : [];
      groups = splitAtPages(total, parsed.pages, "after");
      break;
    }
    case "blank-before":
      groups = splitAtPages(total, blank, "before");
      break;
    case "blank-after":
      groups = splitAtPages(total, blank, "after");
      break;
    case "size-approx":
      groups = splitByApproximateSize(total, sourceBytes, targetMegabytes);
      break;
    default:
      groups = [];
  }

  if (excludeBlankPages && blank.length) {
    groups = removePagesFromGroups(groups, blank);
  }

  return {
    groups: groups.map((group) => uniqueSortedPages(group, total)).filter((group) => group.length),
    errors,
  };
}

export function summarizePages(pages) {
  const sorted = [...new Set(pages.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  if (!sorted.length) return "Sin páginas";

  const chunks = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    chunks.push(start === previous ? String(start) : `${start}-${previous}`);
    start = current;
    previous = current;
  }

  return chunks.join(", ");
}

export function analyzePlan(groups, pageCount) {
  const total = Math.max(0, Number(pageCount) || 0);
  const counts = new Map();
  for (const group of groups) {
    for (const page of group) {
      counts.set(page, (counts.get(page) || 0) + 1);
    }
  }

  const duplicatedPages = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([page]) => page)
    .sort((a, b) => a - b);
  const missingPages = allPages(total).filter((page) => !counts.has(page));

  return {
    outputCount: groups.length,
    totalPageOccurrences: groups.reduce((sum, group) => sum + group.length, 0),
    duplicatedPages,
    missingPages,
  };
}

export function sanitizeFilename(value, fallback = "PDFPrivado_Resultado.pdf") {
  let name = String(value ?? "")
    .trim()
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/[. ]+$/g, "")
    .replace(/_+/g, "_");

  if (!name) name = fallback;
  if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
  if (name.length > 180) name = `${name.slice(0, 176)}.pdf`;
  return name;
}

export function applyNamePattern(pattern, context) {
  const source = String(pattern || "{nombre}_parte_{parte}");
  const replacements = {
    nombre: context.nombre ?? "Documento",
    parte: context.parte ?? 1,
    partes: context.partes ?? 1,
    pagina: context.pagina ?? context.desde ?? 1,
    desde: context.desde ?? 1,
    hasta: context.hasta ?? context.desde ?? 1,
    paginas: context.paginas ?? 1,
    fecha: context.fecha ?? new Date().toISOString().slice(0, 10),
  };

  const width = Math.max(2, String(replacements.partes).length);
  const raw = source.replace(/\{(nombre|parte|partes|pagina|desde|hasta|paginas|fecha)\}/g, (_, key) => {
    if (key === "parte") return String(replacements[key]).padStart(width, "0");
    return String(replacements[key]);
  });

  return sanitizeFilename(raw);
}
