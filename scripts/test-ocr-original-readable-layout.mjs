import assert from "node:assert/strict";
import { reconstructOcrText } from "../src/ocr-text-layout.js";

const record = {
  imageWidth: 200,
  words: [
    { text: "TÍTULO", bbox: { x0: 78, y0: 0, x1: 122, y1: 10 } },
    { text: "Texto", bbox: { x0: 20, y0: 18, x1: 50, y1: 28 } },
    { text: "principal", bbox: { x0: 55, y0: 18, x1: 105, y1: 28 } },
    { text: "Segunda", bbox: { x0: 35, y0: 36, x1: 75, y1: 46 } },
    { text: "línea", bbox: { x0: 80, y0: 36, x1: 110, y1: 46 } },
    { text: "Bloque", bbox: { x0: 20, y0: 75, x1: 55, y1: 85 } },
    { text: "nuevo", bbox: { x0: 60, y0: 75, x1: 90, y1: 85 } },
  ],
};

const original = reconstructOcrText(record, "original");
const lines = original.split("\n");

assert.equal(lines[0], "        TÍTULO");
assert.equal(lines[1], "Texto principal");
assert.equal(lines[2], "  Segunda línea");
assert.equal(lines[3], "");
assert.equal(lines[4], "Bloque nuevo");
assert.doesNotMatch(original, /\S\s{10,}\S/);

console.log("OK  Original usa líneas completas, sangrías discretas y bloques legibles");
