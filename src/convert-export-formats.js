function pageHeading(pageNumber) {
  return `Página ${pageNumber}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function pageText(page) {
  return String(page?.text || "").trim();
}

export function serializeDocumentToTxt(document, {
  includePageHeadings = true,
  pageSeparator = "\n\n\f\n\n",
} = {}) {
  return document.pages.map((page) => {
    const text = pageText(page);
    return includePageHeadings
      ? `${pageHeading(page.pageNumber)}\n${"=".repeat(pageHeading(page.pageNumber).length)}\n\n${text}`
      : text;
  }).join(pageSeparator).trimEnd() + "\n";
}

export function serializeDocumentToJson(document) {
  return JSON.stringify(document, null, 2) + "\n";
}

export function serializeDocumentToHtml(document, {
  includePageHeadings = true,
} = {}) {
  const title = escapeHtml(document.document?.sourceName || "Documento exportado");
  const sections = document.pages.map((page) => {
    const heading = includePageHeadings
      ? `<h2>${escapeHtml(pageHeading(page.pageNumber))}</h2>`
      : "";
    const body = escapeHtml(pageText(page)).replace(/\n/gu, "<br>\n");
    return `    <section class="pdf-page" data-page="${page.pageNumber}">\n      ${heading}\n      <p>${body}</p>\n    </section>`;
  }).join("\n\n");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { max-width: 920px; margin: 0 auto; padding: 32px; font: 16px/1.6 system-ui, sans-serif; color: #172033; }
    .pdf-page { padding: 24px 0; border-bottom: 1px solid #dfe5ee; }
    .pdf-page h2 { margin: 0 0 16px; font-size: 1.1rem; }
    .pdf-page p { margin: 0; white-space: normal; }
  </style>
</head>
<body>
  <h1>${title}</h1>
${sections}
</body>
</html>
`;
}

export function serializeDocumentToMarkdown(document, {
  includeDocumentHeading = true,
  includePageHeadings = true,
  pageSeparator = "\n\n---\n\n",
} = {}) {
  const blocks = [];

  if (includeDocumentHeading) {
    blocks.push(`# ${document.document?.sourceName || "Documento exportado"}`);
  }

  const pages = document.pages.map((page) => {
    const text = pageText(page);
    return includePageHeadings
      ? `## ${pageHeading(page.pageNumber)}\n\n${text}`
      : text;
  });

  if (pages.length) blocks.push(pages.join(pageSeparator));
  return blocks.join("\n\n").trimEnd() + "\n";
}

export function serializeExportDocument(document, format, options = {}) {
  switch (format) {
    case "json":
      return {
        content: serializeDocumentToJson(document),
        mimeType: "application/json;charset=utf-8",
        extension: "json",
      };
    case "html":
      return {
        content: serializeDocumentToHtml(document, options),
        mimeType: "text/html;charset=utf-8",
        extension: "html",
      };
    case "markdown":
      return {
        content: serializeDocumentToMarkdown(document, options),
        mimeType: "text/markdown;charset=utf-8",
        extension: "md",
      };
    case "txt":
    default:
      return {
        content: serializeDocumentToTxt(document, options),
        mimeType: "text/plain;charset=utf-8",
        extension: "txt",
      };
  }
}
