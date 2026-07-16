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
    viewer.includes("PDFPRIVADO_OCR_ASSISTED_SELECTION_V1V"),
    "marcador V1V presente",
  ],
  [
    viewer.includes("function buildOcrSelectableLines(words)"),
    "agrupación OCR por líneas creada",
  ],
  [
    viewer.includes("line.words.sort((a, b) => a.x0 - b.x0);"),
    "palabras ordenadas de izquierda a derecha",
  ],
  [
    viewer.includes("function buildOcrSelectionMap(layer)"),
    "mapa geométrico de selección creado",
  ],
  [
    viewer.includes("function ocrCharacterOffsetAtX("),
    "posición de carácter calculada durante el arrastre",
  ],
  [
    viewer.includes("function ocrCaretFromPoint("),
    "punto del ratón convertido en caret OCR",
  ],
  [
    viewer.includes("const horizontalTolerance = Math.max("),
    "tolerancia de inicio preparada",
  ],
  [
    viewer.includes("function setOcrNativeSelection("),
    "selección DOM nativa conservada",
  ],
  [
    viewer.includes("selection.setBaseAndExtent("),
    "selección directa compatible con avance y retroceso",
  ],
  [
    viewer.includes("selection.extend(focus.node, focus.offset);"),
    "alternativa Selection.extend preparada",
  ],
  [
    viewer.includes('layer.addEventListener("pointerdown"'),
    "inicio asistido de selección conectado",
  ],
  [
    viewer.includes('layer.addEventListener("pointermove"'),
    "avance continuo de selección conectado",
  ],
  [
    viewer.includes('layer.addEventListener("pointerup"'),
    "final de selección conectado",
  ],
  [
    viewer.includes('lineBreak.textContent = "\\n";'),
    "saltos de línea reales incluidos",
  ],
  [
    functionSource.includes("PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"),
    "marcador V1H conservado",
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
    functionSource.includes('wordBox.className = "viewer-ocr-word-box";'),
    "caja exterior OCR conservada",
  ],
  [
    functionSource.includes('wordText.className = "viewer-ocr-word-text";'),
    "texto interior OCR conservado",
  ],
  [
    functionSource.includes('wordText.textContent = `${text} `;'),
    "espacio seleccionable entre palabras conservado",
  ],
  [
    functionSource.includes(
      "const measuredWidth = wordText?.getBoundingClientRect?.().width || 0;"
    ),
    "medición literal compatible con V1K",
  ],
  [
    functionSource.includes(
      "wordText.style.transform = `scaleX(${desiredWidth / measuredWidth})`;"
    ),
    "ajuste literal al bbox compatible con V1K",
  ],
  [
    css.includes("PDFPRIVADO_OCR_ASSISTED_SELECTION_V1V"),
    "estilos V1V presentes",
  ],
  [
    css.includes(".viewer-ocr-text-layer .viewer-ocr-line-break {"),
    "estilo del salto de línea presente",
  ],
  [
    /\.is-pointer-mode \.viewer-ocr-text-layer \{[\s\S]*?pointer-events:\s*auto\s*!important;/.test(css),
    "toda la capa recibe el puntero en modo Puntero",
  ],
  [
    css.includes("touch-action: none;"),
    "arrastre asistido protegido frente a gestos",
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
  console.log("SELECCION OCR ASISTIDA V1V: ARQUITECTURA VALIDADA");
}
