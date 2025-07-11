import { Page, CDPSession, Cookie, CookieParam } from 'puppeteer';

interface StorageData {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  cookies?: Cookie[];
}

export class StorageTools {
  private page: Page | null = null;
  private cdpSession: CDPSession | null = null;

  async initialize(page: Page) {
    this.page = page;
    this.cdpSession = await page.target().createCDPSession();
    
    // Enable necessary domains
    await this.cdpSession.send('DOMStorage.enable');
  }

  // LocalStorage operations
  async getLocalStorage(): Promise<Record<string, string>> {
    if (!this.page) throw new Error('Page not initialized');
    
    const result = await this.page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items[key] = localStorage.getItem(key) || '';
        }
      }
      return items;
    });
    
    return result;
  }

  async setLocalStorage(key: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate((k, v) => {
      localStorage.setItem(k, v);
    }, key, value);
  }

  async removeLocalStorage(key: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate((k) => {
      localStorage.removeItem(k);
    }, key);
  }

  async clearLocalStorage(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate(() => {
      localStorage.clear();
    });
  }

  // SessionStorage operations
  async getSessionStorage(): Promise<Record<string, string>> {
    if (!this.page) throw new Error('Page not initialized');
    
    const result = await this.page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          items[key] = sessionStorage.getItem(key) || '';
        }
      }
      return items;
    });
    
    return result;
  }

  async setSessionStorage(key: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate((k, v) => {
      sessionStorage.setItem(k, v);
    }, key, value);
  }

  async removeSessionStorage(key: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate((k) => {
      sessionStorage.removeItem(k);
    }, key);
  }

  async clearSessionStorage(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.evaluate(() => {
      sessionStorage.clear();
    });
  }

  // Cookie operations
  async getCookies(): Promise<Cookie[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    const cookies = await this.page.cookies();
    return cookies;
  }

  async setCookie(cookie: CookieParam): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.setCookie(cookie);
  }

  async deleteCookie(name: string, url?: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    const cookies = await this.page.cookies(...(url ? [url] : []));
    const cookieToDelete = cookies.find(c => c.name === name);
    
    if (cookieToDelete) {
      await this.page.deleteCookie(cookieToDelete);
    }
  }

  async clearCookies(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Get all cookies and delete them one by one
    const cookies = await this.page.cookies();
    for (const cookie of cookies) {
      await this.page.deleteCookie(cookie);
    }
  }

  // Clear all storage data
  async clearAllStorage(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Clear localStorage and sessionStorage
    await this.clearLocalStorage();
    await this.clearSessionStorage();
    
    // Clear cookies
    await this.clearCookies();
  }

  // Export/Import storage state
  async exportStorageState(): Promise<StorageData> {
    if (!this.page) throw new Error('Page not initialized');
    
    const localStorage = await this.getLocalStorage();
    const sessionStorage = await this.getSessionStorage();
    const cookies = await this.getCookies();
    
    return {
      localStorage,
      sessionStorage,
      cookies
    };
  }

  async importStorageState(data: StorageData): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Import localStorage
    if (data.localStorage) {
      await this.clearLocalStorage();
      for (const [key, value] of Object.entries(data.localStorage)) {
        await this.setLocalStorage(key, value);
      }
    }
    
    // Import sessionStorage
    if (data.sessionStorage) {
      await this.clearSessionStorage();
      for (const [key, value] of Object.entries(data.sessionStorage)) {
        await this.setSessionStorage(key, value);
      }
    }
    
    // Import cookies
    if (data.cookies) {
      await this.clearCookies();
      for (const cookie of data.cookies) {
        await this.setCookie(cookie);
      }
    }
  }

  // Storage size and quota
  async getStorageInfo(): Promise<{ usage: number; quota: number }> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Use navigator.storage.estimate() which is more widely supported
    const result = await this.page.evaluate(async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      }
      // Fallback for browsers that don't support storage.estimate()
      return {
        usage: 0,
        quota: 0
      };
    });
    
    return result;
  }

  // Helper to format storage data nicely
  formatStorageData(data: StorageData): string {
    let output = '📦 Storage State\n';
    output += '================\n\n';
    
    if (data.localStorage && Object.keys(data.localStorage).length > 0) {
      output += '📂 LocalStorage:\n';
      for (const [key, value] of Object.entries(data.localStorage)) {
        output += `  • ${key}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}\n`;
      }
      output += '\n';
    }
    
    if (data.sessionStorage && Object.keys(data.sessionStorage).length > 0) {
      output += '📋 SessionStorage:\n';
      for (const [key, value] of Object.entries(data.sessionStorage)) {
        output += `  • ${key}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}\n`;
      }
      output += '\n';
    }
    
    if (data.cookies && data.cookies.length > 0) {
      output += '🍪 Cookies:\n';
      for (const cookie of data.cookies) {
        output += `  • ${cookie.name}: ${cookie.value.length > 30 ? cookie.value.substring(0, 30) + '...' : cookie.value} (${cookie.domain})\n`;
      }
    }
    
    return output;
  }

  // Cleanup
  async cleanup() {
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch (err) {
        // Ignore detach errors
      }
    }
    this.page = null;
    this.cdpSession = null;
  }
}