import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");

const functionStart = viewer.indexOf(
  "async function renderOcrSelectableTextLayer("
);

const functionEnd = viewer.indexOf(
  "async function renderSelectableTextLayer(",
  functionStart + 1
);

const source =
  functionStart >= 0 && functionEnd > functionStart
    ? viewer.slice(functionStart, functionEnd)
    : "";

const checks = [
  [
    source.includes(
      "PDFPRIVADO_OCR_HIGHLIGHT_VERTICAL_CENTER_V2A"
    ),
    "marcador V2A presente",
  ],
  [
    source.includes(
      "const verticalLift = lineHeight * 0.15;"
    ),
    "elevación del 15 % activa",
  ],
  [
    !source.includes(
      "const verticalLift = lineHeight * 0.1;"
    ),
    "elevación antigua retirada",
  ],
  [
    source.includes(
      "wordBox.style.top = `${lineTop - verticalLift}px`;"
    ),
    "top centrado conservado",
  ],
  [
    source.includes(
      "wordBox.style.height = `${lineHeight}px`;"
    ),
    "altura uniforme conservada",
  ],
  [
    source.includes(
      "wordText.style.lineHeight = `${lineHeight}px`;"
    ),
    "line-height uniforme conservado",
  ],
  [
    source.includes(
      "const measuredWidth = wordText?.getBoundingClientRect?.().width || 0;"
    ),
    "medición natural conservada",
  ],
  [
    source.includes(
      "wordText.style.transform = `scaleX(${desiredWidth / measuredWidth})`;"
    ),
    "escalado al bbox conservado",
  ],
  [
    source.includes(
      "PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"
    ),
    "alineación V1H conservada",
  ],
  [
    viewer.includes("PDFPRIVADO_OCR_ASSISTED_SELECTION_V1V"),
    "selección asistida V1V conservada",
  ],
  [
    viewer.includes("PDFPRIVADO_OCR_UNIFORM_HIGHLIGHT_V1X"),
    "uniformidad V1X conservada",
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
  console.log("CENTRADO VERTICAL OCR V2A: ARQUITECTURA VALIDADA");
}
