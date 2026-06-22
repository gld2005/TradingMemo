from collections import deque
from pathlib import Path
import sys

from PIL import Image, ImageFilter


def extract_subject(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    width, height = source.size
    pixels = source.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        distance_from_white = ((255 - red) ** 2 + (255 - green) ** 2 + (255 - blue) ** 2) ** 0.5
        return distance_from_white < 190

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not background[index] and is_background(x, y):
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    mask = Image.new("L", source.size, 255)
    mask.putdata([0 if value else 255 for value in background])
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("No icon subject was detected")

    left, top, right, bottom = bounds
    subject = source.crop(bounds)
    subject_mask = mask.crop(bounds).filter(ImageFilter.GaussianBlur(1.2))
    subject.putalpha(subject_mask)

    side = max(subject.size)
    padding = max(8, round(side * 0.025))
    canvas = Image.new("RGBA", (side + padding * 2, side + padding * 2), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((canvas.width - subject.width) // 2, (canvas.height - subject.height) // 2))
    canvas = canvas.resize((1024, 1024), Image.Resampling.LANCZOS)
    canvas.save(output_path, "PNG", optimize=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare-icon.py SOURCE.png OUTPUT.png")
    extract_subject(Path(sys.argv[1]), Path(sys.argv[2]))
