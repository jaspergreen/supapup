/**
 * DOM change monitoring for dynamic page updates
 */

export class DOMMonitor {
  /**
   * Wait for DOM changes after an action and return new agent page
   */
  static async waitForChangesAndRemap(page: any, options: {
    timeout?: number;
    waitForSelector?: string;
    waitForXPath?: string;
    waitForFunction?: string;
    debounceMs?: number;
  } = {}) {
    const { 
      timeout = 5000, 
      debounceMs = 500,
      waitForSelector,
      waitForXPath,
      waitForFunction
    } = options;

    try {
      // Method 1: Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
      }
      // Method 2: Wait for XPath if provided
      else if (waitForXPath) {
        await page.waitForXPath(waitForXPath, { timeout });
      }
      // Method 3: Wait for custom function if provided
      else if (waitForFunction) {
        await page.waitForFunction(waitForFunction, { timeout });
      }
      // Method 4: Smart DOM change detection with proper cleanup
      else {
        // Create an abort controller for cleanup
        const abortController = new AbortController();
        const cleanup = () => abortController.abort();
        
        try {
          // Wait for any of these common AJAX indicators
          const result = await Promise.race([
            // Network idle (no requests for 500ms) - wrapped with cleanup
            new Promise((resolve) => {
              if (abortController.signal.aborted) {
                resolve(false);
                return;
              }
              
              const navPromise = page.waitForNavigation({ waitUntil: 'networkidle0', timeout })
                .then(() => {
                  if (!abortController.signal.aborted) {
                    cleanup();
                    resolve(true);
                  }
                })
                .catch(() => {
                  if (!abortController.signal.aborted) {
                    resolve(false);
                  }
                });
              
              // Listen for abort signal
              abortController.signal.addEventListener('abort', () => {
                // Cancel the navigation wait if possible
                resolve(false);
              });
            }),
            
            // DOM mutations have settled
            page.evaluate((debounce: number) => {
              return new Promise((resolve) => {
                let timeoutId: NodeJS.Timeout;
                const observer = new MutationObserver(() => {
                  clearTimeout(timeoutId);
                  timeoutId = setTimeout(() => {
                    observer.disconnect();
                    resolve(true);
                  }, debounce);
                });
                
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  characterData: true
                });
                
                // Fallback timeout
                setTimeout(() => {
                  observer.disconnect();
                  resolve(true);
                }, 5000);
              });
            }, debounceMs).then((result: any) => {
              cleanup();
              return result;
            }),
            
            // Common loading indicators disappear - wrapped with cleanup
            new Promise((resolve) => {
              if (abortController.signal.aborted) {
                resolve(false);
                return;
              }
              
              const funcPromise = page.waitForFunction(() => {
                const loadingSelectors = [
                  '.loading', '.spinner', '.loader', 
                  '[data-loading]', '[aria-busy="true"]',
                  '.progress', '.placeholder'
                ];
                
                for (const selector of loadingSelectors) {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) return false;
                }
                return true;
              }, { timeout })
                .then(() => {
                  if (!abortController.signal.aborted) {
                    cleanup();
                    resolve(true);
                  }
                })
                .catch(() => {
                  if (!abortController.signal.aborted) {
                    resolve(false);
                  }
                });
              
              // Listen for abort signal
              abortController.signal.addEventListener('abort', () => {
                // Cancel the wait if possible
                resolve(false);
              });
            }),
          ]);
          
          // Ensure cleanup happens
          cleanup();
          return result;
        } catch (error) {
          cleanup();
          throw error;
        }
      }

      // Additional stabilization wait
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return true;
    } catch (error) {
      // console.error('[DOMMonitor] Timeout waiting for changes:', (error as Error).message);
      return false;
    }
  }

  /**
   * Monitor for specific types of changes
   */
  static async waitForContentChange(page: any, options: {
    selector: string;
    property?: 'text' | 'html' | 'value';
    timeout?: number;
  }) {
    const { selector, property = 'text', timeout = 5000 } = options;
    
    // Get initial content
    const initialContent = await page.evaluate((sel: string, prop: string) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      
      switch (prop) {
        case 'text': return element.textContent;
        case 'html': return element.innerHTML;
        case 'value': return (element as any).value;
        default: return element.textContent;
      }
    }, selector, property);
    
    // Wait for content to change
    await page.waitForFunction(
      (sel: string, prop: string, initial: string | null) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        let current;
        switch (prop) {
          case 'text': current = element.textContent; break;
          case 'html': current = element.innerHTML; break;
          case 'value': current = (element as any).value; break;
          default: current = element.textContent;
        }
        
        return current !== initial;
      },
      { timeout },
      selector,
      property,
      initialContent
    );
  }

  /**
   * Wait for new elements matching a pattern
   */
  static async waitForNewElements(page: any, options: {
    selector: string;
    minCount?: number;
    timeout?: number;
  }) {
    const { selector, minCount = 1, timeout = 5000 } = options;
    
    // Get initial count
    const initialCount = await page.evaluate((sel: string) => {
      return document.querySelectorAll(sel).length;
    }, selector);
    
    // Wait for new elements
    await page.waitForFunction(
      (sel: string, initial: number, min: number) => {
        const current = document.querySelectorAll(sel).length;
        return current >= initial + min;
      },
      { timeout },
      selector,
      initialCount,
      minCount
    );
  }
}