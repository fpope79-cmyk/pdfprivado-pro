import fs from "node:fs";

const files = [
  "src/convert-export-core.js",
  "src/convert-export-formats.js",
  "src/convert-export.js",
  "src/convert-export.css",
];

const forbidden = [
  /https?:\/\//i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /FormData/i,
  /multipart/i,
  /telemetry/i,
  /analytics/i,
];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) {
      throw new Error(`${file}: patrón no permitido ${pattern}`);
    }
  }
}

const ui = fs.readFileSync("src/convert-export.js", "utf8");
if (!ui.includes("./vendor/pdfjs/pdf.mjs")) throw new Error("PDF.js no es local.");
if (!ui.includes("./vendor/pdfjs/pdf.worker.mjs")) throw new Error("El worker PDF.js no es local.");
if (!ui.includes("URL.createObjectURL")) throw new Error("No se encontró guardado local mediante Blob.");
if (!ui.includes("El PDF original no se ha modificado")) throw new Error("Falta el compromiso de no modificar el original.");

console.log("OK  Convertir y exportar: privacidad local validada");
