import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync("src/convert-export.css", "utf8");

assert.match(css, /PDFPRIVADO_CONVERT_EXPORT_LAYOUT_SECOND_ROW_V2/);
assert.match(css, /@media\s*\(min-width:\s*1051px\)/);
assert.match(css, /grid-column:\s*1\s*\/\s*-1\s*!important/);
assert.match(css, /grid-template-columns:[\s\S]*1\.55fr\)\s*!important/);

console.log("OK  Diseño del texto fijado siempre en segunda línea");
