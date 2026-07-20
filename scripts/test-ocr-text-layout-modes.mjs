import assert from "node:assert/strict";
import {
  groupOcrWordsIntoLines,
  reconstructOcrText,
} from "../src/ocr-text-layout.js";

const record = {
  words: [
    { text: "Las", bbox: { x0: 0, y0: 0, x1: 20, y1: 10 } },
    { text: "condi-", bbox: { x0: 25, y0: 0, x1: 65, y1: 10 } },
    { text: "ciones", bbox: { x0: 0, y0: 16, x1: 38, y1: 26 } },
    { text: "generales", bbox: { x0: 42, y0: 16, x1: 95, y1: 26 } },
    { text: "se", bbox: { x0: 0, y0: 32, x1: 12, y1: 42 } },
    { text: "aceptan.", bbox: { x0: 16, y0: 32, x1: 62, y1: 42 } },
  ],
};

assert.equal(groupOcrWordsIntoLines(record.words).length, 3);

const original = reconstructOcrText(record, "original");
const cleanLines = reconstructOcrText(record, "clean-lines");
const continuous = reconstructOcrText(record, "continuous");

assert.equal(
  original,
  "Las condi-\nciones generales\nse aceptan."
);

assert.equal(
  cleanLines,
  "Las condiciones generales\nse aceptan."
);

assert.equal(
  continuous,
  "Las condiciones generales se aceptan."
);

assert.notEqual(original, cleanLines);
assert.notEqual(cleanLines, continuous);
assert.notEqual(original, continuous);

console.log("OK  Continuo, Líneas y Original producen resultados diferentes");
