import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/ocr-searchable-pdf.js", "utf8");

const examples = [
  "acción",
  "niño",
  "pingüino",
  "información",
  "ÁÉÍÓÚ",
  "¿Qué tal?",
  "€ 25,50",
];

for (const text of examples) {
  assert.equal(text.normalize("NFC"), text);
}

assert.match(source, /\.normalize\("NFC"\)/);
assert.match(source, /page\.drawText\(text/);

console.log("PRUEBAS TEXTO LATINO UNICODE: OK");
