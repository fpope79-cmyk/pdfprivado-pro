import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";

const { createWorker, OEM, PSM } = Tesseract;

const WORKER_PATH = new URL("./vendor/tesseract/worker.min.js", import.meta.url).href;
const CORE_PATH = new URL("./vendor/tesseract/core", import.meta.url).href.replace(/\/$/, "");
const LANG_PATH = new URL("./vendor/tesseract/lang", import.meta.url).href.replace(/\/$/, "");

export class OcrCancelledError extends Error {
  constructor(message = "OCR cancelado") {
    super(message);
    this.name = "OcrCancelledError";
  }
}

let worker = null;
let workerLanguage = "";
let workerPromise = null;
let epoch = 0;
let activeOperation = null;

function createCancellationSignal() {
  let rejectOperation = null;
  const promise = new Promise((_, reject) => {
    rejectOperation = reject;
  });
  return {
    promise,
    cancel() {
      rejectOperation?.(new OcrCancelledError());
      rejectOperation = null;
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

async function ensureWorker(language, onProgress, operationEpoch) {
  if (worker && workerLanguage === language) return worker;

  if (worker) {
    const previous = worker;
    worker = null;
    workerLanguage = "";
    await terminateCandidate(previous);
  }

  if (!workerPromise) {
    const creationEpoch = operationEpoch;
    workerPromise = createWorker(language, OEM.LSTM_ONLY, {
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      workerBlobURL: true,
      gzip: true,
      cacheMethod: "none",
      logger(message) {
        if (creationEpoch !== epoch) return;
        onProgress?.(message);
      },
      errorHandler(error) {
        if (creationEpoch !== epoch) return;
        onProgress?.({ status: "error", progress: 0, error: String(error?.message || error) });
      },
    });
  }

  const creationPromise = workerPromise;
  const candidate = await creationPromise;
  if (workerPromise === creationPromise) workerPromise = null;

  if (operationEpoch !== epoch) {
    await terminateCandidate(candidate);
    throw new OcrCancelledError();
  }

  worker = candidate;
  workerLanguage = language;
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });
  return worker;
}

export async function recognizeOcrImage(image, language, { onProgress } = {}) {
  const operationEpoch = epoch;
  const operation = createCancellationSignal();
  activeOperation = operation;

  try {
    const activeWorker = await Promise.race([
      ensureWorker(language, onProgress, operationEpoch),
      operation.promise,
    ]);

    if (operationEpoch !== epoch) throw new OcrCancelledError();

    const recognition = activeWorker.recognize(
      image,
      {},
      { text: true, blocks: true },
      `pdfprivado-ocr-${operationEpoch}`
    );

    return await Promise.race([recognition, operation.promise]);
  } finally {
    if (activeOperation === operation) activeOperation = null;
  }
}

export async function cancelOcrEngine() {
  epoch += 1;
  activeOperation?.cancel();
  activeOperation = null;

  const activeWorker = worker;
  const pendingWorker = workerPromise;
  worker = null;
  workerLanguage = "";
  workerPromise = null;

  await terminateCandidate(activeWorker);
  if (pendingWorker) {
    pendingWorker.then(terminateCandidate).catch(() => {});
  }
}

export async function destroyOcrEngine() {
  await cancelOcrEngine();
}

export function isOcrCancelledError(error) {
  return error?.name === "OcrCancelledError" || error?.name === "RenderingCancelledException";
}
