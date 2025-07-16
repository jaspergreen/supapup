/**
 * PageSettleDetector - Robust page settlement detection for Puppeteer
 * 
 * Combines multiple signals to determine when a page has truly settled after an action:
 * - DOM mutations (debounced)
 * - Network activity
 * - Loading indicators
 * - Navigation detection
 * - Dialog handling
 */

import { Page } from 'puppeteer';

export interface SettleOptions {
  domIdleTime?: number;        // Time in ms of DOM inactivity to consider settled (default: 500)
  networkIdleTime?: number;    // Time in ms of network inactivity to consider settled (default: 500)
  globalTimeout?: number;      // Maximum time to wait for settlement (default: 10000)
  waitForSelector?: string;    // Optional selector to wait for
  waitForFunction?: string;    // Optional function to evaluate
  ignoredSelectors?: string[]; // Selectors to ignore for mutations (e.g., ads, clocks)
  ignoredAttributes?: string[]; // Attributes to ignore for mutations
}

export interface SettleResult {
  settled: boolean;
  hasChanges: boolean;
  navigated: boolean;
  dialogHandled: boolean;
  error?: Error;
  changes: {
    domMutations: boolean;
    networkActivity: boolean;
    newElements: number;
    removedElements: number;
    urlChanged: boolean;
    dialogType?: 'alert' | 'confirm' | 'prompt';
  };
  duration: number;
}

export class PageSettleDetector {
  private page: Page;
  private startTime: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Wait for the page to settle after an action
   * Sets up all observers BEFORE the action is executed
   */
  async waitForPageSettle(options: SettleOptions = {}): Promise<SettleResult> {
    const {
      domIdleTime = 500,
      networkIdleTime = 500,
      globalTimeout = 10000,
      waitForSelector,
      waitForFunction,
      ignoredSelectors = [],
      ignoredAttributes = [] // Don't ignore style by default - it's important for visibility changes
    } = options;

    this.startTime = Date.now();
    const originalUrl = await this.page.url();
    
    // Initialize result
    const result: SettleResult = {
      settled: false,
      hasChanges: false,
      navigated: false,
      dialogHandled: false,
      changes: {
        domMutations: false,
        networkActivity: false,
        newElements: 0,
        removedElements: 0,
        urlChanged: false
      },
      duration: 0
    };

    try {
      // Set up dialog handling
      const dialogPromise = this.setupDialogHandling(result);

      // Set up DOM mutation detection with debouncing and filtering
      const domSettlePromise = this.page.evaluate(
        ({ idleTime, ignoredSelectors, ignoredAttributes }) => {
          return new Promise<any>((resolve) => {
            let timeoutId: any;
            let mutationCount = 0;
            let addedElements = 0;
            let removedElements = 0;
            let hasRelevantChanges = false;

            const observer = new MutationObserver((mutations) => {
              // Filter out irrelevant mutations
              const relevantMutations = mutations.filter(mutation => {
                // Ignore mutations on ignored selectors
                if (ignoredSelectors.length > 0) {
                  const target = mutation.target as Element;
                  for (const selector of ignoredSelectors) {
                    if (target.matches && target.matches(selector)) return false;
                    if (target.closest && target.closest(selector)) return false;
                  }
                }

                // Ignore specific attribute changes
                if (mutation.type === 'attributes' && 
                    mutation.attributeName && 
                    ignoredAttributes.includes(mutation.attributeName)) {
                  return false;
                }

                // Count added/removed elements
                if (mutation.type === 'childList') {
                  addedElements += mutation.addedNodes.length;
                  removedElements += mutation.removedNodes.length;
                }

                return true;
              });

              if (relevantMutations.length > 0) {
                hasRelevantChanges = true;
                mutationCount += relevantMutations.length;
                
                // Reset the debounce timer
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                  observer.disconnect();
                  resolve({
                    hasChanges: hasRelevantChanges,
                    mutationCount,
                    addedElements,
                    removedElements
                  });
                }, idleTime);
              }
            });

            // Start observing
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeOldValue: true,
              characterData: true,
              // Optimize: Only watch attributes that affect visibility/interactivity
              attributeFilter: ['style', 'class', 'hidden', 'disabled', 'aria-hidden', 'data-visible', 'data-state']
            });

            // Initial timeout in case no mutations occur
            timeoutId = setTimeout(() => {
              observer.disconnect();
              resolve({
                hasChanges: false,
                mutationCount: 0,
                addedElements: 0,
                removedElements: 0
              });
            }, idleTime);
          });
        },
        { idleTime: domIdleTime, ignoredSelectors, ignoredAttributes }
      );

      // Set up network idle detection
      const networkPromise = this.page.waitForNetworkIdle({
        idleTime: networkIdleTime,
        timeout: globalTimeout
      }).then(() => ({ networkIdle: true }))
        .catch(() => ({ networkIdle: false }));

      // Wait for specific selector if provided
      const selectorPromise = waitForSelector
        ? this.page.waitForSelector(waitForSelector, { timeout: globalTimeout })
            .then(() => ({ selectorFound: true }))
            .catch(() => ({ selectorFound: false }))
        : Promise.resolve({ selectorFound: null });

      // Wait for custom function if provided
      const functionPromise = waitForFunction
        ? this.page.waitForFunction(waitForFunction, { timeout: globalTimeout })
            .then(() => ({ functionPassed: true }))
            .catch(() => ({ functionPassed: false }))
        : Promise.resolve({ functionPassed: null });

      // Wait for loading indicators to disappear
      const loadingPromise = this.waitForLoadingIndicators(Math.min(5000, globalTimeout));

      // Race all promises against global timeout
      const settled = await Promise.race([
        Promise.all([
          domSettlePromise,
          networkPromise,
          selectorPromise,
          functionPromise,
          loadingPromise
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Settlement detection timed out')), globalTimeout)
        )
      ]) as any[];

      // Process results
      const [domResult, networkResult] = settled;
      
      result.changes.domMutations = domResult.hasChanges;
      result.changes.newElements = domResult.addedElements;
      result.changes.removedElements = domResult.removedElements;
      result.changes.networkActivity = !networkResult.networkIdle;
      result.hasChanges = domResult.hasChanges || !networkResult.networkIdle;

      // Check for navigation
      const currentUrl = await this.page.url();
      result.navigated = currentUrl !== originalUrl;
      result.changes.urlChanged = result.navigated;

      // Additional stabilization wait
      await new Promise(resolve => setTimeout(resolve, 100));

      result.settled = true;
      result.duration = Date.now() - this.startTime;

      return result;

    } catch (error) {
      result.error = error as Error;
      result.duration = Date.now() - this.startTime;
      return result;
    }
  }

  /**
   * Wait for common loading indicators to disappear
   */
  private async waitForLoadingIndicators(timeout: number): Promise<{ loadingComplete: boolean }> {
    try {
      await this.page.waitForFunction(
        () => {
          const loadingSelectors = [
            '.loading', '.loader', '.spinner',
            '[data-loading]', '[aria-busy="true"]',
            '.progress', '.placeholder',
            '.skeleton', '.shimmer'
          ];
          
          for (const selector of loadingSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              // Check if element is visible
              const style = window.getComputedStyle(element);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                return false;
              }
            }
          }
          return true;
        },
        { timeout }
      );
      return { loadingComplete: true };
    } catch {
      return { loadingComplete: false };
    }
  }

  /**
   * Set up dialog handling (alert, confirm, prompt)
   */
  private setupDialogHandling(result: SettleResult): Promise<void> {
    return new Promise((resolve) => {
      const dialogHandler = async (dialog: any) => {
        result.dialogHandled = true;
        result.changes.dialogType = dialog.type() as 'alert' | 'confirm' | 'prompt';
        
        // Auto-accept dialogs during settlement detection
        await dialog.accept();
        
        // Remove handler after first dialog
        this.page.off('dialog', dialogHandler);
        resolve();
      };

      this.page.on('dialog', dialogHandler);
      
      // Timeout for dialog handling
      setTimeout(() => {
        this.page.off('dialog', dialogHandler);
        resolve();
      }, 1000);
    });
  }

  /**
   * Utility method to perform action and wait for settlement
   */
  async performActionAndWaitForSettle(
    action: () => Promise<any>,
    options: SettleOptions = {}
  ): Promise<{ actionResult: any; settleResult: SettleResult }> {
    const {
      domIdleTime = 500,
      networkIdleTime = 500,
      globalTimeout = 10000,
      waitForSelector,
      waitForFunction,
      ignoredSelectors = [],
      ignoredAttributes = []
    } = options;

    this.startTime = Date.now();
    const originalUrl = await this.page.url();
    
    // Initialize result
    const result: SettleResult = {
      settled: false,
      hasChanges: false,
      navigated: false,
      dialogHandled: false,
      changes: {
        domMutations: false,
        networkActivity: false,
        newElements: 0,
        removedElements: 0,
        urlChanged: false
      },
      duration: 0
    };

    // First, set up the DOM observer BEFORE the action
    const domObserverPromise = this.page.evaluate(
      ({ idleTime, ignoredSelectors, ignoredAttributes }) => {
        return new Promise<any>((resolve) => {
          let timeoutId: any;
          let mutationCount = 0;
          let addedElements = 0;
          let removedElements = 0;
          let hasRelevantChanges = false;
          let observerSetup = false;

          const observer = new MutationObserver((mutations) => {
            // Filter out irrelevant mutations
            const relevantMutations = mutations.filter(mutation => {
              // Ignore mutations on ignored selectors
              if (ignoredSelectors.length > 0) {
                const target = mutation.target as Element;
                for (const selector of ignoredSelectors) {
                  if (target.matches && target.matches(selector)) return false;
                  if (target.closest && target.closest(selector)) return false;
                }
              }

              // Ignore specific attribute changes
              if (mutation.type === 'attributes' && 
                  mutation.attributeName && 
                  ignoredAttributes.includes(mutation.attributeName)) {
                return false;
              }

              // Count added/removed elements
              if (mutation.type === 'childList') {
                addedElements += mutation.addedNodes.length;
                removedElements += mutation.removedNodes.length;
              }

              return true;
            });

            if (relevantMutations.length > 0) {
              hasRelevantChanges = true;
              mutationCount += relevantMutations.length;
              
              // Reset the debounce timer
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve({
                  hasChanges: hasRelevantChanges,
                  mutationCount,
                  addedElements,
                  removedElements
                });
              }, idleTime);
            }
          });

          // Start observing
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            // Optimize: Only watch attributes that affect visibility/interactivity
            attributeFilter: ['style', 'class', 'hidden', 'disabled', 'aria-hidden', 'data-visible', 'data-state']
          });
          
          observerSetup = true;

          // Initial timeout in case no mutations occur
          timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve({
              hasChanges: false,
              mutationCount: 0,
              addedElements: 0,
              removedElements: 0
            });
          }, idleTime);
          
          // Signal that observer is ready
          (window as any).__observerReady = true;
        });
      },
      { idleTime: domIdleTime, ignoredSelectors, ignoredAttributes }
    );

    // Wait for observer to be set up
    await this.page.waitForFunction(() => (window as any).__observerReady === true, { timeout: 1000 });
    await this.page.evaluate(() => delete (window as any).__observerReady);

    // Now execute the action
    const actionResult = await action();

    // Wait for DOM changes to settle
    const domResult = await domObserverPromise;
    
    // Also check for network activity
    const networkPromise = this.page.waitForNetworkIdle({
      idleTime: networkIdleTime,
      timeout: Math.min(5000, globalTimeout)
    }).then(() => ({ networkIdle: true }))
      .catch(() => ({ networkIdle: false }));

    const networkResult = await networkPromise;

    // Process results
    result.changes.domMutations = domResult.hasChanges;
    result.changes.newElements = domResult.addedElements;
    result.changes.removedElements = domResult.removedElements;
    result.changes.networkActivity = !networkResult.networkIdle;
    result.hasChanges = domResult.hasChanges || !networkResult.networkIdle;

    // Check for navigation
    const currentUrl = await this.page.url();
    result.navigated = currentUrl !== originalUrl;
    result.changes.urlChanged = result.navigated;

    result.settled = true;
    result.duration = Date.now() - this.startTime;

    return { actionResult, settleResult: result };
  }
}