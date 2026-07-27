import assert from "node:assert/strict";
import {
  buildExportDocument,
  buildPageRecord,
  parsePageExpression,
  resolveExportPages,
  safeBaseName,
  textItemsToStructuredText,
  mergeNativeAndOcrLayouts,
  layoutToStructuredText,
  calculateExportStatistics,
} from "../src/convert-export-core.js";
import {
  serializeDocumentToHtml,
  serializeDocumentToJson,
  serializeDocumentToMarkdown,
  serializeDocumentToTxt,
} from "../src/convert-export-formats.js";

assert.deepEqual(parsePageExpression("1-3,5,3", 8), {
  pages: [1, 2, 3, 5],
  errors: [],
});

assert.deepEqual(resolveExportPages({ mode: "current", pageCount: 9, currentPage: 4 }).pages, [4]);
assert.equal(resolveExportPages({ mode: "range", pageCount: 3, expression: "9" }).errors.length, 1);

const text = textItemsToStructuredText([
  { str: "Hola", hasEOL: false },
  { str: "mundo", hasEOL: true },
  { str: "Segunda línea", hasEOL: false },
]);
assert.equal(text, "Hola mundo\nSegunda línea");

const page = buildPageRecord({ pageNumber: 1, text, width: 595, height: 842 });
assert.equal(page.source, "native");
assert.equal(page.words, 4);

const document = buildExportDocument({
  sourceName: "Prueba.pdf",
  totalPages: 1,
  exportedPages: [1],
  pages: [page],
  elapsedMs: 12.4,
});

assert.match(serializeDocumentToTxt(document), /Página 1/);
assert.equal(JSON.parse(serializeDocumentToJson(document)).schemaVersion, 1);
assert.match(serializeDocumentToHtml(document), /<!doctype html>/i);
assert.match(serializeDocumentToHtml(document), /Hola mundo/);
assert.match(serializeDocumentToMarkdown(document), /## Página 1/);
assert.equal(safeBaseName('informe: "final".pdf'), 'informe- -final-');

const hybridLayout = mergeNativeAndOcrLayouts(
  [
    { text: "Factura 123", x: 10, y: 80, width: 60, height: 10, fontSize: 10, source: "native" },
  ],
  [
    { text: "Factura 123", x: 11, y: 79, ocrTop: 11, width: 59, height: 10, fontSize: 10, source: "ocr" },
    { text: "TOTAL IMAGEN 42,00", x: 12, y: 48, ocrTop: 42, width: 78, height: 10, fontSize: 10, source: "ocr" },
  ],
  { pageHeight: 100 }
);
assert.equal(hybridLayout.length, 2);
assert.equal(hybridLayout.filter((line) => line.source === "ocr").length, 1);
assert.match(layoutToStructuredText(hybridLayout, { pageHeight: 100 }), /TOTAL IMAGEN 42,00/);
const hybridStats = calculateExportStatistics([
  buildPageRecord({ pageNumber: 1, text: "nativo", source: "native" }),
  buildPageRecord({ pageNumber: 2, text: "mixto", source: "hybrid" }),
  buildPageRecord({ pageNumber: 3, text: "ocr", source: "ocr" }),
], 3);
assert.equal(hybridStats.nativePages, 1);
assert.equal(hybridStats.hybridPages, 1);
assert.equal(hybridStats.ocrPages, 1);
assert.equal(hybridStats.emptyPages, 0);

console.log("OK  Convertir y exportar: núcleo, híbrido y formatos validados");
