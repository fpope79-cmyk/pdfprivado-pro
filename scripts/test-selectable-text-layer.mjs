import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/styles.css", "utf8");
const viewer = fs.readFileSync("src/viewer.js", "utf8");

assert.match(viewer, /PDFPRIVADO_SELECTABLE_TEXT_LAYER_V1/);
assert.match(viewer, /const selectableTextCache = new Map\(\)/);
assert.match(viewer, /function selectableTextCacheKey\(entry\)/);
assert.match(viewer, /async function selectableTextContent\(entry\)/);
assert.match(viewer, /async function renderSelectableTextLayer/);
assert.match(viewer, /page\.getTextContent\(\)/);
assert.match(viewer, /window\.pdfjsLib\?\.Util\?\.transform/);
assert.match(viewer, /await renderSelectableTextLayer\(\s*entry,\s*canvas/);
assert.match(viewer, /await renderSelectableTextLayer\(\s*entry,\s*target,\s*item/);
assert.match(viewer, /targetCanvas\.closest\("\.viewer-spread-page"\)/);

assert.match(css, /PDFPRIVADO_SELECTABLE_TEXT_LAYER_V1/);
assert.match(css, /\.viewer-text-layer\s*\{/);
assert.match(css, /color:\s*transparent/);
assert.match(css, /user-select:\s*text/);
assert.match(css, /\.is-hand-mode \.viewer-text-layer/);
assert.match(css, /\.is-pointer-mode \.viewer-text-layer/);

console.log("OK  capa DOM de texto preparada");
console.log("OK  usa getTextContent y transformaciones PDF.js");
console.log("OK  vista de pagina individual integrada");
console.log("OK  vista continua integrada");
console.log("OK  vista doble integrada");
console.log("OK  seleccion habilitada solo en Puntero");
console.log("");
console.log("TEXTO SELECCIONABLE V1: ARQUITECTURA VALIDADA");
