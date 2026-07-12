export const OCR_LANGUAGES = Object.freeze([
  Object.freeze({ code: "spa", label: "Español" }),
  Object.freeze({ code: "eng", label: "Inglés" }),
]);

const OCR_LANGUAGE_MAP = new Map(OCR_LANGUAGES.map((language) => [language.code, language]));

export function resolveOcrLanguage(code) {
  return OCR_LANGUAGE_MAP.get(String(code || "").toLowerCase()) || OCR_LANGUAGE_MAP.get("spa");
}
