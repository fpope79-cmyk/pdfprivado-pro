// Fachada estable para el visor. La definición y la lógica viven en módulos
// separados para que el OCR por lotes y los paquetes offline puedan reutilizarlas.
export {
  OCR_LANGUAGE_LIMITS,
  OCR_LANGUAGE_MANIFEST as OCR_LANGUAGES,
  OCR_LANGUAGE_MAP,
} from "./ocr-language-manifest.js";

export {
  formatOcrModelSize,
  listInstalledOcrLanguages,
  listOcrLanguages,
  normalizeOcrLanguageSelection,
  resolveOcrLanguage,
  resolveOcrLanguageSelection,
  summarizeOcrLanguageCatalog,
} from "./ocr-language-manager.js";
