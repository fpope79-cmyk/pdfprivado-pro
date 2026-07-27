import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corePath = path.join(root, "src", "convert-export-core.js");
const formatsPath = path.join(root, "src", "convert-export-formats.js");
const exportPath = path.join(root, "src", "convert-export.js");

const core = await import(pathToFileURL(corePath));
const formats = await import(pathToFileURL(formatsPath));

const record = {
  imageWidth: 1000,
  imageHeight: 1400,
  pageImageWidth: 1000,
  pageImageHeight: 1400,
  cropX: 0,
  cropY: 0,
  words: [
    { text: "CONTRATO", bbox: { x0: 100, y0: 100, x1: 260, y1: 135 } },
    { text: "EDITABLE", bbox: { x0: 280, y0: 100, x1: 430, y1: 135 } },
    { text: "Primera", bbox: { x0: 100, y0: 190, x1: 190, y1: 220 } },
    { text: "cláusula", bbox: { x0: 200, y0: 190, x1: 310, y1: 220 } },
  ],
};

const layout = core.ocrRecordToLayout(record, 595, 842);
assert.equal(layout.length, 2, "OCR debe agrupar palabras en líneas");
assert.equal(layout[0].text, "CONTRATO EDITABLE");
assert.ok(layout[0].x > 0 && layout[0].y > 0 && layout[0].width > 0);

const nativePlan = formats.classifyDocxPage({
  source: "native",
  text: "Texto nativo con geometría",
  layout: [{ text: "Texto nativo con geometría", x: 20, y: 700, width: 200, fontSize: 10 }],
  docxVisualMetrics: { imageCoverageRatio: 0.9, vectorOperations: 500 },
}, { layoutMode: "original" });
assert.equal(nativePlan.route, "editable", "Original debe priorizar texto nativo posicionado");

const ocrPlan = formats.classifyDocxPage({
  source: "ocr",
  text: "Texto OCR con geometría",
  layout,
  docxVisualMetrics: { imageCoverageRatio: 1 },
}, { layoutMode: "original" });
assert.equal(ocrPlan.route, "editable", "Original debe priorizar OCR posicionado");

const visualPlan = formats.classifyDocxPage({
  source: "ocr",
  text: "Texto sin cajas",
  layout: null,
}, { layoutMode: "original" });
assert.equal(visualPlan.route, "visual", "Sin geometría debe conservar respaldo visual");

const formatsText = fs.readFileSync(formatsPath, "utf8");
const exportText = fs.readFileSync(exportPath, "utf8");
for (const marker of [
  "new api.Textbox",
  "texto-nativo-posicionado",
  "ocr-posicionado",
  "graphicsImage",
  "behindDocument: true",
  "fillColor: \"none\"",
]) assert.ok(formatsText.includes(marker), `Falta marcador ${marker}`);
for (const marker of [
  "ocrRecordToLayout",
  "record.pageImageWidth",
  "record.cropX",
  "maskLayout: pageRecord.layout",
  "context.fillRect",
]) assert.ok(exportText.includes(marker), `Falta marcador ${marker}`);

console.log("OK   OCR con geometría editable");
console.log("OK   Diseño original prioriza editabilidad posicionada");
console.log("OK   Respaldo visual solo sin geometría");
console.log("OK   Fondo gráfico enmascarado + Textbox visible");
