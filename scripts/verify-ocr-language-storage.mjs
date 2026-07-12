import { readFile } from "node:fs/promises";
import path from "node:path";
import { inspectOcrLanguagePackage } from "../src/ocr-language-package.js";
import {
  createMemoryOcrLanguageDriver,
  createOcrLanguageStorage,
} from "../src/ocr-language-storage.js";

const suppliedPath = process.argv[2];
if (!suppliedPath) {
  throw new Error(
    "Indica la ruta del paquete de prueba: npm run verify:ocr-storage -- <ruta>"
  );
}

const packagePath = path.resolve(suppliedPath);
const bytes = new Uint8Array(await readFile(packagePath));
const inspection = await inspectOcrLanguagePackage({
  fileName: path.basename(packagePath),
  bytes,
});

const driver = createMemoryOcrLanguageDriver();
const storage = createOcrLanguageStorage({
  driver,
  now: () => "2026-07-12T19:30:00.000Z",
});

if ((await storage.list()).length !== 0) {
  throw new Error("El almacén de prueba no comienza vacío.");
}

const installed = await storage.install({ inspection, bytes });
if (installed.code !== "fra" || installed.bytes !== bytes.byteLength) {
  throw new Error("La instalación local no conservó los metadatos esperados.");
}

const listed = await storage.list();
if (listed.length !== 1 || listed[0].code !== "fra") {
  throw new Error("El idioma instalado no aparece en el catálogo local.");
}
if (Object.prototype.hasOwnProperty.call(listed[0], "model")) {
  throw new Error("La lista ligera de metadatos está exponiendo el modelo completo.");
}

const verified = await storage.readVerified("fra");
if (!verified || verified.bytes.byteLength !== bytes.byteLength) {
  throw new Error("No se pudo recuperar y verificar el modelo instalado.");
}
if (verified.metadata.sha256 !== inspection.sha256) {
  throw new Error("La huella recuperada no coincide con la validación inicial.");
}

const corruptMetadata = new Map();
const corruptModels = new Map();
const corruptDriver = {
  async write(record) {
    corruptMetadata.set(record.metadata.code, { ...record.metadata });
    corruptModels.set(record.metadata.code, new Uint8Array(record.bytes).slice());
  },
  async listMetadata() {
    return [...corruptMetadata.values()].map((record) => ({ ...record }));
  },
  async read(code) {
    if (!corruptMetadata.has(code) || !corruptModels.has(code)) return null;
    return {
      metadata: { ...corruptMetadata.get(code) },
      bytes: corruptModels.get(code).slice(),
    };
  },
  async remove(code) {
    const existed = corruptMetadata.delete(code);
    corruptModels.delete(code);
    return existed;
  },
};
const corruptStorage = createOcrLanguageStorage({ driver: corruptDriver });
await corruptStorage.install({ inspection, bytes });
const alteredModel = corruptModels.get("fra");
alteredModel[Math.max(0, alteredModel.length - 11)] ^= 0x01;
let corruptedModelRejected = false;
try {
  await corruptStorage.readVerified("fra");
} catch {
  corruptedModelRejected = true;
}
if (!corruptedModelRejected) {
  throw new Error("Un modelo almacenado y posteriormente alterado no fue rechazado.");
}

let baseRemovalRejected = false;
try {
  await storage.remove("spa");
} catch {
  baseRemovalRejected = true;
}
if (!baseRemovalRejected) {
  throw new Error("El almacén permitió eliminar un idioma base.");
}

if (!(await storage.remove("fra"))) {
  throw new Error("La desinstalación no confirmó la eliminación del francés.");
}
if ((await storage.list()).length !== 0) {
  throw new Error("El francés sigue apareciendo después de desinstalarlo.");
}
if (await storage.readVerified("fra")) {
  throw new Error("El modelo francés sigue presente después de desinstalarlo.");
}
if (await storage.remove("fra")) {
  throw new Error("Una segunda desinstalación indicó que todavía existía el modelo.");
}

console.log("OK: instalación local simulada del paquete francés.");
console.log("OK: listado ligero y persistente de metadatos validado.");
console.log("OK: recuperación y rechazo de corrupción SHA-256 validados.");
console.log("OK: desinstalación segura sin eliminar idiomas base.");
console.log("OK: la prueba no conecta el modelo con Tesseract.");
