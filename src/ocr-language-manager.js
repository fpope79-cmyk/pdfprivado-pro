import {
  OCR_LANGUAGE_LIMITS,
  OCR_LANGUAGE_MANIFEST,
  OCR_LANGUAGE_MAP,
} from "./ocr-language-manifest.js";

const DEFAULT_LANGUAGE_CODE = "spa";

function normalizeCode(value) {
  return String(value || "").trim().toLowerCase();
}

export function resolveOcrLanguage(code, { installedOnly = false, fallback = true } = {}) {
  const language = OCR_LANGUAGE_MAP.get(normalizeCode(code));
  if (language && (!installedOnly || language.installed)) return language;
  if (!fallback) return null;
  return OCR_LANGUAGE_MAP.get(DEFAULT_LANGUAGE_CODE);
}

export function listOcrLanguages({ installedOnly = false } = {}) {
  return OCR_LANGUAGE_MANIFEST.filter((language) => !installedOnly || language.installed);
}

export function listInstalledOcrLanguages() {
  return listOcrLanguages({ installedOnly: true });
}

export function normalizeOcrLanguageSelection(value, { installedOnly = true } = {}) {
  const rawCodes = Array.isArray(value)
    ? value
    : String(value || "").split("+");
  const codes = [];

  for (const rawCode of rawCodes) {
    const code = normalizeCode(rawCode);
    if (!code || codes.includes(code)) continue;
    const language = resolveOcrLanguage(code, { installedOnly, fallback: false });
    if (!language) {
      throw new Error(
        OCR_LANGUAGE_MAP.has(code)
          ? `El idioma OCR ${code} no está instalado en esta compilación.`
          : `El idioma OCR ${code} no existe en el catálogo.`
      );
    }
    codes.push(code);
  }

  if (!codes.length) codes.push(DEFAULT_LANGUAGE_CODE);
  if (codes.length > OCR_LANGUAGE_LIMITS.maximumSelectedLanguages) {
    throw new Error(
      `Solo se pueden combinar hasta ${OCR_LANGUAGE_LIMITS.maximumSelectedLanguages} idiomas por reconocimiento.`
    );
  }

  return codes;
}

export function resolveOcrLanguageSelection(primaryCode, secondaryCode = "") {
  const codes = normalizeOcrLanguageSelection([primaryCode, secondaryCode]);
  const languages = codes.map((code) => resolveOcrLanguage(code, { installedOnly: true }));
  return Object.freeze({
    codes: Object.freeze(codes),
    key: codes.join("+"),
    label: languages.map((language) => language.label).join(" + "),
    nativeLabel: languages.map((language) => language.nativeName).join(" + "),
    scripts: Object.freeze([...new Set(languages.map((language) => language.script))]),
    direction: languages.every((language) => language.direction === "rtl") ? "rtl" : "auto",
    languages: Object.freeze(languages),
  });
}

export function formatOcrModelSize(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Tamaño pendiente de medir";
  return `${(numeric / 1024 / 1024).toFixed(2)} MB`;
}

export function summarizeOcrLanguageCatalog() {
  const installed = listInstalledOcrLanguages();
  return Object.freeze({
    catalogued: OCR_LANGUAGE_MANIFEST.length,
    installed: installed.length,
    installedCodes: Object.freeze(installed.map((language) => language.code)),
    installedBytes: installed.reduce((total, language) => total + (language.modelBytes || 0), 0),
  });
}
