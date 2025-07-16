#!/usr/bin/env node

/**
 * CLI interface for Supapup - run MCP tools directly from command line
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { DevToolsAgentPageGenerator } from './../generators/devtools-agent-page-generator.js';
import { NavigationMonitor } from './../monitors/navigation-monitor.js';
import { PageSettleDetector } from './page-settle-detector.js';
import * as fs from 'fs';

class SupapupCLI {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async run(args: string[]) {
    const command = args[0];
    
    try {
      // Special server mode - keeps running for multiple commands
      if (command === 'server') {
        console.log('Starting Supapup in server mode. Commands:');
        console.log('  navigate <url>');
        console.log('  execute <actionId> [value]');
        console.log('  remap');
        console.log('  exit\n');
        
        await this.serverMode();
        return;
      }
      
      switch (command) {
        case 'navigate':
          await this.navigate(args[1]);
          break;
        
        case 'execute':
        case 'action':
          await this.executeAction(args[1], args[2]);
          break;
        
        case 'remap':
          await this.remapPage();
          break;
          
        case 'screenshot':
          await this.screenshot(args[1] || 'screenshot.png');
          break;
          
        case 'close':
          await this.close();
          break;
          
        default:
          console.log(`
Supapup CLI - Direct command line interface

Usage:
  supapup navigate <url>              Navigate to URL and generate agent page
  supapup execute <actionId> [value]  Execute an action on current page
  supapup remap                       Re-map current page after changes
  supapup screenshot [filename]       Take a screenshot
  supapup close                       Close browser

Examples:
  supapup navigate https://google.com
  supapup execute form-q-textarea "search query"
  supapup execute form-btnk-submit
  supapup remap
`);
      }
    } catch (error) {
      // console.error('Error:', error);
    }
  }

  private async ensureBrowser() {
    if (!this.browser) {
      try {
        // Try to connect to existing browser first
        console.log('Connecting to existing browser...');
        this.browser = await puppeteer.connect({
          browserURL: 'http://127.0.0.1:9222'
        });
        
        const pages = await this.browser.pages();
        this.page = pages.find(p => p.url() !== 'about:blank') || pages[0];
        
        if (this.page) {
          console.log(`Connected to: ${this.page.url()}`);
        }
      } catch (e) {
        // Launch new browser if connection fails
        console.log('Launching new browser...');
        this.browser = await puppeteer.launch({
          headless: false,
          args: ['--remote-debugging-port=9222']
        });
        
        const pages = await this.browser.pages();
        this.page = pages[0] || await this.browser.newPage();
      }
    }
  }

  private async navigate(url: string) {
    await this.ensureBrowser();
    
    console.log(`Navigating to ${url}...`);
    await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Use the new DevToolsAgentPageGenerator
    const generator = new DevToolsAgentPageGenerator(this.page!);
    const result = await generator.generateAgentPage();
    
    console.log(`\nFound ${result.elements.length} elements\n`);
    
    // Display the agent page
    console.log(result.content);
    
    // Note: Interaction handler already injected by DevToolsAgentPageGenerator
    
    console.log('\n✅ Page ready for interaction');
  }

  private async executeAction(actionId: string, value?: string) {
    await this.ensureBrowser();
    
    if (!this.page || this.page.url() === 'about:blank') {
      // console.error('No page loaded. Run navigate first.');
      return;
    }
    
    const originalUrl = this.page.url();
    console.log(`Executing action: ${actionId}${value ? ` with value "${value}"` : ''}...`);
    
    // Check if agent page is initialized
    const hasAgentPage = await this.page.evaluate(() => {
      return !!(window as any).__AGENT_PAGE__;
    });
    
    if (!hasAgentPage) {
      console.log('Agent page not initialized, setting up...');
      await this.remapPage();
    }
    
    // Execute the action
    const result = await this.page.evaluate((id: string, val?: string) => {
      const agentPage = (window as any).__AGENT_PAGE__;
      if (!agentPage?.execute) {
        throw new Error('Agent page not initialized');
      }
      return agentPage.execute(id, val ? { value: val } : {});
    }, actionId, value);
    
    console.log('Action result:', result);
    
    // Check if this action might cause changes
    const shouldWait = actionId.includes('submit') || 
                      actionId.includes('search') || 
                      actionId.includes('button');
    
    if (shouldWait) {
      console.log('Waiting for page changes...');
      
      // Wait a bit for any navigation/changes to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check for navigation
      const navCheck = await NavigationMonitor.checkForNavigation(this.page, originalUrl);
      
      if (navCheck.navigated) {
        console.log(`\n⚠️ Navigation detected to: ${navCheck.newUrl}`);
        
        if (navCheck.isCaptcha) {
          console.log('This appears to be a CAPTCHA/verification page');
          return;
        }
        
        // Re-inject and remap for new page
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.remapPage();
      } else {
        // Wait for DOM changes using PageSettleDetector
        const detector = new PageSettleDetector(this.page);
        const settleResult = await detector.waitForPageSettle({
          domIdleTime: 500,
          networkIdleTime: 500,
          globalTimeout: 3000
        });
        
        if (settleResult.hasChanges || settleResult.navigated) {
          console.log('DOM changes detected, remapping...');
          await this.remapPage();
        }
      }
    }
  }

  private async remapPage() {
    if (!this.page) {
      // console.error('No page loaded.');
      return;
    }
    
    console.log('Remapping page...');
    
    // Use the new DevToolsAgentPageGenerator for remapping
    const generator = new DevToolsAgentPageGenerator(this.page);
    const result = await generator.generateAgentPage();
    
    console.log(`\nFound ${result.elements.length} elements\n`);
    
    // Display updated agent page
    console.log(result.content);
  }

  private async screenshot(filename: string) {
    if (!this.page) {
      // console.error('No page loaded.');
      return;
    }
    
    await this.page.screenshot({ path: filename as `${string}.png`, fullPage: false });
    console.log(`Screenshot saved to ${filename}`);
  }

  private async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  private async serverMode() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'supapup> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const parts = line.trim().split(' ');
      const cmd = parts[0];
      
      if (cmd === 'exit' || cmd === 'quit') {
        await this.close();
        rl.close();
        return;
      }
      
      try {
        await this.run(parts);
      } catch (error) {
        // console.error('Error:', error);
      }
      
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }
}

// Run CLI
const cli = new SupapupCLI();
cli.run(process.argv.slice(2)).then(() => {
  // Exit after command completes (browser stays open)
  process.exit(0);
}).catch(error => {
  // console.error('Fatal error:', error);
  process.exit(1);
});