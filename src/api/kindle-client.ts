import axios from 'axios';
import * as cheerio from 'cheerio';
import type { KindleHighlight, KindleBook, KindleApiCredentials } from '../types/index.js';

/**
 * Kindle API Client
 *
 * This client provides a unified interface to fetch Kindle highlights.
 * It implements multiple fetching strategies:
 *
 * 1. Primary: Amazon Kindle unofficial API (using npm packages)
 * 2. Fallback: Web scraping from kindle.amazon.com/your_highlights
 *
 * The client automatically falls back to web scraping if the API method fails.
 */
export class KindleClient {
  private credentials: KindleApiCredentials;
  private sessionCookies?: string;

  constructor(credentials: KindleApiCredentials) {
    this.credentials = credentials;
  }

  /**
   * Fetch all highlights from Kindle
   * Tries API first, falls back to web scraping
   */
  async fetchHighlights(): Promise<KindleBook[]> {
    console.log('Fetching Kindle highlights...');

    try {
      // Try API method first
      return await this.fetchViaApi();
    } catch (error) {
      console.warn('API method failed, falling back to web scraping...');
      console.warn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Fallback to web scraping
      return await this.fetchViaWebScraping();
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
   * Method 2: Fetch via web scraping
   * Scrapes https://kindle.amazon.com/your_highlights
   */
  private async fetchViaWebScraping(): Promise<KindleBook[]> {
    console.log('Using web scraping method...');

    // Step 1: Authenticate and get session cookies
    await this.authenticateWeb();

    // Step 2: Fetch the highlights page
    const highlights = await this.scrapeHighlightsPage();

    // Step 3: Group highlights by book
    return this.groupHighlightsByBook(highlights);
  }

  /**
   * Authenticate with Amazon and get session cookies
   */
  private async authenticateWeb(): Promise<void> {
    const marketplace = this.credentials.marketplace || 'US';
    const baseUrl = this.getAmazonBaseUrl(marketplace);

    try {
      // This is a simplified authentication flow
      // In production, you may need to handle 2FA, captchas, etc.
      const response = await axios.post(
        `${baseUrl}/ap/signin`,
        new URLSearchParams({
          email: this.credentials.email,
          password: this.credentials.password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 5
        }
      );

      // Extract session cookies
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        this.sessionCookies = cookies.join('; ');
      } else {
        throw new Error('Authentication failed: No session cookies received');
      }

      console.log('✓ Authenticated successfully');
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scrape highlights from the Kindle highlights page
   */
  private async scrapeHighlightsPage(): Promise<KindleHighlight[]> {
    if (!this.sessionCookies) {
      throw new Error('Not authenticated. Call authenticateWeb() first.');
    }

    const marketplace = this.credentials.marketplace || 'US';
    const baseUrl = this.getAmazonBaseUrl(marketplace);
    const highlightsUrl = `${baseUrl}/kp/notebook`;

    const highlights: KindleHighlight[] = [];
    let pageToken: string | null = null;
    let pageCount = 0;

    // Kindle highlights are paginated, so we need to fetch all pages
    do {
      const url = pageToken
        ? `${highlightsUrl}?token=${pageToken}`
        : highlightsUrl;

      const response = await axios.get(url, {
        headers: {
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Parse highlights from the page
      $('.kp-notebook-highlight').each((_, element) => {
        const $el = $(element);

        const highlight: KindleHighlight = {
          id: $el.attr('id') || `highlight-${Date.now()}-${Math.random()}`,
          bookTitle: $el.find('.kp-notebook-book-title').text().trim(),
          bookAuthor: $el.find('.kp-notebook-book-author').text().trim(),
          text: $el.find('#highlight').text().trim(),
          location: this.parseLocation($el.find('.kp-notebook-location').text()),
          note: $el.find('#note').text().trim() || undefined,
          createdAt: this.parseDate($el.find('.kp-notebook-date').text()),
          asin: $el.data('asin') as string | undefined
        };

        if (highlight.text) {
          highlights.push(highlight);
        }
      });

      // Check for next page token
      const nextButton = $('.kp-notebook-next-page');
      pageToken = nextButton.data('token') as string | null;
      pageCount++;

      console.log(`✓ Scraped page ${pageCount} (${highlights.length} highlights so far)`);

      // Add delay to avoid rate limiting
      if (pageToken) {
        await this.delay(1000);
      }

    } while (pageToken && pageCount < 100); // Safety limit

    console.log(`✓ Scraped ${highlights.length} total highlights`);
    return highlights;
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
   * Parse location string (e.g., "Location 1234" or "Page 56")
   */
  private parseLocation(locationText: string): number | undefined {
    const match = locationText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Parse date string from Kindle format
   */
  private parseDate(dateText: string): Date {
    // Kindle dates are typically in format like "Added on Monday, January 1, 2024"
    const match = dateText.match(/Added on (.+)/i);
    if (match) {
      return new Date(match[1]);
    }
    return new Date();
  }

  /**
   * Get Amazon base URL for marketplace
   */
  private getAmazonBaseUrl(marketplace: string): string {
    const urls: Record<string, string> = {
      'US': 'https://kindle.amazon.com',
      'UK': 'https://kindle.amazon.co.uk',
      'DE': 'https://kindle.amazon.de',
      'FR': 'https://kindle.amazon.fr',
      'ES': 'https://kindle.amazon.es',
      'IT': 'https://kindle.amazon.it',
      'JP': 'https://kindle.amazon.co.jp',
      'CA': 'https://kindle.amazon.ca'
    };

    return urls[marketplace] || urls['US'];
  }

  /**
   * Utility: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
