import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const html = fs.readFileSync(path.join(process.cwd(), "src", "index.html"), "utf8");
const css = fs.readFileSync(path.join(process.cwd(), "src", "styles.css"), "utf8");

const pageCard = html.indexOf('id="viewer-ocr-page-label"');
const operation = html.indexOf('id="viewer-ocr-operation-panel"');
const scope = html.indexOf('id="viewer-ocr-scope"');
const advanced = html.indexOf('class="viewer-ocr-advanced-options"');
const language = html.indexOf('id="viewer-ocr-language"');
const maintenance = html.indexOf('class="viewer-ocr-maintenance"');
const benchmark = html.indexOf('id="viewer-ocr-benchmark"');

assert.ok(pageCard >= 0, "Falta selector de pagina.");
assert.ok(operation > pageCard, "La accion OCR debe aparecer despues del selector de pagina.");
assert.ok(scope > operation, "El boton Reconocer debe aparecer antes de las opciones de alcance.");
assert.ok(advanced > scope, "Las opciones avanzadas deben quedar despues del alcance.");
assert.ok(language > advanced, "Los idiomas deben seguir disponibles.");
assert.ok(maintenance > language, "Las acciones destructivas deben quedar separadas al final.");
assert.ok(benchmark > maintenance, "El banco interno debe conservarse.");

for (const id of [
  "viewer-ocr-start",
  "viewer-ocr-pause",
  "viewer-ocr-resume",
  "viewer-ocr-cancel",
  "viewer-ocr-clear",
  "viewer-ocr-clear-all",
  "viewer-ocr-progress",
  "viewer-ocr-status",
  "viewer-ocr-profile",
  "viewer-ocr-concurrency",
]) {
  assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `El ID ${id} debe existir una sola vez.`);
}

assert.ok(css.includes("/* PDFPRIVADO_PANEL_OCR_PRIORITARIO_V1 */"), "Falta el bloque CSS del parche.");
assert.ok(css.includes("--viewer-tools-column: 324px;"), "El panel debe usar el ancho equilibrado de 324 px.");
assert.ok(css.includes("grid-template-columns: 50px minmax(0, 1fr);"), "No se compacto el rail.");
assert.ok(css.includes(".viewer-ocr-advanced-options"), "Faltan estilos de opciones avanzadas.");
assert.ok(css.includes(".viewer-ocr-maintenance"), "Faltan estilos de mantenimiento.");
assert.ok(css.includes("/* PDFPRIVADO_AJUSTE_ANCHO_PANEL_OCR_V1 */"), "Falta el ajuste de legibilidad del panel.");
assert.ok(css.includes("white-space: nowrap;"), "El boton principal debe evitar saltos innecesarios.");

console.log("OK  accion principal OCR situada arriba");
console.log("OK  opciones avanzadas plegables");
console.log("OK  acciones destructivas separadas");
console.log("OK  lateral y rail compactados");
console.log("\nPANEL OCR PRIORITARIO: ARQUITECTURA VALIDADA");
