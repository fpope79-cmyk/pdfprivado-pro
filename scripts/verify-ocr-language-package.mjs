import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  detectOcrLanguagePackageCode,
  inspectOcrLanguagePackage,
} from "../src/ocr-language-package.js";

const suppliedPath = process.argv[2];

if (!suppliedPath) {
  throw new Error(
    "Indica la ruta del paquete de prueba: npm run verify:ocr-package -- <ruta>"
  );
}

const packagePath = path.resolve(suppliedPath);
const bytes = new Uint8Array(await readFile(packagePath));

const result = await inspectOcrLanguagePackage({
  fileName: path.basename(packagePath),
  bytes,
});

if (result.code !== "fra") {
  throw new Error(`Se esperaba fra y se obtuvo ${result.code}.`);
}

if (detectOcrLanguagePackageCode(result.fileName) !== "fra") {
  throw new Error("No se detecta de forma estable el código del paquete francés.");
}

const altered = bytes.slice();
altered[Math.max(0, altered.length - 17)] ^= 0x01;

let rejectedAlteredPackage = false;

try {
  await inspectOcrLanguagePackage({
    fileName: result.fileName,
    bytes: altered,
  });
} catch {
  rejectedAlteredPackage = true;
}

if (!rejectedAlteredPackage) {
  throw new Error("Un paquete manipulado no fue rechazado.");
}

let rejectedUnknownPackage = false;

try {
  await inspectOcrLanguagePackage({
    fileName: "PDFPrivado-Pro-Idioma-Desconocido-xyz.pdfprivado-ocr",
    bytes,
  });
} catch {
  rejectedUnknownPackage = true;
}

if (!rejectedUnknownPackage) {
  throw new Error("Un código desconocido no fue rechazado.");
}

console.log(`OK: paquete ${result.language.label} (${result.code}) validado.`);
console.log(`OK: tamaño ${result.bytes} bytes y SHA-256 verificados.`);
console.log("OK: paquetes alterados o con código desconocido rechazados.");
console.log("OK: la prueba solo inspecciona; no instala ni copia el modelo.");
