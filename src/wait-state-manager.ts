/**
 * Singleton manager for wait states to prevent event listener accumulation
 * Ensures only one active wait state exists at a time
 */

import { Page } from 'puppeteer';

export class WaitStateManager {
  private static instance: WaitStateManager;
  private activeListeners: Map<string, Function> = new Map();
  private activeMutationObserver: any = null;
  private activeTimeouts: Set<NodeJS.Timeout> = new Set();
  private isWaiting: boolean = false;

  private constructor() {}

  static getInstance(): WaitStateManager {
    if (!WaitStateManager.instance) {
      WaitStateManager.instance = new WaitStateManager();
    }
    return WaitStateManager.instance;
  }

  /**
   * Clean up all active listeners and observers
   */
  async cleanup(page: Page): Promise<void> {
    // console.log('[WaitStateManager] Cleaning up active listeners...');
    
    // Remove all page event listeners
    for (const [event, handler] of this.activeListeners) {
      page.off(event as any, handler as any);
    }
    this.activeListeners.clear();

    // Disconnect mutation observer if active
    if (this.activeMutationObserver) {
      try {
        await page.evaluate(() => {
          const observer = (window as any).__MUTATION_OBSERVER__;
          if (observer) {
            observer.disconnect();
            delete (window as any).__MUTATION_OBSERVER__;
            delete (window as any).__MUTATION_DETECTED__;
          }
        });
      } catch (e) {
        // Page might have navigated, ignore
      }
      this.activeMutationObserver = null;
    }

    // Clear all timeouts
    for (const timeout of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();

    this.isWaiting = false;
  }

  /**
   * Add a page event listener with tracking
   */
  addPageListener(page: Page, event: string, handler: Function): void {
    // Clean up any existing listener for this event
    const existingHandler = this.activeListeners.get(event);
    if (existingHandler) {
      page.off(event as any, existingHandler as any);
    }

    // Add new listener
    page.on(event as any, handler as any);
    this.activeListeners.set(event, handler);
  }

  /**
   * Setup mutation observer with cleanup
   */
  async setupMutationObserver(page: Page): Promise<void> {
    // Clean up any existing observer first
    if (this.activeMutationObserver) {
      await this.cleanup(page);
    }

    await page.evaluate(() => {
      (window as any).__MUTATION_DETECTED__ = false;
      const observer = new MutationObserver(() => {
        (window as any).__MUTATION_DETECTED__ = true;
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      (window as any).__MUTATION_OBSERVER__ = observer;
    });

    this.activeMutationObserver = true;
  }

  /**
   * Add a timeout with tracking
   */
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.activeTimeouts.delete(timeout);
      callback();
    }, ms);
    this.activeTimeouts.add(timeout);
    return timeout;
  }

  /**
   * Execute an action with wait state management
   */
  async executeWithWaitState<T>(
    page: Page,
    action: () => Promise<T>,
    options: {
      waitForChanges?: boolean;
      timeout?: number;
    } = {}
  ): Promise<T> {
    // Clean up any previous wait state
    await this.cleanup(page);

    if (this.isWaiting) {
      // console.warn('[WaitStateManager] Already waiting, cleaning up previous state...');
      await this.cleanup(page);
    }

    this.isWaiting = true;

    try {
      const result = await action();
      return result;
    } finally {
      // Always cleanup after action completes
      await this.cleanup(page);
    }
  }

  /**
   * Check if currently in a wait state
   */
  isInWaitState(): boolean {
    return this.isWaiting;
  }

  /**
   * Get count of active listeners
   */
  getActiveListenerCount(): number {
    return this.activeListeners.size + this.activeTimeouts.size + (this.activeMutationObserver ? 1 : 0);
  }
}