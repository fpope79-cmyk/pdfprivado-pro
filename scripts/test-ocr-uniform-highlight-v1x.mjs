import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

const functionStart = viewer.indexOf(
  "async function renderOcrSelectableTextLayer("
);

const functionEnd = viewer.indexOf(
  "async function renderSelectableTextLayer(",
  functionStart + 1
);

const functionSource =
  functionStart >= 0 && functionEnd > functionStart
    ? viewer.slice(functionStart, functionEnd)
    : "";

const checks = [
  [
    functionSource.includes(
      "PDFPRIVADO_OCR_UNIFORM_HIGHLIGHT_V1X"
    ),
    "marcador V1X dentro de la función OCR",
  ],
  [
    functionSource.includes(
      "const lineTop = line.top * scaleY;"
    ),
    "top común calculado por línea",
  ],
  [
    functionSource.includes(
      "const lineHeight = Math.max(1, (line.bottom - line.top) * scaleY);"
    ),
    "altura común calculada por línea",
  ],
  [
    functionSource.includes(
      "const lineFontHeight = Math.max("
    ),
    "altura tipográfica común calculada",
  ],
  [
    functionSource.includes(
      "wordBox.style.top = `${lineTop}px`;"
    ),
    "top común aplicado a cada palabra",
  ],
  [
    functionSource.includes(
      "wordBox.style.height = `${lineHeight}px`;"
    ),
    "altura común aplicada a cada palabra",
  ],
  [
    functionSource.includes(
      "wordText.style.fontSize = `${lineFontHeight}px`;"
    ),
    "fuente común aplicada",
  ],
  [
    functionSource.includes(
      "wordText.style.lineHeight = `${lineHeight}px`;"
    ),
    "line-height común aplicado",
  ],
  [
    functionSource.includes(
      "const width = Math.max(1, (x1 - x0) * scaleX);"
    ),
    "anchura individual de palabra conservada",
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
    "escalado horizontal V1K conservado",
  ],
  [
    functionSource.includes(
      "PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"
    ),
    "alineación V1H conservada",
  ],
  [
    viewer.includes(
      "PDFPRIVADO_OCR_ASSISTED_SELECTION_V1V"
    ),
    "selección asistida V1V conservada",
  ],
  [
    css.includes(
      "PDFPRIVADO_OCR_UNIFORM_HIGHLIGHT_V1X"
    ),
    "estilos V1X presentes",
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
  console.log("RESALTADO OCR UNIFORME V1X: ARQUITECTURA VALIDADA");
}
