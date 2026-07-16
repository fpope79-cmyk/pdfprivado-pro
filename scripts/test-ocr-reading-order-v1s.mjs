import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

const functionStart = viewer.indexOf(
  "async function renderOcrSelectableTextLayer("
);

const nextFunctionStart = viewer.indexOf(
  "async function renderSelectableTextLayer(",
  functionStart + 1
);

const functionSource =
  functionStart >= 0 && nextFunctionStart > functionStart
    ? viewer.slice(functionStart, nextFunctionStart)
    : "";

const checks = [
  [
    functionSource.includes("PDFPRIVADO_OCR_READING_ORDER_V1S"),
    "marcador V1S dentro de la función OCR",
  ],
  [
    functionSource.includes("PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"),
    "marcador V1H conservado dentro de la función",
  ],
  [
    functionSource.includes("const hostRect = host.getBoundingClientRect();"),
    "geometría del contenedor V1H conservada",
  ],
  [
    functionSource.includes(
      "const canvasOffsetLeft = canvasRect.left - hostRect.left;"
    ),
    "desplazamiento horizontal V1H conservado",
  ],
  [
    functionSource.includes(
      "const canvasOffsetTop = canvasRect.top - hostRect.top;"
    ),
    "desplazamiento vertical V1H conservado",
  ],
  [
    functionSource.includes("left: `${canvasOffsetLeft}px`,"),
    "desplazamiento horizontal aplicado",
  ],
  [
    functionSource.includes("top: `${canvasOffsetTop}px`,"),
    "desplazamiento vertical aplicado",
  ],
  [
    functionSource.includes("PDFPRIVADO_OCR_SELECTION_GEOMETRY_V1K"),
    "geometría V1K conservada",
  ],
  [
    functionSource.includes("normalizedWords.sort((a, b) =>"),
    "palabras normalizadas y ordenadas",
  ],
  [
    functionSource.includes("lines.sort((a, b) => a.top - b.top);"),
    "líneas ordenadas de arriba abajo",
  ],
  [
    functionSource.includes("line.words.sort((a, b) => a.x0 - b.x0);"),
    "palabras ordenadas de izquierda a derecha",
  ],
  [
    functionSource.includes("wordBox.dataset.ocrLine = String(lineIndex);"),
    "cada palabra conserva su línea visual",
  ],
  [
    functionSource.includes('wordText.textContent = `${text} `;'),
    "espacio seleccionable entre palabras conservado",
  ],
  [
    functionSource.includes(
      "const measuredWidth = wordText?.getBoundingClientRect?.().width || 0;"
    ),
    "medición natural V1K conservada",
  ],
  [
    functionSource.includes(
      "wordText.style.transform = `scaleX(${desiredWidth / measuredWidth})`;"
    ),
    "ajuste al bbox conservado",
  ],
  [
    css.includes("PDFPRIVADO_OCR_READING_ORDER_V1S"),
    "marcador CSS V1S presente",
  ],
  [
    css.includes(
      ".viewer-ocr-text-layer .viewer-ocr-word-text::before {"
    ),
    "zona de tolerancia transparente presente",
  ],
  [
    /viewer-ocr-word-text::before[\s\S]*?left:\s*-0\.32em;/.test(css),
    "tolerancia izquierda ampliada",
  ],
  [
    /viewer-ocr-word-text::before[\s\S]*?pointer-events:\s*auto;/.test(css),
    "zona de tolerancia recibe el puntero",
  ],
  [
    css.includes("PDFPRIVADO_OCR_CHARACTER_HIT_V1L"),
    "selección por caracteres V1L conservada",
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
  console.log("ORDEN DE SELECCION OCR V1S: ARQUITECTURA VALIDADA");
}
