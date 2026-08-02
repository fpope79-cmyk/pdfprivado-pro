import { fetchProLanguageCatalog } from "./language-catalog-client.js";
import {
  deleteInstalledLanguagePackage,
  installVerifiedLanguagePackage,
  listInstalledLanguagePackages,
  readInstalledLanguagePackage,
} from "./language-package-storage.js";

async function fetchJson(url, {
  fetchRef = globalThis.fetch,
  signal,
} = {}) {
  if (typeof fetchRef !== "function") {
    throw new TypeError("Fetch is unavailable.");
  }

  const response = await fetchRef(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
  });

  if (!response?.ok) {
    throw new TypeError(
      `Language package request failed with HTTP ${response?.status ?? "unknown"}.`,
    );
  }

  return response.json();
}

export function createLanguageDeliveryService({
  runtime,
  invoke,
  fetchRef = globalThis.fetch,
  cryptoRef = globalThis.crypto,
  apiBaseUrl,
} = {}) {
  if (!runtime || typeof runtime.setLanguageBundle !== "function") {
    throw new TypeError("Language runtime is required.");
  }

  async function getState(options = {}) {
    const [catalog, installed] = await Promise.all([
      fetchProLanguageCatalog({
        fetchRef,
        apiBaseUrl,
        signal: options.signal,
      }),
      listInstalledLanguagePackages({ invoke }),
    ]);

    return Object.freeze({
      catalog,
      installed,
      active: runtime.getActiveLanguage(),
    });
  }

  async function installFromCatalog(entry, options = {}) {
    if (!entry?.manifestUrl) {
      throw new TypeError("This language has no downloadable package.");
    }

    const manifest = await fetchJson(entry.manifestUrl, {
      fetchRef,
      signal: options.signal,
    });

    const translationsUrl = new URL(
      manifest.translationsFile,
      entry.manifestUrl,
    );
    const translations = await fetchJson(translationsUrl, {
      fetchRef,
      signal: options.signal,
    });

    const installed = await installVerifiedLanguagePackage({
      manifest,
      translations,
      invoke,
      cryptoRef,
    });

    const verified = await readInstalledLanguagePackage({
      code: installed.code,
      version: installed.version,
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
        persist: true,
        reason: "package-installed-and-activated",
      },
    );

    return Object.freeze({
      installed,
      active: runtime.getActiveLanguage(),
    });
  }

  async function activateInstalled(code, version) {
    if (code === "es") {
      runtime.resetToFallback({
        persist: true,
        reason: "integrated-spanish-activated",
      });

      return runtime.getActiveLanguage();
    }

    const verified = await readInstalledLanguagePackage({
      code,
      version,
      invoke,
      cryptoRef,
    });

    return runtime.setLanguageBundle(
      {
        ...verified.manifest,
        source: "installed",
        translations: verified.translations,
      },
      {
        persist: true,
        reason: "installed-package-activated",
      },
    );
  }

  async function removeInstalled(code, version) {
    if (runtime.getActiveLanguage().code === code) {
      runtime.resetToFallback({
        persist: true,
        reason: "active-package-removed",
      });
    }

    return deleteInstalledLanguagePackage({
      code,
      version,
      invoke,
    });
  }

  return Object.freeze({
    getState,
    installFromCatalog,
    activateInstalled,
    removeInstalled,
    listInstalled: () => listInstalledLanguagePackages({ invoke }),
  });
}
