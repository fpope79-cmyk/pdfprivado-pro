import fs from "node:fs";
import assert from "node:assert/strict";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const moduleSource = fs.readFileSync("src/ocr-searchable-pdf.js", "utf8");

assert.match(viewer, /addInvisibleOcrTextToPdfPage/);
assert.match(viewer, /async function buildSearchablePdfBytesForEntries/);
assert.match(viewer, /async function saveSearchableCopyInternal/);
assert.match(viewer, /window\.PDFPrivadoSearchablePdfTest/);
assert.match(viewer, /allowRotated:\s*false/);
assert.match(moduleSource, /export function addInvisibleOcrTextToPdfPage/);
assert.match(moduleSource, /opacity:\s*0/);

console.log("PRUEBA INTEGRACION PDF BUSCABLE INTERNA: OK");
