import assert from "node:assert/strict";
import { reconstructOcrText } from "../src/ocr-text-layout.js";

const record = {
  imageWidth: 200,
  words: [
    { text: "TÍTULO", bbox: { x0: 78, y0: 0, x1: 122, y1: 10 } },
    { text: "Texto", bbox: { x0: 20, y0: 18, x1: 50, y1: 28 } },
    { text: "separado", bbox: { x0: 55, y0: 18, x1: 105, y1: 28 } },
    { text: "condi-", bbox: { x0: 20, y0: 36, x1: 60, y1: 46 } },
    { text: "ciones", bbox: { x0: 20, y0: 54, x1: 58, y1: 64 } },
  ],
};

const continuous = reconstructOcrText(record, "continuous");
const cleanLines = reconstructOcrText(record, "clean-lines");
const original = reconstructOcrText(record, "original");

assert.notEqual(continuous, cleanLines);
assert.notEqual(cleanLines, original);
assert.notEqual(continuous, original);
assert.match(original, /^\s+TÍTULO/m);
assert.match(original, /Texto separado/);
assert.match(cleanLines, /condiciones/);
assert.match(original, /condi-\nciones/);

console.log("OK  Original conserva estructura legible sin dispersar palabras");
