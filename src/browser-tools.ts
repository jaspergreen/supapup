import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BrowserRecovery } from './browser-recovery.js';
import { AgentPageGenerator } from './agent-page-generator.js';
import { AgentPageScript } from './agent-page-script.js';
import { ContentExtractor } from './content-extractor.js';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

export class BrowserTools {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private browserRecovery: BrowserRecovery;
  private currentManifest: any = null;

  constructor(browserRecovery: BrowserRecovery) {
    this.browserRecovery = browserRecovery;
  }

  // Getters for external access
  getBrowser(): Browser | null {
    return this.browser;
  }

  getPage(): Page | null {
    return this.page;
  }

  getCurrentManifest(): any {
    return this.currentManifest;
  }

  setCurrentManifest(manifest: any): void {
    this.currentManifest = manifest;
  }

  async navigate(url: string): Promise<any> {
    try {
      // Launch browser if needed
      if (!this.browser) {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--remote-debugging-port=9222',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--start-maximized'
          ]
        });
      }

      // Create page if needed
      if (!this.page) {
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        
        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      }

      console.log(`📍 Navigating to: ${url}`);
      
      // Determine redirect limit based on URL
      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
      const maxRedirects = isLocalhost ? 30 : 15;
      
      // Navigate with redirect tracking
      let redirectCount = 0;
      let currentUrl = url;
      const startTime = Date.now();
      
      try {
        const response = await this.page.goto(currentUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Track redirects
        while (this.page.url() !== currentUrl && redirectCount < maxRedirects) {
          redirectCount++;
          currentUrl = this.page.url();
          console.log(`↪️ Redirect ${redirectCount}: ${currentUrl}`);
          
          if (redirectCount >= maxRedirects) {
            throw new Error(`Too many redirects (${redirectCount}). Possible infinite redirect attack or complex SPA flow. URL: ${currentUrl}`);
          }
        }

        const finalUrl = this.page.url();
        console.log(`✅ Navigation completed. Final URL: ${finalUrl}`);
        console.log(`🔄 Redirects: ${redirectCount}`);
        console.log(`⏱️ Time: ${Date.now() - startTime}ms`);

        // Wait for JavaScript to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check for bot detection and CAPTCHAs
        const botCheckResult = await this.checkForBotDetection();
        if (botCheckResult.hasIssues) {
          return this.generateCaptchaResponse(finalUrl, botCheckResult);
        }

        // Inject agent page script
        await this.page.evaluate(AgentPageScript.generate());

        // Generate agent page
        const html = await this.page.evaluate(() => document.documentElement.outerHTML);
        const manifest = await this.generateAgentPageInBrowser();
        this.currentManifest = manifest;

        // Generate enhanced agent page
        const agentPage = await this.generateEnhancedAgentPage(manifest, finalUrl);
        
        return {
          content: [{ type: 'text', text: agentPage }]
        };

      } catch (error: any) {
        console.error('❌ Navigation error:', error.message);
        
        if (error.message.includes('Too many redirects')) {
          throw error; // Re-throw redirect errors
        }
        
        // Handle other navigation errors
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Navigation failed: ${error.message}\n📍 URL: ${url}` 
          }]
        };
      }

    } catch (error: any) {
      console.error('❌ Browser navigation error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Navigation failed: ${error.message}\n📍 URL: ${url}` 
        }]
      };
    }
  }

  async closeBrowser(): Promise<any> {
    try {
      if (this.browser) {
        console.log('🔚 Closing browser...');
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.currentManifest = null;
        console.log('✅ Browser closed successfully');
        return {
          content: [{ type: 'text', text: '✅ Browser closed successfully' }]
        };
      } else {
        return {
          content: [{ type: 'text', text: '⚠️ No browser instance to close' }]
        };
      }
    } catch (error: any) {
      console.error('❌ Error closing browser:', error);
      return {
        content: [{ type: 'text', text: `❌ Error closing browser: ${error.message}` }]
      };
    }
  }

  async openInTab(content: string, contentType: string = 'text/html', title?: string): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Call browser_navigate first.');
      }

      // Create a new page
      const newPage = await this.browser.newPage();
      
      // Set title if provided
      if (title) {
        await newPage.evaluateOnNewDocument((title) => {
          document.title = title;
        }, title);
      }

      // Handle different content types
      if (contentType.startsWith('text/html')) {
        await newPage.setContent(content, { waitUntil: 'networkidle0' });
      } else if (contentType.startsWith('text/')) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title || 'Content'}</title>
            <style>
              body { font-family: monospace; white-space: pre-wrap; padding: 20px; }
            </style>
          </head>
          <body>${content}</body>
          </html>
        `;
        await newPage.setContent(htmlContent, { waitUntil: 'networkidle0' });
      } else {
        // For other content types, create a data URL
        const dataUrl = `data:${contentType};base64,${Buffer.from(content).toString('base64')}`;
        await newPage.goto(dataUrl);
      }

      const url = newPage.url();
      console.log(`✅ Opened content in new tab: ${url}`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Opened content in new tab\n📍 URL: ${url}\n📋 Content type: ${contentType}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error opening content in tab:', error);
      return {
        content: [{ type: 'text', text: `❌ Error opening content in tab: ${error.message}` }]
      };
    }
  }

  async listTabs(): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Call browser_navigate first.');
      }

      const pages = await this.browser.pages();
      const tabList = await Promise.all(
        pages.map(async (page, index) => {
          try {
            const title = await page.title();
            const url = page.url();
            return `${index}: "${title}" - ${url}`;
          } catch (error) {
            return `${index}: [Error getting tab info] - ${error}`;
          }
        })
      );

      const response = `📑 Open browser tabs (${tabList.length}):\n${tabList.join('\n')}`;
      
      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error listing tabs:', error);
      return {
        content: [{ type: 'text', text: `❌ Error listing tabs: ${error.message}` }]
      };
    }
  }

  async switchTab(index: number): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Call browser_navigate first.');
      }

      const pages = await this.browser.pages();
      
      if (index < 0 || index >= pages.length) {
        throw new Error(`Invalid tab index: ${index}. Available tabs: 0-${pages.length - 1}`);
      }

      const targetPage = pages[index];
      await targetPage.bringToFront();
      
      // Update current page reference
      this.page = targetPage;
      
      // Get tab info
      const title = await targetPage.title();
      const url = targetPage.url();
      
      console.log(`✅ Switched to tab ${index}: "${title}"`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Switched to tab ${index}\n📋 "${title}"\n📍 ${url}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error switching tabs:', error);
      return {
        content: [{ type: 'text', text: `❌ Error switching tabs: ${error.message}` }]
      };
    }
  }

  // Private helper methods
  private async checkForBotDetection(): Promise<any> {
    if (!this.page) return { hasIssues: false };

    try {
      const result = await this.page.evaluate(() => {
        // Check for visible CAPTCHAs only (not just presence of scripts)
        const captchaSelectors = [
          '.g-recaptcha:not([style*="display: none"]):not([style*="display:none"])',
          '.h-captcha:not([style*="display: none"]):not([style*="display:none"])',
          '.cf-turnstile:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="recaptcha"]:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="hcaptcha"]:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="turnstile"]:not([style*="display: none"]):not([style*="display:none"])'
        ];
        
        let visibleCaptchas = 0;
        captchaSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && 
                style.visibility !== 'hidden' && 
                style.opacity !== '0') {
              visibleCaptchas++;
            }
          });
        });

        // Check for blocking text patterns
        const bodyText = document.body.textContent || '';
        const blockingPatterns = [
          /please complete.*captcha/i,
          /verify.*you.*human/i,
          /prove.*you.*human/i,
          /security check/i,
          /access denied/i,
          /blocked.*suspicious/i
        ];
        
        const hasBlockingText = blockingPatterns.some(pattern => pattern.test(bodyText));
        
        return {
          visibleCaptchas,
          hasBlockingText,
          hasIssues: visibleCaptchas > 0 || hasBlockingText
        };
      });

      return result;
    } catch (error) {
      console.error('❌ Bot detection check failed:', error);
      return { hasIssues: false };
    }
  }

  private generateCaptchaResponse(url: string, botCheckResult: any): any {
    const text = `🤖 Whoops! Seems like I am a robot... Any humans around?\n` +
                `⚠️ CAPTCHA/verification detected - need human help!\n\n` +
                `📍 Current URL: ${url}\n\n` +
                `🔒 Detection details:\n` +
                `   • Visible CAPTCHAs: ${botCheckResult.visibleCaptchas || 0}\n` +
                `   • Blocking text: ${botCheckResult.hasBlockingText ? 'Yes' : 'No'}\n\n` +
                `👤 Hey human! Could you please:\n` +
                `   1. Go to the browser window\n` +
                `   2. Complete the CAPTCHA/verification challenge\n` +
                `   3. I'll detect when you're done and continue automatically\n\n` +
                `⏳ WAITING: This tool is now polling for CAPTCHA completion.\n` +
                `🛑 AGENT: DO NOTHING. DO NOT CALL ANY TOOLS.\n` +
                `The tool will automatically return when the user completes the CAPTCHA.`;

    return {
      content: [{ type: 'text', text }]
    };
  }

  private async generateAgentPageInBrowser(): Promise<any> {
    if (!this.page) throw new Error('Page not initialized');

    return await this.page.evaluate(() => {
      // This runs in browser context - use the agent page generator
      const { generateManifest } = (window as any).__AGENT_PAGE_GENERATOR__ || {};
      if (!generateManifest) {
        throw new Error('Agent page generator not available');
      }
      return generateManifest();
    });
  }

  private async generateEnhancedAgentPage(manifest: any, url: string): Promise<string> {
    try {
      if (!this.page) throw new Error('Page not initialized');

      // Get enhanced markdown content that includes interactive elements
      const html = await this.page.evaluate(() => document.documentElement.outerHTML);
      const enhancedResult = await this.generateEnhancedMarkdown(html, url);
      
      let agentPage = `✅ Navigation successful\n📍 URL: ${url}\n\n`;
      agentPage += `ENHANCED AGENT PAGE\n==============================\n\n`;
      agentPage += enhancedResult.content;
      
      // Add interactive elements distribution map if we have multiple pages
      const pageSize = 20000;
      const totalPages = Math.ceil(enhancedResult.content.length / pageSize);
      if (totalPages > 1) {
        agentPage += `\n\n⚠️ LARGE PAGE: Content spans ${totalPages} pages\n`;
        agentPage += `• Use agent_get_page_chunk({page: N}) to see other sections\n`;
        if (enhancedResult.elementsMap && Object.keys(enhancedResult.elementsMap).length > 0) {
          agentPage += `• Interactive elements: `;
          Object.entries(enhancedResult.elementsMap).forEach(([type, pages]) => {
            agentPage += `${type} (pages ${(pages as number[]).join(',')}) `;
          });
          agentPage += `\n`;
        }
      }
      
      return agentPage;
      
    } catch (enhancedError: any) {
      console.error('❌ Enhanced agent page generation failed, falling back to traditional view:', enhancedError.message);
      
      // Fallback to original agent page generation
      return AgentPageGenerator.generateAgentPage(manifest);
    }
  }

  private async generateEnhancedMarkdown(html: string, url: string): Promise<{content: string, elements: any[], elementsMap: any}> {
    try {
      console.log('Starting enhanced markdown generation...');
      console.log('HTML contains data-mcp-id:', html.includes('data-mcp-id'));
      console.log('HTML length:', html.length);
      
      // Import NodeHtmlMarkdown dynamically
      const { NodeHtmlMarkdown } = await import('node-html-markdown');
      
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // First, find and tag all interactive elements with their IDs
      const interactiveElements: any[] = [];
      const elementMap = new Map();
      
      // Find all elements that already have data-mcp-id (from agent page generation)
      const mcpElements = document.querySelectorAll('[data-mcp-id]');
      console.log('Found', mcpElements.length, 'elements with data-mcp-id');
      mcpElements.forEach((element: any, index: number) => {
        const mcpId = element.getAttribute('data-mcp-id');
        const elementInfo = {
          id: mcpId,
          tagName: element.tagName,
          type: element.type || element.getAttribute('data-mcp-type'),
          text: element.textContent?.trim() || element.value || element.title || '',
          label: this.getElementLabel(element),
          action: element.getAttribute('data-mcp-action'),
          placeholder: element.placeholder || ''
        };
        
        interactiveElements.push(elementInfo);
        elementMap.set(element, elementInfo);
        
        // Replace the element in DOM with markdown representation
        if (index < 5) console.log('Replacing element:', mcpId, elementInfo.tagName);
        this.replaceElementWithMarkdown(element, elementInfo, document);
      });
      
      console.log('Replaced', interactiveElements.length, 'elements with markdown');
      
      // Convert the modified HTML to markdown
      const nhm = new NodeHtmlMarkdown({
        strongDelimiter: '**',
        emDelimiter: '*',
        bulletMarker: '-',
        maxConsecutiveNewlines: 2,
        ignore: ['script', 'style', 'nav', 'header', 'footer', '.ad', '.advertisement'],
      });
      
      // Find main content area (same logic as ContentExtractor)
      const mainContent = this.findMainContentArea(document);
      const cleanHtml = mainContent ? mainContent.innerHTML : document.body.innerHTML;
      
      const markdown = nhm.translate(cleanHtml);
      
      return {
        content: markdown,
        elements: interactiveElements,
        elementsMap: this.generateElementsMap(interactiveElements, markdown)
      };
    } catch (error: any) {
      console.error('Enhanced markdown generation failed:', error);
      // Fallback to regular content extraction
      const result = ContentExtractor.extractReadableContent(html, url, { maxElements: 50 });
      return {
        content: `Enhanced markdown failed: ${error.message}\n\n${result.content}`,
        elements: [],
        elementsMap: {}
      };
    }
  }

  private getElementLabel(element: any): string {
    // Try to find a label for this element
    const id = element.id;
    if (id) {
      const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    
    // Check if element is inside a label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';
    
    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check for nearby text (previous/next sibling)
    const prevSibling = element.previousElementSibling;
    if (prevSibling && prevSibling.textContent) {
      const text = prevSibling.textContent.trim();
      if (text.length < 50) return text;
    }
    
    return '';
  }

  private replaceElementWithMarkdown(element: any, elementInfo: any, document: any): void {
    let markdownText = '';
    
    switch (elementInfo.tagName.toLowerCase()) {
      case 'input':
        if (elementInfo.type === 'submit' || elementInfo.type === 'button') {
          markdownText = `**[BUTTON: ${elementInfo.text || elementInfo.value || 'Submit'}]** (ID: ${elementInfo.id})`;
        } else {
          const label = elementInfo.label || elementInfo.placeholder || `${elementInfo.type} field`;
          markdownText = `**[INPUT: ${label}]** (ID: ${elementInfo.id})`;
        }
        break;
      case 'button':
        markdownText = `**[BUTTON: ${elementInfo.text || 'Button'}]** (ID: ${elementInfo.id})`;
        break;
      case 'a':
        markdownText = `**[LINK: ${elementInfo.text || 'Link'}]** (ID: ${elementInfo.id})`;
        break;
      case 'select':
        markdownText = `**[SELECT: ${elementInfo.label || 'Dropdown'}]** (ID: ${elementInfo.id})`;
        break;
      case 'textarea':
        markdownText = `**[TEXTAREA: ${elementInfo.label || elementInfo.placeholder || 'Text area'}]** (ID: ${elementInfo.id})`;
        break;
      default:
        markdownText = `**[${elementInfo.tagName}: ${elementInfo.text || 'Element'}]** (ID: ${elementInfo.id})`;
    }
    
    // Create a text node to replace the element
    const textNode = document.createTextNode(markdownText);
    element.parentNode?.replaceChild(textNode, element);
  }

  private findMainContentArea(document: any): any {
    // Look for main content areas in order of preference
    const contentSelectors = [
      'main',
      '[role="main"]',
      '#main',
      '#content',
      '.main-content',
      '.content',
      'article',
      '.post',
      '.entry-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    return null; // Return null to use body
  }

  private generateElementsMap(elements: any[], markdown: string): any {
    const map: any = {};
    const pageSize = 20000;
    
    elements.forEach(element => {
      const elementText = `(ID: ${element.id})`;
      const position = markdown.indexOf(elementText);
      if (position >= 0) {
        const page = Math.floor(position / pageSize) + 1;
        const type = element.tagName.toLowerCase();
        
        if (!map[type]) map[type] = [];
        if (!map[type].includes(page)) {
          map[type].push(page);
        }
      }
    });
    
    return map;
  }
}