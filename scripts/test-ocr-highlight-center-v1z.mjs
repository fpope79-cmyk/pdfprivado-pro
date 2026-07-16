import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");

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
      "PDFPRIVADO_OCR_HIGHLIGHT_VERTICAL_CENTER_V1Z"
    ),
    "marcador V1Z dentro de la función OCR",
  ],
  [
    functionSource.includes(
      "const verticalLift = lineHeight * 0.1;"
    ),
    "subida vertical del 10 % calculada",
  ],
  [
    functionSource.includes(
      "wordBox.style.top = `${lineTop - verticalLift}px`;"
    ),
    "subida aplicada",
  ],
  [
    functionSource.includes(
      "wordBox.style.height = `${lineHeight}px`;"
    ),
    "altura uniforme conservada",
  ],
  [
    functionSource.includes(
      "wordText.style.lineHeight = `${lineHeight}px`;"
    ),
    "line-height conservado",
  ],
  [
    functionSource.includes(
      "PDFPRIVADO_OCR_UNIFORM_HIGHLIGHT_V1X"
    ),
    "resaltado uniforme V1X conservado",
  ],
  [
    viewer.includes(
      "PDFPRIVADO_OCR_ASSISTED_SELECTION_V1V"
    ),
    "selección asistida V1V conservada",
  ],
  [
    functionSource.includes(
      "PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"
    ),
    "alineación V1H conservada",
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
  console.log("CENTRADO VERTICAL OCR V1Z: ARQUITECTURA VALIDADA");
}
