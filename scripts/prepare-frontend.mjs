import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(projectRoot, "src");
const outputDir = path.join(projectRoot, "dist");
const mode = String(process.argv[2] || "").toLowerCase();

if (!new Set(["dev", "release"]).has(mode)) {
  console.error("Uso: node scripts/prepare-frontend.mjs dev|release");
  process.exit(1);
}

const diagnosticsFilePattern = /^diagnostics(?:\.|$)/i;

async function validateOcrLanguageAssets() {
  const manifestPath = path.join(sourceDir, "ocr-language-manifest.js");
  const manifestUrl = `${pathToFileURL(manifestPath).href}?validation=${Date.now()}`;
  const { OCR_LANGUAGE_LIMITS, OCR_LANGUAGE_MANIFEST } = await import(manifestUrl);

  if (OCR_LANGUAGE_MANIFEST.length < OCR_LANGUAGE_LIMITS.minimumCatalogLanguages) {
    throw new Error(`El catálogo OCR debe incluir al menos ${OCR_LANGUAGE_LIMITS.minimumCatalogLanguages} idiomas.`);
  }

  const installed = OCR_LANGUAGE_MANIFEST.filter((language) => language.installed);
  if (installed.length < 2) {
    throw new Error("La compilación OCR debe incluir al menos español e inglés.");
  }

  for (const language of installed) {
    await assertFile(path.join(sourceDir, "vendor", "tesseract", "lang", language.file), true);
  }

  await assertFile(path.join(sourceDir, "vendor", "tesseract", "LICENSE-TESSDATA-APACHE-2.0.txt"), true);
  await assertFile(path.join(sourceDir, "vendor", "tesseract", "NOTICE-LANGUAGE-DATA.txt"), true);

  await assertFile(path.join(sourceDir, "vendor", "fontkit.umd.min.js"), true);
  await assertFile(
    path.join(sourceDir, "vendor", "fonts", "noto-sans-latin-400-normal.woff"),
    true
  );
  await assertFile(path.join(sourceDir, "vendor", "licenses", "FONTKIT-MIT.txt"), true);
  await assertFile(path.join(sourceDir, "vendor", "licenses", "NOTO-SANS-OFL.txt"), true);
}

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });

  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (mode === "release" && diagnosticsFilePattern.test(entry.name)) {
      continue;
    }

    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(from, to);
    } else if (entry.isFile()) {
      await cp(from, to, { force: true });
    }
  }
}

function removeDiagnosticsReferences(html) {
  return html
    .replace(/\s*<link\b[^>]*href=["'][^"']*diagnostics\.css[^"']*["'][^>]*\/?>/gi, "")
    .replace(/\s*<script\b[^>]*src=["'][^"']*diagnostics\.js[^"']*["'][^>]*>\s*<\/script>/gi, "");
}

function injectDevelopmentDiagnostics(html) {
  const styleAnchor = '<link rel="stylesheet" href="styles.css" />';
  const mainAnchor = '<script type="module" src="/main.js" defer></script>';
  const diagnosticStyle = '<link rel="stylesheet" href="diagnostics.css" />';
  const diagnosticScript = '<script type="module" src="/diagnostics.js" defer></script>';

  if (!html.includes(styleAnchor)) {
    throw new Error("No se encontró el enlace principal de styles.css en src/index.html.");
  }
  if (!html.includes(mainAnchor)) {
    throw new Error("No se encontró el script principal main.js en src/index.html.");
  }

  return html
    .replace(styleAnchor, `${styleAnchor}\n    ${diagnosticStyle}`)
    .replace(mainAnchor, `${diagnosticScript}\n    ${mainAnchor}`);
}

async function assertFile(filePath, shouldExist) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error(`${filePath} no es un archivo.`);
    if (!shouldExist) throw new Error(`${filePath} no debe existir en modo release.`);
  } catch (error) {
    if (error?.code === "ENOENT" && !shouldExist) return;
    throw error;
  }
}

await validateOcrLanguageAssets();
await rm(outputDir, { recursive: true, force: true });
await copyDirectory(sourceDir, outputDir);

const indexPath = path.join(outputDir, "index.html");
let html = await readFile(indexPath, "utf8");
html = removeDiagnosticsReferences(html);

if (mode === "dev") {
  html = injectDevelopmentDiagnostics(html);
}

const banner = `<!-- Generado automáticamente para modo ${mode}. No editar dist directamente. -->`;
html = html.replace(/<!doctype html>/i, `<!doctype html>\n${banner}`);
await writeFile(indexPath, html, "utf8");

const hasDiagnosticReferences = /diagnostics\.(?:css|js)/i.test(html);
if (mode === "dev" && !hasDiagnosticReferences) {
  throw new Error("El frontend de desarrollo no ha cargado el diagnóstico.");
}
if (mode === "release" && hasDiagnosticReferences) {
  throw new Error("El frontend público conserva referencias al diagnóstico.");
}

await assertFile(path.join(outputDir, "diagnostics.js"), mode === "dev");
await assertFile(path.join(outputDir, "diagnostics.css"), mode === "dev");
await assertFile(path.join(outputDir, "viewer.js"), true);

console.log(
  mode === "dev"
    ? "Frontend de desarrollo preparado con diagnóstico interno."
    : "Frontend público preparado sin diagnóstico."
);
