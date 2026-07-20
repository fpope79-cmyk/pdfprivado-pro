import fs from "node:fs";
import assert from "node:assert/strict";
import {
  groupOcrWordsIntoLines,
  reconstructOcrText,
} from "../src/ocr-text-layout.js";

const source = fs.readFileSync("src/convert-export.js", "utf8");
const cache = fs.readFileSync("src/ocr-cache.js", "utf8");

assert.match(source, /hashDocumentBytes/);
assert.match(source, /readCachedPages/);
assert.match(source, /writeOcrCacheRecord/);
assert.match(source, /reconstructOcrText/);
assert.match(source, /convert-export-layout-mode/);
assert.match(cache, /indexedDB\.open/);
assert.match(cache, /SHA-256/);
assert.match(cache, /MAX_RECORDS = 5000/);

const record = {
  words: [
    { text: "condi-", bbox: { x0: 0, y0: 0, x1: 40, y1: 10 } },
    { text: "ciones", bbox: { x0: 0, y0: 15, x1: 40, y1: 25 } },
    { text: "generales.", bbox: { x0: 45, y0: 15, x1: 100, y1: 25 } },
  ],
};

assert.equal(groupOcrWordsIntoLines(record.words).length, 2);
assert.match(reconstructOcrText(record, "continuous"), /condiciones generales\./);
assert.match(reconstructOcrText(record, "original"), /condi-\nciones generales\./);

console.log("OK  Caché OCR persistente y reconstrucción de líneas validadas");
