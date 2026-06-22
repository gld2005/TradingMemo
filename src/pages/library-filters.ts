export type LibraryCategoryFilter = 'all' | 'uncategorized' | string;
export type LibraryDatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export type LibraryFilters = {
  query: string;
  category: LibraryCategoryFilter;
  tagIds: string[];
  stockQuery: string;
  datePreset: LibraryDatePreset;
  dateStart: string;
  dateEnd: string;
  hasImages: boolean;
};

export function createDefaultLibraryFilters(): LibraryFilters {
  return {
    query: '', category: 'all', tagIds: [], stockQuery: '',
    datePreset: 'all', dateStart: '', dateEnd: '', hasImages: false,
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function parseLocalDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return end ? endOfDay(date) : startOfDay(date);
}

export function validateDateRange(start: string, end: string) {
  const startDate = start ? parseLocalDate(start) : null;
  const endDate = end ? parseLocalDate(end, true) : null;
  if ((start && !startDate) || (end && !endDate)) return '日期格式无效，请重新选择。';
  if (startDate && endDate && startDate > endDate) return '开始日期不能晚于结束日期。';
  return '';
}

function resolveDateRange(filters: LibraryFilters, now: Date): [Date | null, Date | null] {
  if (filters.datePreset === 'all') return [null, null];
  if (filters.datePreset === 'custom') {
    if (validateDateRange(filters.dateStart, filters.dateEnd)) return [null, null];
    return [
      filters.dateStart ? parseLocalDate(filters.dateStart) : null,
      filters.dateEnd ? parseLocalDate(filters.dateEnd, true) : null,
    ];
  }

  const end = endOfDay(now);
  if (filters.datePreset === 'today') return [startOfDay(now), end];
  if (filters.datePreset === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), end];
  const start = startOfDay(now);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  return [start, end];
}

export function filterLibraryNotes(
  notes: Note[],
  categories: Category[],
  tags: Tag[],
  filters: LibraryFilters,
  now = new Date(),
) {
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]));
  const tagNames = new Map(tags.map(({ id, name }) => [id, name]));
  const query = normalize(filters.query);
  const stockQuery = normalize(filters.stockQuery);
  const [dateStart, dateEnd] = resolveDateRange(filters, now);

  return notes.filter((note) => {
    if (filters.category === 'uncategorized' && note.categoryId) return false;
    if (filters.category !== 'all' && filters.category !== 'uncategorized' && note.categoryId !== filters.category) return false;
    if (!filters.tagIds.every((id) => note.tagIds.includes(id))) return false;

    const stockText = normalize(`${note.stockName ?? ''} ${note.stockCode ?? ''}`);
    if (stockQuery && !stockText.includes(stockQuery)) return false;
    if (filters.hasImages && note.attachmentIds.length === 0) return false;

    const createdAt = new Date(note.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      if (dateStart || dateEnd) return false;
    } else {
      if (dateStart && createdAt < dateStart) return false;
      if (dateEnd && createdAt > dateEnd) return false;
    }

    if (!query) return true;
    const searchableText = normalize([
      note.title, note.content, note.stockName, note.stockCode,
      note.categoryId ? categoryNames.get(note.categoryId) : '',
      ...note.tagIds.map((id) => tagNames.get(id)),
    ].filter(Boolean).join(' '));
    return searchableText.includes(query);
  });
}
