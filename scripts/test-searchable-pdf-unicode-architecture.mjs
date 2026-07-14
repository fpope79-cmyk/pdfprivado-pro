import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("src/index.html", "utf8");
const prepare = fs.readFileSync("scripts/prepare-frontend.mjs", "utf8");
const viewer = fs.readFileSync("src/viewer.js", "utf8");

assert.match(index, /vendor\/fontkit\.umd\.min\.js/);
assert.match(viewer, /output\.registerFontkit\(window\.fontkit\)/);
assert.match(viewer, /noto-sans-latin-400-normal\.woff/);
assert.match(viewer, /embedFont\(bytes,\s*\{\s*subset:\s*true\s*\}\)/);
assert.match(viewer, /StandardFonts\.Helvetica/);
assert.match(viewer, /unicodeFont/);
assert.match(viewer, /fontFallback/);
assert.match(prepare, /fontkit\.umd\.min\.js/);
assert.match(prepare, /noto-sans-latin-400-normal\.woff/);

assert.doesNotMatch(index, /https?:\/\//i);
assert.doesNotMatch(viewer, /https?:\/\//i);

for (const file of [
  "src/vendor/fontkit.umd.min.js",
  "src/vendor/fonts/noto-sans-latin-400-normal.woff",
  "src/vendor/licenses/FONTKIT-MIT.txt",
  "src/vendor/licenses/NOTO-SANS-OFL.txt",
]) {
  assert.equal(fs.existsSync(file), true, "Falta el recurso local: " + file);
  assert.ok(fs.statSync(file).size > 0, "El recurso esta vacio: " + file);
}

console.log("PRUEBAS ARQUITECTURA UNICODE PDF BUSCABLE: OK");
