import assert from "node:assert/strict";
import {
  buildSearchableTextPlacements,
  mapOcrBboxToPdf,
  mapOcrPointToPdf,
  validateSearchableOcrRecord,
} from "../src/ocr-searchable-pdf.js";

const closeTo = (actual, expected, tolerance = 0.001) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Esperado ${expected}, recibido ${actual}`
  );
};

const baseOptions = {
  imageWidth: 1000,
  imageHeight: 2000,
  pdfWidth: 500,
  pdfHeight: 1000,
};

{
  const point = mapOcrPointToPdf({ ...baseOptions, x: 100, y: 200, rotation: 0 });
  closeTo(point.x, 50);
  closeTo(point.y, 900);
}

{
  const box = mapOcrBboxToPdf(
    { x0: 100, y0: 200, x1: 300, y1: 400 },
    { ...baseOptions, rotation: 0 }
  );
  closeTo(box.x, 50);
  closeTo(box.y, 800);
  closeTo(box.width, 100);
  closeTo(box.height, 100);
}

for (const rotation of [0, 90, 180, 270]) {
  const record = {
    imageWidth: 1000,
    imageHeight: 2000,
    rotation,
    words: [
      {
        text: "Prueba",
        bbox: { x0: 100, y0: 200, x1: 300, y1: 400 },
        confidence: 92,
      },
    ],
  };

  const validation = validateSearchableOcrRecord(record);
  assert.equal(validation.valid, true);

  const result = buildSearchableTextPlacements(record, {
    pdfWidth: 500,
    pdfHeight: 1000,
  });

  assert.equal(result.valid, true);
  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].text, "Prueba");
  assert.ok(result.placements[0].width > 0);
  assert.ok(result.placements[0].height > 0);
  assert.ok(result.placements[0].fontSize > 0);
}

{
  const result = buildSearchableTextPlacements(
    {
      imageWidth: 100,
      imageHeight: 100,
      rotation: 0,
      words: [
        {
          text: "Baja",
          bbox: { x0: 5, y0: 5, x1: 25, y1: 20 },
          confidence: 30,
        },
        {
          text: "Alta",
          bbox: { x0: 30, y0: 5, x1: 55, y1: 20 },
          confidence: 95,
        },
      ],
    },
    {
      pdfWidth: 100,
      pdfHeight: 100,
      minimumConfidence: 50,
    }
  );

  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].text, "Alta");
  assert.equal(result.skipped, 1);
}

console.log("PRUEBAS OCR SEARCHABLE PDF: OK");
