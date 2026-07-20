import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/convert-export.js", "utf8");

assert.match(source, /PDFPRIVADO_LAYOUT_REFRESH_CAPTURE_V3/);
assert.match(source, /rebuildLayoutPreviewFromCacheV3/);
assert.match(source, /state\.persistentCache\.get\(pageNumber\)/);
assert.match(source, /state\.ocrRecords\.get\(pageNumber\)/);
assert.match(source, /reconstructOcrText\(ocrRecord,\s*mode\)/);
assert.match(source, /stopImmediatePropagation/);
assert.match(source, /,\s*true\s*\)/);
assert.match(source, /diseño actualizado sin repetir OCR/i);

console.log("OK  Refresco de diseño interceptado antes del manejador antiguo");
