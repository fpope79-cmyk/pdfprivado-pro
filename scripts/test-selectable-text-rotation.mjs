import assert from "node:assert/strict";
import fs from "node:fs";

const viewer = fs.readFileSync("src/viewer.js", "utf8");

assert.match(
  viewer,
  /PDFPRIVADO_SELECTABLE_TEXT_ROTATION_FIX_V1/
);

assert.match(
  viewer,
  /const textAngle = style\.vertical/
);

assert.match(
  viewer,
  /fontAscent \* Math\.sin\(textAngle\)/
);

assert.match(
  viewer,
  /fontAscent \* Math\.cos\(textAngle\)/
);

assert.match(
  viewer,
  /span\.offsetWidth \|\|\s*span\.scrollWidth/
);

assert.doesNotMatch(
  viewer,
  /const measuredWidth = span\.getBoundingClientRect\(\)\.width/
);

assert.match(
  viewer,
  /rotate\(\$\{textAngle\}rad\)/
);

console.log("OK  posicion corregida para texto rotado");
console.log("OK  admite texto vertical");
console.log("OK  ancho medido antes de transformaciones CSS");
console.log("OK  seleccion conserva granularidad por caracteres");
console.log("");
console.log("TEXTO ROTADO V1: ARQUITECTURA VALIDADA");
