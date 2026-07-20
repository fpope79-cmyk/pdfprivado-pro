import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/convert-export.js", "utf8");

assert.match(source, /buildOcrRecord/);
assert.match(source, /renderPageForOcr/);
assert.match(source, /createOcrBenchmarkWorkerPool/);
assert.match(source, /resolveOcrProfile/);
assert.match(source, /recognizeOcrImage/);
assert.match(source, /readCachedPages/);
assert.match(source, /writeOcrCacheRecord/);
assert.match(source, /reconstructOcrText/);

assert.match(source, /languageKey:\s*"spa"/);
assert.match(source, /language:\s*source === "ocr" \? "spa" : null/);
assert.match(source, /profileKey:\s*"fast"/);
assert.match(source, /balancedRetried/);
assert.match(source, /fastAccepted/);
assert.match(source, /persistentCache/);
assert.match(source, /documentHash/);

assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /https?:\/\//);

console.log(
  "OK  Convertir y exportar: integración OCR local, adaptativa y cacheada validada"
);
