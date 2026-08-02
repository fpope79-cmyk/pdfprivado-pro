import { FALLBACK_LANGUAGE } from "./fallback-es.js";

export const LANGUAGE_PREFERENCE_KEY = "pdfprivado.pro.language.code.v1";

export const SUPPORTED_LANGUAGE_IDENTITIES = Object.freeze([
  Object.freeze({ code: "cn", languageTag: "zh", locale: "zh-CN" }),
  Object.freeze({ code: "de", languageTag: "de", locale: "de-DE" }),
  Object.freeze({ code: "en", languageTag: "en", locale: "en-GB" }),
  Object.freeze({ code: "es", languageTag: "es", locale: "es-ES" }),
  Object.freeze({ code: "fr", languageTag: "fr", locale: "fr-FR" }),
  Object.freeze({ code: "it", languageTag: "it", locale: "it-IT" }),
  Object.freeze({ code: "jp", languageTag: "ja", locale: "ja-JP" }),
  Object.freeze({ code: "nl", languageTag: "nl", locale: "nl-NL" }),
  Object.freeze({ code: "pt", languageTag: "pt", locale: "pt-PT" }),
  Object.freeze({ code: "ru", languageTag: "ru", locale: "ru-RU" }),
]);

const BY_CODE = new Map(
  SUPPORTED_LANGUAGE_IDENTITIES.map((item) => [item.code, item]),
);

const BY_LOCALE = new Map(
  SUPPORTED_LANGUAGE_IDENTITIES.map((item) => [
    normalizeLocale(item.locale).toLowerCase(),
    item,
  ]),
);

const BY_LANGUAGE_TAG = new Map(
  SUPPORTED_LANGUAGE_IDENTITIES.map((item) => [
    item.languageTag.toLowerCase(),
    item,
  ]),
);

export function normalizeLocale(value) {
  const raw = String(value || "").trim().replaceAll("_", "-");

  if (!raw) {
    return "";
  }

  try {
    return Intl.getCanonicalLocales(raw)[0] || raw;
  } catch {
    return raw;
  }
}

export function resolveLanguageIdentity({
  preferredCode = null,
  systemLocale = null,
} = {}) {
  const normalizedCode = String(preferredCode || "").trim().toLowerCase();

  if (normalizedCode && BY_CODE.has(normalizedCode)) {
    return {
      ...BY_CODE.get(normalizedCode),
      reason: "preference",
    };
  }

  const normalizedLocale = normalizeLocale(systemLocale);

  if (normalizedLocale) {
    const exact = BY_LOCALE.get(normalizedLocale.toLowerCase());

    if (exact) {
      return {
        ...exact,
        reason: "system-exact",
      };
    }

    const languageTag = normalizedLocale.split("-")[0].toLowerCase();
    const generic = BY_LANGUAGE_TAG.get(languageTag);

    if (generic) {
      return {
        ...generic,
        reason: "system-language",
      };
    }
  }

  return {
    code: FALLBACK_LANGUAGE.code,
    languageTag: FALLBACK_LANGUAGE.languageTag,
    locale: FALLBACK_LANGUAGE.locale,
    reason: "fallback",
  };
}

export function readStoredLanguageCode(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(LANGUAGE_PREFERENCE_KEY);
    return value && BY_CODE.has(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLanguageCode(
  code,
  storage = globalThis.localStorage,
) {
  const normalizedCode = String(code || "").trim().toLowerCase();

  if (!BY_CODE.has(normalizedCode)) {
    throw new TypeError(`Unsupported PDFPrivado language code: ${code}`);
  }

  storage?.setItem(LANGUAGE_PREFERENCE_KEY, normalizedCode);
  return normalizedCode;
}

export function clearStoredLanguageCode(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(LANGUAGE_PREFERENCE_KEY);
  } catch {
    // A blocked storage provider must not prevent fallback startup.
  }
}

export async function detectSystemLocale({
  invoke = globalThis.__TAURI__?.core?.invoke,
  navigatorLocale = globalThis.navigator?.language,
} = {}) {
  if (typeof invoke === "function") {
    try {
      const locale = await invoke("get_system_locale");

      if (locale) {
        return normalizeLocale(locale);
      }
    } catch {
      // Browser locale remains a safe local fallback.
    }
  }

  return normalizeLocale(navigatorLocale);
}

export async function resolveInitialLanguage(options = {}) {
  const preferredCode =
    options.preferredCode ??
    readStoredLanguageCode(options.storage ?? globalThis.localStorage);

  const systemLocale =
    options.systemLocale ??
    (await detectSystemLocale({
      invoke: options.invoke,
      navigatorLocale: options.navigatorLocale,
    }));

  return resolveLanguageIdentity({
    preferredCode,
    systemLocale,
  });
}

export function getIntegratedFallbackLanguage() {
  return FALLBACK_LANGUAGE;
}
