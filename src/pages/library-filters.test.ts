import { describe, expect, it } from 'vitest';
import { createDefaultLibraryFilters, filterLibraryNotes, validateDateRange } from './library-filters';

const categories: Category[] = [
  {
    id: 'category-kline', name: 'K线知识', color: null, sortOrder: 0,
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
  },
];

const tags: Tag[] = [
  {
    id: 'tag-breakout', name: '突破', usageCount: 1,
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'tag-volume', name: '缩量上涨', usageCount: 1,
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
  },
];

const notes: Note[] = [
  {
    id: 'note-match', title: 'BreakOut 观察', content: '月线突破后的承接。',
    categoryId: 'category-kline', tagIds: ['tag-breakout', 'tag-volume'],
    stockName: '比亚迪', stockCode: '002594', attachmentIds: ['attachment-1'],
    createdAt: '2026-06-21T04:00:00.000Z', updatedAt: '2026-06-21T05:00:00.000Z',
  },
  {
    id: 'note-other', title: '普通记录', content: '等待下一次机会。', categoryId: null,
    tagIds: ['tag-breakout'], stockName: '贵州茅台', stockCode: '600519', attachmentIds: [],
    createdAt: '2026-05-02T04:00:00.000Z', updatedAt: '2026-05-02T05:00:00.000Z',
  },
];

describe('library filters', () => {
  it('matches local note text and related names case-insensitively', () => {
    const filters = { ...createDefaultLibraryFilters(), query: 'breakout' };
    expect(filterLibraryNotes(notes, categories, tags, filters).map(({ id }) => id)).toEqual(['note-match']);

    expect(filterLibraryNotes(notes, categories, tags, { ...filters, query: 'K线知识' }).map(({ id }) => id)).toEqual(['note-match']);
    expect(filterLibraryNotes(notes, categories, tags, { ...filters, query: '缩量上涨' }).map(({ id }) => id)).toEqual(['note-match']);
  });

  it('combines category, tag AND, stock, date, and image filters with AND logic', () => {
    const filters = {
      ...createDefaultLibraryFilters(),
      query: '突破', category: 'category-kline', tagIds: ['tag-breakout', 'tag-volume'],
      stockQuery: '002594', datePreset: 'month' as const, hasImages: true,
    };

    const result = filterLibraryNotes(notes, categories, tags, filters, new Date(2026, 5, 21, 12));
    expect(result.map(({ id }) => id)).toEqual(['note-match']);
    expect(filterLibraryNotes(notes, categories, tags, { ...filters, tagIds: ['tag-breakout', 'missing'] }, new Date(2026, 5, 21, 12))).toEqual([]);
  });

  it('supports uncategorized and inclusive custom date ranges', () => {
    const uncategorized = { ...createDefaultLibraryFilters(), category: 'uncategorized' as const };
    expect(filterLibraryNotes(notes, categories, tags, uncategorized).map(({ id }) => id)).toEqual(['note-other']);

    const custom = {
      ...createDefaultLibraryFilters(), datePreset: 'custom' as const,
      dateStart: '2026-06-21', dateEnd: '2026-06-21',
    };
    expect(filterLibraryNotes(notes, categories, tags, custom).map(({ id }) => id)).toEqual(['note-match']);
  });

  it('returns a friendly validation message for a reversed custom date range', () => {
    expect(validateDateRange('2026-06-22', '2026-06-21')).toBe('开始日期不能晚于结束日期。');
    expect(validateDateRange('', '')).toBe('');
  });
});
