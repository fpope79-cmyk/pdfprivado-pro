import { verifyLanguagePackage } from "./language-package-contract.js";

const INTEGRATED_LANGUAGE_CODE = "es";

function resolveInvoke(invoke) {
  const command = invoke ?? globalThis.__TAURI__?.core?.invoke;

  if (typeof command !== "function") {
    throw new TypeError("Tauri invoke is unavailable.");
  }

  return command;
}

function assertExternalCode(code) {
  if (code === INTEGRATED_LANGUAGE_CODE) {
    throw new TypeError("Integrated Spanish cannot be installed or deleted.");
  }
}

export async function installVerifiedLanguagePackage({
  manifest,
  translations,
  invoke,
  cryptoRef = globalThis.crypto,
} = {}) {
  const verified = await verifyLanguagePackage({
    manifest,
    translations,
    cryptoRef,
  });

  assertExternalCode(verified.manifest.code);

  return resolveInvoke(invoke)("save_language_package", {
    package: {
      manifest: verified.manifest,
      translations: verified.translations,
    },
  });
}

export async function listInstalledLanguagePackages({ invoke } = {}) {
  const result = await resolveInvoke(invoke)("list_language_packages");
  return Array.isArray(result) ? result : [];
}

export async function readInstalledLanguagePackage({
  code,
  version,
  invoke,
  cryptoRef = globalThis.crypto,
} = {}) {
  assertExternalCode(code);

  const packagePayload = await resolveInvoke(invoke)("read_language_package", {
    code,
    version,
  });

  return verifyLanguagePackage({
    manifest: packagePayload.manifest,
    translations: packagePayload.translations,
    cryptoRef,
  });
}

export async function deleteInstalledLanguagePackage({
  code,
  version,
  invoke,
} = {}) {
  assertExternalCode(code);

  return resolveInvoke(invoke)("delete_language_package", {
    code,
    version,
  });
}
