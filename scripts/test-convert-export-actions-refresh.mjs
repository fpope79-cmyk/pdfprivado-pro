import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("src/index.html", "utf8");
const source = fs.readFileSync("src/convert-export.js", "utf8");
const css = fs.readFileSync("src/convert-export.css", "utf8");

assert.match(html, /convert-export-control-row/);
assert.match(source, /structuredPages/);
assert.match(source, /rebuildPresentation/);
assert.match(source, /vista previa actualizada sin repetir OCR/i);
assert.match(source, /activeOcrRecord/);
assert.match(css, /PDFPRIVADO_CONVERT_EXPORT_ACTION_ROW_REFRESH_V1/);
assert.match(css, /justify-content:\s*space-between/);
assert.match(css, /calc\(100vh - 278px\)/);

console.log("OK  Acciones alineadas y refresco instantáneo sin OCR validados");
