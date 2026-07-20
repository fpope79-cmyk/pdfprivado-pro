import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("src/index.html", "utf8");
const source = fs.readFileSync("src/convert-export.js", "utf8");
const css = fs.readFileSync("src/convert-export.css", "utf8");

assert.match(html, /convert-export-segmented/);
assert.match(html, /name="convert-export-layout-mode"/);
assert.match(html, />Continuo</);
assert.match(html, />Líneas</);
assert.match(html, />Original</);

assert.match(source, /selectedLayoutMode/);
assert.match(source, /setSelectedLayoutMode/);
assert.match(source, /els\.progress\.value = 100/);
assert.match(source, /páginas recuperadas de caché/);
assert.match(source, /dataset\.complete/);

assert.match(css, /PDFPRIVADO_CONVERT_EXPORT_SEGMENTED_LAYOUT_V1/);
assert.match(css, /grid-template-columns:\s*repeat\(3/);
assert.match(css, /calc\(100vh - 270px\)/);

console.log("OK  Diseño segmentado y cierre de progreso validados");
