import { readdir, readFile, writeFile, mkdir, rename } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { KindleClient } from '../api/kindle-client.js';
import { MarkdownExporter } from '../exporters/markdown.js';
import type { Config, KindleBook, SyncResult } from '../types/index.js';

/**
 * Sync Manager
 *
 * Orchestrates the synchronization of Kindle highlights to Obsidian vault:
 * 1. Fetches highlights from Kindle
 * 2. Compares with existing files
 * 3. Updates only changed files
 * 4. Archives deleted books
 */
export class SyncManager {
  private config: Config;
  private kindleClient: KindleClient;
  private markdownExporter: MarkdownExporter;

  constructor(config: Config, kindleClient: KindleClient) {
    this.config = config;
    this.kindleClient = kindleClient;
    this.markdownExporter = new MarkdownExporter(config);
  }

  /**
   * Run the synchronization process
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      booksProcessed: 0,
      highlightsExported: 0,
      filesCreated: 0,
      filesUpdated: 0,
      filesArchived: 0,
      errors: []
    };

    try {
      console.log('Starting Kindle sync...\n');

      // Step 1: Ensure output directory exists
      await this.ensureOutputDirectory();

      // Step 2: Fetch highlights from Kindle
      console.log('Fetching highlights from Kindle...');
      const books = await this.kindleClient.fetchHighlights();
      console.log(`✓ Found ${books.length} books with highlights\n`);

      // Step 3: Get existing files
      const existingFiles = await this.getExistingFiles();
      const processedFiles = new Set<string>();

      // Step 4: Process each book
      for (const book of books) {
        try {
          const filename = this.markdownExporter.generateFilename(book);
          const filepath = resolve(this.config.obsidianVaultPath, filename);
          processedFiles.add(filename);

          // Check if file exists and needs update
          const shouldUpdate = await this.shouldUpdateFile(filepath, book);

          if (shouldUpdate) {
            await this.writeBookFile(filepath, book);

            if (existingFiles.has(filename)) {
              result.filesUpdated++;
              console.log(`✓ Updated: ${filename}`);
            } else {
              result.filesCreated++;
              console.log(`✓ Created: ${filename}`);
            }
          } else {
            console.log(`- Skipped (no changes): ${filename}`);
          }

          result.booksProcessed++;
          result.highlightsExported += book.highlights.length;
        } catch (error) {
          const errorMsg = `Error processing ${book.title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
        }
      }

      // Step 5: Archive deleted books
      if (this.config.sync.archiveDeleted) {
        const deletedFiles = Array.from(existingFiles).filter(f => !processedFiles.has(f));
        for (const filename of deletedFiles) {
          try {
            await this.archiveFile(filename);
            result.filesArchived++;
            console.log(`✓ Archived: ${filename}`);
          } catch (error) {
            const errorMsg = `Error archiving ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(`✗ ${errorMsg}`);
          }
        }
      }

      result.success = true;
      console.log('\n' + this.formatSyncResult(result));

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`\n✗ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await mkdir(this.config.obsidianVaultPath, { recursive: true });

      // Create archive directory if needed
      if (this.config.sync.archiveDeleted) {
        const archivePath = resolve(this.config.obsidianVaultPath, this.config.sync.archivePath);
        await mkdir(archivePath, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of existing markdown files in output directory
   */
  private async getExistingFiles(): Promise<Set<string>> {
    const files = new Set<string>();

    try {
      const entries = await readdir(this.config.obsidianVaultPath);
      for (const entry of entries) {
        if (entry.endsWith('.md') && !entry.startsWith('.')) {
          files.add(entry);
        }
      }
    } catch (error) {
      // Directory doesn't exist yet, that's ok
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }

  /**
   * Determine if a file should be updated
   */
  private async shouldUpdateFile(filepath: string, book: KindleBook): Promise<boolean> {
    // If updateExisting is false, never update existing files
    if (!this.config.sync.updateExisting && existsSync(filepath)) {
      return false;
    }

    // If file doesn't exist, always create it
    if (!existsSync(filepath)) {
      return true;
    }

    try {
      // Read existing file and compare
      const existingContent = await readFile(filepath, 'utf-8');
      const { highlights: existingHighlights, frontmatter } = this.markdownExporter.parseExistingFile(existingContent);

      // Compare highlight counts
      if (book.highlights.length !== frontmatter.highlights_count) {
        return true;
      }

      // Compare number of highlights (simple check)
      if (existingHighlights.length !== book.highlights.length) {
        return true;
      }

      // File exists and hasn't changed
      return false;
    } catch (error) {
      // If we can't read the file, update it
      return true;
    }
  }

  /**
   * Write book to markdown file
   */
  private async writeBookFile(filepath: string, book: KindleBook): Promise<void> {
    const content = this.markdownExporter.generateMarkdown(book);
    await writeFile(filepath, content, 'utf-8');
  }

  /**
   * Archive a file that no longer has highlights
   */
  private async archiveFile(filename: string): Promise<void> {
    const sourcePath = resolve(this.config.obsidianVaultPath, filename);
    const archivePath = resolve(
      this.config.obsidianVaultPath,
      this.config.sync.archivePath,
      filename
    );

    await rename(sourcePath, archivePath);
  }

  /**
   * Format sync result for display
   */
  private formatSyncResult(result: SyncResult): string {
    const lines = [
      '═══════════════════════════════════════',
      '           SYNC COMPLETE',
      '═══════════════════════════════════════',
      `Books processed:      ${result.booksProcessed}`,
      `Highlights exported:  ${result.highlightsExported}`,
      `Files created:        ${result.filesCreated}`,
      `Files updated:        ${result.filesUpdated}`,
      `Files archived:       ${result.filesArchived}`,
      `Errors:               ${result.errors.length}`,
      '═══════════════════════════════════════'
    ];

    return lines.join('\n');
  }
}
