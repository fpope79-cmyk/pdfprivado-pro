import {
  inferVisualInkColor,
  normalizeRgbHex,
  shouldAcceptOcrCalibration,
  shouldAcceptOcrVisualPageFeedback,
  shouldAcceptVisualVariant,
} from "./ocr-visual-feedback.js";
import {
  buildOcrRasterProtectionProfile,
  shouldPreserveOcrRasterLine,
} from "./raster-text-separation.js";

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


function textToDocxParagraphs(text, { emptyText = "" } = {}) {
  const normalized = String(text || "").replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  if (!lines.some((line) => line.trim())) {
    return emptyText ? [{ text: emptyText, italic: true }] : [{ text: "" }];
  }
  return lines.map((line) => ({ text: line }));
}

function optionsPageImages(pageImages, pageNumber) {
  const value = pageImages instanceof Map
    ? pageImages.get(pageNumber)
    : Array.isArray(pageImages)
      ? pageImages.find((entry) => entry?.pageNumber === pageNumber)?.images
      : null;
  if (Array.isArray(value)) return value.filter((image) => image?.bytes?.byteLength);
  if (value?.bytes?.byteLength) return [value];
  return [];
}

function fitDocxImage(width, height, { maxWidth = 600, maxHeight = 760 } = {}) {
  const safeWidth = Math.max(1, Number(width) || maxWidth);
  const safeHeight = Math.max(1, Number(height) || maxHeight);
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);
  return { width: Math.max(1, Math.round(safeWidth * scale)), height: Math.max(1, Math.round(safeHeight * scale)) };
}

function docxFontSize(points, page = null) {
  const base = Number(points) || 10;
  const dense = Array.isArray(page?.layout) && page.layout.length > 34;
  const scale = dense ? 1.55 : 1.72;
  return Math.max(15, Math.min(54, Math.round(base * scale)));
}

function normalizedLineText(line = {}) {
  return String(line.text || "")
    .replace(/\u00ad/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function lineStyle(line = {}) {
  const text = normalizedLineText(line);
  const darkBanner = line.centered && line.bold && (
    /^¿.+\?$/u.test(text) ||
    /necesarios y recomendaciones/iu.test(text) ||
    /cómo valoramos.+tarea/iu.test(text)
  );
  const mainTitle = line.kind === "title";
  const warningHeading = /^NOTA MUY IMPORTANTE$/iu.test(text);
  const lightPanelHeading = /^(Caso práctico|Indicaciones de entrega)$/iu.test(text);
  const sectionLabel = /^(Resultados de aprendizaje:|Contenidos|Recursos necesarios\.?|Recomendaciones)$/iu.test(text);
  const redWarning = /Se resta 0,1|error ortográfico|expresiones incorrectas/iu.test(text);
  return {
    darkBanner,
    mainTitle,
    warningHeading,
    lightPanelHeading,
    sectionLabel,
    redWarning,
    color: darkBanner
      ? "FFFFFF"
      : mainTitle
        ? "1494E8"
        : redWarning
          ? "E00000"
          : warningHeading
            ? "243B5A"
            : lightPanelHeading
              ? "2C6B25"
              : sectionLabel
                ? "254B73"
                : "111111",
    fill: darkBanner
      ? "07558F"
      : warningHeading
        ? "B9D5F2"
        : lightPanelHeading
          ? "DFF2CC"
          : sectionLabel
            ? "D9E9F8"
            : undefined,
  };
}

function listLevelFromX(x = 0) {
  if (x >= 120) return 2;
  if (x >= 75) return 1;
  return 0;
}

function paragraphFromLayoutLine(line, api, page = null) {
  const { AlignmentType, HeadingLevel, Paragraph, TextRun } = api;
  const style = lineStyle(line);
  const heading = line.kind === "title"
    ? HeadingLevel.HEADING_1
    : line.kind === "heading"
      ? HeadingLevel.HEADING_2
      : line.kind === "subheading"
        ? HeadingLevel.HEADING_3
        : undefined;
  const rawText = normalizedLineText(line);
  const isBullet = line.kind === "bullet";
  const isNumber = line.kind === "number";
  const listLevel = Number.isInteger(line.listLevel) ? line.listLevel : listLevelFromX(Number(line.x) || 0);
  const text = rawText
    .replace(/^[•·▪◦o*\-]\s+/u, "")
    .replace(/^\d+[.)-]\s+/u, (match) => isNumber ? match : "");
  const dense = Array.isArray(page?.layout) && page.layout.length > 34;
  const after = style.darkBanner || style.warningHeading || style.lightPanelHeading
    ? 55
    : line.kind === "title"
      ? 80
      : line.kind === "heading"
        ? 55
        : dense
          ? 18
          : 32;
  const indent = isBullet
    ? { left: 360 + (listLevel * 300), hanging: 180 }
    : isNumber
      ? { left: 300 + (listLevel * 300), hanging: 0 }
      : !line.centered && Number(line.x) > 55
        ? { left: Math.min(900, Math.round((Number(line.x) - 40) * 10)) }
        : undefined;
  const visibleText = isBullet ? `•  ${text}` : text;

  return new Paragraph({
    heading,
    alignment: line.centered ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent,
    keepNext: Boolean(heading || style.darkBanner || style.warningHeading || style.lightPanelHeading),
    spacing: {
      before: line.kind === "title" ? 70 : line.kind === "heading" ? 45 : 0,
      after,
      line: dense ? 205 : 220,
    },
    shading: style.fill ? { fill: style.fill } : undefined,
    children: [new TextRun({
      text: visibleText,
      bold: Boolean(line.bold || heading || style.darkBanner || style.warningHeading),
      italics: Boolean(line.italic),
      color: style.color,
      size: docxFontSize(line.fontSize, page),
      font: "Arial",
    })],
  });
}

function panelFromLayoutLine(line, api, page = null) {
  const { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = api;
  const style = lineStyle(line);
  const borderColor = style.darkBanner ? "07558F" : style.warningHeading ? "8FB7DE" : style.lightPanelHeading ? "A8CF8E" : "C6D7E8";
  const border = { style: BorderStyle.SINGLE, size: 4, color: borderColor };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { fill: style.fill || "FFFFFF" },
        margins: { top: 85, bottom: 85, left: 130, right: 130 },
        children: [new Paragraph({
          alignment: line.centered ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 0, line: 215 },
          children: [new TextRun({
            text: normalizedLineText(line),
            bold: true,
            italics: Boolean(line.italic),
            color: style.color,
            size: docxFontSize(line.fontSize, page),
            font: "Arial",
          })],
        })],
      })],
    })],
  });
}

function isRubricHeading(line = {}) {
  return /Rúbrica de la tarea/iu.test(normalizedLineText(line));
}

function isRubricScore(value = "") {
  return /(?:Hasta\s+\d+(?:[.,]\d+)?\s+puntos?|\d+(?:[.,]\d+)?\s+puntos?|Se\s+resta\s+0[.,]1)/iu.test(String(value));
}

function isRubricFinalWarning(value = "") {
  return /Se\s+resta\s+0[.,]1|error\s+ortográfico|expresiones\s+incorrectas/iu.test(String(value));
}

function splitRubricTextAndScore(value = "") {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  const match = text.match(
    /^(.*?)(Hasta\s+\d+(?:[.,]\d+)?\s+puntos?|\d+(?:[.,]\d+)?\s+puntos?|Se\s+resta\s+0[.,]1(?:\s+puntos?)?.*)$/iu
  );
  if (!match) return null;
  return {
    left: String(match[1] || "").trim(),
    right: String(match[2] || "").trim(),
  };
}

function rubricVisualGroups(layout = [], from = 0) {
  const groups = [];

  for (let lineIndex = from; lineIndex < layout.length; lineIndex += 1) {
    const line = layout[lineIndex];
    const text = normalizedLineText(line);
    if (!text) continue;

    const y = Number(line.y);
    const tolerance = Math.max(2.5, (Number(line.fontSize) || 10) * 0.28);
    let group = Number.isFinite(y)
      ? groups.find((entry) => Math.abs(entry.y - y) <= tolerance)
      : null;

    if (!group) {
      group = {
        y: Number.isFinite(y) ? y : -(groups.length + 1),
        lines: [],
        endLineIndex: lineIndex,
      };
      groups.push(group);
    }

    group.lines.push({ ...line, text, lineIndex });
    group.endLineIndex = Math.max(group.endLineIndex, lineIndex);
  }

  groups.sort((a, b) => b.y - a.y);
  for (const group of groups) {
    group.lines.sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0));
  }
  return groups;
}

function isRubricDescriptionStart(value = "") {
  return /^(?:Apartado\s+\d+|Redacción clara)/iu.test(
    String(value || "").trim()
  );
}

function normalizeRubricRows(rows = []) {
  const header = rows.find((row) => row?.header) || {
    header: true,
    left: "Rúbrica de la tarea",
    right: "",
  };

  const body = rows
    .filter((row) => row && !row.header)
    .map((row) => ({
      ...row,
      left: String(row.left || "").replace(/\s+/gu, " ").trim(),
      right: String(row.right || "").replace(/\s+/gu, " ").trim(),
    }));

  const normalized = [];

  for (const row of body) {
    const previous = normalized.at(-1);

    if (
      previous &&
      !row.right &&
      row.left &&
      !isRubricDescriptionStart(row.left)
    ) {
      previous.left = `${previous.left} ${row.left}`
        .replace(/\s+/gu, " ")
        .trim();
      continue;
    }

    if (previous && !row.left && row.right) {
      previous.right = `${previous.right} ${row.right}`
        .replace(/\s+/gu, " ")
        .trim();
      continue;
    }

    normalized.push({ ...row });
  }

  const finalRows = [];
  let conclusion = null;
  let warningLeft = "";
  let warningRight = "";
  let warningPage = null;

  const flushConclusion = () => {
    if (!conclusion) return;

    finalRows.push({
      ...conclusion,
      left: "Apartado 5: Conclusión definitiva y justificación",
      right: "0.5 puntos",
      finalWarning: false,
    });

    conclusion = null;
  };

  const flushWarning = () => {
    const left = warningLeft.replace(/\s+/gu, " ").trim();
    const right = warningRight.replace(/\s+/gu, " ").trim();

    if (left || right) {
      finalRows.push({
        left: "Redacción clara y correcta, sin errores ortográficos",
        right:
          "Se resta 0,1 puntos por cada error ortográfico o expresión incorrecta.",
        sourcePageIndex: warningPage,
        finalWarning: true,
      });
    }

    warningLeft = "";
    warningRight = "";
    warningPage = null;
  };

  for (const row of normalized) {
    const combined = `${row.left} ${row.right}`
      .replace(/\s+/gu, " ")
      .trim();

    const hasConclusion =
      /Apartado\s+5:\s*Conclusión definitiva y justificación/iu.test(
        combined
      );

    const hasConclusionScore =
      /0[.,]5\s+puntos?/iu.test(combined);

    if (hasConclusion) {
      flushWarning();

      conclusion = {
        sourcePageIndex: Number.isInteger(row.sourcePageIndex)
          ? row.sourcePageIndex
          : null,
      };

      if (hasConclusionScore) {
        flushConclusion();
      }

      const warningTail = combined
        .replace(
          /.*?Apartado\s+5:\s*Conclusión definitiva y justificación/iu,
          ""
        )
        .replace(/0[.,]5\s+puntos?/iu, "")
        .trim();

      if (warningTail) {
        warningPage =
          Number.isInteger(row.sourcePageIndex)
            ? row.sourcePageIndex
            : warningPage;

        if (/^Redacción clara/iu.test(warningTail)) {
          warningLeft = warningTail;
        } else {
          warningRight = warningTail;
        }
      }

      continue;
    }

    if (conclusion) {
      if (/0[.,]5\s+puntos?/iu.test(combined)) {
        flushConclusion();

        const remainder = combined
          .replace(/0[.,]5\s+puntos?/iu, "")
          .trim();

        if (remainder) {
          warningPage =
            Number.isInteger(row.sourcePageIndex)
              ? row.sourcePageIndex
              : warningPage;

          if (/^Redacción clara/iu.test(remainder)) {
            warningLeft = remainder;
          } else {
            warningRight = remainder;
          }
        }

        continue;
      }

      flushConclusion();
    }

    const startsWarningLeft =
      /^Redacción clara/iu.test(row.left) ||
      /Redacción clara y correcta/iu.test(combined);

    const warningRelated =
      /^Se\s+resta/iu.test(row.right) ||
      /Se\s+resta\s+0[.,]1/iu.test(combined) ||
      /puntos\s+por\s+cada/iu.test(combined) ||
      /error ortográfico/iu.test(combined) ||
      /expresi(?:ó|o)n(?:es)? incorrecta/iu.test(combined);

    if (startsWarningLeft || warningRelated) {
      warningPage =
        warningPage ??
        (Number.isInteger(row.sourcePageIndex)
          ? row.sourcePageIndex
          : null);

      if (startsWarningLeft) {
        warningLeft = `${warningLeft} ${row.left}`
          .replace(/\s+/gu, " ")
          .trim();

        const rightPart = row.right;
        if (rightPart) {
          warningRight = `${warningRight} ${rightPart}`
            .replace(/\s+/gu, " ")
            .trim();
        }
      } else {
        warningRight = `${warningRight} ${combined}`
          .replace(/\s+/gu, " ")
          .trim();
      }

      continue;
    }

    flushConclusion();
    flushWarning();

    finalRows.push({
      ...row,
      finalWarning: false,
    });
  }

  flushConclusion();
  flushWarning();

  return [header, ...finalRows];
}
function splitRubricRowsBySourcePage(rows = []) {
  const header = rows.find((row) => row?.header) || {
    header: true,
    left: "Rúbrica de la tarea",
    right: "",
  };
  const body = rows.filter((row) => row && !row.header);
  if (!body.length) return [[header]];

  const groups = [];
  let current = [header];
  let currentPage = Number.isInteger(body[0].sourcePageIndex)
    ? body[0].sourcePageIndex
    : null;

  for (const row of body) {
    const page = Number.isInteger(row.sourcePageIndex)
      ? row.sourcePageIndex
      : currentPage;

    if (
      current.length > 1 &&
      currentPage !== null &&
      page !== null &&
      page > currentPage
    ) {
      groups.push(current);
      current = [header];
    }

    current.push(row);
    if (page !== null) currentPage = page;
  }

  if (current.length > 1) groups.push(current);
  return groups.length ? groups : [[header]];
}

function collectRubricRows(pages, startPageIndex, startLineIndex) {
  const rows = [{ header: true, left: "Rúbrica de la tarea", right: "" }];
  let endPageIndex = startPageIndex;
  let endLineIndex = startLineIndex;
  let pending = null;
  let active = false;

  const flushPending = () => {
    if (!pending) return;
    const left = String(pending.left || "").replace(/\s+/gu, " ").trim();
    const right = String(pending.right || "").replace(/\s+/gu, " ").trim();
    if (left || right) {
      rows.push({
        left,
        right,
        sourcePageIndex: pending.sourcePageIndex,
        finalWarning: isRubricFinalWarning(`${left} ${right}`),
      });
    }
    pending = null;
  };

  for (let pageIndex = startPageIndex; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex] || {};
    const layout = Array.isArray(page.layout) ? page.layout : [];
    const from = pageIndex === startPageIndex ? startLineIndex : 0;
    const pageWidth = Number(page.width) || 595;
    const groups = rubricVisualGroups(layout, from);

    for (const group of groups) {
      const headingLine = group.lines.find(isRubricHeading);

      if (!active) {
        if (!headingLine) continue;
        active = true;
        endPageIndex = pageIndex;
        endLineIndex = group.endLineIndex;
        continue;
      }

      const cellLine = group.lines.find(
        (line) => Array.isArray(line.cells) && line.cells.length >= 2
      );

      if (cellLine) {
        flushPending();
        const cells = cellLine.cells.map((cell) =>
          String(cell || "").replace(/\s+/gu, " ").trim()
        );
        const left = cells[0] || "";
        const right = cells.slice(1).join(" ").trim();
        rows.push({
          left,
          right,
          sourcePageIndex: pageIndex,
          finalWarning: isRubricFinalWarning(`${left} ${right}`),
        });
        endPageIndex = pageIndex;
        endLineIndex = group.endLineIndex;
        continue;
      }

      const joined = group.lines.map((line) => line.text).join(" ").trim();
      const direct = splitRubricTextAndScore(joined);

      if (direct?.right) {
        flushPending();
        rows.push({
          left: direct.left,
          right: direct.right,
          sourcePageIndex: pageIndex,
          finalWarning: isRubricFinalWarning(joined),
        });
        endPageIndex = pageIndex;
        endLineIndex = group.endLineIndex;
        continue;
      }

      const leftLines = [];
      const rightLines = [];

      for (const line of group.lines) {
        const x = Number(line.x) || 0;
        if (
          x > pageWidth * 0.57 ||
          isRubricScore(line.text) ||
          /^Se\s+resta/iu.test(line.text)
        ) {
          rightLines.push(line.text);
        } else {
          leftLines.push(line.text);
        }
      }

      const leftText = leftLines.join(" ").trim();
      const rightText = rightLines.join(" ").trim();

      if (rightText) {
        if (!pending) pending = { left: leftText, right: "", sourcePageIndex: pageIndex };
        else if (leftText) pending.left = `${pending.left} ${leftText}`.trim();

        pending.right = `${pending.right} ${rightText}`.trim();

        if (
          isRubricScore(pending.right) ||
          isRubricFinalWarning(`${pending.left} ${pending.right}`)
        ) {
          flushPending();
        }
      } else if (leftText) {
        const startsNewRow =
          /^Apartado\s+\d+/iu.test(leftText) ||
          /^Redacción clara/iu.test(leftText);

        if (startsNewRow) {
          flushPending();
          pending = { left: leftText, right: "", sourcePageIndex: pageIndex };
        } else if (pending) {
          pending.left = `${pending.left} ${leftText}`.trim();
        } else {
          pending = { left: leftText, right: "", sourcePageIndex: pageIndex };
        }
      }

      endPageIndex = pageIndex;
      endLineIndex = group.endLineIndex;
    }
  }

  flushPending();

  const normalizedRows = normalizeRubricRows(rows);

  return normalizedRows.length > 1
    ? { rows: normalizedRows, endPageIndex, endLineIndex }
    : null;
}

function tableFromRubricRows(rows, api) {
  const { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = api;
  const border = { style: BorderStyle.SINGLE, size: 5, color: "8FA9C2" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [7600, 2400],
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: rows.map((row, index) => {
      if (row.header) {
        return new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [new TableCell({
            columnSpan: 2,
            shading: { fill: "B9D5F2" },
            margins: { top: 95, bottom: 95, left: 100, right: 100 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
              children: [new TextRun({ text: row.left, bold: true, color: "1E3E5E", size: 25, font: "Arial" })],
            })],
          })],
        });
      }

      const fill = index % 2 ? "F3F7FB" : "FFFFFF";
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 76, type: WidthType.PERCENTAGE },
            shading: { fill },
            margins: { top: 65, bottom: 65, left: 90, right: 90 },
            children: [new Paragraph({
              pageBreakBefore: Boolean(row.pageBreakBefore),
              spacing: { after: 0, line: 205 },
              children: [new TextRun({ text: row.left, bold: /^Apartado/u.test(row.left), color: "333333", size: 18, font: "Arial" })],
            })],
          }),
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            shading: { fill },
            margins: { top: 65, bottom: 65, left: 90, right: 90 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0, line: 205 },
              children: [new TextRun({ text: row.right, bold: true, color: row.finalWarning ? "E00000" : "333333", size: 18, font: "Arial" })],
            })],
          }),
        ],
      });
    }),
  });
}

function structuredRecordStart(value = "") {
  const text = String(value || "")
    .replace(/\s+/gu, " ")
    .trim();

  const match = text.match(/^(\d{2,4})\s+(.+)$/u);

  if (!match) return null;

  const remainder = String(match[2] || "").trim();

  if (
    remainder.length < 8 ||
    !/\d/u.test(remainder)
  ) {
    return null;
  }

  return {
    id: match[1],
    primary: remainder,
  };
}

function structuredRecordDetail(value = "") {
  const text = String(value || "")
    .replace(/\s+/gu, " ")
    .trim();

  if (!text) return false;

  const labelledValues =
    (text.match(
      /[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s./%-]{2,}\s*:/gu
    ) || []).length;

  return (
    labelledValues >= 1 ||
    /\d+[.,]\d+\s*€/u.test(text) ||
    /\d+[.,]\d+\s*(?:Ha|Kg|%)/iu.test(text)
  );
}

function detectStructuredRecordBlock(
  layout,
  startIndex
) {
  const first = structuredRecordStart(
    normalizedLineText(layout[startIndex])
  );

  if (!first) return null;

  const records = [];
  let cursor = startIndex;

  while (cursor < layout.length) {
    const start = structuredRecordStart(
      normalizedLineText(layout[cursor])
    );

    if (!start) break;

    const record = {
      id: start.id,
      primary: start.primary,
      details: [],
    };

    cursor += 1;

    while (cursor < layout.length) {
      const nextText = normalizedLineText(
        layout[cursor]
      );

      if (structuredRecordStart(nextText)) {
        break;
      }

      if (!structuredRecordDetail(nextText)) {
        break;
      }

      record.details.push(nextText);
      cursor += 1;

      if (record.details.length >= 4) {
        break;
      }
    }

    if (!record.details.length) {
      break;
    }

    records.push(record);
  }

  if (records.length < 3) {
    return null;
  }

  return {
    records,
    endIndex: cursor - 1,
  };
}

function tableFromStructuredRecords(
  records,
  api
) {
  const {
    AlignmentType,
    BorderStyle,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = api;

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "AAB7C4",
  };

  const cell = (
    value,
    {
      bold = false,
      fill = undefined,
      align = AlignmentType.LEFT,
      width = undefined,
    } = {}
  ) =>
    new TableCell({
      width: width
        ? {
            size: width,
            type: WidthType.PERCENTAGE,
          }
        : undefined,
      shading: fill
        ? { fill }
        : undefined,
      margins: {
        top: 65,
        bottom: 65,
        left: 75,
        right: 75,
      },
      children: [
        new Paragraph({
          alignment: align,
          spacing: {
            after: 0,
            line: 190,
          },
          children: [
            new TextRun({
              text: String(value || ""),
              bold,
              size: 16,
              font: "Arial",
              color: "222222",
            }),
          ],
        }),
      ],
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        cell("Nº", {
          bold: true,
          fill: "DCE8F2",
          align: AlignmentType.CENTER,
          width: 8,
        }),
        cell("Datos principales", {
          bold: true,
          fill: "DCE8F2",
          width: 45,
        }),
        cell("Valores y detalles", {
          bold: true,
          fill: "DCE8F2",
          width: 47,
        }),
      ],
    }),
    ...records.map((record) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(record.id, {
            bold: true,
            align: AlignmentType.CENTER,
            width: 8,
          }),
          cell(record.primary, {
            width: 45,
          }),
          cell(
            record.details.join("\n"),
            {
              width: 47,
            }
          ),
        ],
      })
    ),
  ];

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
    rows,
  });
}

function layoutToDocxChildren(page, api) {
  const layout = Array.isArray(page?.layout) ? page.layout.filter((line) => line?.text) : [];
  if (!layout.length) return null;
  const children = [];
  for (const line of layout) {
    const style = lineStyle(line);
    if (style.darkBanner || style.warningHeading || style.lightPanelHeading) {
      children.push(panelFromLayoutLine(line, api, page));
    } else {
      children.push(paragraphFromLayoutLine(line, api, page));
    }
  }
  return children;
}

export function docxPageLayoutMetrics(page = {}) {
  const layout = Array.isArray(page?.layout)
    ? page.layout.filter((line) => line?.text)
    : [];
  const pageTextLength = String(page?.text || "")
    .replace(/\s+/gu, "")
    .length;
  const layoutTextLength = layout.reduce(
    (total, line) => total + normalizedLineText(line).replace(/\s+/gu, "").length,
    0
  );
  const textLength = Math.max(pageTextLength, layoutTextLength);
  const width = Math.max(1, Number(page?.width) || 595);
  const xBands = new Set(
    layout.map((line) =>
      Math.round((Math.max(0, Number(line.x) || 0) / width) * 12)
    )
  );
  let segmentCount = 0;
  let multiSegmentCount = 0;
  let multiSegmentLines = 0;
  let maxSegmentsPerLine = 1;
  let hasCellHints = false;

  for (const line of layout) {
    const segments = Array.isArray(line?.segments)
      ? line.segments.filter((segment) => segment?.text)
      : [];
    const groups = Math.max(
      1,
      Number(line?.groupCount) ||
        segments.length ||
        (Array.isArray(line?.cells) ? line.cells.length : 1)
    );
    segmentCount += groups;
    multiSegmentCount += Math.max(0, groups - 1);
    if (groups > 1) multiSegmentLines += 1;
    maxSegmentsPerLine = Math.max(maxSegmentsPerLine, groups);
    if (Array.isArray(line?.cells) && line.cells.length > 1) {
      hasCellHints = true;
    }
  }

  const hasWideDispersion =
    layout.some((line) => Number(line.x) > width * 0.55) &&
    layout.some((line) => Number(line.x) < width * 0.2);

  return {
    textLength,
    lineCount: layout.length,
    segmentCount,
    multiSegmentCount,
    multiSegmentLines,
    maxSegmentsPerLine,
    xBandCount: xBands.size,
    hasWideDispersion,
    hasCellHints,
  };
}

export function classifyDocxPage(page = {}, {
  layoutMode = "original",
} = {}) {
  const layoutMetrics = docxPageLayoutMetrics(page);
  const visualMetrics = page?.docxVisualMetrics || {};
  const positionedLines = Array.isArray(page?.layout)
    ? page.layout.filter((line) =>
        normalizedLineText(line) &&
        Number.isFinite(Number(line?.x)) &&
        Number.isFinite(Number(line?.y))
      )
    : [];
  const hasEditableGeometry = positionedLines.length > 0 && layoutMetrics.textLength >= 8;

  if (layoutMode !== "original") {
    return { route: "editable", reasons: ["modo-editable"], metrics: { ...layoutMetrics, ...visualMetrics } };
  }

  if (page?.source === "ocr") {
    return {
      route: hasEditableGeometry ? "editable" : "visual",
      reasons: [hasEditableGeometry ? "ocr-posicionado-editable" : "ocr-sin-geometria"],
      metrics: { ...layoutMetrics, ...visualMetrics, positionedLines: positionedLines.length },
    };
  }

  if (hasEditableGeometry) {
    return {
      route: "editable",
      reasons: ["texto-nativo-posicionado"],
      metrics: { ...layoutMetrics, ...visualMetrics, positionedLines: positionedLines.length },
    };
  }

  return {
    route: "visual",
    reasons: [page?.source === "ocr" ? "ocr-sin-geometria" : "sin-geometria-editable"],
    metrics: { ...layoutMetrics, ...visualMetrics, positionedLines: positionedLines.length },
  };
}

function pageImageFromCollection(pageImages, pageNumber) {
  const images = optionsPageImages(pageImages, pageNumber);
  return images.find((image) => image?.graphicsOnly) ||
    images.find((image) => image?.fullPage && !image?.calibrationSource) ||
    images[0] ||
    null;
}

function pageSectionProperties(page) {
  const widthPoints = Math.max(72, Number(page?.width) || 595.28);
  const heightPoints = Math.max(72, Number(page?.height) || 841.89);
  const landscape = widthPoints > heightPoints;
  const shortEdge = Math.min(widthPoints, heightPoints);
  const longEdge = Math.max(widthPoints, heightPoints);
  const margin = 0;
  return {
    page: {
      size: {
        // docx-js invierte los lados al aplicar orientación horizontal.
        width: Math.round((landscape ? shortEdge : widthPoints) * 20),
        height: Math.round((landscape ? longEdge : heightPoints) * 20),
        orientation: landscape ? "landscape" : "portrait",
      },
      margin: {
        top: margin,
        right: margin,
        bottom: margin,
        left: margin,
        header: 0,
        footer: 0,
        gutter: 0,
      },
    },
  };
}

function fullPageImageParagraph(page, image, api) {
  const { AlignmentType, ImageRun, Paragraph, TextRun } = api;
  const widthPoints = Math.max(72, Number(page?.width) || 595.28);
  const heightPoints = Math.max(72, Number(page?.height) || 841.89);
  const safetyPoints = 28;
  const usableWidthPixels = Math.max(
    1,
    Math.round(((widthPoints - safetyPoints) / 72) * 96)
  );
  const usableHeightPixels = Math.max(
    1,
    Math.round(((heightPoints - safetyPoints) / 72) * 96)
  );
  const transformation = fitDocxImage(image.width, image.height, {
    maxWidth: usableWidthPixels,
    maxHeight: usableHeightPixels,
  });
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      new ImageRun({
        data: image.bytes,
        type: image.type || "png",
        transformation,
        altText: {
          title: `Página ${page.pageNumber}`,
          description: `Representación visual fiel de una página PDF compleja. ${String(page?.text || "").replace(/\s+/gu, " ").slice(0, 700)}`,
          name: `pagina-${page.pageNumber}-completa`,
        },
      }),
      // Conserva el texto nativo u OCR dentro del DOCX sin modificar el diseño
      // visible. El usuario puede recuperarlo mostrando texto oculto en Word.
      new TextRun({
        text: String(page?.text || "")
          .replace(/\u00ad/gu, "")
          .replace(/\r\n?/gu, "\n")
          .slice(0, 20000),
        vanish: true,
        noProof: true,
        size: 2,
      }),
    ],
  });
}

function collectRubricSegmentsByPage(pages = []) {
  const segmentsByPage = new Map();
  let consumedUntilPage = -1;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (pageIndex <= consumedUntilPage) continue;
    const layout = Array.isArray(pages[pageIndex]?.layout)
      ? pages[pageIndex].layout
      : [];
    const headingIndex = layout.findIndex(isRubricHeading);
    if (headingIndex < 0) continue;

    const rubric = collectRubricRows(pages, pageIndex, headingIndex);
    if (!rubric?.rows?.length) continue;

    const segments = splitRubricRowsBySourcePage(rubric.rows);
    segments.forEach((rows, segmentIndex) => {
      const sourcePageIndex = rows
        .find((row) => !row?.header && Number.isInteger(row?.sourcePageIndex))
        ?.sourcePageIndex;
      const targetPageIndex = Number.isInteger(sourcePageIndex)
        ? sourcePageIndex
        : pageIndex + segmentIndex;
      if (targetPageIndex >= 0 && targetPageIndex < pages.length) {
        segmentsByPage.set(targetPageIndex, rows);
      }
    });
    consumedUntilPage = Math.max(consumedUntilPage, rubric.endPageIndex);
  }

  return segmentsByPage;
}


const DOCX_TWIPS_PER_POINT = 20;
const DOCX_EMUS_PER_POINT = 12_700;
const DOCX_PIXELS_PER_POINT = 96 / 72;
const DOCX_EDITABLE_FONT = "Arial";

function clampDocx(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function progressiveDocxFontSize(points) {
  const size = clampDocx(points || 9, 1, 96);
  // La exportación DrawingML conserva ya la geometría real de cada línea.
  // Reducirla al 68-76 % dejaba el Word notablemente más pequeño que el PDF.
  // Estos factores actúan como base conservadora; las páginas OCR que aportan
  // ambos rásteres se autocalibran después con evidencia visual local.
  if (size <= 5) return Math.max(4.2, size * 1.13);
  if (size <= 10.5) return Math.max(4.2, size * 0.92);
  return Math.max(4.2, size * 1.03);
}

function cleanFontName(value = "") {
  return String(value)
    .replace(/^[A-Z]{6}\+/u, "")
    .replace(/[,_-]+/gu, " ")
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
    .replace(/\s+/gu, " ")
    .trim();
}

export function resolveDocxEditableFont(line = {}) {
  const descriptor = cleanFontName(
    line.ocrVisualFontFamily ||
    line.resolvedFontName ||
    line.fontFamily ||
    line.fontName ||
    line.styledRuns?.[0]?.resolvedFontName ||
    line.styledRuns?.[0]?.fontFamily ||
    ""
  );
  const lower = descriptor.toLocaleLowerCase();
  if (/calibri/u.test(lower)) return { family: "Calibri", reliable: true };
  if (/cambria/u.test(lower)) return { family: "Cambria", reliable: true };
  if (/arial|helvetica|liberation sans|dejavu sans|noto sans|sans/u.test(lower)) {
    return { family: "Arial", reliable: true };
  }
  if (/times|liberation serif|dejavu serif|noto serif|serif/u.test(lower)) {
    return { family: "Times New Roman", reliable: true };
  }
  if (/courier|liberation mono|dejavu sans mono|noto sans mono/u.test(lower)) {
    return { family: "Courier New", reliable: true };
  }
  return { family: DOCX_EDITABLE_FONT, reliable: false };
}

let docxMeasureContext = null;

function browserMeasureContext() {
  if (docxMeasureContext) return docxMeasureContext;
  if (typeof document === "undefined" || !document.createElement) return null;
  docxMeasureContext = document.createElement("canvas").getContext("2d");
  return docxMeasureContext;
}

function measuredTextWidth(text, {
  family = DOCX_EDITABLE_FONT,
  size = 10,
  bold = false,
  italic = false,
} = {}) {
  const request = { text: String(text || ""), family, size, bold, italic };
  if (typeof globalThis.__pdfWordMeasureText === "function") {
    const measured = Number(globalThis.__pdfWordMeasureText(request));
    if (Number.isFinite(measured) && measured > 0) return measured;
  }
  const context = browserMeasureContext();
  if (context) {
    context.font = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${size}px "${family}"`;
    return context.measureText(request.text).width * (72 / 96);
  }
  return Math.max(0.1, request.text.length * size * 0.49);
}

function pageOcrLayoutEntries(page = {}) {
  const layout = Array.isArray(page?.layout) ? page.layout : [];
  const pageSource = String(page?.source || "").toLocaleLowerCase();
  const ocr = layout.filter((line) =>
    String(line?.source || pageSource).toLocaleLowerCase() === "ocr"
  );
  return ocr.length ? ocr : (pageSource === "ocr" ? layout : []);
}

function pageOcrLayoutCoverage(page = {}) {
  const layout = pageOcrLayoutEntries(page);
  const pageArea =
    Math.max(1, Number(page?.width) || 595.28) *
    Math.max(1, Number(page?.height) || 841.89);
  return layout.reduce((sum, entry) => {
    const width = Math.max(0, Number(entry?.width) || 0);
    const height = Math.max(
      0,
      Number(entry?.height) || Number(entry?.fontSize) || 0
    );
    return sum + width * height;
  }, 0) / pageArea;
}

export function docxAdaptiveOcrBaseScale(page = {}) {
  const rawOverride = page.ocrScaleOverride;
  const override = Number(rawOverride);
  if (rawOverride !== null && rawOverride !== undefined && rawOverride !== "" && Number.isFinite(override)) {
    return clampDocx(override, 0.58, 1.08);
  }
  const lineCount = pageOcrLayoutEntries(page).length;
  const historicalScale = lineCount <= 32 ? 0.78 : 0.86;
  // El render real de Word/LibreOffice muestra que las paginas OCR con una
  // huella geometrica densa necesitan una base menor que la historica. La
  // cobertura se deriva unicamente de cajas OCR normalizadas y, por tanto,
  // generaliza entre documentos sin reglas por plantilla o pagina concreta.
  return pageOcrLayoutCoverage(page) >= 0.20 ? 0.70 : historicalScale;
}

function pageOcrScale(page = {}) {
  return docxAdaptiveOcrBaseScale(page);
}

function initialDocxFontSize(line, page) {
  let raw = clampDocx(line?.fontSize || 9, 1, 96);
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  if (source !== "ocr") return raw;
  const layout = pageOcrLayoutEntries(page);
  const pageSizes = layout
    .map((entry) => Number(entry?.fontSize))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const medianSize = pageSizes.length
    ? pageSizes[Math.floor(pageSizes.length / 2)]
    : raw;
  const textLength = normalizedLineText(line).replace(/\s+/gu, "").length;
  // Una palabra contaminada por un sello puede inflar la mediana de altura
  // de toda la línea. Las líneas largas rara vez cambian varias categorías
  // tipográficas respecto al cuerpo dominante, así que limitamos solo esos
  // valores atípicos y dejamos intactos títulos breves, cifras y logotipos.
  const robustMaximum = textLength >= 55
    ? medianSize * 1.35
    : textLength >= 28
      ? medianSize * 1.55
      : textLength >= 18
        ? medianSize * 1.80
        : Infinity;
  raw = Math.min(raw, robustMaximum);
  const sparse = layout.length <= 32;
  const layoutCoverage = pageOcrLayoutCoverage(page);
  // La caja OCR mide tinta visible. En páginas poco densas la señal es limpia
  // y con cobertura suficiente puede recuperarse el em completo. Cuando el
  // OCR solo ha encontrado fragmentos de una infografía o un sello, se
  // conserva la estimación histórica para no sobredimensionar esos restos.
  const reliableSparseGeometry = sparse && layoutCoverage >= 0.24;
  return raw * (reliableSparseGeometry ? (1.35 / 0.82) : 1);
}

function effectiveLineSegments(line) {
  const segments = Array.isArray(line?.segments)
    ? line.segments.filter((segment) => String(segment?.text || "").trim())
    : [];
  if (segments.length) return segments;
  return [{
    text: normalizedLineText(line),
    x: Number(line?.x) || 0,
    width: Math.max(1, Number(line?.width) || 1),
  }];
}

function lineInkTargetWidth(line) {
  const segments = effectiveLineSegments(line);
  if (segments.length > 1) {
    return segments.reduce((sum, segment) => sum + Math.max(0, Number(segment?.width) || 0), 0);
  }
  return Math.max(1, Number(segments[0]?.width) || Number(line?.width) || 1);
}

function measuredLineInkWidth(line, { family, size, bold, italic }) {
  return effectiveLineSegments(line).reduce((sum, segment) => sum + measuredTextWidth(segment.text, {
    family,
    size,
    bold,
    italic,
  }), 0);
}

export function docxOcrTextScale({
  text,
  targetWidth,
  family = DOCX_EDITABLE_FONT,
  size = 10,
  bold = false,
  italic = false,
  confidence = null,
} = {}) {
  const value = String(text || "");
  const compactLength = value.replace(/\s+/gu, "").length;
  const confidenceValue = Number(confidence);
  if (compactLength < 3 || !(Number(targetWidth) > 0)) return null;
  if (Number.isFinite(confidenceValue) && confidenceValue < 70) return null;
  const measured = measuredTextWidth(value, { family, size, bold, italic });
  if (!(measured > 0)) return null;
  const ratio = Number(targetWidth) / measured;
  // La caja OCR puede estar contaminada por sellos o componentes gráficos.
  // Solo aplicamos escalado horizontal cuando la corrección es moderada; los
  // casos extremos continúan usando la geometría conservadora histórica.
  if (ratio < 0.90 || ratio > 1.10) return null;
  const percent = Math.round(ratio * 100);
  return Math.abs(percent - 100) >= 2 ? percent : null;
}


export function docxOcrWordTextScale({
  text,
  targetWidth,
  family = DOCX_EDITABLE_FONT,
  size = 10,
  bold = false,
  italic = false,
  confidence = null,
} = {}) {
  const value = String(text || "");
  const compactLength = value.replace(/\s+/gu, "").length;
  const confidenceValue = Number(confidence);
  if (!compactLength || !(Number(targetWidth) > 0)) return null;
  if (Number.isFinite(confidenceValue) && confidenceValue < 55) return null;
  const measured = measuredTextWidth(value, { family, size, bold, italic });
  if (!(measured > 0)) return null;
  const ratio = Number(targetWidth) / measured;
  // El anclaje por palabra ya fija la X mediante tabulaciones exactas. Aquí
  // solo compensamos la anchura de la palabra para que no invada el siguiente
  // ancla. Admitimos algo más de rango que a nivel de línea porque la caja OCR
  // de una palabra es una observación directa de su tinta, no una extrapolación
  // sobre una frase completa. Los extremos siguen rechazados para evitar texto
  // deformado cuando el OCR incluye sello, firma o ruido gráfico.
  if (ratio < 0.78 || ratio > 1.22) return null;
  const percent = Math.round(ratio * 100);
  return Math.abs(percent - 100) >= 2 ? percent : null;
}

function calibratedDocxFontSize(line, page, font) {
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  const raw = initialDocxFontSize(line, page);
  if (source !== "ocr") return progressiveDocxFontSize(raw);

  const base = pageOcrScale(page);
  const sparse = pageOcrLayoutEntries(page).length <= 32;
  const width = lineInkTargetWidth(line);
  const measured = measuredLineInkWidth(line, {
    family: font.family,
    size: raw,
    bold: Boolean(line?.bold),
    italic: Boolean(line?.italic),
  });
  const fit = clampDocx((width / Math.max(1, measured)) * 0.98, 0.58, 1.08);
  const blend = sparse ? 0.72 : 0.42;
  return Math.max(4.2, raw * ((fit * blend) + (base * (1 - blend))));
}

function calibrationImageFromCollection(pageImages, pageNumber, property) {
  return optionsPageImages(pageImages, pageNumber).find((image) => image?.[property]) || null;
}

async function decodeCalibrationImage(image) {
  if (!image?.bytes?.byteLength || typeof globalThis.createImageBitmap !== "function") return null;
  return globalThis.createImageBitmap(new Blob([image.bytes], {
    type: `image/${image.type || "png"}`,
  }));
}

function calibrationCanvas(width, height) {
  const canvas = globalThis.document?.createElement?.("canvas");
  if (!canvas) return null;
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function inferredCalibrationColorDetails(sourcePixels, graphicsPixels, box, canvasWidth) {
  return inferVisualInkColor(sourcePixels, graphicsPixels, box, canvasWidth);
}

function inferredCalibrationColor(sourcePixels, graphicsPixels, box, canvasWidth) {
  // Mantener la estimación histórica de v11 para la búsqueda global de
  // escala/referencia vertical. La inferencia robusta de v12 se usa solo
  // cuando una variante de línea demuestra una mejora local, evitando que
  // una mejora de color altere indirectamente páginas ya validadas.
  let r = 0;
  let g = 0;
  let b = 0;
  let weightTotal = 0;
  for (let y = box.top; y < box.bottom; y += 1) {
    for (let x = box.left; x < box.right; x += 1) {
      const offset = (y * canvasWidth + x) * 4;
      const distance =
        Math.abs(sourcePixels[offset] - graphicsPixels[offset]) +
        Math.abs(sourcePixels[offset + 1] - graphicsPixels[offset + 1]) +
        Math.abs(sourcePixels[offset + 2] - graphicsPixels[offset + 2]);
      if (distance < 45) continue;
      const weight = Math.min(255, distance);
      r += sourcePixels[offset] * weight;
      g += sourcePixels[offset + 1] * weight;
      b += sourcePixels[offset + 2] * weight;
      weightTotal += weight;
    }
  }
  if (weightTotal < 1) return "#000000";
  const channel = (value) => Math.round(value / weightTotal).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function localCalibrationError(sourcePixels, graphicsPixels, candidatePixels) {
  let error = 0;
  let samples = 0;
  const length = Math.min(
    sourcePixels?.length || 0,
    graphicsPixels?.length || 0,
    candidatePixels?.length || 0
  );
  for (let offset = 0; offset + 2 < length; offset += 4) {
    const sourceDelta =
      Math.abs(sourcePixels[offset] - graphicsPixels[offset]) +
      Math.abs(sourcePixels[offset + 1] - graphicsPixels[offset + 1]) +
      Math.abs(sourcePixels[offset + 2] - graphicsPixels[offset + 2]);
    const candidateDelta =
      Math.abs(candidatePixels[offset] - graphicsPixels[offset]) +
      Math.abs(candidatePixels[offset + 1] - graphicsPixels[offset + 1]) +
      Math.abs(candidatePixels[offset + 2] - graphicsPixels[offset + 2]);
    if (sourceDelta < 24 && candidateDelta < 24) continue;
    error +=
      Math.abs(sourcePixels[offset] - candidatePixels[offset]) +
      Math.abs(sourcePixels[offset + 1] - candidatePixels[offset + 1]) +
      Math.abs(sourcePixels[offset + 2] - candidatePixels[offset + 2]);
    samples += 3;
  }
  return {
    error: samples ? error / samples : Infinity,
    samples,
  };
}

function drawCalibrationScaledText(context, text, x, baselineY, scalePercent = null) {
  const scale = Number(scalePercent);
  if (!Number.isFinite(scale) || Math.abs(scale - 100) < 0.5) {
    context.fillText(String(text || ""), x, baselineY);
    return;
  }
  context.save();
  context.translate(x, baselineY);
  context.scale(scale / 100, 1);
  context.fillText(String(text || ""), 0, 0);
  context.restore();
}

function drawCalibrationLine(context, line, page, sx, sy, {
  offsetX = 0,
  offsetY = 0,
  color = null,
} = {}) {
  const geometry = layoutLineGeometry(line, page);
  context.textBaseline = "alphabetic";
  context.font = `${line?.italic ? "italic " : ""}${line?.bold ? "700 " : "400 "}${Math.max(1, geometry.displayFontSize * sy)}px "${geometry.font.family}"`;
  context.fillStyle = color || `#${normalizeRgbHex(line?.color, "000000")}`;
  const baselineY = (geometry.top + geometry.displayFontSize * 0.82) * sy - offsetY;
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();

  if (source === "ocr") {
    const anchorPlan = buildOcrWordAnchorPlan(line, page, geometry);
    if (anchorPlan.enabled) {
      // v22-B: mantener la coherencia calibrador->DOCX de v22-A solo en
      // paginas OCR densas, reutilizando la frontera estructural historica
      // pageOcrLayoutCoverage >= 0.20. En paginas sparse conservamos v21.
      const pageLineCount = Array.isArray(page?.layout)
        ? page.layout.filter((candidateLine) => {
            const candidateSource = String(
              candidateLine?.source || page?.source || ""
            ).toLocaleLowerCase();
            return candidateSource === "ocr";
          }).length
        : 0;
      const pageAllowsLift =
        pageLineCount >= 32 &&
        pageOcrLayoutCoverage(page) >= 0.20;
      const fontLift = 1.14;
      const baseContextFont = context.font;

      for (const word of anchorPlan.words) {
        const confidence = Number(word?.confidence ?? line?.confidence);
        const wordScale = docxOcrWordTextScale({
          text: word.text,
          targetWidth: word.width,
          family: geometry.font.family,
          size: geometry.displayFontSize,
          bold: Boolean(line?.bold),
          italic: Boolean(line?.italic),
          confidence,
        });
        const baseScalePercent = Number(wordScale) || 100;
        const compensatedScale = Math.round(baseScalePercent / fontLift);
        const canLift =
          pageAllowsLift &&
          Number.isFinite(confidence) &&
          confidence >= 75 &&
          compensatedScale >= 78 &&
          compensatedScale <= 122;

        if (canLift) {
          const liftedHalfPoints = Math.max(
            9,
            Math.round(geometry.displayFontSize * fontLift * 2)
          );
          const liftedSizePoints = liftedHalfPoints / 2;
          context.font =
            `${line?.italic ? "italic " : ""}` +
            `${line?.bold ? "700 " : "400 "}` +
            `${Math.max(1, liftedSizePoints * sy)}px "${geometry.font.family}"`;
          drawCalibrationScaledText(
            context,
            word.text,
            word.x * sx - offsetX,
            baselineY,
            compensatedScale
          );
          context.font = baseContextFont;
        } else {
          drawCalibrationScaledText(
            context,
            word.text,
            word.x * sx - offsetX,
            baselineY,
            wordScale
          );
        }
      }
      context.font = baseContextFont;
      return geometry;
    }

    const segments = effectiveLineSegments(line);
    if (segments.length) {
      for (const segment of segments) {
        const segmentScale = docxOcrTextScale({
          text: segment.text,
          targetWidth: segment.width,
          family: geometry.font.family,
          size: geometry.displayFontSize,
          bold: Boolean(line?.bold),
          italic: Boolean(line?.italic),
          confidence: line?.confidence,
        });
        drawCalibrationScaledText(
          context,
          segment.text,
          Number(segment?.x ?? geometry.x) * sx - offsetX,
          baselineY,
          segmentScale
        );
      }
      return geometry;
    }
  }

  context.fillText(
    normalizedLineText(line),
    geometry.x * sx - offsetX,
    baselineY
  );
  return geometry;
}

function evaluateCalibrationLineVariant({
  line,
  page,
  box,
  sourceContext,
  graphicsContext,
  sourceImageData = null,
  graphicsImageData = null,
  localContext = null,
  sx,
  sy,
  color = null,
}) {
  const localWidth = Math.max(1, box.right - box.left);
  const localHeight = Math.max(1, box.bottom - box.top);
  const canvas = localContext ? null : calibrationCanvas(localWidth, localHeight);
  const context = localContext || canvas?.getContext?.("2d", { alpha: false });
  if (!context) return { error: Infinity, samples: 0 };

  const source = sourceImageData || sourceContext.getImageData(box.left, box.top, localWidth, localHeight);
  const graphics = graphicsImageData || graphicsContext.getImageData(box.left, box.top, localWidth, localHeight);
  context.putImageData(graphics, 0, 0);
  drawCalibrationLine(context, line, page, sx, sy, {
    offsetX: box.left,
    offsetY: box.top,
    color,
  });
  const candidate = context.getImageData(0, 0, localWidth, localHeight);
  return localCalibrationError(source.data, graphics.data, candidate.data);
}

function renderedOcrFeedbackError({
  page,
  sourcePixels,
  graphicsPixels,
  graphicsContext,
  width,
  height,
}) {
  const canvas = calibrationCanvas(width, height);
  const context = canvas?.getContext?.("2d", { alpha: false });
  if (!context || !graphicsContext?.canvas) return Infinity;
  context.drawImage(graphicsContext.canvas, 0, 0, width, height);
  const sx = width / Math.max(1, Number(page?.width) || 595.28);
  const sy = height / Math.max(1, Number(page?.height) || 841.89);
  const boxes = calibrationBoxes(page, width, height);
  for (const box of boxes) {
    drawCalibrationLine(context, box.line, page, sx, sy, {
      color: `#${normalizeRgbHex(box.line?.color, "000000")}`,
    });
  }
  const candidatePixels = context.getImageData(0, 0, width, height).data;
  return calibrationError(sourcePixels, graphicsPixels, candidatePixels, boxes, width);
}

function inferOcrVisualLineStyles({
  page,
  sourceContext,
  graphicsContext,
  sourcePixels,
  graphicsPixels,
  width,
  height,
}) {
  const source = String(page?.source || "").toLocaleLowerCase();
  if (source !== "ocr" || !Array.isArray(page?.layout) || !page.layout.length) {
    return { colors: 0, bold: 0, italic: 0, font: 0, baseline: 0 };
  }

  const basePage = {
    ...page,
    ocrScaleOverride: pageOcrScale({ ...page, ocrScaleOverride: undefined }),
    ocrBaselineFactorOverride: 0.82,
  };
  const sx = width / Math.max(1, Number(page.width) || 595.28);
  const sy = height / Math.max(1, Number(page.height) || 841.89);
  const boxes = calibrationBoxes(basePage, width, height);
  const result = { colors: 0, bold: 0, italic: 0, font: 0, baseline: 0 };
  const originalLines = page.layout.map((line) => ({
    line,
    color: line.color,
    bold: line.bold,
    italic: line.italic,
    ocrVisualColor: line.ocrVisualColor,
    ocrVisualStyle: line.ocrVisualStyle,
    ocrVisualFontFamily: line.ocrVisualFontFamily,
    ocrVisualBaselineOffset: line.ocrVisualBaselineOffset,
  }));
  const baselinePage = {
    ...basePage,
    layout: originalLines.map((snapshot) => ({
      ...snapshot.line,
      color: snapshot.color,
      bold: snapshot.bold,
      italic: snapshot.italic,
    })),
  };
  const baselinePageError = renderedOcrFeedbackError({
    page: baselinePage,
    sourcePixels,
    graphicsPixels,
    graphicsContext,
    width,
    height,
  });

  for (const box of boxes) {
    const line = box.line;
    const text = normalizedLineText(line);
    const compactLength = text.replace(/\s+/gu, "").length;
    if (!text || compactLength < 2) continue;

    const localWidth = Math.max(1, box.right - box.left);
    const localHeight = Math.max(1, box.bottom - box.top);
    const sourceImageData = sourceContext.getImageData(
      box.left,
      box.top,
      localWidth,
      localHeight
    );
    const graphicsImageData = graphicsContext.getImageData(
      box.left,
      box.top,
      localWidth,
      localHeight
    );
    const variantCanvas = calibrationCanvas(localWidth, localHeight);
    const variantContext = variantCanvas?.getContext?.("2d", { alpha: false });
    if (!variantContext) continue;

    const colorEvidence = inferredCalibrationColorDetails(
      sourcePixels,
      graphicsPixels,
      box,
      width
    );
    const baseColor = normalizeRgbHex(line?.color, "000000");
    let activeColor = baseColor;

    if (colorEvidence?.hex && colorEvidence.hex !== baseColor) {
      const baseVariant = evaluateCalibrationLineVariant({
        line,
        page: basePage,
        box,
        sourceContext,
        graphicsContext,
        sourceImageData,
        graphicsImageData,
        localContext: variantContext,
        sx,
        sy,
        color: `#${baseColor}`,
      });
      const colorVariant = evaluateCalibrationLineVariant({
        line,
        page: basePage,
        box,
        sourceContext,
        graphicsContext,
        sourceImageData,
        graphicsImageData,
        localContext: variantContext,
        sx,
        sy,
        color: `#${colorEvidence.hex}`,
      });
      if (shouldAcceptVisualVariant({
        baseError: baseVariant.error,
        candidateError: colorVariant.error,
        samples: Math.min(baseVariant.samples, colorVariant.samples),
        minimumSamples: 60,
        minimumRelativeGain: 0.006,
        minimumAbsoluteGain: 0.18,
      })) {
        line.color = colorEvidence.hex;
        line.ocrVisualColor = {
          luminance: colorEvidence.luminance,
          saturation: colorEvidence.saturation,
          changedPixels: colorEvidence.changedPixels,
        };
        activeColor = colorEvidence.hex;
        result.colors += 1;
      }
    }

    const confidence = Number(line?.confidence);
    if (
      compactLength < 5 ||
      !Number.isFinite(confidence) ||
      confidence < 55 ||
      (colorEvidence?.changedPixels || 0) < 22
    ) {
      continue;
    }

    const fontFamilyCandidates = [
      "Arial",
      "Times New Roman",
      "Courier New",
      "Calibri",
      "Cambria",
    ];
    const currentFamily = resolveDocxEditableFont(line).family;
    const fontBaseline = evaluateCalibrationLineVariant({
      line: { ...line },
      page: basePage,
      box,
      sourceContext,
      graphicsContext,
      sourceImageData,
      graphicsImageData,
      localContext: variantContext,
      sx,
      sy,
      color: `#${activeColor}`,
    });
    let bestFont = null;
    for (const family of fontFamilyCandidates) {
      if (family === currentFamily) continue;
      const fontLine = { ...line, ocrVisualFontFamily: family };
      const measured = evaluateCalibrationLineVariant({
        line: fontLine,
        page: basePage,
        box,
        sourceContext,
        graphicsContext,
        sourceImageData,
        graphicsImageData,
        localContext: variantContext,
        sx,
        sy,
        color: `#${activeColor}`,
      });
      if (!shouldAcceptVisualVariant({
        baseError: fontBaseline.error,
        candidateError: measured.error,
        samples: Math.min(fontBaseline.samples, measured.samples),
        minimumSamples: 100,
        minimumRelativeGain: 0.04,
        minimumAbsoluteGain: 0.75,
      })) continue;
      if (!bestFont || measured.error < bestFont.measured.error) {
        bestFont = { family, measured };
      }
    }
    if (bestFont) {
      line.ocrVisualFontFamily = bestFont.family;
      result.font += 1;
    }

    // La caja inferior de Tesseract no es una baseline tipográfica: incluye
    // descendentes y ruido. Probamos un pequeño ajuste vertical por línea y
    // solo lo conservamos si reduce el error de tinta local y, después, el de
    // la página completa. Esto evita aplicar un desplazamiento global que
    // mejora unas páginas pero empeora otras.
    const baselineReference = evaluateCalibrationLineVariant({
      line: { ...line, ocrVisualBaselineOffset: 0 },
      page: basePage,
      box,
      sourceContext,
      graphicsContext,
      sourceImageData,
      graphicsImageData,
      localContext: variantContext,
      sx,
      sy,
      color: `#${activeColor}`,
    });
    const geometryForOffset = layoutLineGeometry(line, basePage);
    const offsetMagnitude = Math.min(2.8, Math.max(0.35, geometryForOffset.displayFontSize));
    const baselineOffsets = [-0.24, -0.18, -0.12, -0.06, 0.06].map(
      (ratio) => ratio * offsetMagnitude
    );
    let bestBaseline = null;
    for (const offset of baselineOffsets) {
      const offsetLine = { ...line, ocrVisualBaselineOffset: offset };
      const measured = evaluateCalibrationLineVariant({
        line: offsetLine,
        page: basePage,
        box,
        sourceContext,
        graphicsContext,
        sourceImageData,
        graphicsImageData,
        localContext: variantContext,
        sx,
        sy,
        color: `#${activeColor}`,
      });
      if (!shouldAcceptVisualVariant({
        baseError: baselineReference.error,
        candidateError: measured.error,
        samples: Math.min(baselineReference.samples, measured.samples),
        minimumSamples: 80,
        minimumRelativeGain: 0.018,
        minimumAbsoluteGain: 0.35,
      })) continue;
      if (!bestBaseline || measured.error < bestBaseline.measured.error) {
        bestBaseline = { offset, measured };
      }
    }
    if (bestBaseline) {
      line.ocrVisualBaselineOffset = bestBaseline.offset;
      result.baseline += 1;
    }

    const currentLine = { ...line };
    const baseline = evaluateCalibrationLineVariant({
      line: currentLine,
      page: basePage,
      box,
      sourceContext,
      graphicsContext,
      sourceImageData,
      graphicsImageData,
      localContext: variantContext,
      sx,
      sy,
      color: `#${activeColor}`,
    });
    if (!Number.isFinite(baseline.error)) continue;

    const variants = [
      {
        name: "bold",
        line: { ...line, bold: true, italic: false },
        minimumRelativeGain: 0.025,
        minimumAbsoluteGain: 0.45,
      },
      {
        name: "italic",
        line: { ...line, bold: false, italic: true },
        minimumRelativeGain: 0.045,
        minimumAbsoluteGain: 0.55,
      },
      {
        name: "bold-italic",
        line: { ...line, bold: true, italic: true },
        minimumRelativeGain: 0.055,
        minimumAbsoluteGain: 0.65,
      },
    ];

    let best = null;
    for (const variant of variants) {
      const measured = evaluateCalibrationLineVariant({
        line: variant.line,
        page: basePage,
        box,
        sourceContext,
        graphicsContext,
        sourceImageData,
        graphicsImageData,
        localContext: variantContext,
        sx,
        sy,
        color: `#${activeColor}`,
      });
      if (!shouldAcceptVisualVariant({
        baseError: baseline.error,
        candidateError: measured.error,
        samples: Math.min(baseline.samples, measured.samples),
        minimumSamples: 90,
        minimumRelativeGain: variant.minimumRelativeGain,
        minimumAbsoluteGain: variant.minimumAbsoluteGain,
      })) {
        continue;
      }
      if (!best || measured.error < best.measured.error) {
        best = { ...variant, measured };
      }
    }

    if (best) {
      line.bold = Boolean(best.line.bold);
      line.italic = Boolean(best.line.italic);
      line.ocrVisualStyle = best.name;
      if (line.bold) result.bold += 1;
      if (line.italic) result.italic += 1;
    }
  }

  const changed = result.colors + result.bold + result.italic + result.font + result.baseline;
  if (!changed) return result;

  const candidatePage = {
    ...basePage,
    layout: page.layout,
  };
  const candidatePageError = renderedOcrFeedbackError({
    page: candidatePage,
    sourcePixels,
    graphicsPixels,
    graphicsContext,
    width,
    height,
  });
  const relativeGain =
    Number.isFinite(baselinePageError) && baselinePageError > 0
      ? (baselinePageError - candidatePageError) / baselinePageError
      : -Infinity;
  const pageAccepted = shouldAcceptOcrVisualPageFeedback({
    baseError: baselinePageError,
    candidateError: candidatePageError,
    changedLines: changed,
  });

  if (!pageAccepted) {
    for (const snapshot of originalLines) {
      snapshot.line.color = snapshot.color;
      snapshot.line.bold = snapshot.bold;
      snapshot.line.italic = snapshot.italic;
      if (snapshot.ocrVisualColor === undefined) delete snapshot.line.ocrVisualColor;
      else snapshot.line.ocrVisualColor = snapshot.ocrVisualColor;
      if (snapshot.ocrVisualStyle === undefined) delete snapshot.line.ocrVisualStyle;
      else snapshot.line.ocrVisualStyle = snapshot.ocrVisualStyle;
      if (snapshot.ocrVisualFontFamily === undefined) delete snapshot.line.ocrVisualFontFamily;
      else snapshot.line.ocrVisualFontFamily = snapshot.ocrVisualFontFamily;
      if (snapshot.ocrVisualBaselineOffset === undefined) delete snapshot.line.ocrVisualBaselineOffset;
      else snapshot.line.ocrVisualBaselineOffset = snapshot.ocrVisualBaselineOffset;
    }
    return { colors: 0, bold: 0, italic: 0, font: 0, baseline: 0 };
  }

  return {
    ...result,
    relativeGain,
    baseError: baselinePageError,
    visualError: candidatePageError,
  };
}

function calibrationBoxes(page, width, height) {
  const sx = width / Math.max(1, Number(page?.width) || 595.28);
  const sy = height / Math.max(1, Number(page?.height) || 841.89);
  const layout = Array.isArray(page?.layout) ? page.layout : [];
  const protectionProfile = buildOcrRasterProtectionProfile(layout);
  return layout
    .filter((line) => !shouldPreserveOcrRasterLine(line, protectionProfile))
    .map((line) => {
    const geometry = layoutLineGeometry(line, page);
    const pad = Math.max(2, Math.ceil(geometry.fontSize * sy * 0.22));
    return {
      line,
      geometry,
      left: Math.max(0, Math.floor(geometry.x * sx) - pad),
      top: Math.max(0, Math.floor(geometry.top * sy) - pad),
      right: Math.min(width, Math.ceil((geometry.x + geometry.width) * sx) + pad),
      bottom: Math.min(height, Math.ceil((geometry.top + geometry.height) * sy) + pad),
    };
  }).filter((box) => box.right > box.left && box.bottom > box.top);
}

function calibrationError(sourcePixels, graphicsPixels, candidatePixels, boxes, width) {
  let error = 0;
  let samples = 0;
  for (const box of boxes) {
    for (let y = box.top; y < box.bottom; y += 1) {
      for (let x = box.left; x < box.right; x += 1) {
        const offset = (y * width + x) * 4;
        const sourceDelta =
          Math.abs(sourcePixels[offset] - graphicsPixels[offset]) +
          Math.abs(sourcePixels[offset + 1] - graphicsPixels[offset + 1]) +
          Math.abs(sourcePixels[offset + 2] - graphicsPixels[offset + 2]);
        const candidateDelta =
          Math.abs(candidatePixels[offset] - graphicsPixels[offset]) +
          Math.abs(candidatePixels[offset + 1] - graphicsPixels[offset + 1]) +
          Math.abs(candidatePixels[offset + 2] - graphicsPixels[offset + 2]);
        if (sourceDelta < 24 && candidateDelta < 24) continue;
        error +=
          Math.abs(sourcePixels[offset] - candidatePixels[offset]) +
          Math.abs(sourcePixels[offset + 1] - candidatePixels[offset + 1]) +
          Math.abs(sourcePixels[offset + 2] - candidatePixels[offset + 2]);
        samples += 3;
      }
    }
  }
  return samples >= 180 ? error / samples : Infinity;
}

async function autoCalibrateOcrPage(page, pageImages) {
  if (!Array.isArray(page?.layout) || !page.layout.length) return null;
  const pageSource = String(page?.source || "").toLocaleLowerCase();
  const ocrLayout = page.layout.filter((line) =>
    String(line?.source || pageSource).toLocaleLowerCase() === "ocr"
  );
  if (!ocrLayout.length) return null;
  // En páginas híbridas calibramos únicamente el texto que procede de OCR.
  // Las líneas nativas ya traen métricas tipográficas del PDF y no deben
  // influir en la búsqueda de escala/baseline OCR ni recibir sus ajustes.
  page = { ...page, source: "ocr", layout: ocrLayout };
  const source = calibrationImageFromCollection(pageImages, page.pageNumber, "calibrationSource");
  const graphics = calibrationImageFromCollection(pageImages, page.pageNumber, "graphicsOnly");
  if (!source || !graphics) return null;

  const [sourceBitmap, graphicsBitmap] = await Promise.all([
    decodeCalibrationImage(source),
    decodeCalibrationImage(graphics),
  ]);
  if (!sourceBitmap || !graphicsBitmap) return null;
  try {
    const sourceWidth = Math.min(sourceBitmap.width, graphicsBitmap.width);
    const sourceHeight = Math.min(sourceBitmap.height, graphicsBitmap.height);
    const rasterScale = Math.min(1, 900 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * rasterScale));
    const height = Math.max(1, Math.round(sourceHeight * rasterScale));
    const canvas = calibrationCanvas(width, height);
    const sourceCanvas = calibrationCanvas(width, height);
    const graphicsCanvas = calibrationCanvas(width, height);
    const context = canvas?.getContext?.("2d", { alpha: false });
    const sourceContext = sourceCanvas?.getContext?.("2d", { alpha: false });
    const graphicsContext = graphicsCanvas?.getContext?.("2d", { alpha: false });
    if (!context || !sourceContext || !graphicsContext) return null;
    sourceContext.drawImage(sourceBitmap, 0, 0, width, height);
    graphicsContext.drawImage(graphicsBitmap, 0, 0, width, height);
    const sourcePixels = sourceContext.getImageData(0, 0, width, height).data;
    const graphicsPixels = graphicsContext.getImageData(0, 0, width, height).data;
    const sx = width / Math.max(1, Number(page.width) || 595.28);
    const sy = height / Math.max(1, Number(page.height) || 841.89);
    const visualStyleFeedback = inferOcrVisualLineStyles({
      page,
      sourceContext,
      graphicsContext,
      sourcePixels,
      graphicsPixels,
      width,
      height,
    });
    if (
      visualStyleFeedback.colors ||
      visualStyleFeedback.bold ||
      visualStyleFeedback.italic ||
      visualStyleFeedback.font ||
      visualStyleFeedback.baseline
    ) {
      page.docxOcrVisualStyleFeedback = visualStyleFeedback;
    }
    const baseScale = pageOcrScale({ ...page, ocrScaleOverride: undefined });
    const fontSizes = page.layout
      .map((line) => Number(line?.fontSize))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    const medianFontSize = fontSizes.length
      ? fontSizes[Math.floor(fontSizes.length / 2)]
      : 0;
    // Los caracteres OCR grandes ofrecen una medida de caja más estable. En
    // ellos evitamos saltos bruscos provocados por residuos del inpainting.
    // El texto pequeño admite una búsqueda mayor porque un punto de error
    // relativo pesa mucho más. Es una propiedad geométrica, no documental.
    const maximumIncrease = medianFontSize >= 6 ? 0.08 : 0.16;
    const candidates = [...new Set([
      baseScale,
      0.66, 0.70, 0.74, 0.78, 0.82, 0.86, 0.90, 0.94, 0.98, 1.02,
    ])]
      .filter((scale) => scale <= baseScale + maximumIncrease + 0.001)
      .sort((a, b) => a - b);
    const baseBaselineFactor = 0.82;
    // La caja OCR ya contiene el extremo inferior del glifo. Desplazar el
    // texto más abajo que esa línea base nunca recupera información visual y
    // aumenta el riesgo de invadir la línea siguiente; solo se prueba hacia
    // la parte superior de la caja.
    const baselineFactors = [0.82, 0.94, 1.06, 1.18, 1.24];
    let best = {
      scale: baseScale,
      baselineFactor: baseBaselineFactor,
      error: Infinity,
    };
    let baseError = Infinity;

    for (const scale of candidates) {
      for (const baselineFactor of baselineFactors) {
        const candidatePage = {
          ...page,
          ocrScaleOverride: scale,
          ocrBaselineFactorOverride: baselineFactor,
        };
        const boxes = calibrationBoxes(candidatePage, width, height);
        context.clearRect(0, 0, width, height);
        context.drawImage(graphicsBitmap, 0, 0, width, height);
        context.textBaseline = "alphabetic";
        for (const box of boxes) {
          const line = box.line;
          drawCalibrationLine(
            context,
            line,
            candidatePage,
            sx,
            sy,
            {
              color: line?.color
                ? `#${normalizeRgbHex(line.color, "000000")}`
                : inferredCalibrationColor(
                    sourcePixels,
                    graphicsPixels,
                    box,
                    width
                  ),
            }
          );
        }
        const candidatePixels = context.getImageData(0, 0, width, height).data;
        const error = calibrationError(sourcePixels, graphicsPixels, candidatePixels, boxes, width);
        if (
          Math.abs(scale - baseScale) < 0.001 &&
          Math.abs(baselineFactor - baseBaselineFactor) < 0.001
        ) {
          baseError = error;
        }
        if (error < best.error) {
          best = { scale, baselineFactor, error };
        }
      }
    }

    if (!Number.isFinite(best.error) || !Number.isFinite(baseError)) return null;
    const relativeGain = (baseError - best.error) / Math.max(1, baseError);
    const scaleDelta = best.scale - baseScale;
    const baselineDelta = best.baselineFactor - baseBaselineFactor;
    if (!shouldAcceptOcrCalibration({
      relativeGain,
      scaleDelta,
      baselineDelta,
      lineCount: page.layout.length,
    })) {
      return null;
    }
    return {
      scale: best.scale,
      baselineFactor: best.baselineFactor,
      relativeGain,
      baseError,
      calibratedError: best.error,
      adjustmentKind: Math.abs(baselineDelta) >= 0.001
        ? "baseline-and-scale"
        : "scale-only-strong-evidence",
    };
  } finally {
    sourceBitmap.close?.();
    graphicsBitmap.close?.();
  }
}

async function autoCalibrateOcrPages(pages, pageImages) {
  for (const page of pages) {
    try {
      const result = await autoCalibrateOcrPage(page, pageImages);
      if (!result) continue;
      page.ocrScaleOverride = result.scale;
      page.ocrBaselineFactorOverride = result.baselineFactor;
      page.docxOcrCalibration = result;
    } catch (error) {
      console.warn(`[PDF→Word] No se pudo autocalibrar la página ${page?.pageNumber}:`, error);
    }
  }
}

function docxAnchorSpacing(api) {
  return {
    before: 0,
    after: 0,
    line: 1,
    lineRule: api.LineRuleType?.EXACT || "exact",
  };
}

function layoutLineGeometry(line, page) {
  const pageWidth = Math.max(72, Number(page?.width) || 595.28);
  const pageHeight = Math.max(72, Number(page?.height) || 841.89);
  const fontSize = initialDocxFontSize(line, page);
  const x = clampDocx(line?.x, 0, Math.max(0, pageWidth - 1));
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  const font = resolveDocxEditableFont(line);
  const displayFontSize = calibratedDocxFontSize(line, page, font);
  const ocrTop = Number(line?.ocrTop);
  const ocrBaselineHint = Number(line?.ocrBaselineHint);
  const baselineFactor = clampDocx(page?.ocrBaselineFactorOverride ?? 0.82, 0.68, 1.28);

  let computedTop;
  if (source === "ocr" && Number.isFinite(ocrBaselineHint)) {
    // La baseline robusta procede de la mediana de los fondos de palabra, no
    // del borde inferior de la caja unión. Con factor 0.82 el baseline visible
    // de Word cae exactamente sobre esa referencia. La autocalibración de
    // página conserva su semántica como desplazamiento adicional relativo.
    computedTop =
      ocrBaselineHint -
      displayFontSize * 0.82 -
      fontSize * (baselineFactor - 0.82);
  } else if (source === "ocr" && Number.isFinite(ocrTop)) {
    computedTop =
      ocrTop +
      Math.max(fontSize, Number(line?.height) || fontSize) -
      fontSize * baselineFactor;
  } else {
    // v21: geometría vertical nativa adaptativa.
    // Si la caja del PDF demuestra una altura vertical real superior al
    // fontSize nominal y el tamaño visible se ha reducido, usamos ese tamaño
    // visible también para posicionar la baseline. En el resto conservamos
    // exactamente el comportamiento histórico.
    const nativeHeight = Number(line?.height);
    const nativeHasVerticalScale =
      displayFontSize < fontSize &&
      Number.isFinite(nativeHeight) &&
      nativeHeight > fontSize + (1 / DOCX_TWIPS_PER_POINT);
    const nativeBaselineSize = nativeHasVerticalScale
      ? displayFontSize
      : fontSize;

    computedTop =
      pageHeight -
      (Number(line?.y) || 0) -
      (nativeBaselineSize * 0.82);
  }

  const visualBaselineOffset = source === "ocr"
    ? clampDocx(line?.ocrVisualBaselineOffset ?? 0, -4, 4)
    : 0;
  const top = clampDocx(
    computedTop + visualBaselineOffset,
    0,
    Math.max(0, pageHeight - 1)
  );
  const width = clampDocx(
    Math.max(12, Number(line?.width) || (String(line?.text || "").length * fontSize * 0.45)),
    8,
    Math.max(8, pageWidth - x)
  );
  return {
    x,
    top,
    width,
    height: Math.max(6, fontSize * 1.30),
    fontSize,
    displayFontSize,
    font,
  };
}

export function layoutLineTextAndTabs(line) {
  const segments = Array.isArray(line?.segments)
    ? line.segments.filter((segment) => String(segment?.text || "").trim())
    : [];
  if (segments.length < 2) {
    return {
      text: normalizedLineText(line),
      tabStops: [],
      segments: effectiveLineSegments(line),
    };
  }

  const originX = Number(segments[0]?.x) || Number(line?.x) || 0;
  const tabStops = [];
  let text = String(segments[0]?.text || "").trim();

  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    tabStops.push({
      type: "left",
      position: Math.max(1, Math.round(((Number(segment?.x) || originX) - originX) * DOCX_TWIPS_PER_POINT)),
    });
    text += `\t${String(segment?.text || "").trim()}`;
  }

  return { text, tabStops, segments };
}



const DOCX_NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  v: "urn:schemas-microsoft-com:vml",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  wps: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
};

function docxXmlElement(documentXml, prefix, localName, attributes = {}) {
  const element = documentXml.createElementNS(DOCX_NS[prefix], `${prefix}:${localName}`);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function docxStylePoints(style, property, fallback = 0) {
  const match = String(style || "").match(
    new RegExp(`(?:^|;)${property.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}:(-?[0-9.]+)pt(?:;|$)`)
  );
  return match ? Number(match[1]) : fallback;
}

function docxTextboxHasHiddenText(shape) {
  return Boolean(shape.getElementsByTagNameNS(DOCX_NS.w, "vanish").length);
}

function drawingMlTextboxParagraph(documentXml, shape, order) {
  const style = shape.getAttribute("style") || "";
  const x = docxStylePoints(style, "left", 0);
  const top = docxStylePoints(style, "top", 0);
  const width = Math.max(1, docxStylePoints(style, "width", 100));
  const height = Math.max(1, docxStylePoints(style, "height", 20));
  const emu = (points) => Math.round(Number(points || 0) * DOCX_EMUS_PER_POINT);
  const textboxContent = shape.getElementsByTagNameNS(DOCX_NS.w, "txbxContent")[0];
  if (!textboxContent) return null;

  const paragraph = docxXmlElement(documentXml, "w", "p");
  const paragraphProperties = docxXmlElement(documentXml, "w", "pPr");
  paragraphProperties.appendChild(docxXmlElement(documentXml, "w", "spacing", {
    "w:after": 0,
    "w:before": 0,
    "w:line": 1,
    "w:lineRule": "exact",
  }));
  paragraph.appendChild(paragraphProperties);

  const run = docxXmlElement(documentXml, "w", "r");
  const runProperties = docxXmlElement(documentXml, "w", "rPr");
  runProperties.appendChild(docxXmlElement(documentXml, "w", "noProof"));
  run.appendChild(runProperties);

  const drawing = docxXmlElement(documentXml, "w", "drawing");
  const anchor = docxXmlElement(documentXml, "wp", "anchor", {
    distT: 0,
    distB: 0,
    distL: 0,
    distR: 0,
    simplePos: 0,
    relativeHeight: 251658240 + order,
    behindDoc: 0,
    locked: 0,
    layoutInCell: 0,
    allowOverlap: 1,
  });
  anchor.appendChild(docxXmlElement(documentXml, "wp", "simplePos", { x: 0, y: 0 }));

  const horizontal = docxXmlElement(documentXml, "wp", "positionH", { relativeFrom: "page" });
  const horizontalOffset = docxXmlElement(documentXml, "wp", "posOffset");
  horizontalOffset.textContent = String(emu(x));
  horizontal.appendChild(horizontalOffset);
  anchor.appendChild(horizontal);

  const vertical = docxXmlElement(documentXml, "wp", "positionV", { relativeFrom: "page" });
  const verticalOffset = docxXmlElement(documentXml, "wp", "posOffset");
  verticalOffset.textContent = String(emu(top));
  vertical.appendChild(verticalOffset);
  anchor.appendChild(vertical);

  anchor.appendChild(docxXmlElement(documentXml, "wp", "extent", {
    cx: emu(width),
    cy: emu(height),
  }));
  anchor.appendChild(docxXmlElement(documentXml, "wp", "effectExtent", { l: 0, t: 0, r: 0, b: 0 }));
  anchor.appendChild(docxXmlElement(documentXml, "wp", "wrapNone"));
  anchor.appendChild(docxXmlElement(documentXml, "wp", "docPr", {
    id: 10000 + order,
    name: `Texto PDF editable ${order}`,
    descr: "Texto editable reconstruido localmente desde el PDF.",
  }));

  const nonVisual = docxXmlElement(documentXml, "wp", "cNvGraphicFramePr");
  nonVisual.appendChild(docxXmlElement(documentXml, "a", "graphicFrameLocks", { noChangeAspect: 0 }));
  anchor.appendChild(nonVisual);

  const graphic = docxXmlElement(documentXml, "a", "graphic");
  const graphicData = docxXmlElement(documentXml, "a", "graphicData", {
    uri: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
  });
  const wordShape = docxXmlElement(documentXml, "wps", "wsp");
  wordShape.appendChild(docxXmlElement(documentXml, "wps", "cNvSpPr", { txBox: 1 }));

  const shapeProperties = docxXmlElement(documentXml, "wps", "spPr");
  const transform = docxXmlElement(documentXml, "a", "xfrm");
  transform.appendChild(docxXmlElement(documentXml, "a", "off", { x: 0, y: 0 }));
  transform.appendChild(docxXmlElement(documentXml, "a", "ext", { cx: emu(width), cy: emu(height) }));
  shapeProperties.appendChild(transform);
  const geometry = docxXmlElement(documentXml, "a", "prstGeom", { prst: "rect" });
  geometry.appendChild(docxXmlElement(documentXml, "a", "avLst"));
  shapeProperties.appendChild(geometry);
  shapeProperties.appendChild(docxXmlElement(documentXml, "a", "noFill"));
  const line = docxXmlElement(documentXml, "a", "ln");
  line.appendChild(docxXmlElement(documentXml, "a", "noFill"));
  shapeProperties.appendChild(line);
  wordShape.appendChild(shapeProperties);

  const textBox = docxXmlElement(documentXml, "wps", "txbx");
  textBox.appendChild(textboxContent.cloneNode(true));
  wordShape.appendChild(textBox);
  const bodyProperties = docxXmlElement(documentXml, "wps", "bodyPr", {
    rot: 0,
    vert: "horz",
    wrap: "none",
    lIns: 0,
    tIns: 0,
    rIns: 0,
    bIns: 0,
    anchor: "t",
    anchorCtr: 0,
    upright: 1,
  });
  bodyProperties.appendChild(docxXmlElement(documentXml, "a", "noAutofit"));
  wordShape.appendChild(bodyProperties);

  graphicData.appendChild(wordShape);
  graphic.appendChild(graphicData);
  anchor.appendChild(graphic);
  drawing.appendChild(anchor);
  run.appendChild(drawing);
  paragraph.appendChild(run);
  return paragraph;
}

async function modernizeEditableDocxTextboxes(bytes) {
  const JSZip = globalThis.JSZip;
  if (!JSZip?.loadAsync) {
    throw new Error("El motor local JSZip no está disponible para completar el Word editable.");
  }

  const zip = await JSZip.loadAsync(bytes);
  const documentPart = zip.file("word/document.xml");
  if (!documentPart) return bytes;
  const xml = await documentPart.async("string");
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  if (documentXml.getElementsByTagName("parsererror").length) {
    throw new Error("No se pudo analizar la estructura interna del documento Word.");
  }

  const shapes = [...documentXml.getElementsByTagNameNS(DOCX_NS.v, "shape")];
  let replaced = 0;
  for (const shape of shapes) {
    if (docxTextboxHasHiddenText(shape)) continue;
    const pict = shape.parentNode;
    const paragraph = pict?.parentNode;
    if (!paragraph || paragraph.namespaceURI !== DOCX_NS.w || paragraph.localName !== "p") continue;
    const modern = drawingMlTextboxParagraph(documentXml, shape, replaced + 1);
    if (!modern) continue;
    paragraph.parentNode?.replaceChild(modern, paragraph);
    replaced += 1;
  }

  if (!replaced) return bytes;
  zip.file("word/document.xml", new XMLSerializer().serializeToString(documentXml));
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function shouldUseDocxStyledRuns(line, page, content = null) {
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  const tabStops = Array.isArray(content?.tabStops) ? content.tabStops : [];
  return (
    source !== "ocr" &&
    Array.isArray(line?.styledRuns) &&
    line.styledRuns.filter((run) => String(run?.text || "").length).length > 1 &&
    tabStops.length === 0
  );
}


function sortedOcrWordRuns(line) {
  return (Array.isArray(line?.styledRuns) ? line.styledRuns : [])
    .filter((run) => (
      String(run?.text || "").trim() &&
      Number.isFinite(Number(run?.x)) &&
      Number.isFinite(Number(run?.width)) &&
      Number(run?.width) > 0
    ))
    .map((run) => ({ ...run, x: Number(run.x), width: Number(run.width) }))
    .sort((a, b) => a.x - b.x);
}

function runsForOcrSegment(runs, segment) {
  const x0 = Number(segment?.x);
  const x1 = x0 + Math.max(0.1, Number(segment?.width) || 0.1);
  return runs.filter((run) => {
    const center = run.x + run.width / 2;
    return center >= x0 - 0.2 && center <= x1 + 0.2;
  });
}

function continuousOcrWordStarts(runs, segment, line, geometry) {
  if (!runs.length) return [];
  const text = runs.map((run) => String(run.text || "").trim()).join(" ");
  const targetWidth = Math.max(0.1, Number(segment?.width) || 0.1);
  const scale = docxOcrTextScale({
    text,
    targetWidth,
    family: geometry.font.family,
    size: geometry.displayFontSize,
    bold: Boolean(line?.bold),
    italic: Boolean(line?.italic),
    confidence: line?.confidence,
  });
  const widthScale = (Number(scale) || 100) / 100;
  const starts = [];
  let prefix = "";
  for (const [index, run] of runs.entries()) {
    if (index) prefix += " ";
    starts.push(
      Number(segment?.x || runs[0].x) +
      measuredTextWidth(prefix, {
        family: geometry.font.family,
        size: geometry.displayFontSize,
        bold: Boolean(line?.bold),
        italic: Boolean(line?.italic),
      }) * widthScale
    );
    prefix += String(run.text || "").trim();
  }
  return starts;
}

export function buildOcrWordAnchorPlan(line, page, geometryOverride = null) {
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  if (source !== "ocr") return { enabled: false, reason: "not-ocr" };
  const confidence = Number(line?.confidence);
  if (!Number.isFinite(confidence) || confidence < 75) {
    return { enabled: false, reason: "low-line-confidence" };
  }

  const runs = sortedOcrWordRuns(line);
  if (runs.length < 2 || runs.length > 28) {
    return { enabled: false, reason: "word-count" };
  }
  const compactLength = runs.reduce(
    (sum, run) => sum + String(run.text || "").replace(/\s+/gu, "").length,
    0
  );
  if (compactLength < 5) return { enabled: false, reason: "short-line" };

  const geometry = geometryOverride || layoutLineGeometry(line, page);
  const segments = effectiveLineSegments(line);
  const predictedStarts = [];
  const actualStarts = [];
  for (const segment of segments) {
    const segmentRuns = runsForOcrSegment(runs, segment);
    if (!segmentRuns.length) continue;
    const predicted = continuousOcrWordStarts(segmentRuns, segment, line, geometry);
    for (let index = 0; index < segmentRuns.length; index += 1) {
      predictedStarts.push(predicted[index]);
      actualStarts.push(segmentRuns[index].x);
    }
  }
  if (predictedStarts.length !== runs.length) {
    return { enabled: false, reason: "segment-mapping" };
  }

  const errors = actualStarts.map((value, index) => Math.abs(value - predictedStarts[index]));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const maxError = Math.max(...errors);
  const meanThreshold = Math.max(0.75, geometry.displayFontSize * 0.075);
  const maxThreshold = Math.max(1.8, geometry.displayFontSize * 0.17);
  if (meanError < meanThreshold && maxError < maxThreshold) {
    return { enabled: false, reason: "continuous-layout-accurate", meanError, maxError };
  }

  // Las tabulaciones de Word solo pueden avanzar. Si el OCR produce cajas
  // fuertemente solapadas, anclarlas individualmente sería menos robusto que
  // mantener el flujo de v14.
  for (let index = 1; index < runs.length; index += 1) {
    if (runs[index].x <= runs[index - 1].x + 0.35) {
      return { enabled: false, reason: "non-increasing-geometry", meanError, maxError };
    }
  }

  const originX = runs[0].x;
  const tabStops = runs.slice(1).map((run) => ({
    type: "left",
    position: Math.max(1, Math.round((run.x - originX) * DOCX_TWIPS_PER_POINT)),
  }));
  const words = runs.map((run) => ({
    text: String(run.text || "").trim(),
    x: run.x,
    width: run.width,
    confidence: Number.isFinite(Number(run?.confidence)) ? Number(run.confidence) : confidence,
  }));

  return {
    enabled: true,
    reason: "geometric-drift",
    originX,
    words,
    tabStops,
    meanError,
    maxError,
  };
}

function editableOcrSegmentRunOptions(segment, line, geometry, singleRun) {
  const scale = docxOcrTextScale({
    text: segment?.text,
    targetWidth: segment?.width,
    family: geometry.font.family,
    size: geometry.displayFontSize,
    bold: Boolean(line?.bold),
    italic: Boolean(line?.italic),
    confidence: line?.confidence,
  });
  return {
    ...singleRun,
    text: String(segment?.text || ""),
    ...(scale ? { scale } : {}),
  };
}


function editableOcrWordRunOptions(word, line, geometry, singleRun, page) {
  const text = String(word?.text || "");
  const confidence = Number(word?.confidence ?? line?.confidence);
  const baseScale = docxOcrWordTextScale({
    text,
    targetWidth: word?.width,
    family: geometry.font.family,
    size: geometry.displayFontSize,
    bold: Boolean(line?.bold),
    italic: Boolean(line?.italic),
    confidence,
  });

  // v20: recuperación vertical adaptativa de palabras OCR.
  // En páginas con al menos 32 líneas OCR, aumenta un 14 % el tamaño
  // tipográfico de palabras ancladas fiables y compensa horizontalmente
  // para conservar aproximadamente el ancho de v19.
  const pageLineCount = Array.isArray(page?.layout)
    ? page.layout.filter((candidateLine) => {
        const source = String(
          candidateLine?.source || page?.source || ""
        ).toLocaleLowerCase();
        return source === "ocr";
      }).length
    : 0;
  const pageAllowsLift = pageLineCount >= 32;

  const fontLift = 1.14;
  const baseScalePercent = Number(baseScale) || 100;
  const compensatedScale = Math.round(baseScalePercent / fontLift);
  const canLift =
    pageAllowsLift &&
    Number.isFinite(confidence) &&
    confidence >= 75 &&
    compensatedScale >= 78 &&
    compensatedScale <= 122;

  return {
    ...singleRun,
    text,
    ...(canLift
      ? {
          size: Math.max(9, Math.round(geometry.displayFontSize * fontLift * 2)),
          scale: compensatedScale,
        }
      : (baseScale ? { scale: baseScale } : {})),
  };
}

function editableLineTextbox(line, page, api, index) {
  const geometry = layoutLineGeometry(line, page);
  const content = layoutLineTextAndTabs(line);
  const wordAnchorPlan = buildOcrWordAnchorPlan(line, page, geometry);
  const activeTabStops = wordAnchorPlan.enabled ? wordAnchorPlan.tabStops : content.tabStops;
  const style = lineStyle(line);
  const color = (() => {
    const candidate = String(line?.color || style.color || "000000").replace(/^#/u, "").toUpperCase();
    return /^[0-9A-F]{6}$/u.test(candidate) ? candidate : "000000";
  })();
  const singleRun = {
    text: content.text,
    font: geometry.font.family,
    size: Math.max(9, Math.round(geometry.displayFontSize * 2)),
    bold: Boolean(line?.bold),
    italics: Boolean(line?.italic),
    color,
    noProof: true,
  };
  // Los runs OCR proceden de palabras detectadas de forma independiente y no
  // contienen los espacios que sí existen en `line.text`. Usarlos como runs
  // consecutivos colapsa palabras en Word y, además, pisa el color/negrita/
  // cursiva inferidos visualmente a nivel de línea. Hasta disponer de estilo
  // visual fiable por palabra, la unidad editable OCR correcta es la línea.
  // En PDF nativo mantenemos los runs porque sí traen estilo tipográfico real.
  const styledRuns = shouldUseDocxStyledRuns(line, page, content)
    ? line.styledRuns.filter((run) => String(run?.text || "").length)
    : [];
  const source = String(line?.source || page?.source || "").toLocaleLowerCase();
  let runChildren;
  if (source === "ocr" && wordAnchorPlan.enabled) {
    runChildren = [];
    wordAnchorPlan.words.forEach((word, wordIndex) => {
      if (wordIndex) {
        runChildren.push(new api.TextRun({
          ...singleRun,
          text: "\t",
        }));
      }
      runChildren.push(new api.TextRun(
        editableOcrWordRunOptions(word, line, geometry, singleRun, page)
      ));
    });
  } else if (source === "ocr" && Array.isArray(content.segments) && content.segments.length) {
    runChildren = [];
    content.segments.forEach((segment, segmentIndex) => {
      if (segmentIndex) {
        runChildren.push(new api.TextRun({
          ...singleRun,
          text: "\t",
        }));
      }
      runChildren.push(new api.TextRun(
        editableOcrSegmentRunOptions(segment, line, geometry, singleRun)
      ));
    });
  } else if (styledRuns.length > 1) {
    runChildren = styledRuns.map((run) => {
      const runFont = resolveDocxEditableFont(run);
      return new api.TextRun({
        ...singleRun,
        text: String(run.text || ""),
        font: runFont.family,
        bold: Boolean(run.bold),
        italics: Boolean(run.italic),
        color: (() => {
          const candidate = String(run.color || color).replace(/^#/u, "").toUpperCase();
          return /^[0-9A-F]{6}$/u.test(candidate) ? candidate : color;
        })(),
      });
    });
  } else {
    const segment = content.segments?.[0] || { text: content.text, width: line?.width };
    runChildren = [new api.TextRun(
      source === "ocr"
        ? editableOcrSegmentRunOptions(segment, line, geometry, singleRun)
        : singleRun
    )];
  }
  const paragraph = new api.Paragraph({
    alignment: line?.centered ? api.AlignmentType?.CENTER : api.AlignmentType?.LEFT,
    bidirectional: Boolean(line?.rtl),
    spacing: {
      before: 0,
      after: 0,
      line: Math.max(1, Math.round(Math.max(geometry.displayFontSize * 1.04, 4.4) * DOCX_TWIPS_PER_POINT)),
      lineRule: api.LineRuleType?.EXACT || "exact",
    },
    tabStops: activeTabStops.map((tab) => ({
      type: api.TabStopType?.LEFT || tab.type,
      position: tab.position,
    })),
    children: runChildren,
  });

  return new api.Textbox({
    spacing: docxAnchorSpacing(api),
    children: [paragraph],
    style: {
      position: "absolute",
      positionHorizontal: "absolute",
      positionHorizontalRelative: "page",
      positionVertical: "absolute",
      positionVerticalRelative: "page",
      left: `${geometry.x.toFixed(2)}pt`,
      top: `${geometry.top.toFixed(2)}pt`,
      width: `${geometry.width.toFixed(2)}pt`,
      height: `${Math.max(geometry.height, geometry.displayFontSize * 1.35).toFixed(2)}pt`,
      wrapStyle: "none",
      wrapDistanceTop: 0,
      wrapDistanceRight: 0,
      wrapDistanceBottom: 0,
      wrapDistanceLeft: 0,
      marginTop: "0pt",
      marginRight: "0pt",
      marginBottom: "0pt",
      marginLeft: "0pt",
      zIndex: 20 + index,
    },
  });
}

function floatingPageImageParagraph(page, image, api, { behindDocument = true } = {}) {
  const widthPoints = Math.max(72, Number(page?.width) || 595.28);
  const heightPoints = Math.max(72, Number(page?.height) || 841.89);
  return new api.Paragraph({
    spacing: docxAnchorSpacing(api),
    children: [
      new api.ImageRun({
        data: image.bytes,
        type: image.type || "png",
        transformation: {
          width: Math.max(1, Math.round(widthPoints * DOCX_PIXELS_PER_POINT)),
          height: Math.max(1, Math.round(heightPoints * DOCX_PIXELS_PER_POINT)),
        },
        floating: {
          horizontalPosition: {
            relative: api.HorizontalPositionRelativeFrom?.PAGE,
            offset: 0,
          },
          verticalPosition: {
            relative: api.VerticalPositionRelativeFrom?.PAGE,
            offset: 0,
          },
          allowOverlap: true,
          behindDocument,
          layoutInCell: false,
          zIndex: behindDocument ? 0 : 2,
          wrap: {
            type: api.TextWrappingType?.NONE,
          },
        },
        altText: {
          title: `Página ${page.pageNumber}`,
          description: behindDocument
            ? "Capa gráfica local sin texto visible."
            : "Representación visual fiel de la página PDF.",
          name: `pagina-${page.pageNumber}-${behindDocument ? "graficos" : "visual"}`,
        },
      }),
    ],
  });
}

function hiddenRecoveryTextbox(page, api) {
  const text = String(page?.text || "")
    .replace(/\u00ad/gu, "")
    .replace(/\r\n?/gu, "\n")
    .slice(0, 60000)
    .trim();
  if (!text) return null;

  return new api.Textbox({
    spacing: docxAnchorSpacing(api),
    children: [
      new api.Paragraph({
        spacing: docxAnchorSpacing(api),
        children: [
          new api.TextRun({
            text,
            font: "Arial",
            size: 2,
            color: "FFFFFF",
            vanish: true,
            noProof: true,
          }),
        ],
      }),
    ],
    style: {
      position: "absolute",
      positionHorizontal: "absolute",
      positionHorizontalRelative: "page",
      positionVertical: "absolute",
      positionVerticalRelative: "page",
      left: "0pt",
      top: "0pt",
      width: `${Math.max(1, Number(page?.width) || 595.28).toFixed(2)}pt`,
      height: "1pt",
      wrapStyle: "none",
      visibility: "hidden",
      zIndex: 1,
    },
  });
}

function editablePageTextboxes(page, api, {
  includePageHeadings = false,
  graphicsImage = null,
} = {}) {
  const children = [];
  if (graphicsImage?.bytes?.byteLength) {
    children.push(floatingPageImageParagraph(page, graphicsImage, api, {
      behindDocument: true,
    }));
  }

  const rawLayout = Array.isArray(page?.layout) ? page.layout : [];
  const protectionProfile = buildOcrRasterProtectionProfile(rawLayout);
  const canPreserveRaster = Boolean(graphicsImage?.bytes?.byteLength) && String(page?.source || "").toLocaleLowerCase() === "ocr";
  const layout = rawLayout.filter((line) =>
    normalizedLineText(line) &&
    !(canPreserveRaster && shouldPreserveOcrRasterLine(line, protectionProfile))
  );

  if (includePageHeadings) {
    layout.unshift({
      text: pageHeading(page.pageNumber),
      x: 18,
      y: Math.max(18, (Number(page?.height) || 842) - 28),
      width: 180,
      fontSize: 10,
      bold: true,
      italic: false,
      centered: false,
      segments: [],
    });
  }

  if (layout.length) {
    layout.forEach((line, index) => {
      children.push(editableLineTextbox(line, page, api, index));
    });
  } else {
    const fallback = {
      text: pageText(page) || "Página sin texto reconocible",
      x: 18,
      y: Math.max(18, (Number(page?.height) || 842) - 32),
      width: Math.max(36, (Number(page?.width) || 595) - 36),
      fontSize: 9,
      bold: false,
      italic: false,
      centered: false,
      segments: [],
    };
    children.push(editableLineTextbox(fallback, page, api, 0));
  }

  return children;
}

function editablePageChildren(page, api, {
  includePageHeadings = false,
  rubricRows = null,
} = {}) {
  const { HeadingLevel, Paragraph, TextRun } = api;
  const children = [];
  if (includePageHeadings) {
    children.push(new Paragraph({ text: pageHeading(page.pageNumber), heading: HeadingLevel.HEADING_2, spacing: { after: 50 } }));
  }
  const layout = Array.isArray(page?.layout) ? page.layout.filter((line) => line?.text) : [];
  if (Array.isArray(rubricRows) && rubricRows.length > 1) {
    const headingIndex = layout.findIndex(isRubricHeading);
    const leadingLines = headingIndex > 0 ? layout.slice(0, headingIndex) : [];
    for (const line of leadingLines) {
      const style = lineStyle(line);
      children.push(
        style.darkBanner || style.warningHeading || style.lightPanelHeading
          ? panelFromLayoutLine(line, api, page)
          : paragraphFromLayoutLine(line, api, page)
      );
    }
    children.push(tableFromRubricRows(rubricRows, api));
    return children;
  }
  if (!layout.length) {
    for (const line of textToDocxParagraphs(pageText(page), { emptyText: "Página sin texto reconocible" })) {
      children.push(new Paragraph({ children: [new TextRun({ text: line.text, italics: Boolean(line.italic), size: 18 })], spacing: { after: 25, line: 210 } }));
    }
    return children;
  }
  for (let lineIndex = 0; lineIndex < layout.length; lineIndex += 1) {
    const structuredBlock = detectStructuredRecordBlock(layout, lineIndex);
    if (structuredBlock) {
      children.push(tableFromStructuredRecords(structuredBlock.records, api));
      lineIndex = structuredBlock.endIndex;
      continue;
    }
    const line = layout[lineIndex];
    const style = lineStyle(line);
    children.push(style.darkBanner || style.warningHeading || style.lightPanelHeading
      ? panelFromLayoutLine(line, api, page)
      : paragraphFromLayoutLine(line, api, page));
  }
  return children;
}

export async function buildDocumentToDocxBytes(document, {
  includeDocumentHeading = false,
  includePageHeadings = false,
  pageBreaks = true,
  pageImages = null,
  layoutMode = "original",
  autoCalibrateOcr = true,
} = {}) {
  let api;
  try {
    api = await import("./vendor/docx/index.mjs");
  } catch {
    // En desarrollo y en las pruebas headless el paquete vive en
    // node_modules; la aplicación distribuida sigue usando la copia local.
    api = await import("docx");
  }
  const { Document, HeadingLevel, Packer, Paragraph } = api;
  const title = String(document?.document?.sourceName || "Documento exportado").trim();
  const pages = Array.isArray(document?.pages) ? document.pages : [];
  if (autoCalibrateOcr) {
    await autoCalibrateOcrPages(pages, pageImages);
  }
  const sections = [];
  const rubricSegmentsByPage = collectRubricSegmentsByPage(pages);

  pages.forEach((page, pageIndex) => {
    const fullPageImage = pageImageFromCollection(pageImages, page.pageNumber);
    const plan = classifyDocxPage(page, { layoutMode });
    const route = plan.route === "visual" && fullPageImage?.bytes?.byteLength
      ? "visual"
      : "editable";
    const children = [];

    if (pageIndex === 0 && includeDocumentHeading && route === "editable") {
      children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }));
    }

    if (route === "visual") {
      children.push(
        fullPageImage?.bytes?.byteLength
          ? floatingPageImageParagraph(page, fullPageImage, api, {
              behindDocument: false,
            })
          : fullPageImageParagraph(page, fullPageImage, api)
      );
      const recovery = hiddenRecoveryTextbox(page, api);
      if (recovery) children.push(recovery);
    } else {
      children.push(...editablePageTextboxes(page, api, {
        includePageHeadings,
        graphicsImage: fullPageImage?.graphicsOnly ? fullPageImage : null,
      }));
    }

    sections.push({
      properties: pageSectionProperties(page),
      children,
    });
  });

  if (!sections.length) {
    sections.push({ properties: pageSectionProperties(null), children: [new Paragraph("")] });
  }

  const wordDocument = new Document({
    creator: "PDFPrivado Pro",
    title,
    description: "Documento Word híbrido reconstruido localmente desde un PDF.",
    sections,
  });
  const blob = await Packer.toBlob(wordDocument);
  const packedBytes = new Uint8Array(await blob.arrayBuffer());
  return modernizeEditableDocxTextboxes(packedBytes);
}

function serializeDocumentToDocxPreview(document, options = {}) {
  return serializeDocumentToTxt(document, {
    includePageHeadings: options.includePageHeadings !== false,
    pageSeparator: "\n\n──────── SALTO DE PÁGINA WORD ────────\n\n",
  });
}

export function serializeExportDocument(document, format, options = {}) {
  switch (format) {
    case "docx":
      return {
        content: serializeDocumentToDocxPreview(document, options),
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: "docx",
        binary: true,
        buildBytes: (runtimeOptions = {}) => buildDocumentToDocxBytes(
          document,
          { ...options, ...runtimeOptions }
        ),
      };
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
