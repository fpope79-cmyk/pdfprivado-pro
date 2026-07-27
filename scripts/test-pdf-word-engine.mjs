import assert from "node:assert/strict";
import {
  buildNormalizedPageModel,
  deriveLineSegments,
  enrichPdfTextStyles,
  pageModelToLegacyLayout,
  validateNormalizedPageModel,
} from "../src/pdf-word-page-model.js";
import {
  buildWordDocumentPlan,
  validateWordDocumentPlan,
} from "../src/pdf-word-reconstruction-plan.js";
import {
  buildOcrWordAnchorPlan,
  classifyDocxPage,
  docxOcrTextScale,
  docxOcrWordTextScale,
  layoutLineTextAndTabs,
  resolveDocxEditableFont,
  shouldUseDocxStyledRuns,
} from "../src/convert-export-formats.js";
import {
  buildOcrRasterProtectionProfile,
  shouldPreserveOcrRasterLine,
  suppressRasterTextInImageData,
} from "../src/raster-text-separation.js";
import {
  inferVisualInkColor,
  shouldAcceptOcrCalibration,
  shouldAcceptOcrVisualPageFeedback,
  shouldAcceptVisualVariant,
} from "../src/ocr-visual-feedback.js";

function positioned(text, x, y, width, height=10, extra={}) {
  return { text, x, y, width, height, fontSize: height, ...extra };
}

const archetypes = [
  {
    name: "texto-simple",
    input: {
      pageNumber: 1, width: 595, height: 842, source: "native",
      normalizedItems: Array.from({length: 18}, (_, i) => positioned(`Línea de texto normal ${i}`, 60, 70 + i * 18, 360, 9)),
      graphics: { imageOperations: 0, imageCoverageRatio: 0, vectorOperations: 0 },
    }, expected: "flow-text",
  },
  {
    name: "tabla-formulario",
    input: {
      pageNumber: 1, width: 595, height: 842, source: "native",
      normalizedItems: Array.from({length: 24}, (_, i) => positioned(`Dato ${i}`, 50 + (i%4)*130, 80 + Math.floor(i/4)*35, 90, 9)),
      graphics: { horizontalRules: 8, verticalRules: 5, vectorOperations: 20, imageCoverageRatio: 0 },
    }, expected: "table-form",
  },
  {
    name: "escaneado",
    input: {
      pageNumber: 1, width: 595, height: 842, source: "native", normalizedItems: [],
      graphics: { imageOperations: 1, imageCoverageRatio: 0.96 },
    }, expected: "scan",
  },
  {
    name: "mixto-con-graficos",
    input: {
      pageNumber: 1, width: 595, height: 842, source: "native",
      normalizedItems: Array.from({length: 20}, (_, i) => positioned(`Bloque ${i} con contenido suficiente`, 60 + (i%2)*260, 80 + Math.floor(i/2)*45, 210, 10)),
      graphics: { imageOperations: 2, imageCoverageRatio: 0.28, vectorOperations: 18, filledRects: 2 },
    }, expected: "anchored-layout",
  },
  {
    name: "ocr",
    input: {
      pageNumber: 1, width: 595, height: 842, source: "ocr",
      ocrRecord: { imageWidth: 1190, imageHeight: 1684, words: [
        { text: "Texto", bbox: {x0:100,y0:100,x1:180,y1:130}, confidence: 95 },
        { text: "OCR", bbox: {x0:190,y0:100,x1:250,y1:130}, confidence: 94 },
      ] },
      graphics: { imageOperations: 1, imageCoverageRatio: 1 },
    }, expected: "scan",
  },
];

for (const test of archetypes) {
  const model = buildNormalizedPageModel(test.input);
  const mv = validateNormalizedPageModel(model);
  assert.equal(mv.ok, true, `${test.name}: modelo inválido ${mv.errors}`);
  const plan = buildWordDocumentPlan([model]);
  const pv = validateWordDocumentPlan(plan);
  assert.equal(pv.ok, true, `${test.name}: plan inválido ${pv.errors}`);
  assert.equal(plan.pages[0].strategy, test.expected, `${test.name}: estrategia`);
  assert.equal(plan.pages[0].reconstruction.allowFullPageVisualFallback, false);
  assert.equal(plan.pages[0].reconstruction.allowHiddenRecoveryTextAsPrimary, false);
}

const styles = enrichPdfTextStyles(
  { F1: { fontFamily: "ABCDEE+LiberationSans" } },
  { F1: { resolvedName: "Liberation Sans Bold Italic", ascent: 0.91, descent: -0.22 } }
);
assert.equal(styles.F1.fontFamily, "Liberation Sans");
assert.equal(styles.F1.bold, true);
assert.equal(styles.F1.italic, true);
assert.equal(styles.F1.ascent, 0.91);

const nativeModel = buildNormalizedPageModel({
  pageNumber: 1,
  width: 595,
  height: 842,
  source: "native",
  nativeStyles: styles,
  nativeItems: [{
    str: "Contrato general",
    transform: [10, 0, 0, 10, 72, 760],
    width: 82,
    height: 10,
    fontName: "F1",
  }],
});
const nativeLayout = pageModelToLegacyLayout(nativeModel);
assert.equal(nativeLayout.length, 1);
assert.equal(nativeLayout[0].fontFamily, "Liberation Sans");
assert.equal(nativeLayout[0].styledRuns[0].bold, true);
assert.equal(nativeLayout[0].styledRuns[0].italic, true);

const splitOcr = buildNormalizedPageModel({
  pageNumber: 1,
  width: 595,
  height: 842,
  source: "ocr",
  ocrRecord: {
    imageWidth: 1190,
    imageHeight: 1684,
    words: [
      { text: "Motor", bbox: { x0: 100, y0: 100, x1: 180, y1: 130 }, confidence: 96 },
      { text: "general", bbox: { x0: 200, y0: 100, x1: 300, y1: 130 }, confidence: 94 },
      { text: "segunda", bbox: { x0: 100, y0: 170, x1: 205, y1: 200 }, confidence: 95 },
      { text: "línea", bbox: { x0: 220, y0: 170, x1: 290, y1: 200 }, confidence: 92 },
    ],
  },
  graphics: { imageOperations: 1, imageCoverageRatio: 1 },
});
assert.equal(splitOcr.lines.length, 2);
assert.equal(splitOcr.lines[0].text, "Motor general");
assert.equal(splitOcr.lines[1].text, "segunda línea");
const ocrLayout = pageModelToLegacyLayout(splitOcr);
assert.equal(classifyDocxPage({
  source: "ocr",
  layout: ocrLayout,
}).route, "editable");
assert.equal(resolveDocxEditableFont({ fontFamily: "Noto Sans" }).family, "Arial");
assert.equal(resolveDocxEditableFont({ fontFamily: "Liberation Serif" }).family, "Times New Roman");
assert.equal(resolveDocxEditableFont({ ocrVisualFontFamily: "Courier New" }).family, "Courier New");

assert.equal(
  shouldUseDocxStyledRuns({
    source: "ocr",
    text: "Motor general",
    styledRuns: [
      { text: "Motor", x: 50, width: 32 },
      { text: "general", x: 88, width: 45 },
    ],
  }, { source: "ocr" }, { tabStops: [] }),
  false,
  "los runs OCR por palabra no deben colapsar espacios ni pisar el estilo visual de línea"
);
assert.equal(
  shouldUseDocxStyledRuns({
    source: "native",
    styledRuns: [
      { text: "Negrita", bold: true },
      { text: " normal", bold: false },
    ],
  }, { source: "native" }, { tabStops: [] }),
  true,
  "los runs nativos fiables deben conservar estilo mixto"
);
assert.ok(ocrLayout[0].confidence > 94 && ocrLayout[0].confidence < 96, "la confianza OCR debe propagarse a la línea");

const tabbedSegments = deriveLineSegments({
  fontSize: 6,
  items: [
    positioned("12/2/19", 170, 100, 22, 6, { source: "ocr" }),
    positioned("EJENER", 260, 100, 31, 6, { source: "ocr" }),
  ],
}, { pageMedianFont: 6 });
assert.equal(tabbedSegments.length, 2, "un hueco de formulario debe conservarse como dos segmentos posicionables");
assert.equal(tabbedSegments[0].text, "12/2/19");
assert.equal(tabbedSegments[1].text, "EJENER");
const tabbedContent = layoutLineTextAndTabs({
  text: "12/2/19 EJENER",
  x: 170,
  segments: tabbedSegments,
});
assert.equal(tabbedContent.text, "12/2/19\tEJENER", "los campos OCR separados deben convertirse en tabulación editable");
assert.equal(tabbedContent.tabStops.length, 1);
assert.ok(tabbedContent.tabStops[0].position > 1000, "la tabulación debe conservar la separación geométrica real");

const ordinarySegments = deriveLineSegments({
  fontSize: 8,
  items: [
    positioned("Motor", 50, 100, 30, 8, { source: "ocr" }),
    positioned("general", 83, 100, 42, 8, { source: "ocr" }),
  ],
}, { pageMedianFont: 8 });
assert.equal(ordinarySegments.length, 1, "un espacio normal no debe convertirse en tabulación");
assert.equal(ordinarySegments[0].text, "Motor general");

const previousMeasure = globalThis.__pdfWordMeasureText;
globalThis.__pdfWordMeasureText = ({ text, size }) => String(text || "").length * Number(size || 0) * 0.5;
assert.equal(docxOcrTextScale({
  text: "ABCDEFGHIJ",
  targetWidth: 55,
  family: "Arial",
  size: 10,
  confidence: 95,
}), 110, "una diferencia moderada de anchura OCR debe convertirse en escala horizontal dinámica");
assert.equal(docxOcrTextScale({
  text: "ABCDEFGHIJ",
  targetWidth: 80,
  family: "Arial",
  size: 10,
  confidence: 95,
}), null, "una caja OCR extrema no debe deformar el texto de Word");
if (previousMeasure === undefined) delete globalThis.__pdfWordMeasureText;
else globalThis.__pdfWordMeasureText = previousMeasure;

const previousAnchorMeasure = globalThis.__pdfWordMeasureText;
globalThis.__pdfWordMeasureText = ({ text, size }) => String(text || "").length * Number(size || 0) * 0.5;
const anchoredLine = {
  source: "ocr",
  text: "CAMPO UNO VALOR MUY LEJANO",
  x: 50,
  y: 700,
  width: 250,
  height: 10,
  fontSize: 8,
  confidence: 94,
  styledRuns: [
    { text: "CAMPO", x: 50, width: 29, confidence: 96 },
    { text: "UNO", x: 86, width: 20, confidence: 95 },
    { text: "VALOR", x: 132, width: 30, confidence: 93 },
    { text: "MUY", x: 169, width: 21, confidence: 92 },
    { text: "LEJANO", x: 235, width: 40, confidence: 94 },
  ],
  segments: [
    { text: "CAMPO UNO VALOR MUY", x: 50, width: 140 },
    { text: "LEJANO", x: 235, width: 40 },
  ],
};
const anchorPlan = buildOcrWordAnchorPlan(anchoredLine, {
  source: "ocr",
  width: 595,
  height: 842,
  layout: [anchoredLine],
}, {
  x: 50,
  top: 100,
  width: 250,
  height: 12,
  fontSize: 8,
  displayFontSize: 8,
  font: { family: "Arial", reliable: true },
});
assert.equal(anchorPlan.enabled, true, "el OCR con deriva interna debe activar anclas por palabra");
assert.equal(anchorPlan.words.length, 5);
assert.equal(anchorPlan.tabStops.length, 4);
assert.equal(anchorPlan.tabStops[0].position, Math.round((86 - 50) * 20));
assert.ok(anchorPlan.meanError > 0.75 || anchorPlan.maxError > 1.8);
assert.equal(docxOcrWordTextScale({
  text: "CAMPO",
  targetWidth: 27.5,
  family: "Arial",
  size: 10,
  confidence: 95,
}), 110, "una palabra fiable puede ajustar su anchura dentro de un rango moderado ampliado");
assert.equal(docxOcrWordTextScale({
  text: "CAMPO",
  targetWidth: 40,
  family: "Arial",
  size: 10,
  confidence: 95,
}), null, "una palabra OCR no debe deformarse de forma extrema");
if (previousAnchorMeasure === undefined) delete globalThis.__pdfWordMeasureText;
else globalThis.__pdfWordMeasureText = previousAnchorMeasure;

const feedbackWidth = 16;
const feedbackHeight = 8;
const feedbackSource = new Uint8ClampedArray(feedbackWidth * feedbackHeight * 4);
const feedbackGraphics = new Uint8ClampedArray(feedbackSource.length);
for (let offset = 0; offset < feedbackSource.length; offset += 4) {
  feedbackSource[offset] = 242;
  feedbackSource[offset + 1] = 242;
  feedbackSource[offset + 2] = 242;
  feedbackSource[offset + 3] = 255;
  feedbackGraphics[offset] = 242;
  feedbackGraphics[offset + 1] = 242;
  feedbackGraphics[offset + 2] = 242;
  feedbackGraphics[offset + 3] = 255;
}
for (let y = 2; y < 6; y += 1) {
  for (let x = 3; x < 13; x += 1) {
    const offset = (y * feedbackWidth + x) * 4;
    feedbackSource[offset] = 20;
    feedbackSource[offset + 1] = 80;
    feedbackSource[offset + 2] = 160;
  }
}
const inferredInk = inferVisualInkColor(
  feedbackSource,
  feedbackGraphics,
  { left: 0, top: 0, right: feedbackWidth, bottom: feedbackHeight },
  feedbackWidth
);
assert.equal(inferredInk?.hex, "1450A0", "la tinta OCR coloreada debe recuperarse de la diferencia visual");
assert.equal(shouldAcceptVisualVariant({
  baseError: 30,
  candidateError: 27,
  samples: 500,
  minimumRelativeGain: 0.02,
  minimumAbsoluteGain: 0.35,
}), true, "una variante visual claramente mejor debe aceptarse");
assert.equal(shouldAcceptVisualVariant({
  baseError: 30,
  candidateError: 29.8,
  samples: 500,
  minimumRelativeGain: 0.02,
  minimumAbsoluteGain: 0.35,
}), false, "un microajuste visual no debe sobreajustar el motor");
assert.equal(shouldAcceptOcrCalibration({
  relativeGain: 0.03,
  scaleDelta: 0.01,
  baselineDelta: 0.12,
  lineCount: 5,
}), true, "la calibración vertical histórica debe seguir aceptándose con evidencia suficiente");
assert.equal(shouldAcceptOcrCalibration({
  relativeGain: 0.065,
  scaleDelta: 0.04,
  baselineDelta: 0,
  lineCount: 8,
}), true, "v12 debe aceptar escala aislada solo con evidencia visual fuerte");
assert.equal(shouldAcceptOcrCalibration({
  relativeGain: 0.04,
  scaleDelta: 0.04,
  baselineDelta: 0,
  lineCount: 8,
}), false, "una mejora de escala débil no debe abrir la puerta a sobreajuste");
assert.equal(shouldAcceptOcrVisualPageFeedback({
  baseError: 20,
  candidateError: 19.8,
  changedLines: 3,
}), true, "el feedback local debe superar también la puerta visual de página");
assert.equal(shouldAcceptOcrVisualPageFeedback({
  baseError: 20,
  candidateError: 19.97,
  changedLines: 3,
}), false, "una ganancia de página marginal debe revertirse");

const syntheticWidth = 180;
const syntheticHeight = 50;
const syntheticPixels = new Uint8ClampedArray(syntheticWidth * syntheticHeight * 4);
for (let offset = 0; offset < syntheticPixels.length; offset += 4) {
  syntheticPixels[offset] = 250;
  syntheticPixels[offset + 1] = 250;
  syntheticPixels[offset + 2] = 250;
  syntheticPixels[offset + 3] = 255;
}
const paint = (left, top, right, bottom, value) => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * syntheticWidth + x) * 4;
      syntheticPixels[offset] = value;
      syntheticPixels[offset + 1] = value;
      syntheticPixels[offset + 2] = value;
    }
  }
};
paint(35, 18, 41, 29, 55);
paint(45, 18, 51, 29, 55);
paint(20, 34, 160, 35, 45);
const separation = suppressRasterTextInImageData({
  data: syntheticPixels,
  width: syntheticWidth,
  height: syntheticHeight,
}, {
  pageWidth: syntheticWidth,
  pageHeight: syntheticHeight,
  layout: [{
    text: "II",
    x: 34,
    y: 20,
    width: 18,
    height: 12,
    fontSize: 10,
  }],
});
assert.ok(separation.maskedPixels > 50, "la máscara debe retirar tinta textual");
assert.ok(
  syntheticPixels[(34 * syntheticWidth + 80) * 4] < 80,
  "una regla horizontal larga debe conservarse"
);

// Una barra estrecha de un glifo (I/l) no debe confundirse con un borde
// vertical de tabla. v12/v13 inicial podían preservar ambos cuando la barra
// ocupaba ~75 % de la banda. El borde real, que cruza prácticamente toda la
// banda, sí debe sobrevivir.
const verticalPixels = new Uint8ClampedArray(syntheticWidth * syntheticHeight * 4);
for (let offset = 0; offset < verticalPixels.length; offset += 4) {
  verticalPixels[offset] = 250;
  verticalPixels[offset + 1] = 250;
  verticalPixels[offset + 2] = 250;
  verticalPixels[offset + 3] = 255;
}
const verticalPaint = (left, top, right, bottom, value) => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * syntheticWidth + x) * 4;
      verticalPixels[offset] = value;
      verticalPixels[offset + 1] = value;
      verticalPixels[offset + 2] = value;
    }
  }
};
verticalPaint(60, 18, 62, 29, 50); // glifo estrecho, 11 px
verticalPaint(110, 17, 112, 31, 40); // borde, 14 px
suppressRasterTextInImageData({
  data: verticalPixels,
  width: syntheticWidth,
  height: syntheticHeight,
}, {
  pageWidth: syntheticWidth,
  pageHeight: syntheticHeight,
  layout: [{
    text: "I",
    x: 54,
    y: 20,
    width: 64,
    height: 12,
    fontSize: 10,
  }],
});
assert.ok(
  verticalPixels[(23 * syntheticWidth + 60) * 4] > 200,
  "un glifo vertical estrecho debe retirarse y no clasificarse como regla"
);
assert.ok(
  verticalPixels[(23 * syntheticWidth + 110) * 4] < 80,
  "un borde vertical que cruza toda la banda OCR debe conservarse"
);

const protectionProfile = buildOcrRasterProtectionProfile([
  { text: "Texto normal", fontSize: 6, confidence: 94 },
  { text: "Otra línea", fontSize: 6.2, confidence: 92 },
  { text: "OQaxon:", fontSize: 33, confidence: 60 },
]);
assert.equal(
  shouldPreserveOcrRasterLine({ text: "OQaxon:", fontSize: 33, confidence: 60 }, protectionProfile),
  true,
  "un fragmento grande y poco fiable compatible con logotipo debe preservarse en el ráster"
);
assert.equal(
  shouldPreserveOcrRasterLine({ text: "CONTRATO DE COMPRAVENTA", fontSize: 11, confidence: 94 }, protectionProfile),
  false,
  "un título OCR fiable no debe confundirse con un logotipo"
);

const denseWidth = 220;
const denseHeight = 120;
const densePixels = new Uint8ClampedArray(denseWidth * denseHeight * 4);
for (let offset = 0; offset < densePixels.length; offset += 4) {
  densePixels[offset] = 250;
  densePixels[offset + 1] = 250;
  densePixels[offset + 2] = 250;
  densePixels[offset + 3] = 255;
}
const densePaint = (left, top, right, bottom, value) => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * denseWidth + x) * 4;
      densePixels[offset] = value;
      densePixels[offset + 1] = value;
      densePixels[offset + 2] = value;
    }
  }
};
// Dos glifos y una regla que cruza la misma banda OCR. La lista de 40 líneas
// reproduce el caso denso en el que v12 usaba borrado rectangular ciego.
densePaint(54, 42, 60, 54, 50);
densePaint(66, 42, 72, 54, 50);
densePaint(20, 50, 200, 52, 35);
const denseLayout = Array.from({ length: 40 }, (_, index) => ({
  text: index === 0 ? "II" : `L${index}`,
  x: index === 0 ? 52 : 8,
  y: index === 0 ? 58 : 110 - (index % 20) * 4,
  width: index === 0 ? 22 : 12,
  height: index === 0 ? 16 : 3,
  fontSize: index === 0 ? 12 : 3,
}));
const denseSeparation = suppressRasterTextInImageData({
  data: densePixels,
  width: denseWidth,
  height: denseHeight,
}, {
  pageWidth: denseWidth,
  pageHeight: denseHeight,
  layout: denseLayout,
});
assert.ok(denseSeparation.maskedPixels > 40, "el texto denso debe seguir retirándose por componentes");
assert.ok(
  densePixels[(50 * denseWidth + 120) * 4] < 80,
  "una regla horizontal que atraviesa una caja OCR densa debe conservarse"
);

const implementationText = [
  enrichPdfTextStyles,
  buildNormalizedPageModel,
  pageModelToLegacyLayout,
  inferVisualInkColor,
  shouldAcceptOcrCalibration,
  shouldAcceptOcrVisualPageFeedback,
  shouldAcceptVisualVariant,
  shouldUseDocxStyledRuns,
  shouldPreserveOcrRasterLine,
].map((fn) => fn.toString()).join("\n");
assert.doesNotMatch(implementationText, /Seguro|olivar|Maiz|JARRINA|pageNumber\s*===/iu);

console.log("OK PDF→Word: contrato genérico, estilos, OCR, feedback visual y cinco arquetipos validados.");
