import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

const checks = [
  [
    css.includes("PDFPRIVADO_OCR_CHARACTER_HIT_V1L"),
    "marcador V1L presente",
  ],
  [
    /\.viewer-ocr-text-layer \.viewer-ocr-word-box \{[\s\S]*?pointer-events:\s*none;/.test(css),
    "caja exterior no captura el puntero",
  ],
  [
    /\.viewer-ocr-text-layer \.viewer-ocr-word-text \{[\s\S]*?pointer-events:\s*auto;/.test(css),
    "texto interior captura el puntero",
  ],
  [
    /\.is-pointer-mode \.viewer-ocr-text-layer \.viewer-ocr-word-box \{[\s\S]*?pointer-events:\s*none\s*!important;/.test(css),
    "Puntero mantiene inactiva la caja exterior",
  ],
  [
    /\.is-pointer-mode \.viewer-ocr-text-layer \.viewer-ocr-word-text \{[\s\S]*?pointer-events:\s*auto\s*!important;/.test(css),
    "Puntero activa el texto carácter a carácter",
  ],
  [
    /\.is-hand-mode \.viewer-ocr-text-layer[\s\S]*?pointer-events:\s*none\s*!important/.test(css),
    "Mano continúa desactivando la selección",
  ],
  [
    viewer.includes('wordText.textContent = `${text} `;'),
    "se conserva el espacio seleccionable entre palabras",
  ],
  [
    viewer.includes("wordText.style.transform = `scaleX(${desiredWidth / measuredWidth})`;"),
    "se conserva el ajuste al bbox",
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
  console.log("SELECCION OCR POR CARACTERES V1L: ARQUITECTURA VALIDADA");
}
