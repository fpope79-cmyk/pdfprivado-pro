import { readStoredLanguageCode } from "./language-core.js";
import {
  listInstalledLanguagePackages,
  readInstalledLanguagePackage,
} from "./language-package-storage.js";

function compareVersionsDescending(left, right) {
  return right.version.localeCompare(left.version, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function selectInstalledLanguagePackage(installed, code) {
  return (Array.isArray(installed) ? installed : [])
    .filter((entry) => entry?.code === code && entry?.version)
    .sort(compareVersionsDescending)[0] ?? null;
}

export async function activatePreferredInstalledLanguage({
  runtime,
  preferredCode,
  storage = globalThis.localStorage,
  invoke,
  cryptoRef = globalThis.crypto,
} = {}) {
  if (!runtime || typeof runtime.setLanguageBundle !== "function") {
    throw new TypeError("Language runtime is required.");
  }

  const code = preferredCode ?? readStoredLanguageCode(storage);

  if (!code || code === "es") {
    runtime.resetToFallback({
      persist: false,
      reason: code === "es" ? "integrated-preference" : "no-preference",
    });

    return Object.freeze({
      activated: false,
      code: "es",
      reason: code === "es" ? "integrated-preference" : "no-preference",
    });
  }

  try {
    const installed = await listInstalledLanguagePackages({ invoke });
    const selected = selectInstalledLanguagePackage(installed, code);

    if (!selected) {
      runtime.resetToFallback({
        persist: false,
        reason: "installed-package-missing",
      });

      return Object.freeze({
        activated: false,
        code: "es",
        requestedCode: code,
        reason: "installed-package-missing",
      });
    }

    const verified = await readInstalledLanguagePackage({
      code,
      version: selected.version,
      invoke,
      cryptoRef,
    });

    runtime.setLanguageBundle(
      {
        ...verified.manifest,
        source: "installed",
        translations: verified.translations,
      },
      {
        persist: false,
        reason: "installed-package-activated",
      },
    );

    return Object.freeze({
      activated: true,
      code,
      version: selected.version,
      reason: "installed-package-activated",
    });
  } catch (error) {
    runtime.resetToFallback({
      persist: false,
      reason: "installed-package-invalid",
    });

    return Object.freeze({
      activated: false,
      code: "es",
      requestedCode: code,
      reason: "installed-package-invalid",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
