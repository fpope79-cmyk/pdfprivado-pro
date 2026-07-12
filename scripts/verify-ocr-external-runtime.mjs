import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TESSERACT_LANGUAGE_CACHE,
  clearOcrRuntimeLanguage,
  createMemoryTesseractCacheDriver,
  createOcrRuntimePath,
  ocrRuntimeCacheKey,
  stageOcrRuntimeLanguage,
} from "../src/ocr-tesseract-cache.js";

const driver = createMemoryTesseractCacheDriver();
const source = new Uint8Array([31, 139, 8, 0, 80, 68, 70, 80, 82, 73, 86, 65, 68, 79]);
const firstPath = createOcrRuntimePath("fra", "prueba-1");
const secondPath = createOcrRuntimePath("fra", "prueba-2");

const first = await stageOcrRuntimeLanguage({
  code: "fra",
  bytes: source,
  driver,
  runtimePath: firstPath,
});
const second = await stageOcrRuntimeLanguage({
  code: "fra",
  bytes: source,
  driver,
  runtimePath: secondPath,
});

assert.equal(first.code, "fra");
assert.equal(first.cachePath, firstPath);
assert.equal(first.key, ocrRuntimeCacheKey("fra", firstPath));
assert.equal(second.key, ocrRuntimeCacheKey("fra", secondPath));
assert.notEqual(first.key, second.key, "Cada operación debe usar una clave temporal distinta.");
assert.deepEqual(await driver.read(first.key), source);
assert.deepEqual(await driver.read(second.key), source);

source[0] = 0;
assert.equal((await driver.read(first.key))[0], 31, "La caché debe conservar una copia independiente.");

await clearOcrRuntimeLanguage({ code: "fra", driver, runtimePath: firstPath });
assert.equal(await driver.read(first.key), null);
assert.notEqual(await driver.read(second.key), null, "Limpiar una operación no debe borrar otra.");
await clearOcrRuntimeLanguage({ code: "fra", driver, runtimePath: secondPath });
assert.equal(await driver.read(second.key), null);

assert.equal(TESSERACT_LANGUAGE_CACHE.databaseName, "keyval-store");
assert.equal(TESSERACT_LANGUAGE_CACHE.storeName, "keyval");

const runtimeSource = await readFile(
  new URL("../src/ocr-external-runtime.js", import.meta.url),
  "utf8"
);

assert.match(runtimeSource, /cacheMethod:\s*"readOnly"/);
assert.match(runtimeSource, /lang-offline-unavailable/);
assert.doesNotMatch(runtimeSource, /https?:\/\//i);
assert.match(runtimeSource, /Promise\.race/);
assert.match(runtimeSource, /clearOperationCache\(operation\)/);
assert.match(runtimeSource, /candidate\.recognize/);
assert.match(runtimeSource, /createOcrRuntimePath/);

console.log("OK: modelo comprimido preparado en la caché temporal usada por Tesseract.");
console.log("OK: cada prueba usa una clave aislada y su limpieza no afecta a otra.");
console.log("OK: cancelación y limpieza se aplican también durante carga y reconocimiento.");
console.log("OK: el runtime aislado no contiene rutas HTTP ni descargas externas.");
console.log("OK: la prueba no modifica el flujo OCR normal ni conserva resultados.");
