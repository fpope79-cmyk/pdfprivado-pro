import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/viewer.js", "utf8");

assert.match(
  source,
  /PDFPRIVADO_SELECTABLE_TEXT_CACHE_RESET_V1/,
  "Falta el marcador de invalidación de caché.",
);

assert.match(
  source,
  /async function resetDocument\(\)\s*\{\s*\/\* PDFPRIVADO_SELECTABLE_TEXT_CACHE_RESET_V1 \*\/\s*selectableTextCache\.clear\(\);/,
  "resetDocument debe limpiar selectableTextCache al comenzar.",
);

assert.match(
  source,
  /const selectableTextCache = new Map\(\);/,
  "Debe conservarse la caché de texto seleccionable.",
);

assert.match(
  source,
  /if \(selectableTextCache\.has\(key\)\)/,
  "Debe conservarse la reutilización de caché dentro del mismo documento.",
);

console.log("OK  caché conservada durante el mismo documento");
console.log("OK  caché invalidada al abrir o sustituir documento");
console.log("");
console.log("CACHE TEXTO SELECCIONABLE V1: ARQUITECTURA VALIDADA");
