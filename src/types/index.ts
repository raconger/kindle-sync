/**
 * Type definitions for Kindle Sync
 */

export interface KindleHighlight {
  id: string;
  bookTitle: string;
  bookAuthor: string;
  asin?: string;
  text: string;
  location?: number;
  page?: number;
  note?: string;
  color?: 'yellow' | 'blue' | 'pink' | 'orange';
  createdAt: Date;
  updatedAt?: Date;
}

export interface KindleBook {
  title: string;
  author: string;
  asin?: string;
  highlights: KindleHighlight[];
  lastSync: Date;
}

export interface Config {
  obsidianVaultPath: string;
  outputFormat: {
    fileNameTemplate: string;
    includeMetadata: boolean;
    groupBy: 'book' | 'author' | 'date';
    sortHighlightsBy: 'location' | 'date' | 'page';
  };
  sync: {
    updateExisting: boolean;
    archiveDeleted: boolean;
    archivePath: string;
  };
  markdown: {
    frontmatter: {
      title: boolean;
      author: boolean;
      category: boolean;
      lastSync: boolean;
      highlightsCount: boolean;
      asin: boolean;
    };
    highlightFormat: 'blockquote' | 'list' | 'paragraph';
    includeLocation: boolean;
    includeDate: boolean;
    includeNotes: boolean;
  };
}

export interface SyncResult {
  success: boolean;
  booksProcessed: number;
  highlightsExported: number;
  filesCreated: number;
  filesUpdated: number;
  filesArchived: number;
  errors: string[];
}

export interface MarkdownFrontmatter {
  title: string;
  author: string;
  category?: string;
  last_sync: string;
  highlights_count: number;
  asin?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface KindleApiCredentials {
  email: string;
  password: string;
  deviceId?: string;
  marketplace?: string;
}
