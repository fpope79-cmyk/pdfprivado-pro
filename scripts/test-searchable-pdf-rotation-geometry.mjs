import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSearchableTextPlacements,
  mapOcrBboxToPdf,
} from "../src/ocr-searchable-pdf.js";

const moduleSource = fs.readFileSync("src/ocr-searchable-pdf.js", "utf8");

assert.doesNotMatch(
  moduleSource,
  /degrees\(placement\.rotation\)/,
  "La capa no debe girar el texto una segunda vez."
);

assert.match(
  moduleSource,
  /allowRotated && pageRotation !== recordRotation/,
  "La rotacion OCR y la rotacion PDF deben coincidir exactamente."
);

const options = {
  imageWidth: 1000,
  imageHeight: 2000,
  pdfWidth: 500,
  pdfHeight: 1000,
};

const horizontal = mapOcrBboxToPdf(
  { x0: 100, y0: 200, x1: 300, y1: 400 },
  { ...options, rotation: 0 }
);

const rotated90 = mapOcrBboxToPdf(
  { x0: 100, y0: 200, x1: 300, y1: 400 },
  { ...options, rotation: 90 }
);

assert.ok(horizontal.width > 0 && horizontal.height > 0);
assert.ok(rotated90.width > 0 && rotated90.height > 0);
assert.ok(
  rotated90.width !== horizontal.width || rotated90.height !== horizontal.height,
  "La caja de 90 grados debe reflejar el intercambio geometrico de ejes."
);

for (const rotation of [0, 90, 180, 270]) {
  const result = buildSearchableTextPlacements(
    {
      imageWidth: 1000,
      imageHeight: 2000,
      rotation,
      words: [
        {
          text: "Colegio",
          bbox: { x0: 100, y0: 200, x1: 300, y1: 400 },
          confidence: 96,
        },
      ],
    },
    {
      pdfWidth: 500,
      pdfHeight: 1000,
    }
  );

  assert.equal(result.valid, true);
  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].rotation, rotation);
  assert.ok(result.placements[0].width > 0);
  assert.ok(result.placements[0].height > 0);
  assert.ok(result.placements[0].fontSize > 0);
}

console.log("PRUEBAS GEOMETRIA OCR GIRADA: OK");
