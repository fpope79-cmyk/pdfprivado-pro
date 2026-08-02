import { SUPPORTED_LANGUAGE_IDENTITIES } from "./language-core.js";

export const LANGUAGE_PACKAGE_SCHEMA_VERSION = 1;
export const LANGUAGE_PACKAGE_KIND = "pdfprivado-pro-ui-language";
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const SUPPORTED_BY_CODE = new Map(
  SUPPORTED_LANGUAGE_IDENTITIES.map((identity) => [identity.code, identity]),
);

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype,
  );
}

function assertString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function assertTranslations(value, path = "translations") {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path} must be a plain object.`);
  }

  for (const [key, child] of Object.entries(value)) {
    if (!key.trim()) {
      throw new TypeError(`${path} contains an empty key.`);
    }

    if (typeof child === "string") {
      continue;
    }

    if (isPlainObject(child)) {
      assertTranslations(child, `${path}.${key}`);
      continue;
    }

    throw new TypeError(
      `${path}.${key} must be a string or a nested plain object.`,
    );
  }

  return value;
}

function assertKnownIdentity({ code, languageTag, locale }) {
  const supported = SUPPORTED_BY_CODE.get(code);

  if (!supported) {
    throw new TypeError(`Unsupported PDFPrivado language code: ${code}`);
  }

  if (supported.languageTag !== languageTag) {
    throw new TypeError(
      `Language tag mismatch for ${code}: expected ${supported.languageTag}.`,
    );
  }

  if (supported.locale !== locale) {
    throw new TypeError(
      `Locale mismatch for ${code}: expected ${supported.locale}.`,
    );
  }
}

export function validateLanguagePackageManifest(manifest) {
  if (!isPlainObject(manifest)) {
    throw new TypeError("Language package manifest must be a plain object.");
  }

  if (manifest.schemaVersion !== LANGUAGE_PACKAGE_SCHEMA_VERSION) {
    throw new TypeError(
      `Unsupported language package schema version: ${manifest.schemaVersion}`,
    );
  }

  if (manifest.kind !== LANGUAGE_PACKAGE_KIND) {
    throw new TypeError(`Unsupported language package kind: ${manifest.kind}`);
  }

  const code = assertString(manifest.code, "code");
  const languageTag = assertString(manifest.languageTag, "languageTag");
  const locale = assertString(manifest.locale, "locale");
  const name = assertString(manifest.name, "name");
  const nativeName = assertString(manifest.nativeName, "nativeName");
  const version = assertString(manifest.version, "version");
  const translationsFile = assertString(manifest.translationsFile, "translationsFile");
  const translationsSha256 = assertString(
    manifest.translationsSha256,
    "translationsSha256",
  ).toLowerCase();

  if (!SEMVER_PATTERN.test(version)) {
    throw new TypeError(`Invalid semantic version: ${version}`);
  }

  if (!SHA256_HEX_PATTERN.test(translationsSha256)) {
    throw new TypeError(
      "translationsSha256 must be a 64-character SHA-256 hex digest.",
    );
  }

  if (
    translationsFile.includes("..") ||
    translationsFile.startsWith("/") ||
    translationsFile.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(translationsFile)
  ) {
    throw new TypeError("translationsFile must be a safe relative file name.");
  }

  assertKnownIdentity({ code, languageTag, locale });

  return Object.freeze({
    schemaVersion: LANGUAGE_PACKAGE_SCHEMA_VERSION,
    kind: LANGUAGE_PACKAGE_KIND,
    code,
    languageTag,
    locale,
    name,
    nativeName,
    version,
    translationsFile,
    translationsSha256,
  });
}

export function validateLanguageTranslations(translations) {
  assertTranslations(translations);
  return Object.freeze(structuredClone(translations));
}

function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableSortObject(value[key])]),
    );
  }

  return value;
}

export function canonicalizeTranslations(translations) {
  const validated = validateLanguageTranslations(translations);
  return JSON.stringify(stableSortObject(validated));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(content, cryptoRef = globalThis.crypto) {
  if (!cryptoRef?.subtle || typeof cryptoRef.subtle.digest !== "function") {
    throw new TypeError("Web Crypto SHA-256 is unavailable.");
  }

  const bytes =
    content instanceof Uint8Array
      ? content
      : new TextEncoder().encode(String(content));

  const digest = await cryptoRef.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyLanguagePackage({
  manifest,
  translations,
  cryptoRef = globalThis.crypto,
} = {}) {
  const normalizedManifest = validateLanguagePackageManifest(manifest);
  const normalizedTranslations = validateLanguageTranslations(translations);
  const canonicalTranslations = canonicalizeTranslations(normalizedTranslations);
  const actualSha256 = await sha256Hex(canonicalTranslations, cryptoRef);

  if (actualSha256 !== normalizedManifest.translationsSha256) {
    throw new TypeError(
      `Language package SHA-256 mismatch: expected ${normalizedManifest.translationsSha256}, received ${actualSha256}.`,
    );
  }

  return Object.freeze({
    manifest: normalizedManifest,
    translations: normalizedTranslations,
    canonicalTranslations,
    verifiedSha256: actualSha256,
  });
}
