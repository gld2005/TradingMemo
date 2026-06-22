type FloatingMode = 'expanded' | 'mini';

type FloatingState = {
  mode: FloatingMode;
  shortcutRegistered: boolean;
  visible: boolean;
};
type AppSettings = { schemaVersion: 1; theme: 'light'|'dark'|'system'; floatingShortcut: string; defaultCategoryId: string|null; onboardingDismissed: boolean };

type Note = {
  id: string;
  title: string | null;
  content: string;
  categoryId: string | null;
  tagIds: string[];
  stockName: string | null;
  stockCode: string | null;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Category = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Tag = {
  id: string;
  name: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

type Attachment = {
  id: string;
  noteId: string;
  type: string;
  fileName: string;
  filePath: string;
  createdAt: string;
};

type CreateNoteInput = {
  content: string;
  categoryId?: string | null;
  tagIds?: string[];
  stockName?: string;
  stockCode?: string;
  images?: Array<{
    name: string;
    type: string;
    bytes: Uint8Array;
  }>;
};

type UpdateNoteInput = {
  title: string;
  content: string;
  categoryId: string | null;
  tagIds: string[];
  stockName: string;
  stockCode: string;
  removeAttachmentIds: string[];
  images: NonNullable<CreateNoteInput['images']>;
};

type NoteMutationResult = {
  note: Note;
  warnings: string[];
};

type AttachmentContent = {
  id: string;
  type: string;
  bytes: Uint8Array;
};

type DesktopApi = {
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, input: UpdateNoteInput) => Promise<NoteMutationResult>;
  deleteNote: (id: string) => Promise<NoteMutationResult>;
  createCategory: (input: { name: string }) => Promise<Category>;
  updateCategory: (id: string, input: { name: string }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<Category>;
  createTag: (input: { name: string }) => Promise<Tag>;
  updateTag: (id: string, input: { name: string }) => Promise<Tag>;
  deleteTag: (id: string) => Promise<Tag>;
  getAllNotes: () => Promise<Note[]>;
  getAttachments: (ids: string[]) => Promise<Attachment[]>;
  getCategories: () => Promise<Category[]>;
  getTags: () => Promise<Tag[]>;
  getFloatingState: () => Promise<FloatingState>;
  getStorageInfo: () => Promise<{ dataFilePath: string }>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  openDataDirectory: () => Promise<void>;
  exportMarkdown: () => Promise<string|null>;
  exportJson: () => Promise<string|null>;
  backupData: () => Promise<string|null>;
  restoreData: () => Promise<{safetyBackupPath:string; warning:string|null}|null>;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  hideFloatingWindow: () => Promise<FloatingState>;
  onFloatingShown: (callback: () => void) => () => void;
  onFloatingStateChanged: (callback: (state: FloatingState) => void) => () => void;
  onNotesChanged: (callback: () => void) => () => void;
  readAttachment: (id: string) => Promise<AttachmentContent>;
  setFloatingMode: (mode: FloatingMode) => Promise<FloatingState>;
  showFloatingWindow: () => Promise<FloatingState>;
  toggleFloatingWindow: () => Promise<FloatingState>;
};

interface Window {
  desktop: DesktopApi;
}
