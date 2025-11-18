import matter from 'gray-matter';
import type { KindleBook, KindleHighlight, Config, MarkdownFrontmatter } from '../types/index.js';

/**
 * Markdown Exporter
 *
 * Converts Kindle books and highlights into Obsidian-compatible markdown files
 * with YAML frontmatter.
 */
export class MarkdownExporter {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Generate markdown content for a book
   */
  generateMarkdown(book: KindleBook): string {
    const frontmatter = this.generateFrontmatter(book);
    const content = this.generateContent(book);

    // Use gray-matter to combine frontmatter and content
    return matter.stringify(content, frontmatter);
  }

  /**
   * Generate YAML frontmatter for a book
   */
  private generateFrontmatter(book: KindleBook): MarkdownFrontmatter {
    const frontmatter: MarkdownFrontmatter = {
      title: book.title,
      author: book.author,
      last_sync: book.lastSync.toISOString(),
      highlights_count: book.highlights.length
    };

    // Add optional fields based on config
    if (this.config.markdown.frontmatter.category) {
      frontmatter.category = 'Books';
    }

    if (this.config.markdown.frontmatter.asin && book.asin) {
      frontmatter.asin = book.asin;
    }

    return frontmatter;
  }

  /**
   * Generate markdown content (body) for a book
   */
  private generateContent(book: KindleBook): string {
    const lines: string[] = [];

    // Add title as H1
    lines.push(`# ${book.title}\n`);

    // Add author
    lines.push(`**By:** ${book.author}\n`);

    // Add highlights section
    lines.push('## Highlights\n');

    // Sort highlights
    const sortedHighlights = this.sortHighlights(book.highlights);

    // Generate highlight entries
    for (const highlight of sortedHighlights) {
      lines.push(this.formatHighlight(highlight));
      lines.push(''); // Empty line between highlights
    }

    return lines.join('\n');
  }

  /**
   * Sort highlights based on configuration
   */
  private sortHighlights(highlights: KindleHighlight[]): KindleHighlight[] {
    const sorted = [...highlights];

    switch (this.config.outputFormat.sortHighlightsBy) {
      case 'location':
        sorted.sort((a, b) => (a.location || 0) - (b.location || 0));
        break;
      case 'date':
        sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'page':
        sorted.sort((a, b) => (a.page || 0) - (b.page || 0));
        break;
    }

    return sorted;
  }

  /**
   * Format a single highlight based on configuration
   */
  private formatHighlight(highlight: KindleHighlight): string {
    const parts: string[] = [];

    // Format the highlight text based on style
    switch (this.config.markdown.highlightFormat) {
      case 'blockquote':
        parts.push(`> ${highlight.text}`);
        break;
      case 'list':
        parts.push(`- ${highlight.text}`);
        break;
      case 'paragraph':
        parts.push(highlight.text);
        break;
    }

    // Add metadata section
    const metadata: string[] = [];

    if (this.config.markdown.includeLocation && highlight.location) {
      metadata.push(`**Location:** ${highlight.location}`);
    }

    if (this.config.markdown.includeDate) {
      metadata.push(`**Date:** ${this.formatDate(highlight.createdAt)}`);
    }

    if (this.config.markdown.includeNotes && highlight.note) {
      parts.push('');
      parts.push(`**Note:** ${highlight.note}`);
    }

    if (metadata.length > 0) {
      parts.push('');
      parts.push(metadata.join(' • '));
    }

    // Add separator
    parts.push('\n---');

    return parts.join('\n');
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Generate filename for a book
   */
  generateFilename(book: KindleBook): string {
    let filename = this.config.outputFormat.fileNameTemplate;

    // Replace template variables
    filename = filename
      .replace(/\{\{title\}\}/g, this.sanitizeFilename(book.title))
      .replace(/\{\{author\}\}/g, this.sanitizeFilename(book.author));

    // Ensure .md extension
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    return filename;
  }

  /**
   * Sanitize filename (remove invalid characters)
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-')  // Replace invalid chars with dash
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .trim();
  }

  /**
   * Parse existing markdown file to extract highlights
   * Used for detecting changes during sync
   */
  parseExistingFile(content: string): { highlights: KindleHighlight[], frontmatter: MarkdownFrontmatter } {
    const parsed = matter(content);
    const frontmatter = parsed.data as MarkdownFrontmatter;

    // Extract highlights from content
    // This is a simplified parser - in production you might want more robust parsing
    const highlights: KindleHighlight[] = [];
    const highlightPattern = /^> (.+?)(?:\n\n|\n---)/gms;
    const matches = parsed.content.matchAll(highlightPattern);

    for (const match of matches) {
      highlights.push({
        id: `parsed-${highlights.length}`,
        bookTitle: frontmatter.title,
        bookAuthor: frontmatter.author,
        text: match[1].trim(),
        createdAt: new Date()
      });
    }

    return { highlights, frontmatter };
  }
}
