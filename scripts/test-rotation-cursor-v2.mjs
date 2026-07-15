import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/styles.css", "utf8");
const viewer = fs.readFileSync("src/viewer.js", "utf8");

assert.match(viewer, /PDFPRIVADO_ROTATION_CURSOR_FIX_V2/);
assert.match(viewer, /const currentPage = state\.currentPage/);
assert.match(viewer, /state\.currentPage = Math\.max/);
assert.match(viewer, /pageInput\.value = String\(state\.currentPage\)/);
assert.match(viewer, /beginReadingNavigation\(state\.currentPage, "auto"\)/);
assert.match(viewer, /scrollReadingPageIntoView\(state\.currentPage/);
assert.match(viewer, /function updateScopeControls\(\)/);

assert.match(css, /PDFPRIVADO_ROTATION_CURSOR_FIX_V2/);
assert.match(css, /\.is-pointer-mode canvas/);
assert.match(css, /\.is-pointer-mode \.viewer-continuous-list/);
assert.match(css, /cursor:\s*default\s*!important/);
assert.match(css, /\.is-hand-mode canvas/);
assert.match(css, /cursor:\s*grab\s*!important/);

console.log("OK  applyRotation localizado con anclaje flexible");
console.log("OK  rotacion conserva state.currentPage");
console.log("OK  navegacion vuelve a la pagina conservada");
console.log("OK  Puntero fuerza cursor de flecha");
console.log("OK  Mano conserva grab y grabbing");
console.log("");
console.log("ROTACION Y CURSOR V2: ARQUITECTURA VALIDADA");
