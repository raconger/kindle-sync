import { chromium, Browser, Page } from 'playwright';
import type { KindleHighlight, KindleApiCredentials } from '../types/index.js';

/**
 * Playwright-based Kindle scraper
 * Uses a real browser to handle Amazon authentication and scraping
 */
export class PlaywrightKindleScraper {
  private browser?: Browser;
  private page?: Page;
  private credentials: KindleApiCredentials;

  constructor(credentials: KindleApiCredentials) {
    this.credentials = credentials;
  }

  /**
   * Initialize the browser
   */
  async initialize(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    this.page = await context.newPage();
  }

  /**
   * Authenticate with Amazon
   */
  async authenticate(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const marketplace = this.credentials.marketplace || 'US';
    const notebookUrl = this.getNotebookUrl(marketplace);

    console.log('Navigating to Kindle highlights page...');
    await this.page.goto(notebookUrl, { waitUntil: 'networkidle' });

    // Take screenshot to see what page we land on
    await this.page.screenshot({ path: 'debug-initial-page.png' });
    console.log('Screenshot saved to debug-initial-page.png');

    // Check if we need to login
    const url = this.page.url();
    if (url.includes('ap/signin') || !url.includes('kp/notebook')) {
      console.log('Login required, filling credentials...');

      // Try multiple possible email input selectors
      try {
        await this.page.waitForSelector('input#ap_email, input[name="email"], input[type="email"]', { timeout: 5000 });
        await this.page.fill('input#ap_email, input[name="email"], input[type="email"]', this.credentials.email);

        // Click continue button
        await this.page.click('input#continue, button:has-text("Continue"), #continue');
        await this.page.waitForTimeout(2000);
      } catch (error) {
        await this.page.screenshot({ path: 'debug-email-error.png' });
        throw new Error('Could not find email input field. Screenshot saved to debug-email-error.png');
      }

      // Fill in password
      try {
        await this.page.waitForSelector('input#ap_password, input[name="password"], input[type="password"]', { timeout: 5000 });
        await this.page.fill('input#ap_password, input[name="password"], input[type="password"]', this.credentials.password);

        // Click sign in button
        await this.page.click('input#signInSubmit, button:has-text("Sign in"), button:has-text("Sign In"), #signInSubmit');
        await this.page.waitForTimeout(2000);
      } catch (error) {
        await this.page.screenshot({ path: 'debug-password-error.png' });
        throw new Error('Could not find password input field. Screenshot saved to debug-password-error.png');
      }

      // Check if CAPTCHA appeared
      await this.page.waitForTimeout(1000);
      const hasCaptcha = await this.page.locator('form[action*="validateCaptcha"], img[alt*="captcha"], img[alt*="puzzle"]').count() > 0;

      if (hasCaptcha) {
        console.log('\n⚠️  CAPTCHA detected! Please solve the puzzle in the browser window...');
        console.log('Waiting up to 60 seconds for you to solve it...\n');

        // Wait for user to solve CAPTCHA and get redirected
        await this.page.waitForURL('**/kp/notebook**', { timeout: 60000 }).catch(() => {
          console.warn('Still not on notebook page after 60 seconds');
        });
      } else {
        // Wait for redirect to notebook
        await this.page.waitForURL('**/kp/notebook**', { timeout: 10000 }).catch(() => {
          console.warn('Did not redirect to notebook page');
        });
      }
    }

    // Check final URL
    const finalUrl = this.page.url();
    if (finalUrl.includes('ap/mfa')) {
      throw new Error('Two-factor authentication detected. Please disable 2FA or handle it manually.');
    }

    if (!finalUrl.includes('kp/notebook')) {
      console.log('Current URL:', finalUrl);
      await this.page.screenshot({ path: 'debug-auth-failed.png' });
      throw new Error('Failed to reach notebook page after login. Screenshot saved to debug-auth-failed.png');
    }

    console.log('✓ Logged in successfully and reached notebook page');
    await this.page.screenshot({ path: 'debug-logged-in.png' });
  }

  /**
   * Scrape highlights from Kindle notebook
   */
  async scrapeHighlights(): Promise<KindleHighlight[]> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const marketplace = this.credentials.marketplace || 'US';
    const notebookUrl = this.getNotebookUrl(marketplace);

    console.log('Navigating to Kindle highlights page...');
    await this.page.goto(notebookUrl, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000);

    const highlights: KindleHighlight[] = [];

    // Try to find highlights on the page
    // Note: We need to inspect the actual HTML structure of read.amazon.com/kp/notebook
    // This is a placeholder implementation that will need to be updated based on the actual page structure

    try {
      // Wait for highlights to load
      await this.page.waitForSelector('.kp-notebook-annotation, [data-testid="highlight"]', { timeout: 5000 });

      // Get all highlight elements
      const highlightElements = await this.page.$$('.kp-notebook-annotation, [data-testid="highlight"]');

      console.log(`Found ${highlightElements.length} potential highlight elements`);

      for (const element of highlightElements) {
        try {
          const highlightText = await element.textContent();
          if (highlightText && highlightText.trim()) {
            // Extract book info and highlight details
            // This structure will need to be updated based on actual page structure
            const highlight: KindleHighlight = {
              id: `highlight-${Date.now()}-${Math.random()}`,
              bookTitle: 'Unknown', // Extract from page
              bookAuthor: 'Unknown', // Extract from page
              text: highlightText.trim(),
              createdAt: new Date()
            };
            highlights.push(highlight);
          }
        } catch (err) {
          console.warn('Error extracting highlight:', err);
        }
      }
    } catch (error) {
      console.warn('Could not find highlights with default selectors');

      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'debug-highlights-page.png' });
      console.log('Screenshot saved to debug-highlights-page.png for debugging');

      throw new Error('No highlights found on page. Please check if you have any Kindle highlights at read.amazon.com/kp/notebook');
    }

    return highlights;
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Get notebook URL for marketplace
   */
  private getNotebookUrl(marketplace: string): string {
    const urls: Record<string, string> = {
      'US': 'https://read.amazon.com/kp/notebook',
      'UK': 'https://read.amazon.co.uk/kp/notebook',
      'DE': 'https://read.amazon.de/kp/notebook',
      'FR': 'https://read.amazon.fr/kp/notebook',
      'ES': 'https://read.amazon.es/kp/notebook',
      'IT': 'https://read.amazon.it/kp/notebook',
      'JP': 'https://read.amazon.co.jp/kp/notebook',
      'CA': 'https://read.amazon.ca/kp/notebook'
    };
    return urls[marketplace] || urls['US'];
  }
}
