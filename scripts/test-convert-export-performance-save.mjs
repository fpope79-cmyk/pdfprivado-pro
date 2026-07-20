import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/convert-export.js", "utf8");
const workerPool = fs.readFileSync(
  "src/ocr-benchmark-worker.js",
  "utf8"
);

assert.match(source, /createOcrBenchmarkWorkerPool/);
assert.match(source, /ocrPool/);
assert.match(source, /balancedOcrPool/);
assert.match(source, /hardwareConcurrency/);
assert.match(source, /deviceMemory/);

assert.match(
  workerPool,
  /const MAXIMUM_POOL_SIZE = 4;/
);

assert.match(
  workerPool,
  /Math\.min\(MAXIMUM_POOL_SIZE,\s*Number\(size\)\s*\|\|\s*1\)/
);

assert.match(
  workerPool,
  /return \{ size: poolSize, recognize, cancel, destroy \}/
);

assert.match(source, /safeBaseName/);
assert.match(source, /state\.serialized/);
assert.match(source, /exportButton/);
assert.match(source, /Blob|Uint8Array|TextEncoder/);
assert.match(source, /invoke\(|showSaveDialog|writeFile|save/i);

assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /https?:\/\//);

console.log(
  "OK  Convertir y exportar: rendimiento adaptativo y guardado local validados"
);
