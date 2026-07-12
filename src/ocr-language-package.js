import { OCR_LANGUAGE_MAP } from "./ocr-language-manifest.js";

export const OCR_LANGUAGE_PACKAGE_EXTENSION = ".pdfprivado-ocr";

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value || []);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ocrLanguagePackageFileName(value) {
  return String(value || "").split(/[\\/]/).pop() || "";
}

export function detectOcrLanguagePackageCode(fileName) {
  const name = ocrLanguagePackageFileName(fileName);
  const lowerName = name.toLowerCase();

  if (!lowerName.endsWith(OCR_LANGUAGE_PACKAGE_EXTENSION)) {
    throw new Error(`El archivo debe terminar en ${OCR_LANGUAGE_PACKAGE_EXTENSION}.`);
  }

  const stem = name.slice(0, -OCR_LANGUAGE_PACKAGE_EXTENSION.length);
  const codes = [...OCR_LANGUAGE_MAP.keys()].sort((first, second) => second.length - first.length);
  const code = codes.find((candidate) => {
    const pattern = new RegExp(`(?:^|[-_.])${escapeRegExp(candidate)}$`, "i");
    return pattern.test(stem);
  });

  if (!code) {
    throw new Error("El nombre del paquete no contiene un código OCR reconocido.");
  }

  return code;
}

export async function sha256Hex(bytes) {
  const normalized = normalizeBytes(bytes);
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error("Este equipo no permite verificar la huella SHA-256 del paquete.");
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", normalized);
  return Array.from(
    new Uint8Array(digest),
    (value) => value.toString(16).padStart(2, "0")
  ).join("");
}

export function formatOcrPackageSize(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric < 0) return "Tamaño desconocido";
  if (numeric < 1024) return `${numeric} bytes`;
  if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)} KB`;
  return `${(numeric / 1024 / 1024).toFixed(2)} MB`;
}

export async function inspectOcrLanguagePackage({ fileName, bytes }) {
  const code = detectOcrLanguagePackageCode(fileName);
  const language = OCR_LANGUAGE_MAP.get(code);

  if (!language) {
    throw new Error("El idioma del paquete no existe en el catálogo OCR.");
  }
  if (language.installed) {
    throw new Error(`${language.label} ya está incluido en la aplicación.`);
  }
  if (!language.modelBytes || !language.modelSha256) {
    throw new Error(`Todavía no hay un paquete oficial validable para ${language.label}.`);
  }

  const normalized = normalizeBytes(bytes);
  if (normalized.byteLength !== language.modelBytes) {
    throw new Error(
      `El tamaño del paquete de ${language.label} no coincide. Esperado: ${language.modelBytes} bytes; recibido: ${normalized.byteLength} bytes.`
    );
  }

  const hash = await sha256Hex(normalized);
  if (hash.toLowerCase() !== String(language.modelSha256).toLowerCase()) {
    throw new Error(`La huella SHA-256 del paquete de ${language.label} no coincide.`);
  }

  return Object.freeze({
    code: language.code,
    language,
    fileName: ocrLanguagePackageFileName(fileName),
    bytes: normalized.byteLength,
    sizeLabel: formatOcrPackageSize(normalized.byteLength),
    sha256: hash,
  });
}
