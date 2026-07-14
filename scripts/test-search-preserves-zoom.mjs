import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const source = fs.readFileSync(path.join(process.cwd(), "src", "viewer.js"), "utf8");

const start = source.indexOf("async function activateSearchResult(");
const end = source.indexOf("function navigateSearchResults(", start);

assert.ok(start >= 0 && end > start, "No se encontro activateSearchResult.");
const block = source.slice(start, end);

assert.equal(
  block.includes('state.zoomMode = "fit-page"'),
  false,
  "La busqueda no debe cambiar automaticamente a Ajustar pagina."
);

assert.equal(
  block.includes("const applyFitPage"),
  false,
  "No debe conservarse la bandera que fuerza Ajustar pagina."
);

assert.equal(
  block.includes("if (applyFitPage"),
  false,
  "No debe refrescar la vista por un cambio automatico de zoom."
);

for (const required of [
  "goToPage(result.page",
  "positionSearchPage(result.page",
  "renderSearchHighlight(result, resolved)",
  "stabilizeSearchResultPosition",
]) {
  assert.ok(block.includes(required), `Debe conservarse la navegacion y resaltado: ${required}`);
}

console.log("OK  la busqueda conserva el zoom elegido");
console.log("OK  mantiene navegacion, posicionamiento y resaltado");
console.log("\nCONSERVACION DE ZOOM: ARQUITECTURA VALIDADA");
