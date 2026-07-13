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
  constructor(message = "OCR externo cancelado") {
    super(message);
    this.name = "ExternalOcrCancelledError";
  }
}

function normalizeCode(value) {
  const code = String(value || "").trim().toLowerCase();

  if (!/^[a-z0-9_]+$/.test(code)) {
    throw new Error(
      `Código de idioma OCR no válido: ${code || "vacío"}`
    );
  }

  return code;
}

function normalizeCodes(value) {
  const rawCodes = Array.isArray(value)
    ? value
    : String(value || "").split("+");
  const codes = [];

  for (const rawCode of rawCodes) {
    const code = normalizeCode(rawCode);
    if (!codes.includes(code)) codes.push(code);
  }

  if (!codes.length) {
    throw new Error("No se indicó ningún idioma OCR.");
  }

  if (codes.length > 2) {
    throw new Error(
      "El runtime OCR admite como máximo dos idiomas simultáneos."
    );
  }

  return codes;
}

function normalizeModels(codes, value) {
  if (
    codes.length === 1 &&
    (
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value)
    )
  ) {
    return [{
      code: codes[0],
      bytes: value,
    }];
  }

  const records = Array.isArray(value) ? value : [];

  return codes.map((code) => {
    const record = records.find(
      (entry) => normalizeCode(entry?.code) === code
    );

    if (!record?.bytes) {
      throw new Error(
        `Faltan los bytes del modelo OCR ${code}.`
      );
    }

    return {
      code,
      bytes: record.bytes,
    };
  });
}

// PDFPRIVADO_EXTERNAL_OCR_MULTI_V3
function createOperation(codes, cacheDriver) {
  const id = ++operationSequence;
  let rejectCancellation = null;

  const cancellation = new Promise((_, reject) => {
    rejectCancellation = reject;
  });

  return {
    id,
    codes,
    cacheDriver,
    runtimePath: createOcrRuntimePath(
      codes.join("_"),
      id
    ),
    staged: [],
    worker: null,
    workerPromise: null,
    cancelled: false,
    cancellation,
    cancel() {
      if (this.cancelled) return;
      this.cancelled = true;
      rejectCancellation?.(
        new ExternalOcrCancelledError()
      );
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
  if (!operation?.staged?.length) return;

  await Promise.allSettled(
    operation.staged.map((staged) =>
      clearOcrRuntimeLanguage({
        code: staged.code,
        driver: operation.cacheDriver,
        runtimePath: staged.cachePath,
      })
    )
  );
}

function operationProgress(operation, callback, message) {
  if (
    activeOperation !== operation ||
    operation.cancelled
  ) {
    return;
  }

  callback?.(message);
}

export async function recognizeExternalOcrImage(
  image,
  codesValue,
  modelsValue,
  {
    onProgress,
    cacheDriver = createIndexedDbTesseractCacheDriver(),
  } = {}
) {
  if (activeOperation) {
    throw new Error(
      "Ya hay una operación OCR externa en curso."
    );
  }

  const codes = normalizeCodes(codesValue);
  const models = normalizeModels(codes, modelsValue);
  const operation = createOperation(codes, cacheDriver);
  activeOperation = operation;

  try {
    for (const model of models) {
      const staged = await stageOcrRuntimeLanguage({
        code: model.code,
        bytes: model.bytes,
        driver: operation.cacheDriver,
        runtimePath: operation.runtimePath,
      });

      operation.staged.push(staged);

      if (operation.cancelled) {
        throw new ExternalOcrCancelledError();
      }
    }

    const workerLanguages =
      operation.codes.length === 1
        ? operation.codes[0]
        : operation.codes;

    const creationPromise = createWorker(
      workerLanguages,
      OEM.LSTM_ONLY,
      {
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        langPath: OFFLINE_FALLBACK_LANG_PATH,
        cachePath: operation.runtimePath,
        cacheMethod: "readOnly",
        workerBlobURL: true,
        gzip: true,
        logger(message) {
          operationProgress(
            operation,
            onProgress,
            message
          );
        },
        errorHandler(error) {
          operationProgress(
            operation,
            onProgress,
            {
              status: "error",
              progress: 0,
              error: String(
                error?.message || error
              ),
            }
          );
        },
      }
    );

    operation.workerPromise = creationPromise;

    creationPromise
      .then((candidate) => {
        if (operation.cancelled) {
          terminateCandidate(candidate);
        }
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
        `pdfprivado-ocr-external-${operation.codes.join("+")}-${operation.id}`
      ),
      operation.cancellation,
    ]);
  } finally {
    operation.cancelled = true;

    if (activeOperation === operation) {
      activeOperation = null;
    }

    await terminateCandidate(operation.worker);
    await clearOperationCache(operation);
  }
}

export async function cancelExternalOcrRuntime() {
  const operation = activeOperation;

  if (!operation) return;

  operation.cancel();

  if (activeOperation === operation) {
    activeOperation = null;
  }

  const pendingWorker = operation.workerPromise;
  operation.workerPromise = null;

  await terminateCandidate(operation.worker);
  operation.worker = null;

  if (pendingWorker) {
    pendingWorker
      .then(terminateCandidate)
      .catch(() => {});
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