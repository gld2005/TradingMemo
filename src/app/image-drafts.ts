export const MAX_IMAGE_COUNT = 10;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const supportedExtensions = /\.(png|jpe?g|webp)$/i;

type ImageDraftSelection = {
  accepted: File[];
  message: string;
};

export function selectImageDrafts(
  candidates: Iterable<File>,
  currentCount: number,
): ImageDraftSelection {
  const files = Array.from(candidates);
  const supported = files.filter((item) => (
    supportedTypes.has(item.type) || supportedExtensions.test(item.name)
  ));
  const withinSize = supported.filter((item) => item.size <= MAX_IMAGE_SIZE);
  const remaining = Math.max(0, MAX_IMAGE_COUNT - currentCount);
  const accepted = withinSize.slice(0, remaining);

  let message = '';
  if (supported.length < files.length) {
    message = '仅支持 PNG、JPG、JPEG 和 WebP 图片。';
  } else if (withinSize.length < supported.length) {
    message = '单张图片不能超过 10MB。';
  } else if (withinSize.length > remaining) {
    message = '单条笔记最多添加 10 张图片。';
  }

  return { accepted, message };
}

export function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片。'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}
