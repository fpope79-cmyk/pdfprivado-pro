import { SUPPORTED_LANGUAGE_IDENTITIES } from "./language-core.js";

export const LANGUAGE_CATALOG_API =
  "https://pdfprivado-languages-api.fpope79.workers.dev";

const SUPPORTED_BY_CODE = new Map(
  SUPPORTED_LANGUAGE_IDENTITIES.map((identity) => [identity.code, identity]),
);

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === 0 || value === 1) {
      return Boolean(value);
    }
  }

  return false;
}

export function normalizeCatalogLanguage(raw) {
  if (!raw || typeof raw !== "object") {
    throw new TypeError("Catalog language must be an object.");
  }

  const code = firstString(raw.code, raw.languageCode, raw.language_code);
  const supported = SUPPORTED_BY_CODE.get(code);

  if (!supported) {
    throw new TypeError(`Unsupported catalog language code: ${code}`);
  }

  const languageTag = firstString(
    raw.languageTag,
    raw.language_tag,
    supported.languageTag,
  );
  const locale = firstString(raw.locale, raw.bcp47, raw.bcp_47, supported.locale);

  if (languageTag !== supported.languageTag || locale !== supported.locale) {
    throw new TypeError(`Catalog identity mismatch for ${code}.`);
  }

  return Object.freeze({
    code,
    languageTag,
    locale,
    name: firstString(raw.name, raw.englishName, raw.english_name, code),
    nativeName: firstString(
      raw.nativeName,
      raw.native_name,
      raw.nameNative,
      raw.name_native,
      raw.name,
      code,
    ),
    active:
      firstBoolean(raw.active, raw.isActive, raw.is_active) ||
      raw.status === "active",
    proEnabled: firstBoolean(
      raw.proEnabled,
      raw.pro_enabled,
      raw.targets?.pro,
    ),
    packageVersion: firstString(
      raw.packageVersion,
      raw.package_version,
      raw.proPackageVersion,
      raw.pro_package_version,
      raw.version,
    ),
    manifestUrl: firstString(
      raw.manifestUrl,
      raw.manifest_url,
      raw.packageManifestUrl,
      raw.package_manifest_url,
      raw.proManifestUrl,
      raw.pro_manifest_url,
    ),
  });
}

export function normalizeCatalogResponse(payload) {
  const source = Array.isArray(payload)
    ? payload
    : payload?.languages ?? payload?.items ?? payload?.data;

  if (!Array.isArray(source)) {
    throw new TypeError("Language catalog response does not contain an array.");
  }

  const languages = [];

  for (const item of source) {
    try {
      const normalized = normalizeCatalogLanguage(item);

      if (normalized.active && normalized.proEnabled) {
        languages.push(normalized);
      }
    } catch {
      // Unknown or malformed remote rows are ignored rather than trusted.
    }
  }

  languages.sort((left, right) =>
    left.nativeName.localeCompare(right.nativeName),
  );

  return Object.freeze(languages);
}

export async function fetchProLanguageCatalog({
  fetchRef = globalThis.fetch,
  apiBaseUrl = LANGUAGE_CATALOG_API,
  signal,
} = {}) {
  if (typeof fetchRef !== "function") {
    throw new TypeError("Fetch is unavailable.");
  }

  const url = new URL("/v1/languages", apiBaseUrl);
  url.searchParams.set("target", "pro");

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
      `Language catalog request failed with HTTP ${response?.status ?? "unknown"}.`,
    );
  }

  return normalizeCatalogResponse(await response.json());
}
