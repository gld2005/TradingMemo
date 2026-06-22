function resolveFloatingPosition({ finalize, target, windowSize, workArea }) {
  const targetX = Math.round(target.x);
  const targetY = Math.round(target.y);
  if (!finalize) return [targetX, targetY];

  const [windowWidth, windowHeight] = windowSize;
  const minX = workArea.x;
  const minY = workArea.y;
  const maxX = workArea.x + workArea.width - windowWidth;
  const maxY = workArea.y + workArea.height - windowHeight;
  return [
    Math.min(Math.max(targetX, minX), maxX),
    Math.min(Math.max(targetY, minY), maxY),
  ];
}

module.exports = { resolveFloatingPosition };
