import { OCR_LANGUAGE_MAP } from "./ocr-language-manifest.js";
import {
  inspectOcrLanguagePackage,
  sha256Hex,
} from "./ocr-language-package.js";

export const OCR_LANGUAGE_STORAGE_SCHEMA = Object.freeze({
  databaseName: "pdfprivado-pro-ocr-languages",
  version: 1,
  metadataStore: "metadata",
  modelStore: "models",
  recordVersion: 1,
});

function normalizeCode(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value || []);
}

function copyArrayBuffer(value) {
  const bytes = normalizeBytes(value);
  return bytes.slice().buffer;
}

function cloneMetadata(record) {
  return Object.freeze({
    recordVersion: Number(record.recordVersion) || OCR_LANGUAGE_STORAGE_SCHEMA.recordVersion,
    code: normalizeCode(record.code),
    label: String(record.label || ""),
    nativeName: String(record.nativeName || ""),
    fileName: String(record.fileName || ""),
    modelFile: String(record.modelFile || ""),
    bytes: Number(record.bytes) || 0,
    sha256: String(record.sha256 || "").toLowerCase(),
    installedAt: String(record.installedAt || ""),
  });
}

function createInstallMetadata(inspection, installedAt) {
  return cloneMetadata({
    recordVersion: OCR_LANGUAGE_STORAGE_SCHEMA.recordVersion,
    code: inspection.code,
    label: inspection.language.label,
    nativeName: inspection.language.nativeName,
    fileName: inspection.fileName,
    modelFile: inspection.language.file,
    bytes: inspection.bytes,
    sha256: inspection.sha256,
    installedAt,
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB no pudo completar la operación."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("La operación local fue cancelada."));
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo completar la operación local."));
  });
}

function openDatabase(indexedDBFactory) {
  if (!indexedDBFactory?.open) {
    throw new Error("El almacenamiento local de idiomas no está disponible en este equipo.");
  }

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(
      OCR_LANGUAGE_STORAGE_SCHEMA.databaseName,
      OCR_LANGUAGE_STORAGE_SCHEMA.version
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore)) {
        database.createObjectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, { keyPath: "code" });
      }
      if (!database.objectStoreNames.contains(OCR_LANGUAGE_STORAGE_SCHEMA.modelStore)) {
        database.createObjectStore(OCR_LANGUAGE_STORAGE_SCHEMA.modelStore, { keyPath: "code" });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local de idiomas."));
    request.onblocked = () => reject(new Error("Otra ventana está bloqueando la actualización del almacenamiento de idiomas."));
  });
}

export function createIndexedDbOcrLanguageDriver({ indexedDBFactory = globalThis.indexedDB } = {}) {
  let databasePromise = null;

  function database() {
    if (!databasePromise) databasePromise = openDatabase(indexedDBFactory);
    return databasePromise;
  }

  return Object.freeze({
    async write({ metadata, bytes }) {
      const db = await database();
      const transaction = db.transaction(
        [OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, OCR_LANGUAGE_STORAGE_SCHEMA.modelStore],
        "readwrite"
      );
      transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore).put({ ...metadata });
      transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.modelStore).put({
        code: metadata.code,
        bytes: copyArrayBuffer(bytes),
      });
      await transactionDone(transaction);
    },

    async listMetadata() {
      const db = await database();
      const transaction = db.transaction(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, "readonly");
      const request = transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore).getAll();
      const records = await requestResult(request);
      await transactionDone(transaction);
      return records || [];
    },

    async read(code) {
      const normalized = normalizeCode(code);
      const db = await database();
      const transaction = db.transaction(
        [OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, OCR_LANGUAGE_STORAGE_SCHEMA.modelStore],
        "readonly"
      );
      const metadataRequest = transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore).get(normalized);
      const modelRequest = transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.modelStore).get(normalized);
      const [metadata, model] = await Promise.all([
        requestResult(metadataRequest),
        requestResult(modelRequest),
      ]);
      await transactionDone(transaction);
      if (!metadata || !model?.bytes) return null;
      return {
        metadata,
        bytes: copyArrayBuffer(model.bytes),
      };
    },

    async remove(code) {
      const normalized = normalizeCode(code);
      const db = await database();
      const existingTransaction = db.transaction(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, "readonly");
      const existing = await requestResult(
        existingTransaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore).get(normalized)
      );
      await transactionDone(existingTransaction);
      if (!existing) return false;

      const transaction = db.transaction(
        [OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore, OCR_LANGUAGE_STORAGE_SCHEMA.modelStore],
        "readwrite"
      );
      transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.metadataStore).delete(normalized);
      transaction.objectStore(OCR_LANGUAGE_STORAGE_SCHEMA.modelStore).delete(normalized);
      await transactionDone(transaction);
      return true;
    },
  });
}

export function createMemoryOcrLanguageDriver() {
  const metadata = new Map();
  const models = new Map();

  return Object.freeze({
    async write(record) {
      metadata.set(record.metadata.code, { ...record.metadata });
      models.set(record.metadata.code, copyArrayBuffer(record.bytes));
    },
    async listMetadata() {
      return [...metadata.values()].map((record) => ({ ...record }));
    },
    async read(code) {
      const normalized = normalizeCode(code);
      if (!metadata.has(normalized) || !models.has(normalized)) return null;
      return {
        metadata: { ...metadata.get(normalized) },
        bytes: copyArrayBuffer(models.get(normalized)),
      };
    },
    async remove(code) {
      const normalized = normalizeCode(code);
      const existed = metadata.delete(normalized);
      models.delete(normalized);
      return existed;
    },
  });
}

export function createOcrLanguageStorage({
  driver = createIndexedDbOcrLanguageDriver(),
  now = () => new Date().toISOString(),
} = {}) {
  return Object.freeze({
    async install({ inspection, bytes }) {
      const normalized = normalizeBytes(bytes);
      const verified = await inspectOcrLanguagePackage({
        fileName: inspection?.fileName,
        bytes: normalized,
      });
      const metadata = createInstallMetadata(verified, now());
      await driver.write({ metadata, bytes: normalized });
      return metadata;
    },

    async list() {
      const records = await driver.listMetadata();
      return Object.freeze(
        records
          .map(cloneMetadata)
          .filter((record) => {
            const language = OCR_LANGUAGE_MAP.get(record.code);
            return Boolean(language && !language.installed);
          })
          .sort((first, second) => first.label.localeCompare(second.label, "es"))
      );
    },

    async readVerified(code) {
      const normalized = normalizeCode(code);
      const language = OCR_LANGUAGE_MAP.get(normalized);
      if (!language || language.installed) return null;

      const record = await driver.read(normalized);
      if (!record) return null;

      const metadata = cloneMetadata(record.metadata);
      const bytes = normalizeBytes(record.bytes);
      if (metadata.bytes !== bytes.byteLength || metadata.bytes !== language.modelBytes) {
        throw new Error(`El modelo local de ${language.label} tiene un tamaño inesperado.`);
      }

      const hash = await sha256Hex(bytes);
      if (
        hash !== metadata.sha256 ||
        hash !== String(language.modelSha256 || "").toLowerCase()
      ) {
        throw new Error(`El modelo local de ${language.label} no supera la verificación de integridad.`);
      }

      return Object.freeze({
        metadata,
        bytes: bytes.slice(),
      });
    },

    async remove(code) {
      const normalized = normalizeCode(code);
      const language = OCR_LANGUAGE_MAP.get(normalized);
      if (!language) throw new Error("El idioma OCR solicitado no existe en el catálogo.");
      if (language.installed) {
        throw new Error(`${language.label} forma parte de la aplicación y no puede desinstalarse.`);
      }
      return driver.remove(normalized);
    },
  });
}
