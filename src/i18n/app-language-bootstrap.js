import { activatePreferredInstalledLanguage } from "./installed-language-activation.js";
import { createLanguageRuntime } from "./language-runtime.js";
import {
  getIntegratedFallbackLanguage,
  resolveInitialLanguage,
} from "./language-core.js";

export const APP_LANGUAGE_READY_EVENT = "pdfprivado:app-language-ready";

function safeDocument(documentRef = globalThis.document) {
  return documentRef && typeof documentRef === "object" ? documentRef : null;
}

export function applyLanguageIdentity(
  identity,
  {
    documentRef = globalThis.document,
    eventTarget = globalThis.window,
  } = {},
) {
  const documentObject = safeDocument(documentRef);
  const fallback = getIntegratedFallbackLanguage();
  const resolved = {
    code: identity?.code || fallback.code,
    languageTag: identity?.languageTag || fallback.languageTag,
    locale: identity?.locale || fallback.locale,
    reason: identity?.reason || "fallback",
    source: fallback.source,
  };

  if (documentObject?.documentElement) {
    documentObject.documentElement.lang = resolved.languageTag;
    documentObject.documentElement.dataset.languageCode = resolved.code;
    documentObject.documentElement.dataset.languageLocale = resolved.locale;
    documentObject.documentElement.dataset.languageReason = resolved.reason;
  }

  if (eventTarget && typeof eventTarget.dispatchEvent === "function") {
    const EventConstructor =
      eventTarget.CustomEvent ||
      globalThis.CustomEvent;

    if (typeof EventConstructor === "function") {
      eventTarget.dispatchEvent(
        new EventConstructor(APP_LANGUAGE_READY_EVENT, {
          detail: Object.freeze({ ...resolved }),
        }),
      );
    }
  }

  return Object.freeze(resolved);
}

export async function initializeAppLanguage(options = {}) {
  let identity;

  try {
    identity = await resolveInitialLanguage(options);
  } catch {
    const fallback = getIntegratedFallbackLanguage();
    identity = {
      code: fallback.code,
      languageTag: fallback.languageTag,
      locale: fallback.locale,
      reason: "startup-error-fallback",
    };
  }

  const appliedIdentity = applyLanguageIdentity(identity, options);
  const runtime = createLanguageRuntime({
    fallbackBundle: getIntegratedFallbackLanguage(),
    storage: options.storage ?? globalThis.localStorage,
    documentRef: options.documentRef ?? globalThis.document,
    eventTarget: options.eventTarget ?? globalThis.window,
  });

  const installedActivation = await activatePreferredInstalledLanguage({
    runtime,
    preferredCode: appliedIdentity.code,
    storage: options.storage ?? globalThis.localStorage,
    invoke: options.invoke,
    cryptoRef: options.cryptoRef ?? globalThis.crypto,
  });

  return Object.freeze({
    ...appliedIdentity,
    runtime,
    installedActivation,
  });
}
