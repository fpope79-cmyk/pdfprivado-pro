import assert from "node:assert/strict";
import {
  buildExportDocument,
  buildPageRecord,
  parsePageExpression,
  resolveExportPages,
  safeBaseName,
  textItemsToStructuredText,
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

console.log("OK  Convertir y exportar: núcleo y formatos validados");
