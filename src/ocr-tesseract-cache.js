export const TESSERACT_LANGUAGE_CACHE = Object.freeze({
  databaseName: "keyval-store",
  storeName: "keyval",
  runtimeRoot: "pdfprivado-pro-runtime-v1",
});

function normalizeCode(value) {
  const code = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw new Error(`Código de idioma OCR no válido: ${code || "vacío"}`);
  }
  return code;
}

function normalizeRuntimePath(value = TESSERACT_LANGUAGE_CACHE.runtimeRoot) {
  const path = String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!path || !/^[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/.test(path)) {
    throw new Error("La ruta temporal del modelo OCR no es válida.");
  }
  return path;
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value || []);
}

function copyBytes(value) {
  return normalizeBytes(value).slice();
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(
      request.error || new Error("IndexedDB no pudo completar la operación.")
    );
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(
      transaction.error || new Error("La operación de caché OCR fue cancelada.")
    );
    transaction.onerror = () => reject(
      transaction.error || new Error("No se pudo completar la operación de caché OCR.")
    );
  });
}

async function openKeyValueDatabase(indexedDBFactory) {
  if (!indexedDBFactory?.open) {
    throw new Error("La caché temporal del motor OCR no está disponible en este equipo.");
  }

  let database = await new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(TESSERACT_LANGUAGE_CACHE.databaseName);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TESSERACT_LANGUAGE_CACHE.storeName)) {
        request.result.createObjectStore(TESSERACT_LANGUAGE_CACHE.storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(
      request.error || new Error("No se pudo abrir la caché temporal del motor OCR.")
    );
    request.onblocked = () => reject(
      new Error("Otra ventana está bloqueando la caché temporal del motor OCR.")
    );
  });

  if (!database.objectStoreNames.contains(TESSERACT_LANGUAGE_CACHE.storeName)) {
    const nextVersion = database.version + 1;
    database.close();
    database = await new Promise((resolve, reject) => {
      const request = indexedDBFactory.open(
        TESSERACT_LANGUAGE_CACHE.databaseName,
        nextVersion
      );
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(TESSERACT_LANGUAGE_CACHE.storeName)) {
          request.result.createObjectStore(TESSERACT_LANGUAGE_CACHE.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(
        request.error || new Error("No se pudo preparar la caché temporal del motor OCR.")
      );
      request.onblocked = () => reject(
        new Error("Otra ventana está bloqueando la actualización de la caché OCR.")
      );
    });
  }

  database.onversionchange = () => database.close();
  return database;
}

export function createOcrRuntimePath(code, operationId) {
  const normalizedCode = normalizeCode(code);
  const normalizedOperation = String(operationId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalizedOperation) {
    throw new Error("La operación temporal OCR no tiene un identificador válido.");
  }
  return normalizeRuntimePath(
    `${TESSERACT_LANGUAGE_CACHE.runtimeRoot}/${normalizedCode}-${normalizedOperation}`
  );
}

export function ocrRuntimeCacheKey(
  code,
  runtimePath = TESSERACT_LANGUAGE_CACHE.runtimeRoot
) {
  return `${normalizeRuntimePath(runtimePath)}/${normalizeCode(code)}.traineddata`;
}

export function createIndexedDbTesseractCacheDriver({
  indexedDBFactory = globalThis.indexedDB,
} = {}) {
  return Object.freeze({
    async put(key, bytes) {
      const database = await openKeyValueDatabase(indexedDBFactory);
      try {
        const transaction = database.transaction(
          TESSERACT_LANGUAGE_CACHE.storeName,
          "readwrite"
        );
        const completed = transactionDone(transaction);
        transaction
          .objectStore(TESSERACT_LANGUAGE_CACHE.storeName)
          .put(copyBytes(bytes), String(key));
        await completed;
      } finally {
        database.close();
      }
    },

    async read(key) {
      const database = await openKeyValueDatabase(indexedDBFactory);
      try {
        const transaction = database.transaction(
          TESSERACT_LANGUAGE_CACHE.storeName,
          "readonly"
        );
        const completed = transactionDone(transaction);
        const value = await requestResult(
          transaction
            .objectStore(TESSERACT_LANGUAGE_CACHE.storeName)
            .get(String(key))
        );
        await completed;
        return value == null ? null : copyBytes(value);
      } finally {
        database.close();
      }
    },

    async remove(key) {
      const database = await openKeyValueDatabase(indexedDBFactory);
      try {
        const transaction = database.transaction(
          TESSERACT_LANGUAGE_CACHE.storeName,
          "readwrite"
        );
        const completed = transactionDone(transaction);
        transaction
          .objectStore(TESSERACT_LANGUAGE_CACHE.storeName)
          .delete(String(key));
        await completed;
      } finally {
        database.close();
      }
    },
  });
}

export function createMemoryTesseractCacheDriver() {
  const records = new Map();
  return Object.freeze({
    async put(key, bytes) {
      records.set(String(key), copyBytes(bytes));
    },
    async read(key) {
      return records.has(String(key)) ? copyBytes(records.get(String(key))) : null;
    },
    async remove(key) {
      records.delete(String(key));
    },
  });
}

export async function stageOcrRuntimeLanguage({
  code,
  bytes,
  driver = createIndexedDbTesseractCacheDriver(),
  runtimePath = TESSERACT_LANGUAGE_CACHE.runtimeRoot,
} = {}) {
  const normalizedCode = normalizeCode(code);
  const normalizedPath = normalizeRuntimePath(runtimePath);
  const normalizedBytes = copyBytes(bytes);
  if (!normalizedBytes.byteLength) {
    throw new Error("El modelo OCR local está vacío.");
  }
  if (normalizedBytes[0] !== 31 || normalizedBytes[1] !== 139) {
    throw new Error("El modelo OCR local no está comprimido en el formato esperado.");
  }

  const key = ocrRuntimeCacheKey(normalizedCode, normalizedPath);
  await driver.remove(key);
  await driver.put(key, normalizedBytes);
  return Object.freeze({
    code: normalizedCode,
    key,
    cachePath: normalizedPath,
    bytes: normalizedBytes.byteLength,
  });
}

export async function clearOcrRuntimeLanguage({
  code,
  driver = createIndexedDbTesseractCacheDriver(),
  runtimePath = TESSERACT_LANGUAGE_CACHE.runtimeRoot,
} = {}) {
  const key = ocrRuntimeCacheKey(code, runtimePath);
  await driver.remove(key);
  return key;
}
