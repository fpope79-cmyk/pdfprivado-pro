const STANDARD_FIELDS = Object.freeze([
  "title", "author", "subject", "keywords", "creator", "producer",
]);

export const METADATA_PROFILES = Object.freeze({
  preserve: Object.freeze({
    id: "preserve",
    label: "Conservar todo",
    description: "Mantiene los metadatos actuales y permite editar solo los campos elegidos.",
  }),
  basic: Object.freeze({
    id: "basic",
    label: "Limpieza básica",
    description: "Elimina autor, asunto y palabras clave.",
    clear: ["author", "subject", "keywords"],
  }),
  privacy: Object.freeze({
    id: "privacy",
    label: "Privacidad",
    description: "Elimina identidad, aplicaciones y fechas modificables.",
    clear: ["author", "subject", "keywords", "creator", "producer"],
    clearDates: true,
  }),
  full: Object.freeze({
    id: "full",
    label: "Limpieza completa",
    description: "Vacía todos los campos estándar visibles y las fechas.",
    clear: [...STANDARD_FIELDS],
    clearDates: true,
  }),
});

function text(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "object") {
    if (value["x-default"]) return text(value["x-default"]);
    const values = Object.values(value).map(text).filter(Boolean);
    return values.join(", ");
  }
  const normalized = String(value).trim();
  return normalized === "undefined" || normalized === "null" ? "" : normalized;
}

function xmpGet(metadata, key) {
  try {
    return metadata?.get ? text(metadata.get(key)) : "";
  } catch {
    return "";
  }
}

function first(...values) {
  return values.map(text).find(Boolean) || "";
}

function keywordList(value) {
  return text(value)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeMetadata(record = {}) {
  return {
    title: text(record.title),
    author: text(record.author),
    subject: text(record.subject),
    keywords: text(record.keywords),
    creator: text(record.creator),
    producer: text(record.producer),
    creationDate: text(record.creationDate),
    modificationDate: text(record.modificationDate),
    pdfVersion: text(record.pdfVersion),
    language: text(record.language),
    pageCount: Number(record.pageCount) || 0,
    byteLength: Number(record.byteLength) || 0,
    hasXmp: Boolean(record.hasXmp),
  };
}

export async function inspectPdfMetadata(bytes, { pdfjsLib, PDFDocument } = {}) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let pdfJsResult = null;

  if (pdfjsLib?.getDocument) {
    const loadingTask = pdfjsLib.getDocument({
      data: source.slice(),
      wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    try {
      const metadata = await pdf.getMetadata().catch(() => ({ info: {}, metadata: null }));
      const info = metadata.info || {};
      const xmp = metadata.metadata || null;
      pdfJsResult = {
        title: first(info.Title, xmpGet(xmp, "dc:title")),
        author: first(info.Author, xmpGet(xmp, "dc:creator")),
        subject: first(info.Subject, xmpGet(xmp, "dc:description")),
        keywords: first(info.Keywords, xmpGet(xmp, "pdf:Keywords")),
        creator: first(info.Creator, xmpGet(xmp, "xmp:CreatorTool")),
        producer: first(info.Producer, xmpGet(xmp, "pdf:Producer")),
        creationDate: first(info.CreationDate, xmpGet(xmp, "xmp:CreateDate")),
        modificationDate: first(info.ModDate, xmpGet(xmp, "xmp:ModifyDate")),
        pdfVersion: first(info.PDFFormatVersion),
        language: first(info.Language),
        pageCount: pdf.numPages,
        byteLength: source.byteLength,
        hasXmp: Boolean(xmp),
      };
    } finally {
      await pdf.destroy?.();
    }
  }

  if (!PDFDocument) {
    if (pdfJsResult) return normalizeMetadata(pdfJsResult);
    throw new Error("PDFDocument no disponible.");
  }

  const doc = await PDFDocument.load(source.slice(), {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const fallback = {
    title: doc.getTitle?.(),
    author: doc.getAuthor?.(),
    subject: doc.getSubject?.(),
    keywords: doc.getKeywords?.(),
    creator: doc.getCreator?.(),
    producer: doc.getProducer?.(),
    creationDate: doc.getCreationDate?.(),
    modificationDate: doc.getModificationDate?.(),
    pageCount: doc.getPageCount(),
    byteLength: source.byteLength,
  };

  return normalizeMetadata({
    ...fallback,
    ...(pdfJsResult || {}),
    title: first(pdfJsResult?.title, fallback.title),
    author: first(pdfJsResult?.author, fallback.author),
    subject: first(pdfJsResult?.subject, fallback.subject),
    keywords: first(pdfJsResult?.keywords, fallback.keywords),
    creator: first(pdfJsResult?.creator, fallback.creator),
    producer: first(pdfJsResult?.producer, fallback.producer),
    creationDate: first(pdfJsResult?.creationDate, fallback.creationDate),
    modificationDate: first(pdfJsResult?.modificationDate, fallback.modificationDate),
  });
}

export function applyProfile(current, profileId) {
  const profile = METADATA_PROFILES[profileId] || METADATA_PROFILES.preserve;
  const next = { ...normalizeMetadata(current) };
  for (const field of profile.clear || []) next[field] = "";
  if (profile.clearDates) {
    next.creationDate = "";
    next.modificationDate = "";
  }
  return next;
}

export function privacyAssessment(metadata) {
  const value = normalizeMetadata(metadata);
  const findings = [];
  const add = (field, label, weight) => {
    if (value[field]) findings.push({ field, label, weight, value: value[field] });
  };

  add("author", "Identidad del autor", 30);
  add("creator", "Aplicación creadora", 18);
  add("producer", "Productor o conversor", 18);
  add("creationDate", "Fecha de creación", 10);
  add("modificationDate", "Fecha de modificación", 10);
  add("subject", "Asunto del documento", 6);
  add("keywords", "Palabras clave", 6);
  if (value.hasXmp) findings.push({ field: "xmp", label: "Bloque XMP detectado", weight: 12, value: "Sí" });

  const score = Math.min(100, findings.reduce((sum, item) => sum + item.weight, 0));
  const level = score >= 60 ? "alto" : score >= 25 ? "medio" : "bajo";
  return { score, level, findings };
}

export function compareMetadata(original, proposed) {
  const before = normalizeMetadata(original);
  const after = normalizeMetadata(proposed);
  return [...STANDARD_FIELDS, "creationDate", "modificationDate"].map((field) => ({
    field,
    before: before[field] || "",
    after: after[field] || "",
    changed: before[field] !== after[field],
  }));
}

export async function writePdfMetadata(bytes, proposed, {
  PDFDocument,
  preserveCreationDate = true,
  updateModificationDate = false,
} = {}) {
  if (!PDFDocument) throw new Error("PDFDocument no disponible.");
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const doc = await PDFDocument.load(source.slice(), {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const value = normalizeMetadata(proposed);

  doc.setTitle(value.title);
  doc.setAuthor(value.author);
  doc.setSubject(value.subject);
  doc.setKeywords(keywordList(value.keywords));
  doc.setCreator(value.creator);
  doc.setProducer(value.producer);

  if (!preserveCreationDate) {
    doc.setCreationDate(dateValue(value.creationDate) || new Date(0));
  }
  if (updateModificationDate) {
    doc.setModificationDate(new Date());
  } else if (value.modificationDate) {
    const modification = dateValue(value.modificationDate);
    if (modification) doc.setModificationDate(modification);
  }

  return new Uint8Array(await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  }));
}

export async function verifyPdfMetadata(bytes, expected, dependencies) {
  const actual = await inspectPdfMetadata(bytes, dependencies);
  const comparison = compareMetadata(expected, actual);
  return {
    ok: comparison.every((item) => !item.changed),
    actual,
    comparison,
  };
}

export function buildMetadataReport({ name, original, proposed, verified, outputBytes }) {
  const beforeRisk = privacyAssessment(original);
  const afterRisk = privacyAssessment(verified?.actual || proposed);
  const comparison = compareMetadata(original, verified?.actual || proposed);
  const lines = [
    "PDFPRIVADO PRO — INFORME DE METADATOS",
    `Fecha: ${new Date().toLocaleString()}`,
    `Documento: ${name || "documento.pdf"}`,
    `Tamaño resultado: ${Number(outputBytes || 0)} bytes`,
    "",
    `Riesgo original: ${beforeRisk.level.toUpperCase()} (${beforeRisk.score}/100)`,
    `Riesgo resultado: ${afterRisk.level.toUpperCase()} (${afterRisk.score}/100)`,
    `Verificación: ${verified?.ok ? "CORRECTA" : "REVISAR"}`,
    "",
    "CAMBIOS:",
  ];

  for (const item of comparison.filter((entry) => entry.changed)) {
    lines.push(`- ${item.field}: "${item.before || "—"}" -> "${item.after || "—"}"`);
  }
  if (!comparison.some((entry) => entry.changed)) lines.push("- Sin cambios.");
  lines.push("", "Procesamiento local. El original no se ha modificado.");
  return lines.join("\n");
}
