/**
 * Navigation and redirect monitoring
 */

export class NavigationMonitor {
  /**
   * Check if a navigation/redirect occurred
   */
  static async checkForNavigation(page: any, originalUrl: string): Promise<{
    navigated: boolean;
    newUrl?: string;
    isRedirect?: boolean;
    isCaptcha?: boolean;
  }> {
    const currentUrl = page.url();
    const navigated = currentUrl !== originalUrl;
    
    if (!navigated) {
      return { navigated: false };
    }
    
    // Check for common captcha/sorry pages
    const pageContent = await page.content();
    const title = await page.title();
    
    const captchaIndicators = [
      'sorry/index',
      'recaptcha',
      'captcha',
      'unusual traffic',
      'automated requests',
      'not a robot',
      'verify you\'re human'
    ];
    
    const isCaptcha = captchaIndicators.some(indicator => 
      currentUrl.toLowerCase().includes(indicator) ||
      pageContent.toLowerCase().includes(indicator) ||
      title.toLowerCase().includes(indicator)
    );
    
    return {
      navigated: true,
      newUrl: currentUrl,
      isRedirect: true,
      isCaptcha
    };
  }

  /**
   * Wait for navigation with timeout
   */
  static async waitForPossibleNavigation(page: any, action: () => Promise<any>, options: {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  } = {}) {
    const { timeout = 5000, waitUntil = 'domcontentloaded' } = options;
    
    try {
      // Execute action and wait for navigation in parallel
      const [actionResult, navigationResult] = await Promise.all([
        action(),
        page.waitForNavigation({ timeout, waitUntil }).catch(() => null)
      ]);
      
      return {
        actionResult,
        navigated: !!navigationResult
      };
    } catch (error) {
      return {
        actionResult: null,
        navigated: false,
        error
      };
    }
  }
}