import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";

const { createWorker, OEM, PSM } = Tesseract;

const WORKER_PATH = new URL("./vendor/tesseract/worker.min.js", import.meta.url).href;
const CORE_PATH = new URL("./vendor/tesseract/core", import.meta.url).href.replace(/\/$/, "");
const LANG_PATH = new URL("./vendor/tesseract/lang", import.meta.url).href.replace(/\/$/, "");
const MAXIMUM_LANGUAGES_PER_WORKER = 2;

export class OcrCancelledError extends Error {
  constructor(message = "OCR cancelado") {
    super(message);
    this.name = "OcrCancelledError";
  }
}

let worker = null;
let workerLanguageKey = "";
let workerPromise = null;
let epoch = 0;
let activeOperation = null;

function normalizeWorkerLanguages(value) {
  const rawCodes = Array.isArray(value) ? value : String(value || "").split("+");
  const codes = [];
  for (const rawCode of rawCodes) {
    const code = String(rawCode || "").trim().toLowerCase();
    if (!code || codes.includes(code)) continue;
    if (!/^[a-z0-9_]+$/.test(code)) throw new Error(`Código de idioma OCR no válido: ${code}`);
    codes.push(code);
  }
  if (!codes.length) throw new Error("No se indicó ningún idioma para el motor OCR.");
  if (codes.length > MAXIMUM_LANGUAGES_PER_WORKER) {
    throw new Error(`El motor OCR admite como máximo ${MAXIMUM_LANGUAGES_PER_WORKER} idiomas simultáneos.`);
  }
  return codes;
}

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

async function ensureWorker(languages, onProgress, operationEpoch) {
  const languageCodes = normalizeWorkerLanguages(languages);
  const languageKey = languageCodes.join("+");
  if (worker && workerLanguageKey === languageKey) return worker;

  if (worker) {
    const previous = worker;
    worker = null;
    workerLanguageKey = "";
    await terminateCandidate(previous);
  }

  if (!workerPromise) {
    const creationEpoch = operationEpoch;
    const workerLanguages = languageCodes.length === 1 ? languageCodes[0] : languageCodes;
    workerPromise = createWorker(workerLanguages, OEM.LSTM_ONLY, {
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
  workerLanguageKey = languageKey;
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });
  return worker;
}

function resolvePageSegMode(value) {
  const key = String(value || "AUTO").trim().toUpperCase();
  return PSM[key] ?? PSM.AUTO;
}

export async function recognizeOcrImage(image, languages, { onProgress, parameters = {} } = {}) {
  const operationEpoch = epoch;
  const operation = createCancellationSignal();
  activeOperation = operation;

  try {
    const activeWorker = await Promise.race([
      ensureWorker(languages, onProgress, operationEpoch),
      operation.promise,
    ]);

    if (operationEpoch !== epoch) throw new OcrCancelledError();

    await activeWorker.setParameters({
      tessedit_pageseg_mode: resolvePageSegMode(parameters.pageSegMode),
      preserve_interword_spaces: String(parameters.preserveInterwordSpaces ?? "1"),
    });

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
  workerLanguageKey = "";
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
