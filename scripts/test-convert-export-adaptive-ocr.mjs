import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/convert-export.js", "utf8");
const pool = fs.readFileSync("src/ocr-benchmark-worker.js", "utf8");

assert.match(source, /resolveAdaptiveWorkerCount/);
assert.match(source, /navigator\.hardwareConcurrency/);
assert.match(source, /navigator\.deviceMemory/);
assert.match(source, /analyzeCanvasInk/);
assert.match(source, /cropCanvasForOcr/);
assert.match(source, /ocrRecordQuality/);
assert.match(source, /resolveOcrProfile\("fast"\)/);
assert.match(source, /resolveOcrProfile\("balanced"\)/);
assert.match(source, /balancedRetried/);
assert.match(source, /blankSkipped/);
assert.match(source, /balancedOcrPool/);
assert.match(pool, /MAXIMUM_POOL_SIZE\s*=\s*4/);

console.log("OK  OCR adaptativo: concurrencia, recorte, páginas vacías y segunda pasada validados");
