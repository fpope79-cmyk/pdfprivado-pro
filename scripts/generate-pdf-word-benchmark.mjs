#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { buildDocumentToDocxBytes } from "../src/convert-export-formats.js";

const inputDirectory = path.resolve(process.argv[2] || "");
const outputFile = path.resolve(process.argv[3] || path.join(inputDirectory, "generated.docx"));
if (!inputDirectory) {
  throw new Error("Uso: generate-pdf-word-benchmark.mjs <directorio-preparado> [salida.docx]");
}

globalThis.JSZip = JSZip;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
globalThis.document = {
  createElement(name) {
    if (name !== "canvas") throw new Error(`Elemento headless no soportado: ${name}`);
    return createCanvas(1, 1);
  },
};
globalThis.createImageBitmap = async (blob) => loadImage(Buffer.from(await blob.arrayBuffer()));

const measurementCanvas = createCanvas(8, 8);
const measurementContext = measurementCanvas.getContext("2d");
globalThis.__pdfWordMeasureText = ({ text, family, size, bold, italic }) => {
  measurementContext.font =
    `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${Math.max(1, size)}px "${family}"`;
  return measurementContext.measureText(String(text || "")).width * (72 / 96);
};

const documentPath = path.join(inputDirectory, "document.json");
const document = JSON.parse(await fs.readFile(documentPath, "utf8"));
const forcedScale = Number(process.env.PDF_WORD_FORCE_OCR_SCALE);
if (Number.isFinite(forcedScale)) {
  for (const page of document.pages || []) {
    if (page.source === "ocr") page.ocrScaleOverride = forcedScale;
  }
}
const pageImages = new Map();
for (const page of document.pages || []) {
  const [graphicsBytes, sourceBytes] = await Promise.all([
    fs.readFile(path.join(inputDirectory, page.graphicsImage)),
    fs.readFile(path.join(inputDirectory, page.sourceImage)),
  ]);
  const dimensions = await loadImage(sourceBytes);
  pageImages.set(page.pageNumber, [
    {
      bytes: new Uint8Array(graphicsBytes),
      width: dimensions.width,
      height: dimensions.height,
      type: "png",
      fullPage: true,
      graphicsOnly: true,
    },
    {
      bytes: new Uint8Array(sourceBytes),
      width: dimensions.width,
      height: dimensions.height,
      type: "png",
      fullPage: false,
      calibrationSource: true,
    },
  ]);
}

const bytes = await buildDocumentToDocxBytes(document, {
  includeDocumentHeading: false,
  includePageHeadings: false,
  pageImages,
  layoutMode: "original",
  autoCalibrateOcr:
    process.env.PDF_WORD_DISABLE_CALIBRATION !== "1" &&
    !Number.isFinite(forcedScale),
});
await fs.writeFile(outputFile, bytes);
await fs.writeFile(
  `${outputFile}.calibration.json`,
  `${JSON.stringify({
    outputFile,
    pages: document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      source: page.source,
      lineCount: page.layout.length,
      ocrScaleOverride: page.ocrScaleOverride ?? null,
      ocrBaselineFactorOverride: page.ocrBaselineFactorOverride ?? null,
      calibration: page.docxOcrCalibration ?? null,
      visualStyleFeedback: page.docxOcrVisualStyleFeedback ?? null,
    })),
  }, null, 2)}\n`,
  "utf8"
);
console.log(outputFile);
