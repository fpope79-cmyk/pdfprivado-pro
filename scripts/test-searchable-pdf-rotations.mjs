import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSearchableTextPlacements,
  mapOcrPointToPdf,
} from "../src/ocr-searchable-pdf.js";

const closeTo = (actual, expected, tolerance = 0.001) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Esperado ${expected}, recibido ${actual}`
  );
};

const common = {
  imageWidth: 1000,
  imageHeight: 2000,
  pdfWidth: 500,
  pdfHeight: 1000,
};

{
  const p = mapOcrPointToPdf({ ...common, x: 0, y: 0, rotation: 0 });
  closeTo(p.x, 0);
  closeTo(p.y, 1000);
}
{
  const p = mapOcrPointToPdf({ ...common, x: 0, y: 0, rotation: 90 });
  closeTo(p.x, 0);
  closeTo(p.y, 0);
}
{
  const p = mapOcrPointToPdf({ ...common, x: 0, y: 0, rotation: 180 });
  closeTo(p.x, 500);
  closeTo(p.y, 0);
}
{
  const p = mapOcrPointToPdf({ ...common, x: 0, y: 0, rotation: 270 });
  closeTo(p.x, 500);
  closeTo(p.y, 1000);
}

for (const rotation of [0, 90, 180, 270]) {
  const result = buildSearchableTextPlacements(
    {
      imageWidth: 1000,
      imageHeight: 2000,
      rotation,
      words: [
        {
          text: "Rotacion",
          bbox: { x0: 100, y0: 200, x1: 300, y1: 400 },
          confidence: 95,
        },
      ],
    },
    { pdfWidth: 500, pdfHeight: 1000 }
  );

  assert.equal(result.valid, true);
  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].rotation, rotation);
  assert.ok(result.placements[0].x >= 0);
  assert.ok(result.placements[0].y >= 0);
  assert.ok(result.placements[0].width > 0);
  assert.ok(result.placements[0].height > 0);
}

const viewer = fs.readFileSync("src/viewer.js", "utf8");
assert.match(viewer, /allowRotated:\s*true/);
assert.match(viewer, /usablePages:\s*pages\.length/);

console.log("PRUEBAS PDF BUSCABLE CON ROTACIONES: OK");
