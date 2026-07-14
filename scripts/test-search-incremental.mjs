import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const viewerPath = path.join(root, "src", "viewer.js");
const source = fs.readFileSync(viewerPath, "utf8");

const checks = [
  ["debounce de 200 ms", source.includes("const SEARCH_INPUT_DEBOUNCE_MS = 200;")],
  ["funcion incremental", source.includes("function scheduleIncrementalDocumentSearch()")],
  ["evento input incremental", source.includes('searchInput?.addEventListener("input", scheduleIncrementalDocumentSearch);')],
  ["campo editable durante busqueda", source.includes("searchInput.disabled = !ready || state.saving || state.ocr.running;")],
  ["invalida busqueda anterior", source.includes("state.search.serial += 1;")],
  ["limpia temporizador al buscar", source.includes("state.search.refreshTimer = 0;")],
  ["ejecuta motor existente", source.includes("runDocumentSearch();")],
  ["mantiene formulario Buscar", source.includes('searchForm?.addEventListener("submit"')],
  ["mantiene Limpiar", source.includes('searchClearButton?.addEventListener("click", () => clearSearch());')],
  ["mantiene Anterior", source.includes('searchPreviousButton?.addEventListener("click", () => navigateSearchResults(-1));')],
  ["mantiene Siguiente", source.includes('searchNextButton?.addEventListener("click", () => navigateSearchResults(1));')],
  ["mantiene Cancelar", source.includes('searchCancelButton?.addEventListener("click", () => cancelSearchWork());')],
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, `Falta la garantia: ${label}`);
  console.log(`OK  ${label}`);
}

const inputDisableLine = source.match(/searchInput\.disabled\s*=\s*[^;]+;/)?.[0] || "";
assert.equal(
  inputDisableLine.includes("state.search.running"),
  false,
  "El campo no debe bloquearse mientras una busqueda anterior sigue activa."
);

const functionStart = source.indexOf("function scheduleIncrementalDocumentSearch()");
const refreshStart = source.indexOf("function scheduleSearchRefresh(");
assert.ok(functionStart >= 0 && refreshStart > functionStart, "La funcion incremental debe declararse antes del refresco por cambios.");

const incrementalBlock = source.slice(functionStart, refreshStart);
for (const required of [
  "window.clearTimeout(state.search.refreshTimer)",
  "normalizeExtractedText(searchInput?.value || \"\")",
  "clearSearch({ keepFocus: false })",
  "state.search.serial += 1",
  "clearSearchHighlight()",
  "state.search.results = []",
  "state.search.query = query",
  "state.search.foldedQuery = foldSearchText(query)",
  "window.setTimeout",
  "SEARCH_INPUT_DEBOUNCE_MS",
  "runDocumentSearch()",
]) {
  assert.ok(incrementalBlock.includes(required), `Falta en el flujo incremental: ${required}`);
}

console.log("\nBUSQUEDA INCREMENTAL: ARQUITECTURA VALIDADA");
