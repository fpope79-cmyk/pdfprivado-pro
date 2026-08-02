import { FALLBACK_LANGUAGE } from "./fallback-es.js";
import { writeStoredLanguageCode } from "./language-core.js";

export const APP_LANGUAGE_CHANGED_EVENT = "pdfprivado:app-language-changed";

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getByPath(object, key) {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  if (hasOwn(object, key)) {
    return object[key];
  }

  return String(key)
    .split(".")
    .reduce((value, segment) => {
      if (!value || typeof value !== "object" || !hasOwn(value, segment)) {
        return undefined;
      }

      return value[segment];
    }, object);
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, name) => {
    return hasOwn(values, name) ? String(values[name]) : match;
  });
}

function normalizeBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new TypeError("Language bundle must be an object.");
  }

  if (!bundle.code || !bundle.languageTag || !bundle.locale) {
    throw new TypeError("Language bundle identity is incomplete.");
  }

  return Object.freeze({
    schemaVersion: Number(bundle.schemaVersion || 1),
    code: String(bundle.code),
    languageTag: String(bundle.languageTag),
    locale: String(bundle.locale),
    name: String(bundle.name || bundle.code),
    nativeName: String(bundle.nativeName || bundle.name || bundle.code),
    version: String(bundle.version || "0.0.0"),
    source: String(bundle.source || "memory"),
    translations: Object.freeze({ ...(bundle.translations || {}) }),
  });
}

export function createLanguageRuntime({
  fallbackBundle = FALLBACK_LANGUAGE,
  initialBundle = null,
  storage = globalThis.localStorage,
  documentRef = globalThis.document,
  eventTarget = globalThis.window,
} = {}) {
  const fallback = normalizeBundle(fallbackBundle);
  let active = initialBundle ? normalizeBundle(initialBundle) : fallback;

  function translate(key, values = {}, defaultValue = undefined) {
    const normalizedKey = String(key || "").trim();

    if (!normalizedKey) {
      return "";
    }

    const activeValue = getByPath(active.translations, normalizedKey);
    const fallbackValue = getByPath(fallback.translations, normalizedKey);
    const resolved =
      activeValue ??
      fallbackValue ??
      defaultValue ??
      normalizedKey;

    return interpolate(resolved, values);
  }

  function applyDocumentMetadata(reason = "runtime") {
    const root = documentRef?.documentElement;

    if (!root) {
      return;
    }

    root.lang = active.languageTag;
    root.dataset.languageCode = active.code;
    root.dataset.languageLocale = active.locale;
    root.dataset.languageReason = reason;
    root.dataset.languageSource = active.source;
    root.dataset.languageVersion = active.version;
  }

  function dispatchChange(reason) {
    if (!eventTarget || typeof eventTarget.dispatchEvent !== "function") {
      return;
    }

    const EventConstructor = eventTarget.CustomEvent || globalThis.CustomEvent;

    if (typeof EventConstructor !== "function") {
      return;
    }

    eventTarget.dispatchEvent(
      new EventConstructor(APP_LANGUAGE_CHANGED_EVENT, {
        detail: Object.freeze({
          code: active.code,
          languageTag: active.languageTag,
          locale: active.locale,
          version: active.version,
          source: active.source,
          reason,
        }),
      }),
    );
  }

  function setLanguageBundle(bundle, {
    persist = true,
    reason = "runtime-change",
  } = {}) {
    active = normalizeBundle(bundle);

    if (persist) {
      writeStoredLanguageCode(active.code, storage);
    }

    applyDocumentMetadata(reason);
    dispatchChange(reason);

    return active;
  }

  function resetToFallback({
    persist = false,
    reason = "fallback-reset",
  } = {}) {
    return setLanguageBundle(fallback, { persist, reason });
  }

  function getActiveLanguage() {
    return active;
  }

  applyDocumentMetadata("runtime-init");

  return Object.freeze({
    t: translate,
    setLanguageBundle,
    resetToFallback,
    getActiveLanguage,
    getFallbackLanguage: () => fallback,
  });
}
