import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync("src/convert-export.css", "utf8");

assert.match(css, /PDFPRIVADO_CONVERT_EXPORT_LAYOUT_NO_OVERLAP_V1/);
assert.match(css, /max-width:\s*1500px/);
assert.match(css, /\.convert-export-layout-field\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
assert.match(css, /min-width:\s*255px/);

console.log("OK  Diseño del texto separado de estadísticas sin solapamiento");
