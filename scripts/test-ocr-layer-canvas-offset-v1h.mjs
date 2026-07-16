import fs from "node:fs";

const source = fs.readFileSync("src/viewer.js", "utf8");

const checks = [
  [
    source.includes("PDFPRIVADO_OCR_LAYER_CANVAS_OFFSET_V1H"),
    "marcador V1H presente",
  ],
  [
    source.includes("const hostRect = host.getBoundingClientRect();"),
    "geometría del contenedor calculada",
  ],
  [
    source.includes("const canvasOffsetLeft = canvasRect.left - hostRect.left;"),
    "desplazamiento horizontal calculado",
  ],
  [
    source.includes("const canvasOffsetTop = canvasRect.top - hostRect.top;"),
    "desplazamiento vertical calculado",
  ],
  [
    source.includes("left: `${canvasOffsetLeft}px`,"),
    "desplazamiento horizontal aplicado",
  ],
  [
    source.includes("top: `${canvasOffsetTop}px`,"),
    "desplazamiento vertical aplicado",
  ],
  [
    (source.match(/await renderOcrSelectableTextLayer\(/g) || []).length === 3,
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
  console.log("ALINEACION CAPA OCR V1H: ARQUITECTURA VALIDADA");
}
