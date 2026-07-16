import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

function result(ok, label) {
  console.log(`${ok ? "OK" : "ERROR"}  ${label}`);
  return ok;
}

const storeBlockMatch = viewer.match(
  /if \(storeRecord\) \{[\s\S]*?state\.ocr\.records\.set\(ocrRecordKey\(entry\), record\);[\s\S]*?state\.ocr\.panelKey = "";[\s\S]*?scheduleOcrSelectableLayerRefresh\(\);[\s\S]*?\}/,
);

const removeBlockMatch = viewer.match(
  /function removeOcrRecords\(records, message\) \{[\s\S]*?state\.ocr\.panelKey = "";[\s\S]*?scheduleOcrSelectableLayerRefresh\(\);[\s\S]*?refreshOcrPanel\(\{ force: true \}\);[\s\S]*?return records\.length;[\s\S]*?\}/,
);

const checks = [
  result(
    viewer.includes("PDFPRIVADO_OCR_SELECTABLE_LAYER_V1G"),
    "marcador V1G presente en viewer.js",
  ),
  result(
    viewer.includes("async function renderOcrSelectableTextLayer("),
    "función de capa OCR presente",
  ),
  result(
    (viewer.match(/await renderOcrSelectableTextLayer\(/g) || []).length === 3,
    "integración en vista doble, individual y continua",
  ),
  result(
    Boolean(storeBlockMatch),
    "refresco realmente dentro del guardado OCR",
  ),
  result(
    Boolean(removeBlockMatch),
    "refresco realmente dentro de removeOcrRecords",
  ),
  result(
    viewer.includes("const record = currentOcrRecord(entry);"),
    "la capa usa el registro OCR de la página",
  ),
  result(
    viewer.includes("span.dataset.ocrWidth = String(width);"),
    "la capa conserva el ancho bbox",
  ),
  result(
    css.includes("PDFPRIVADO_OCR_SELECTABLE_LAYER_V1G"),
    "marcador V1G presente en styles.css",
  ),
  result(
    css.includes(".viewer-ocr-text-layer {"),
    "estilo principal de capa OCR presente",
  ),
  result(
    /\.is-hand-mode \.viewer-ocr-text-layer[\s\S]*?pointer-events:\s*none\s*!important/.test(css),
    "Mano desactiva la capa OCR",
  ),
  result(
    /\.is-pointer-mode \.viewer-ocr-text-layer span[\s\S]*?pointer-events:\s*auto\s*!important/.test(css),
    "Puntero activa las palabras OCR",
  ),
];

if (checks.some((ok) => !ok)) {
  process.exitCode = 1;
} else {
  console.log("");
  console.log("CAPA OCR SELECCIONABLE V1G: ARQUITECTURA VALIDADA");
}


const viewerEndsCorrectly =
  viewer.endsWith("\n") && !viewer.endsWith("\n\n");
const cssEndsCorrectly =
  css.endsWith("\n") && !css.endsWith("\n\n");

console.log(
  `${viewerEndsCorrectly ? "OK" : "ERROR"}  viewer.js termina con una sola línea nueva`,
);
console.log(
  `${cssEndsCorrectly ? "OK" : "ERROR"}  styles.css termina con una sola línea nueva`,
);

if (!viewerEndsCorrectly || !cssEndsCorrectly) {
  process.exitCode = 1;
}
