/**
 * PDFPrivado Pro - plan estable de reconstrucción PDF -> Word.
 *
 * Contrato: este módulo NO contiene reglas por nombre de archivo ni por número
 * de página. Consume exclusivamente el modelo normalizado de página y decide
 * cómo debe reconstruirse en Word. Las estrategias son fijas:
 *
 *  - flow-text: párrafos Word nativos.
 *  - table-form: tablas Word + párrafos/celdas nativos.
 *  - anchored-layout: bloques editables anclados sobre gráficos conservados.
 *  - raster-infographic: OCR + fondo raster sin texto + bloques editables.
 *  - scan: OCR + limpieza/inpainting + bloques editables.
 *
 * El generador DOCX posterior debe obedecer este plan; no debe volver a
 * clasificar ni añadir excepciones específicas de documentos.
 */

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function meaningfulNativeText(model) {
  const m = model?.classification?.metrics || {};
  return finite(m.textChars) >= 80 && finite(m.itemCount) >= 4;
}

function imageDominant(model) {
  const m = model?.classification?.metrics || {};
  return finite(m.graphicCoverage) >= 0.5 && finite(m.imageOperations) >= 1;
}

function tableConfidence(model) {
  const m = model?.classification?.metrics || {};
  const rules = Math.min(1, (finite(m.horizontalRules) + finite(m.verticalRules)) / 20);
  const grid = clamp(m.gridScore, 0, 1);
  const columns = Math.min(1, finite(m.columnCount) / 3);
  return clamp(grid * 0.55 + rules * 0.35 + columns * 0.10, 0, 1);
}

function blockAnchoringConfidence(model) {
  const m = model?.classification?.metrics || {};
  const blocks = Math.min(1, finite(m.blockCount) / 12);
  const text = Math.min(1, finite(m.textChars) / 1600);
  const graphics = clamp(m.graphicComplexity, 0, 1);
  return clamp(blocks * 0.30 + text * 0.35 + graphics * 0.35, 0, 1);
}

function commonValidation() {
  return {
    requireSamePageCount: true,
    forbidBlankOutputPage: true,
    forbidHiddenPrimaryText: true,
    forbidDuplicateVisibleText: true,
    requireBoundsInsidePage: true,
    requireVisibleEditableText: true,
    requireMicrosoftWordCheckAtReleaseGate: true,
  };
}

export function buildWordPagePlan(model) {
  if (!model?.page || !model?.classification) {
    throw new Error("Modelo de página normalizado inválido.");
  }

  const kind = String(model.classification.kind || "mixed");
  const m = model.classification.metrics || {};
  const source = String(model.source || "native");
  const nativeUseful = meaningfulNativeText(model);
  const rasterDominant = imageDominant(model);
  const tableScore = tableConfidence(model);
  const anchoredScore = blockAnchoringConfidence(model);
  const reasons = [...(model.classification.reasons || [])];

  let strategy = "anchored-layout";
  let textSource = source === "ocr" ? "ocr" : "native";
  let background = "graphics-only";
  let editableStructure = "blocks";
  let needsOcr = source === "ocr";
  let cleanRasterText = false;
  let preserveGraphics = true;

  if (kind === "text" && nativeUseful && !rasterDominant) {
    strategy = "flow-text";
    textSource = "native";
    background = finite(m.graphicComplexity) > 0.08 ? "graphics-only" : "none";
    editableStructure = "paragraphs";
    needsOcr = false;
    cleanRasterText = false;
  } else if (kind === "table-form") {
    strategy = "table-form";
    textSource = source === "ocr" ? "ocr" : "native";
    background = "graphics-only";
    editableStructure = "tables-and-paragraphs";
    needsOcr = source === "ocr" || !nativeUseful;
    cleanRasterText = needsOcr && rasterDominant;
  } else if (rasterDominant && nativeUseful) {
    // Página visual dominada por una imagen pero con anclas nativas (ej. número
    // de solicitud/pie). El contenido dentro de la imagen se recupera por OCR.
    strategy = "raster-infographic";
    textSource = "hybrid-native-ocr";
    background = "raster-cleaned";
    editableStructure = "anchored-blocks";
    needsOcr = true;
    cleanRasterText = true;
    reasons.push("imagen-dominante-con-anclas-nativas");
  } else if (kind === "scan" || (rasterDominant && !nativeUseful)) {
    strategy = "scan";
    textSource = "ocr";
    background = "raster-cleaned";
    editableStructure = "anchored-blocks";
    needsOcr = true;
    cleanRasterText = true;
    reasons.push("ocr-obligatorio");
  } else if (kind === "infographic") {
    strategy = "anchored-layout";
    textSource = nativeUseful ? "native" : "ocr";
    background = "graphics-only";
    editableStructure = "anchored-blocks";
    needsOcr = !nativeUseful;
    cleanRasterText = needsOcr && rasterDominant;
  } else {
    // Mixto: conserva gráficos, usa bloques nativos cuando existen y OCR solo
    // si la capa nativa es insuficiente. Esta es una estrategia fija, no un
    // fallback visual de página completa.
    strategy = "anchored-layout";
    textSource = nativeUseful ? "native" : "ocr";
    background = rasterDominant && !nativeUseful ? "raster-cleaned" : "graphics-only";
    editableStructure = "anchored-blocks";
    needsOcr = !nativeUseful;
    cleanRasterText = needsOcr && rasterDominant;
  }

  return {
    schemaVersion: 1,
    pageNumber: model.page.pageNumber,
    page: { ...model.page },
    strategy,
    textSource,
    background,
    editableStructure,
    needsOcr,
    cleanRasterText,
    preserveGraphics,
    metrics: {
      nativeUseful,
      rasterDominant,
      tableConfidence: tableScore,
      anchoredConfidence: anchoredScore,
      textChars: finite(m.textChars),
      itemCount: finite(m.itemCount),
      lineCount: finite(m.lineCount),
      blockCount: finite(m.blockCount),
      graphicCoverage: finite(m.graphicCoverage),
      graphicComplexity: finite(m.graphicComplexity),
      columnCount: finite(m.columnCount),
      gridScore: finite(m.gridScore),
    },
    reasons: [...new Set(reasons)],
    reconstruction: {
      paragraphs: strategy === "flow-text" || strategy === "table-form",
      tables: strategy === "table-form",
      anchoredBlocks: ["anchored-layout", "raster-infographic", "scan"].includes(strategy),
      graphicsLayer: background !== "none",
      rasterCleanup: cleanRasterText,
      allowFullPageVisualFallback: false,
      allowHiddenRecoveryTextAsPrimary: false,
    },
    validation: commonValidation(),
  };
}

export function buildWordDocumentPlan(models = []) {
  const pages = models.map(buildWordPagePlan);
  const counts = pages.reduce((acc, page) => {
    acc[page.strategy] = (acc[page.strategy] || 0) + 1;
    if (page.needsOcr) acc.ocrPages += 1;
    if (page.cleanRasterText) acc.rasterCleanupPages += 1;
    return acc;
  }, { ocrPages: 0, rasterCleanupPages: 0 });

  return {
    schemaVersion: 1,
    pageCount: pages.length,
    pages,
    counts,
    invariants: {
      oneWordSectionPerPdfPage: true,
      noDocumentSpecificRules: true,
      noFullPageImageAsFinalEditableResult: true,
      allPrimaryTextVisibleAndEditable: true,
      localOnly: true,
    },
  };
}

export function validateWordDocumentPlan(plan) {
  const errors = [];
  const warnings = [];
  const pages = Array.isArray(plan?.pages) ? plan.pages : [];
  if (plan?.pageCount !== pages.length) errors.push("page-count-mismatch");
  const allowed = new Set(["flow-text", "table-form", "anchored-layout", "raster-infographic", "scan"]);
  for (const page of pages) {
    if (!allowed.has(page.strategy)) errors.push(`unknown-strategy:${page.pageNumber}`);
    if (page.reconstruction?.allowFullPageVisualFallback) errors.push(`visual-fallback-forbidden:${page.pageNumber}`);
    if (page.reconstruction?.allowHiddenRecoveryTextAsPrimary) errors.push(`hidden-primary-text-forbidden:${page.pageNumber}`);
    if (page.background === "raster-cleaned" && !page.needsOcr) warnings.push(`raster-clean-without-ocr:${page.pageNumber}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
