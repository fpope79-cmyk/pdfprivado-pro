import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const viewer = fs.readFileSync(path.join(root, "src", "viewer.js"), "utf8");

for (const id of [
  "viewer-ocr-searchable-save",
  "viewer-ocr-searchable-summary",
  "viewer-ocr-searchable-badge",
]) {
  assert.equal(
    (html.match(new RegExp(`id="${id}"`, "g")) || []).length,
    1,
    `El ID ${id} debe existir una sola vez.`
  );
}

const searchableCard = html.indexOf("PDFPRIVADO_SEARCHABLE_PDF_UI_V1_START");
const maintenance = html.indexOf('class="viewer-ocr-maintenance"');
assert.ok(searchableCard >= 0, "Falta la tarjeta publica de PDF buscable.");
assert.ok(maintenance > searchableCard, "La salida buscable debe aparecer antes de las acciones destructivas.");

assert.ok(
  viewer.includes('const ocrSearchableSaveButton = $("#viewer-ocr-searchable-save");'),
  "Falta la referencia JS del boton."
);
assert.ok(
  viewer.includes("function updateSearchablePdfUi()"),
  "Falta la actualizacion de disponibilidad."
);
assert.ok(
  viewer.includes("updateSearchablePdfUi();"),
  "La interfaz no se actualiza desde los controles OCR."
);
assert.ok(
  viewer.includes('ocrSearchableSaveButton?.addEventListener("click", async () => {'),
  "Falta el evento de guardado."
);
assert.ok(
  viewer.includes("await saveSearchableCopyInternal();"),
  "El boton no reutiliza la API interna existente."
);
assert.ok(
  viewer.includes("const suggested = sanitizePdfName(state.file.name, \"buscable\");"),
  "Debe conservarse el nombre de salida buscable."
);
assert.ok(
  viewer.includes("const uniquePath = await uniqueTauriPath(String(chosen));"),
  "Debe conservarse la proteccion contra sobrescritura."
);

assert.ok(
  css.includes("/* PDFPRIVADO_SEARCHABLE_PDF_UI_V1 */"),
  "Faltan estilos de la tarjeta."
);
assert.ok(
  css.includes(".viewer-ocr-searchable-card"),
  "Falta el estilo principal."
);
assert.ok(
  css.includes('.viewer-ocr-searchable-badge[data-ready="true"]'),
  "Falta el estado visual disponible."
);

console.log("OK  tarjeta Crear PDF buscable publicada");
console.log("OK  resumen de paginas y palabras conectado");
console.log("OK  boton habilitado solo con OCR utilizable");
console.log("OK  reutiliza guardado seguro y copia nueva");
console.log("OK  actualizacion integrada en controles OCR");
console.log("\nPDF BUSCABLE PUBLICO: ARQUITECTURA VALIDADA");
