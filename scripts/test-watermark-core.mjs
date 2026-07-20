import assert from "node:assert/strict";
import {
  clamp,
  parseHexColor,
  parsePageExpression,
  selectedPagesForMode,
  rotatedTextBounds,
  resolveWatermarkPlacement,
} from "../src/watermark-core.js";

assert.equal(clamp(120, 0, 100), 100);
assert.equal(clamp(-2, 0, 100), 0);
assert.deepEqual(parseHexColor("#ff0000"), { r: 1, g: 0, b: 0 });
assert.deepEqual([...parsePageExpression("1-3, 5, 8-7", 8)], [1, 2, 3, 5, 7, 8]);
assert.deepEqual([...selectedPagesForMode("even", 6)], [2, 4, 6]);
assert.deepEqual([...selectedPagesForMode("odd", 6)], [1, 3, 5]);

const bounds = rotatedTextBounds(100, 20, -35);
assert.ok(bounds.width > 100);
assert.ok(bounds.height > 20);

const page = { getSize: () => ({ width: 595, height: 842 }) };
for (const position of ["top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right"]) {
  const placement = resolveWatermarkPlacement(page, 300, 50, {
    position,
    rotation: -35,
    marginX: 24,
    marginY: 24,
  });
  assert.ok(placement.boxX >= 0);
  assert.ok(placement.boxY >= 0);
  assert.ok(placement.boxX + placement.boxWidth <= 595 + 1e-7);
  assert.ok(placement.boxY + placement.boxHeight <= 842 + 1e-7);
}

assert.deepEqual(
  [...selectedPagesForMode("manual", 6, "", new Set([1, 3, 8]), false)],
  [1, 3]
);
assert.deepEqual(
  [...selectedPagesForMode("all", 4, "", new Set(), true)],
  [2, 3, 4]
);
assert.deepEqual(
  [...selectedPagesForMode("manual", 4, "", new Set([1, 2, 4]), true)],
  [2, 4]
);
console.log("OK watermark-core V1.2 selección avanzada y geometría");
