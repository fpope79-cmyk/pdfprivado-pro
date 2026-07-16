import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

const checks = [
  [
    viewer.includes("PDFPRIVADO_OCR_SELECTION_GEOMETRY_V1K"),
    "marcador V1K presente",
  ],
  [
    viewer.includes('wordBox.className = "viewer-ocr-word-box";'),
    "caja exterior OCR creada",
  ],
  [
    viewer.includes('wordText.className = "viewer-ocr-word-text";'),
    "texto interior OCR creado",
  ],
  [
    viewer.includes("const measuredWidth = wordText?.getBoundingClientRect?.().width || 0;"),
    "anchura natural del texto medida",
  ],
  [
    viewer.includes("wordText.style.transform = `scaleX(${desiredWidth / measuredWidth})`;"),
    "texto interior escalado al bbox",
  ],
  [
    css.includes(".viewer-ocr-text-layer .viewer-ocr-word-box {"),
    "estilo de caja OCR presente",
  ],
  [
    css.includes(".viewer-ocr-text-layer .viewer-ocr-word-text {"),
    "estilo de texto OCR presente",
  ],
  [
    /viewer-ocr-word-text[\s\S]*?width:\s*auto;/.test(css),
    "texto interior conserva anchura natural",
  ],
  [
    /viewer-ocr-word-text::selection[\s\S]*?background:/.test(css),
    "resaltado aplicado al texto escalado",
  ],
  [
    (viewer.match(/await renderOcrSelectableTextLayer\(/g) || []).length === 3,
    "tres modos de lectura conservados",
  ],
];

let failed = false;

for (const [ok, label] of checks) {
  console.log(`${ok ? "OK" : "ERROR"}  ${label}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("");
  console.log("GEOMETRIA SELECCION OCR V1K: ARQUITECTURA VALIDADA");
}


const compatibilityChecks = [
  [
    !viewer.includes('span.dataset.ocrWidth = String(width);'),
    "estructura antigua de span único retirada",
  ],
  [
    viewer.includes("wordBox.dataset.ocrWidth = String(width);"),
    "el bbox se conserva ahora en wordBox",
  ],
  [
    css.includes(".is-pointer-mode .viewer-ocr-text-layer .viewer-ocr-word-box"),
    "Puntero activa la nueva caja OCR",
  ],
  [
    css.includes(".is-pointer-mode .viewer-ocr-text-layer .viewer-ocr-word-text"),
    "el texto interior conserva selección",
  ],
];

let compatibilityFailed = false;

for (const [ok, label] of compatibilityChecks) {
  console.log(`${ok ? "OK" : "ERROR"}  ${label}`);
  if (!ok) compatibilityFailed = true;
}

if (compatibilityFailed) {
  process.exitCode = 1;
}
