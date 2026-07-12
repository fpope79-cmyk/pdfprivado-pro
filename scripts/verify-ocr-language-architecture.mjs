import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OCR_LANGUAGE_LIMITS,
  OCR_LANGUAGE_MANIFEST,
  OCR_LANGUAGE_MAP,
} from "../src/ocr-language-manifest.js";
import {
  normalizeOcrLanguageSelection,
  resolveOcrLanguageSelection,
  summarizeOcrLanguageCatalog,
} from "../src/ocr-language-manager.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(OCR_LANGUAGE_MANIFEST.length >= OCR_LANGUAGE_LIMITS.minimumCatalogLanguages,
  `El catálogo debe tener al menos ${OCR_LANGUAGE_LIMITS.minimumCatalogLanguages} idiomas.`);
check(OCR_LANGUAGE_MAP.size === OCR_LANGUAGE_MANIFEST.length, "Hay códigos OCR duplicados.");
check(OCR_LANGUAGE_LIMITS.maximumSelectedLanguages === 2, "El límite multilingüe controlado debe ser 2.");

for (const language of OCR_LANGUAGE_MANIFEST) {
  check(/^[a-z0-9_]+$/.test(language.code), `Código no válido: ${language.code}`);
  check(language.file === `${language.code}.traineddata.gz`, `Nombre de modelo inesperado para ${language.code}.`);
  check(Boolean(language.label && language.nativeName && language.script && language.region),
    `Metadatos incompletos para ${language.code}.`);

  if (language.installed) {
    const modelPath = path.join(projectRoot, "src", "vendor", "tesseract", "lang", language.file);
    try {
      await access(modelPath);
      const info = await stat(modelPath);
      check(info.isFile() && info.size > 0, `Modelo vacío: ${language.file}`);
      if (language.modelBytes) check(info.size === language.modelBytes, `Tamaño inesperado para ${language.file}.`);
    } catch {
      failures.push(`Falta el modelo instalado ${language.file}.`);
    }
  }
}

const installed = summarizeOcrLanguageCatalog();
check(installed.installed >= 2, "La compilación controlada debe conservar español e inglés.");
check(installed.installedCodes.includes("spa"), "Falta español en la compilación controlada.");
check(installed.installedCodes.includes("eng"), "Falta inglés en la compilación controlada.");

const bilingual = resolveOcrLanguageSelection("spa", "eng");
check(bilingual.key === "spa+eng", "La combinación español + inglés no se normaliza correctamente.");
check(normalizeOcrLanguageSelection("spa+spa").join("+") === "spa", "No se eliminan idiomas duplicados.");

let rejectedThirdLanguage = false;
try {
  normalizeOcrLanguageSelection(["spa", "eng", "fra"], { installedOnly: false });
} catch {
  rejectedThirdLanguage = true;
}
check(rejectedThirdLanguage, "El gestor no rechazó una combinación de tres idiomas.");

if (failures.length) {
  console.error("ERROR: arquitectura OCR multilingüe no válida:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OK: ${OCR_LANGUAGE_MANIFEST.length} idiomas catalogados.`);
console.log(`OK: ${installed.installed} idiomas instalados (${installed.installedCodes.join(", ")}).`);
console.log("OK: selección de uno o dos idiomas validada.");
console.log("OK: modelos locales y tamaños instalados verificados.");
