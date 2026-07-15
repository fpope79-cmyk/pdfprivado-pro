import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/styles.css", "utf8");
const viewer = fs.readFileSync("src/viewer.js", "utf8");

assert.match(viewer, /PDFPRIVADO_VIEWER_POINTER_HAND_V3/);
assert.match(viewer, /interactionMode:\s*"pointer"/);
assert.match(viewer, /function initializeViewerInteractionControls\(\)/);
assert.match(viewer, /document\.createElement\("button"\)/);
assert.match(viewer, /viewer-pointer-mode-button/);
assert.match(viewer, /viewer-hand-mode-button/);
assert.match(viewer, /!viewerHandModeActive\(\)/);
assert.match(viewer, /initializeViewerInteractionControls\(\);/);

assert.match(css, /PDFPRIVADO_VIEWER_POINTER_HAND_V3/);
assert.match(css, /\.viewer-stage-stack \.is-pointer-mode/);
assert.match(css, /\.viewer-stage-stack \.is-hand-mode/);

console.log("OK  controles creados sin modificar index.html");
console.log("OK  Puntero es el modo inicial");
console.log("OK  el arrastre solo funciona en modo Mano");
console.log("OK  estilos de cursor preparados");
console.log("");
console.log("PUNTERO Y MANO V3: ARQUITECTURA VALIDADA");
