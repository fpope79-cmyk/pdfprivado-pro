import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";

const { createWorker, OEM, PSM } = Tesseract;
const WORKER_PATH = new URL("./vendor/tesseract/worker.min.js", import.meta.url).href;
const CORE_PATH = new URL("./vendor/tesseract/core", import.meta.url).href.replace(/\/$/, "");
const LANG_PATH = new URL("./vendor/tesseract/lang", import.meta.url).href.replace(/\/$/, "");
const MAXIMUM_POOL_SIZE = 4;

function normalizeLanguages(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split("+");
  const codes = [...new Set(raw.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];
  if (!codes.length) throw new Error("No se indicó ningún idioma para el banco OCR.");
  if (codes.length > 2) throw new Error("El banco OCR admite como máximo dos idiomas simultáneos.");
  return codes;
}

function resolvePageSegMode(value) {
  const key = String(value || "AUTO").trim().toUpperCase();
  return PSM[key] ?? PSM.AUTO;
}

async function terminateWorker(worker) {
  try { await worker?.terminate?.(); } catch { /* limpieza defensiva */ }
}

export async function createOcrBenchmarkWorkerPool({ languages, parameters = {}, size = 1 } = {}) {
  const codes = normalizeLanguages(languages);
  const poolSize = Math.max(1, Math.min(MAXIMUM_POOL_SIZE, Number(size) || 1));
  const workerLanguages = codes.length === 1 ? codes[0] : codes;
  const workers = [];
  const available = [];
  const waiters = [];
  let cancelled = false;

  try {
    const created = await Promise.all(
      Array.from({ length: poolSize }, async () => {
        const worker = await createWorker(workerLanguages, OEM.LSTM_ONLY, {
          workerPath: WORKER_PATH,
          corePath: CORE_PATH,
          langPath: LANG_PATH,
          workerBlobURL: true,
          gzip: true,
          cacheMethod: "none",
        });
        await worker.setParameters({
          tessedit_pageseg_mode: resolvePageSegMode(parameters.pageSegMode),
          preserve_interword_spaces: String(parameters.preserveInterwordSpaces ?? "1"),
        });
        return worker;
      })
    );
    workers.push(...created);
    available.push(...created);
  } catch (error) {
    await Promise.allSettled(workers.map(terminateWorker));
    throw error;
  }

  function acquire() {
    if (cancelled) return Promise.reject(new DOMException("OCR cancelado", "AbortError"));
    const worker = available.pop();
    if (worker) return Promise.resolve(worker);
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }

  function release(worker) {
    if (cancelled) return;
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(worker);
    else available.push(worker);
  }

  async function recognize(image, { onProgress } = {}) {
    const worker = await acquire();
    try {
      if (cancelled) throw new DOMException("OCR cancelado", "AbortError");
      return await worker.recognize(image, {}, { text: true, blocks: true });
    } finally {
      release(worker);
      onProgress?.({ status: "recognizing text", progress: 1 });
    }
  }

  async function cancel() {
    if (cancelled) return;
    cancelled = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new DOMException("OCR cancelado", "AbortError"));
    await Promise.allSettled(workers.map(terminateWorker));
    workers.length = 0;
    available.length = 0;
  }

  async function destroy() {
    await cancel();
  }

  return { size: poolSize, recognize, cancel, destroy };
}
