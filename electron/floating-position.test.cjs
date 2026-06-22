const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveFloatingPosition } = require('./floating-position.cjs');

test('keeps the requested position while dragging', () => {
  const position = resolveFloatingPosition({
    cursor: { x: 1910, y: 500 },
    finalize: false,
    target: { x: 1880, y: 470 },
    windowSize: [80, 80],
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  });

  assert.deepEqual(position, [1880, 470]);
});

test('clamps the final position inside the cursor display work area', () => {
  const position = resolveFloatingPosition({
    cursor: { x: 1930, y: 500 },
    finalize: true,
    target: { x: 1900, y: 470 },
    windowSize: [80, 80],
    workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
  });

  assert.deepEqual(position, [1920, 470]);
});
