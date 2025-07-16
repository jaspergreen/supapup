import { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentElement {
  id: string;
  type: string;
  action: string;
  text: string;
  label: string;
  tagName: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  checked?: boolean;
  value?: string;
}

export interface AgentPageResult {
  content: string;
  elements: AgentElement[];
  actions: string[];
  title: string;
  url: string;
}

/**
 * DevTools Agent Page Generator
 * 
 * This class generates agent-friendly page representations using Chrome DevTools Protocol.
 * It creates a unified text representation that matches what humans see, with proper
 * form detection and bulk form fill capabilities.
 */
export class DevToolsAgentPageGenerator {
  private page: Page;
  private cdpSession: any = null;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Generate agent page with form detection
   */
  async generateAgentPage(): Promise<AgentPageResult> {
    try {
      // Setup CDP session if not already available
      await this.setupCDP();
      
      // Generate the unified representation in browser context
      const result = await this.page.evaluate(() => {
        const generator = (window as any).__DEVTOOLS_AGENT_GENERATOR__;
        if (!generator) {
          throw new Error('DevTools agent generator not available - script injection failed');
        }
        return generator.generate();
      });
      
      return result;
    } catch (error: any) {
      console.error('DevTools agent page generation failed:', error);
      throw new Error(`Agent page generation failed: ${error.message}`);
    }
  }

  /**
   * Setup Chrome DevTools Protocol session
   */
  private async setupCDP(): Promise<void> {
    try {
      // Create CDP session if not exists
      if (!this.cdpSession) {
        this.cdpSession = await this.page.target().createCDPSession();
      }
      
      // Enable required domains
      await this.cdpSession.send('Runtime.enable');
      await this.cdpSession.send('DOM.enable');
      await this.cdpSession.send('CSS.enable');
      
      // Inject the generator script into browser context
      const script = this.getGeneratorScript();
      console.log('🔧 Injecting DevTools agent generator script...');
      await this.page.evaluateOnNewDocument(script);
      
      try {
        await this.page.evaluate(script);
      } catch (scriptError) {
        console.error('❌ Script evaluation failed:', scriptError);
        throw new Error(`Script evaluation failed: ${scriptError}`);
      }
      
      // Verify the script was injected successfully
      const windowProps = await this.page.evaluate(() => {
        return {
          hasGenerator: typeof (window as any).__DEVTOOLS_AGENT_GENERATOR__ !== 'undefined',
          hasAgentPage: typeof (window as any).__AGENT_PAGE__ !== 'undefined'
        };
      });
      
      if (!windowProps.hasGenerator || !windowProps.hasAgentPage) {
        throw new Error(`Script injection verification failed. Window properties: ${JSON.stringify(windowProps)}`);
      }
      
      console.log('✅ DevTools agent generator injected successfully');
    } catch (error) {
      console.error('❌ CDP setup failed:', error);
      throw new Error(`CDP setup failed: ${error}`);
    }
  }

  /**
   * Load the external script file for better maintainability
   */
  private getGeneratorScript(): string {
    try {
      const scriptPath = path.join(__dirname, 'devtools-agent-page-script.js');
      return fs.readFileSync(scriptPath, 'utf8');
    } catch (error) {
      console.error('Failed to load agent page script:', error);
      // Fallback to a minimal script
      return `
        console.log('DevTools agent generator script failed to load');
        (window as any).__DEVTOOLS_AGENT_GENERATOR__ = {
          generate() {
            return {
              content: 'Error: Agent page script failed to load',
              elements: [],
              actions: [],
              title: document.title,
              url: window.location.href
            };
          }
        };
      `;
    }
  }

  /**
   * Cleanup CDP session
   */
  async cleanup(): Promise<void> {
    try {
      if (this.cdpSession) {
        await this.cdpSession.detach();
        this.cdpSession = null;
      }
    } catch (error) {
      console.error('CDP cleanup error:', error);
    }
  }
}