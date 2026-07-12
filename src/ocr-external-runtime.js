import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";
import {
  TESSERACT_LANGUAGE_CACHE,
  clearOcrRuntimeLanguage,
  createIndexedDbTesseractCacheDriver,
  createOcrRuntimePath,
  stageOcrRuntimeLanguage,
} from "./ocr-tesseract-cache.js";

const { createWorker, OEM, PSM } = Tesseract;

const WORKER_PATH = new URL("./vendor/tesseract/worker.min.js", import.meta.url).href;
const CORE_PATH = new URL("./vendor/tesseract/core", import.meta.url).href.replace(/\/$/, "");
const OFFLINE_FALLBACK_LANG_PATH = new URL(
  "./vendor/tesseract/lang-offline-unavailable",
  import.meta.url
).href.replace(/\/$/, "");

let activeOperation = null;
let operationSequence = 0;

export class ExternalOcrCancelledError extends Error {
  constructor(message = "Prueba OCR externa cancelada") {
    super(message);
    this.name = "ExternalOcrCancelledError";
  }
}

function normalizeCode(value) {
  const code = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw new Error(`Código de idioma OCR no válido: ${code || "vacío"}`);
  }
  return code;
}

function createOperation(code, cacheDriver) {
  const id = ++operationSequence;
  let rejectCancellation = null;
  const cancellation = new Promise((_, reject) => {
    rejectCancellation = reject;
  });

  return {
    id,
    code,
    cacheDriver,
    runtimePath: createOcrRuntimePath(code, id),
    staged: null,
    worker: null,
    workerPromise: null,
    cancelled: false,
    cancellation,
    cancel() {
      if (this.cancelled) return;
      this.cancelled = true;
      rejectCancellation?.(new ExternalOcrCancelledError());
      rejectCancellation = null;
    },
  };
}

async function terminateCandidate(candidate) {
  try {
    await candidate?.terminate?.();
  } catch {
    // La limpieza nunca debe bloquear el visor.
  }
}

async function clearOperationCache(operation) {
  if (!operation?.staged) return;
  try {
    await clearOcrRuntimeLanguage({
      code: operation.code,
      driver: operation.cacheDriver,
      runtimePath: operation.staged.cachePath,
    });
  } catch {
    // La entrada se sustituye antes de cada prueba y no contiene documentos.
  }
}

function operationProgress(operation, callback, message) {
  if (activeOperation !== operation || operation.cancelled) return;
  callback?.(message);
}

export async function recognizeExternalOcrImage(
  image,
  code,
  bytes,
  {
    onProgress,
    cacheDriver = createIndexedDbTesseractCacheDriver(),
  } = {}
) {
  if (activeOperation) {
    throw new Error("Ya hay una prueba OCR externa en curso.");
  }

  const normalizedCode = normalizeCode(code);
  const operation = createOperation(normalizedCode, cacheDriver);
  activeOperation = operation;

  try {
    operation.staged = await stageOcrRuntimeLanguage({
      code: operation.code,
      bytes,
      driver: operation.cacheDriver,
      runtimePath: operation.runtimePath,
    });

    if (operation.cancelled) throw new ExternalOcrCancelledError();

    const creationPromise = createWorker(operation.code, OEM.LSTM_ONLY, {
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: OFFLINE_FALLBACK_LANG_PATH,
      cachePath: operation.staged.cachePath,
      cacheMethod: "readOnly",
      workerBlobURL: true,
      gzip: true,
      logger(message) {
        operationProgress(operation, onProgress, message);
      },
      errorHandler(error) {
        operationProgress(operation, onProgress, {
          status: "error",
          progress: 0,
          error: String(error?.message || error),
        });
      },
    });

    operation.workerPromise = creationPromise;
    creationPromise
      .then((candidate) => {
        if (operation.cancelled) terminateCandidate(candidate);
      })
      .catch(() => {});

    const candidate = await Promise.race([
      creationPromise,
      operation.cancellation,
    ]);
    operation.workerPromise = null;
    operation.worker = candidate;

    await Promise.race([
      candidate.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      }),
      operation.cancellation,
    ]);

    return await Promise.race([
      candidate.recognize(
        image,
        {},
        { text: true, blocks: true },
        `pdfprivado-ocr-external-${operation.code}-${operation.id}`
      ),
      operation.cancellation,
    ]);
  } finally {
    operation.cancelled = true;
    if (activeOperation === operation) activeOperation = null;
    await terminateCandidate(operation.worker);
    await clearOperationCache(operation);
  }
}

export async function cancelExternalOcrRuntime() {
  const operation = activeOperation;
  if (!operation) return;

  operation.cancel();
  if (activeOperation === operation) activeOperation = null;

  const pendingWorker = operation.workerPromise;
  operation.workerPromise = null;
  await terminateCandidate(operation.worker);
  operation.worker = null;

  if (pendingWorker) {
    pendingWorker.then(terminateCandidate).catch(() => {});
  }
  await clearOperationCache(operation);
}

export function isExternalOcrCancelledError(error) {
  return error?.name === "ExternalOcrCancelledError";
}

export const EXTERNAL_OCR_RUNTIME_INFO = Object.freeze({
  cacheDatabase: TESSERACT_LANGUAGE_CACHE.databaseName,
  cacheStore: TESSERACT_LANGUAGE_CACHE.storeName,
  cacheRoot: TESSERACT_LANGUAGE_CACHE.runtimeRoot,
  networkFallback: false,
  persistentResult: false,
});
