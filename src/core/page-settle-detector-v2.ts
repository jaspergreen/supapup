/**
 * PageSettleDetector V2 - Honest about what we can and cannot detect
 * 
 * What we CAN reliably detect:
 * - DOM mutations (additions, removals, attribute changes)
 * - Network activity
 * - Navigation events
 * - Specific element appearance/disappearance
 * 
 * What we CANNOT reliably detect without heuristics:
 * - When all JavaScript execution is "done"
 * - When all animations are complete
 * - When all async operations are finished
 * 
 * Our approach:
 * 1. Use MutationObserver for DOM changes (reliable)
 * 2. Use network idle detection (reliable)
 * 3. Use debouncing to wait for mutation "settling" (heuristic)
 * 4. Provide options for specific expectations (most reliable)
 */

import { Page } from 'puppeteer';

export interface SettleExpectations {
  // Specific expectations (most reliable)
  elementToAppear?: string;        // CSS selector
  elementToDisappear?: string;     // CSS selector
  textToAppear?: string;           // Text content
  urlPattern?: RegExp;             // Expected URL pattern
  
  // Heuristic-based (less reliable but more flexible)
  waitForDOMQuiet?: boolean;       // Wait for DOM mutations to stop
  domQuietTime?: number;           // How long DOM should be quiet (ms)
  waitForNetworkIdle?: boolean;    // Wait for network to be idle
  networkIdleTime?: number;        // How long network should be idle (ms)
  
  // Timeouts
  timeout?: number;                // Global timeout
}

export interface SettleResultV2 {
  // What actually happened
  expectations: {
    elementAppeared?: boolean;
    elementDisappeared?: boolean;
    textAppeared?: boolean;
    urlMatched?: boolean;
    domQuiet?: boolean;
    networkIdle?: boolean;
  };
  
  // Detected changes
  mutations: {
    total: number;
    additions: number;
    removals: number;
    attributes: number;
  };
  
  // Timing
  duration: number;
  timedOut: boolean;
}

export class PageSettleDetectorV2 {
  constructor(private page: Page) {}
  
  /**
   * Wait for page to settle based on specific expectations
   * This is the most reliable approach - tell us what you expect!
   */
  async waitForExpectedChanges(
    expectations: SettleExpectations
  ): Promise<SettleResultV2> {
    const startTime = Date.now();
    const timeout = expectations.timeout || 10000;
    
    const result: SettleResultV2 = {
      expectations: {},
      mutations: { total: 0, additions: 0, removals: 0, attributes: 0 },
      duration: 0,
      timedOut: false
    };
    
    const promises: Promise<any>[] = [];
    
    // 1. Specific element expectations (MOST RELIABLE)
    if (expectations.elementToAppear) {
      promises.push(
        this.page.waitForSelector(expectations.elementToAppear, { 
          visible: true, 
          timeout 
        })
        .then(() => { result.expectations.elementAppeared = true; })
        .catch(() => { result.expectations.elementAppeared = false; })
      );
    }
    
    if (expectations.elementToDisappear) {
      promises.push(
        this.page.waitForSelector(expectations.elementToDisappear, { 
          hidden: true, 
          timeout 
        })
        .then(() => { result.expectations.elementDisappeared = true; })
        .catch(() => { result.expectations.elementDisappeared = false; })
      );
    }
    
    if (expectations.textToAppear) {
      promises.push(
        this.page.waitForFunction(
          (text) => document.body.textContent?.includes(text),
          { timeout },
          expectations.textToAppear
        )
        .then(() => { result.expectations.textAppeared = true; })
        .catch(() => { result.expectations.textAppeared = false; })
      );
    }
    
    // 2. DOM quiet detection (HEURISTIC)
    if (expectations.waitForDOMQuiet !== false) {
      const quietTime = expectations.domQuietTime || 500;
      
      promises.push(
        this.page.evaluate((quietTime) => {
          return new Promise<any>((resolve) => {
            let timeoutId: any;
            let mutationCount = 0;
            let additions = 0;
            let removals = 0;
            let attributes = 0;
            
            const observer = new MutationObserver((mutations) => {
              mutations.forEach(m => {
                mutationCount++;
                if (m.type === 'childList') {
                  additions += m.addedNodes.length;
                  removals += m.removedNodes.length;
                } else if (m.type === 'attributes') {
                  attributes++;
                }
              });
              
              // Reset quiet timer
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve({
                  quiet: true,
                  total: mutationCount,
                  additions,
                  removals,
                  attributes
                });
              }, quietTime);
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true
            });
            
            // If no mutations occur
            timeoutId = setTimeout(() => {
              observer.disconnect();
              resolve({
                quiet: true,
                total: 0,
                additions: 0,
                removals: 0,
                attributes: 0
              });
            }, quietTime);
          });
        }, quietTime)
        .then((mutationResult: any) => {
          result.expectations.domQuiet = mutationResult.quiet;
          result.mutations = mutationResult;
        })
      );
    }
    
    // 3. Network idle detection
    if (expectations.waitForNetworkIdle !== false) {
      promises.push(
        this.page.waitForNetworkIdle({
          idleTime: expectations.networkIdleTime || 500,
          timeout: timeout
        })
        .then(() => { result.expectations.networkIdle = true; })
        .catch(() => { result.expectations.networkIdle = false; })
      );
    }
    
    // Wait for all expectations
    try {
      await Promise.race([
        Promise.all(promises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
    } catch (e) {
      result.timedOut = true;
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }
  
  /**
   * Perform action and wait for expected changes
   * This encourages users to specify what they expect
   */
  async performActionAndWaitFor(
    action: () => Promise<any>,
    expectations: SettleExpectations
  ): Promise<{ actionResult: any; settleResult: SettleResultV2 }> {
    // Execute the action
    const actionResult = await action();
    
    // Wait for expected changes
    const settleResult = await this.waitForExpectedChanges(expectations);
    
    return { actionResult, settleResult };
  }
  
  /**
   * Legacy method that uses heuristics (less reliable)
   */
  async performActionAndGuessSettlement(
    action: () => Promise<any>,
    options: {
      domQuietTime?: number;
      networkIdleTime?: number;
      timeout?: number;
    } = {}
  ): Promise<{ actionResult: any; settleResult: SettleResultV2 }> {
    console.warn('⚠️ Using heuristic-based settlement detection. Consider using performActionAndWaitFor() with specific expectations instead.');
    
    return this.performActionAndWaitFor(action, {
      waitForDOMQuiet: true,
      domQuietTime: options.domQuietTime || 500,
      waitForNetworkIdle: true,
      networkIdleTime: options.networkIdleTime || 500,
      timeout: options.timeout || 10000
    });
  }
}