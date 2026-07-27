import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('src/convert-export.js');
const formats = read('src/convert-export-formats.js');
const checks = [
  ['OCR automático en páginas con texto nativo insuficiente', app.includes('nativeText || "").replace(/\\s+/gu, "").length >= 160')],
  ['Geometría editable prioritaria', app.includes('geometria-editable-prioritaria')],
  ['Limpieza adaptativa del texto rasterizado', app.includes('sampleBackground') && app.includes('context.putImageData(image, 0, 0)')],
  ['Fuente editable Arial', formats.includes('const DOCX_EDITABLE_FONT = "Arial";')],
  ['Texto claro convertido a negro', formats.includes('(r + g + b) > 570 ? "000000" : valid')],
  ['DrawingML moderno activo', formats.includes('modernizeEditableDocxTextboxes') && formats.includes('wordprocessingShape')],
];
let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'ERROR'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
