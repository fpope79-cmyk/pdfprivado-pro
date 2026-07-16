import fs from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "src", "styles.css");
const css = fs.readFileSync(cssPath, "utf8");

const markerIndex = css.lastIndexOf("PDFPRIVADO_SELECTABLE_TEXT_POINTER_HIT_V2");
const tail = markerIndex >= 0 ? css.slice(markerIndex) : "";

const checks = [
  [
    markerIndex >= 0,
    "marcador V2 presente",
  ],
  [
    /\.viewer-stage-stack\s+\.is-pointer-mode\s+\.viewer-text-layer\s*\{[\s\S]*?pointer-events\s*:\s*none\s*!important\s*;[\s\S]*?\}/.test(tail),
    "la capa transparente no recibe el puntero en modo Puntero",
  ],
  [
    /\.viewer-stage-stack\s+\.is-pointer-mode\s+\.viewer-text-layer\s+span\s*\{[\s\S]*?pointer-events\s*:\s*auto\s*!important\s*;[\s\S]*?\}/.test(tail),
    "los spans reales reciben el puntero",
  ],
  [
    /\.viewer-stage-stack\s+\.is-pointer-mode\s+\.viewer-text-layer\s+span\s*\{[\s\S]*?user-select\s*:\s*text\s*!important\s*;[\s\S]*?\}/.test(tail),
    "los spans conservan selección de texto",
  ],
  [
    css.lastIndexOf("PDFPRIVADO_SELECTABLE_TEXT_POINTER_HIT_V2") >
      css.lastIndexOf(".viewer-stage-stack .is-pointer-mode .viewer-text-layer,"),
    "la corrección aparece después de la regla antigua combinada",
  ],
];

let failed = false;

for (const [ok, label] of checks) {
  if (ok) {
    console.log(`OK  ${label}`);
  } else {
    failed = true;
    console.error(`ERROR  ${label}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("");
  console.log("SELECCION CON RATON V2: ARQUITECTURA VALIDADA");
}
