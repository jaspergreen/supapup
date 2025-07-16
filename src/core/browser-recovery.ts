import { Browser, Page } from 'puppeteer';

export interface BrowserState {
  browser: Browser | null;
  page: Page | null;
  isHealthy: boolean;
  lastError?: string;
  crashCount: number;
  lastCrashTime?: Date;
}

export class BrowserRecovery {
  private state: BrowserState = {
    browser: null,
    page: null,
    isHealthy: true,
    crashCount: 0
  };

  constructor() {}

  async checkBrowserHealth(browser: Browser | null, page: Page | null): Promise<boolean> {
    if (!browser || !page) {
      return false;
    }

    try {
      // Quick health check - try to get the URL
      await page.evaluate(() => window.location.href);
      return true;
    } catch (error) {
      // Browser is likely crashed or in bad state
      return false;
    }
  }

  async cleanupCrashedBrowser(browser: Browser | null): Promise<void> {
    if (!browser) return;

    try {
      // Try to close gracefully first
      await browser.close();
    } catch (error) {
      // Force kill if graceful close fails
      try {
        const pages = await browser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (e) {
            // Ignore individual page close errors
          }
        }
      } catch (e) {
        // Even getting pages might fail
      }

      // Last resort - disconnect
      try {
        browser.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }

  recordCrash(error: string): void {
    this.state.crashCount++;
    this.state.lastError = error;
    this.state.lastCrashTime = new Date();
    this.state.isHealthy = false;
  }

  resetState(): void {
    this.state.browser = null;
    this.state.page = null;
    this.state.isHealthy = true;
  }

  getCrashInfo(): { crashCount: number; lastError?: string; lastCrashTime?: Date } {
    return {
      crashCount: this.state.crashCount,
      lastError: this.state.lastError,
      lastCrashTime: this.state.lastCrashTime
    };
  }

  shouldThrottle(): boolean {
    // If more than 3 crashes in 5 minutes, suggest throttling
    if (this.state.crashCount > 3 && this.state.lastCrashTime) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return this.state.lastCrashTime > fiveMinutesAgo;
    }
    return false;
  }
}