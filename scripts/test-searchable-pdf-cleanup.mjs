import assert from "node:assert/strict";
import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const moduleSource = fs.readFileSync("src/ocr-searchable-pdf.js", "utf8");

assert.match(viewer, /inspect:\s*searchableOcrSummary/);
assert.match(viewer, /save:\s*saveSearchableCopyInternal/);

assert.doesNotMatch(viewer, /saveCalibration/);
assert.doesNotMatch(viewer, /inspectWord/);
assert.doesNotMatch(viewer, /saveWordInspection/);
assert.doesNotMatch(viewer, /buildSearchableTextPlacements,/);

assert.doesNotMatch(moduleSource, /drawDistributedRotatedText/);
assert.doesNotMatch(moduleSource, /page\.drawText\(character/);
assert.match(
  moduleSource,
  /page\.drawText\(text,\s*\{[\s\S]*?opacity:\s*0/,
  "Debe conservarse la palabra completa como texto invisible."
);

console.log("PRUEBAS LIMPIEZA PDF BUSCABLE: OK");
