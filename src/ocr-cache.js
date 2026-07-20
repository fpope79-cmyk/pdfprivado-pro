const DATABASE_NAME = "pdfprivado-ocr-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "records";
const CACHE_SCHEMA_VERSION = "ocr-cache-v1";
const MAX_RECORDS = 5000;

let databasePromise = null;

function openDatabase() {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "key" });

      if (!store.indexNames.contains("documentHash")) {
        store.createIndex("documentHash", "documentHash", { unique: false });
      }
      if (!store.indexNames.contains("lastUsedAt")) {
        store.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn("Caché OCR no disponible.", error);
    return null;
  });

  return databasePromise;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function normalizeRecord(record) {
  return {
    text: String(record?.text || ""),
    words: Array.isArray(record?.words)
      ? record.words.map((word) => ({
          text: String(word?.text || ""),
          bbox: {
            x0: Number(word?.bbox?.x0) || 0,
            y0: Number(word?.bbox?.y0) || 0,
            x1: Number(word?.bbox?.x1) || 0,
            y1: Number(word?.bbox?.y1) || 0,
          },
          confidence: Number.isFinite(word?.confidence)
            ? Number(word.confidence)
            : null,
          start: Number(word?.start) || 0,
          end: Number(word?.end) || 0,
        }))
      : [],
    confidence: Number.isFinite(record?.confidence)
      ? Number(record.confidence)
      : null,
    language: String(record?.language || ""),
    languageLabel: String(record?.languageLabel || ""),
    imageWidth: Math.max(1, Number(record?.imageWidth) || 1),
    imageHeight: Math.max(1, Number(record?.imageHeight) || 1),
    rotation: Number(record?.rotation) || 0,
    effectiveDpi: Math.max(1, Number(record?.effectiveDpi) || 1),
    createdAt: Number(record?.createdAt) || Date.now(),
  };
}

export async function hashDocumentBytes(bytes) {
  const source = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes || []);

  if (!globalThis.crypto?.subtle) {
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source[index];
      hash = Math.imul(hash, 16777619);
    }
    return `fallback-${source.length}-${(hash >>> 0).toString(16)}`;
  }

  const digest = await crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function createOcrCacheKey({
  documentHash,
  pageNumber,
  languageKey,
  profileKey,
  rotation = 0,
  engineVersion = "tesseract-local-v1",
}) {
  return [
    CACHE_SCHEMA_VERSION,
    documentHash,
    Number(pageNumber) || 0,
    String(languageKey || ""),
    String(profileKey || ""),
    Number(rotation) || 0,
    String(engineVersion || ""),
  ].join("|");
}

export async function readOcrCacheRecord(descriptor) {
  const database = await openDatabase();
  if (!database) return null;

  const key = createOcrCacheKey(descriptor);
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const value = await requestPromise(store.get(key));

  if (value) {
    value.lastUsedAt = Date.now();
    store.put(value);
  }

  await transactionComplete(transaction);
  return value?.record || null;
}

export async function writeOcrCacheRecord(descriptor, record) {
  const database = await openDatabase();
  if (!database || !record) return false;

  const key = createOcrCacheKey(descriptor);
  const now = Date.now();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  store.put({
    key,
    documentHash: descriptor.documentHash,
    pageNumber: Number(descriptor.pageNumber) || 0,
    languageKey: String(descriptor.languageKey || ""),
    profileKey: String(descriptor.profileKey || ""),
    rotation: Number(descriptor.rotation) || 0,
    engineVersion: String(descriptor.engineVersion || ""),
    record: normalizeRecord(record),
    createdAt: now,
    lastUsedAt: now,
  });

  await transactionComplete(transaction);
  void pruneOcrCache();
  return true;
}

export async function readCachedPages({
  documentHash,
  pages,
  languageKey,
  profileKey,
  rotation = 0,
  engineVersion,
}) {
  const result = new Map();

  await Promise.all(
    [...pages].map(async (pageNumber) => {
      const record = await readOcrCacheRecord({
        documentHash,
        pageNumber,
        languageKey,
        profileKey,
        rotation,
        engineVersion,
      });
      if (record?.text || record?.words?.length) {
        result.set(pageNumber, record);
      }
    })
  );

  return result;
}

export async function pruneOcrCache(maxRecords = MAX_RECORDS) {
  const database = await openDatabase();
  if (!database) return;

  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const count = await requestPromise(store.count());

  if (count <= maxRecords) {
    await transactionComplete(transaction);
    return;
  }

  const excess = count - maxRecords;
  const index = store.index("lastUsedAt");
  let removed = 0;

  await new Promise((resolve, reject) => {
    const request = index.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || removed >= excess) {
        resolve();
        return;
      }
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
  });

  await transactionComplete(transaction);
}

export async function clearDocumentOcrCache(documentHash) {
  const database = await openDatabase();
  if (!database) return;

  const transaction = database.transaction(STORE_NAME, "readwrite");
  const index = transaction.objectStore(STORE_NAME).index("documentHash");

  await new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(documentHash));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
  });

  await transactionComplete(transaction);
}
