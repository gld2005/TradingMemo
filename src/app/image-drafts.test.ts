import { describe, expect, it } from 'vitest';
import { selectImageDrafts } from './image-drafts';

function file(name: string, type: string, size = 3) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('image draft selection', () => {
  it('accepts png, jpg, jpeg, and webp files', () => {
    const result = selectImageDrafts([
      file('one.png', 'image/png'),
      file('two.jpg', 'image/jpeg'),
      file('three.jpeg', 'image/jpeg'),
      file('four.webp', 'image/webp'),
    ], 0);

    expect(result.accepted.map(({ name }) => name)).toEqual([
      'one.png', 'two.jpg', 'three.jpeg', 'four.webp',
    ]);
    expect(result.message).toBe('');
  });

  it('rejects unsupported files and images larger than 10MB', () => {
    expect(selectImageDrafts([file('note.txt', 'text/plain')], 0).message)
      .toBe('仅支持 PNG、JPG、JPEG 和 WebP 图片。');
    expect(selectImageDrafts([file('large.png', 'image/png', 10 * 1024 * 1024 + 1)], 0).message)
      .toBe('单张图片不能超过 10MB。');
  });

  it('accepts only the remaining slots up to ten images', () => {
    const result = selectImageDrafts([
      file('one.png', 'image/png'),
      file('two.png', 'image/png'),
    ], 9);

    expect(result.accepted).toHaveLength(1);
    expect(result.message).toBe('单条笔记最多添加 10 张图片。');
  });
});
