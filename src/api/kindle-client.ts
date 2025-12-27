import { PlaywrightKindleScraper } from './scraper-playwright.js';
import type { KindleHighlight, KindleBook, KindleApiCredentials } from '../types/index.js';

/**
 * Kindle API Client
 *
 * This client provides a unified interface to fetch Kindle highlights.
 * It implements multiple fetching strategies:
 *
 * 1. Primary: Amazon Kindle unofficial API (using npm packages)
 * 2. Fallback: Playwright browser automation for web scraping
 *
 * The client automatically falls back to Playwright if the API method fails.
 */
export class KindleClient {
  private credentials: KindleApiCredentials;

  constructor(credentials: KindleApiCredentials) {
    this.credentials = credentials;
  }

  /**
   * Fetch all highlights from Kindle
   * Tries API first, falls back to Playwright web scraping
   */
  async fetchHighlights(): Promise<KindleBook[]> {
    console.log('Fetching Kindle highlights...');

    try {
      // Try API method first
      return await this.fetchViaApi();
    } catch (error) {
      console.warn('API method failed, falling back to Playwright scraping...');
      console.warn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Fallback to Playwright web scraping
      return await this.fetchViaPlaywright();
    }
  }

  /**
   * Method 1: Fetch via unofficial API
   * Note: This is a placeholder for when a stable API package is available
   */
  private async fetchViaApi(): Promise<KindleBook[]> {
    // TODO: Implement using amazon-kindle package or similar
    // For now, throw to fall back to web scraping
    throw new Error('API method not yet implemented. Using web scraping fallback.');
  }


  /**
   * Group highlights by book
   */
  private groupHighlightsByBook(highlights: KindleHighlight[]): KindleBook[] {
    const bookMap = new Map<string, KindleBook>();

    for (const highlight of highlights) {
      const key = `${highlight.bookTitle}::${highlight.bookAuthor}`;

      if (!bookMap.has(key)) {
        bookMap.set(key, {
          title: highlight.bookTitle,
          author: highlight.bookAuthor,
          asin: highlight.asin,
          highlights: [],
          lastSync: new Date()
        });
      }

      bookMap.get(key)!.highlights.push(highlight);
    }

    return Array.from(bookMap.values());
  }

  /**
   * Method 3: Fetch via Playwright (most reliable)
   * Uses a real browser to handle Amazon authentication and scraping
   */
  private async fetchViaPlaywright(): Promise<KindleBook[]> {
    console.log('Using Playwright browser automation...');
    console.log('Opening browser in visible mode - you may need to solve CAPTCHA...');

    const scraper = new PlaywrightKindleScraper(this.credentials);

    try {
      // Initialize browser in non-headless mode so user can solve CAPTCHA
      await scraper.initialize(false); // headless = false

      // Authenticate
      await scraper.authenticate();

      // Scrape highlights
      const highlights = await scraper.scrapeHighlights();

      console.log(`✓ Scraped ${highlights.length} total highlights`);

      // Group by book
      return this.groupHighlightsByBook(highlights);

    } finally {
      // Always close the browser
      await scraper.close();
    }
  }
}
