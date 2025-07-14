import { Page } from 'puppeteer';
import { AgentPageGenerator } from './agent-page-generator.js';
import { AgentPageScript } from './agent-page-script.js';
import { ContentExtractor } from './content-extractor.js';
import { WaitStateManager } from './wait-state-manager.js';
import { NavigationMonitor } from './navigation-monitor.js';
import { DOMMonitor } from './dom-monitor.js';

export class AgentTools {
  private page: Page | null = null;
  private currentManifest: any = null;
  private waitStateManager: WaitStateManager;
  private screenshotChunkData: Map<string, any> | null = null;

  constructor() {
    this.waitStateManager = WaitStateManager.getInstance();
  }

  // Initialize with page and manifest from BrowserTools
  initialize(page: Page | null, manifest: any): void {
    this.page = page;
    this.currentManifest = manifest;
  }

  async executeAction(actionId: string, params: any = {}): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      if (!this.currentManifest) {
        throw new Error('No agent page manifest available. Generate agent page first.');
      }

      console.log(`🎯 Executing action: ${actionId}`, params);

      // Inject interaction script if not present
      await this.ensureInteractionScript();

      // Execute the action
      const result = await this.page.evaluate(
        ({ actionId, params }) => {
          const agentPage = (window as any).__AGENT_PAGE__;
          if (!agentPage) {
            throw new Error('Agent page interaction not available');
          }
          return agentPage.execute(actionId, params);
        },
        { actionId, params }
      );

      console.log(`✅ Action executed:`, result);

      // Check if we should wait for changes
      const waitForChanges = params.waitForChanges !== false; // Default to true
      
      if (waitForChanges) {
        // Simple wait for potential changes
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if URL changed (simple navigation detection)
        const currentUrl = await this.page.url();
        // For now, skip complex navigation monitoring
      }

      return {
        content: [{ type: 'text', text: `✅ Action completed: ${JSON.stringify(result)}` }]
      };

    } catch (error: any) {
      console.error('❌ Action execution failed:', error);
      return {
        content: [{ type: 'text', text: `❌ Action failed: ${error.message}` }]
      };
    }
  }

  async getPageState(): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      const state = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          visibilityState: document.visibilityState,
          activeElement: document.activeElement?.tagName || null,
          scrollPosition: {
            x: window.scrollX,
            y: window.scrollY
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }]
      };

    } catch (error: any) {
      console.error('❌ Error getting page state:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting page state: ${error.message}` }]
      };
    }
  }

  async discoverActions(): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      if (!this.currentManifest) {
        throw new Error('No agent page manifest available. Generate agent page first.');
      }

      const actions = this.currentManifest.actions || [];
      const actionsList = actions.map((action: any) => 
        `${action.id}: ${action.type} - ${action.description || action.text || 'No description'}`
      ).join('\n');

      return {
        content: [{ 
          type: 'text', 
          text: `Available actions (${actions.length}):\n${actionsList}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error discovering actions:', error);
      return {
        content: [{ type: 'text', text: `❌ Error discovering actions: ${error.message}` }]
      };
    }
  }

  async generatePage(enhanced: boolean = true, mode: string = 'auto'): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log(`🔄 Generating agent page (enhanced: ${enhanced}, mode: ${mode})...`);

      // Ensure agent page generator is injected
      await this.ensureAgentPageGenerator();

      // Generate manifest
      const manifest = await this.generateAgentPageInBrowser();
      this.currentManifest = manifest;

      let agentPage: string;
      if (enhanced) {
        agentPage = await this.generateEnhancedAgentPage(manifest, await this.page.url());
      } else {
        agentPage = AgentPageGenerator.generateAgentPage(manifest);
      }

      return {
        content: [{ type: 'text', text: agentPage }]
      };

    } catch (error: any) {
      console.error('❌ Error generating agent page:', error);
      return {
        content: [{ type: 'text', text: `❌ Error generating agent page: ${error.message}` }]
      };
    }
  }

  async remapPage(timeout: number = 5000, waitForSelector?: string): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log('🔄 Remapping page after DOM changes...');

      // Wait for selector if specified
      if (waitForSelector) {
        await this.page.waitForSelector(waitForSelector, { timeout });
      } else {
        await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000)));
      }

      // Re-inject agent page generator and get new manifest
      await this.ensureAgentPageGenerator();
      const newManifest = await this.generateAgentPageInBrowser();
      this.currentManifest = newManifest;

      const agentPage = await this.generateEnhancedAgentPage(newManifest, await this.page.url());

      return {
        content: [{ type: 'text', text: agentPage }]
      };

    } catch (error: any) {
      console.error('❌ Error remapping page:', error);
      return {
        content: [{ type: 'text', text: `❌ Error remapping page: ${error.message}` }]
      };
    }
  }

  async waitForChanges(params: any = {}): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      const {
        timeout = 5000,
        waitForNavigation = false,
        waitForSelector,
        waitForText
      } = params;

      console.log('⏳ Waiting for page changes...', params);

      // Simple implementation for now
      if (waitForSelector) {
        await this.page.waitForSelector(waitForSelector, { timeout });
      }

      if (waitForText) {
        await this.page.waitForFunction(
          (text) => document.body.textContent?.includes(text),
          { timeout },
          waitForText
        );
      }

      // Simple wait
      await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 2000)));
      
      // Re-generate agent page
      await this.ensureAgentPageGenerator();
      const newManifest = await this.generateAgentPageInBrowser();
      this.currentManifest = newManifest;
      
      const agentPage = await this.generateEnhancedAgentPage(newManifest, await this.page.url());
      
      return {
        content: [{ type: 'text', text: agentPage }]
      };

    } catch (error: any) {
      console.error('❌ Error waiting for changes:', error);
      return {
        content: [{ type: 'text', text: `❌ Error waiting for changes: ${error.message}` }]
      };
    }
  }

  async getPageChunk(page: number, maxElements: number = 150): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log(`📄 Getting page chunk ${page} (max elements: ${maxElements})`);

      // Ensure we have a current manifest
      if (!this.currentManifest) {
        await this.ensureAgentPageGenerator();
        this.currentManifest = await this.generateAgentPageInBrowser();
      }

      // For content-based chunking, use enhanced markdown
      const html = await this.page.evaluate(() => document.documentElement.outerHTML);
      const enhancedResult = await this.generateEnhancedMarkdown(html, await this.page.url());
      
      const pageSize = 20000;
      const startPos = (page - 1) * pageSize;
      const endPos = startPos + pageSize;
      const chunk = enhancedResult.content.slice(startPos, endPos);
      
      const totalPages = Math.ceil(enhancedResult.content.length / pageSize);
      
      let response = `📄 Page chunk ${page} of ${totalPages}\n`;
      response += `==============================\n\n`;
      response += chunk;
      
      if (page < totalPages) {
        response += `\n\n⏭️ More content available. Use agent_get_page_chunk({page: ${page + 1}}) to continue.`;
      }

      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error getting page chunk:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting page chunk: ${error.message}` }]
      };
    }
  }

  async readContent(params: any = {}): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      const {
        format = 'markdown',
        page = 1,
        pageSize = 20000,
        maxElements = 100
      } = params;

      const url = await this.page.url();
      const html = await this.page.content();
      
      console.log(`📖 Extracting readable content (format: ${format}, page: ${page})`);

      const result = ContentExtractor.extractReadableContent(html, url, {
        maxElements
      });

      let response = `📖 Readable content (Page ${page})\n`;
      response += `==============================\n\n`;
      response += result.content;

      // Simple pagination check based on content length
      const hasMore = result.content.length > 15000;
      if (hasMore) {
        response += `\n\n⏭️ More content available. Use agent_read_content({page: ${page + 1}}) to continue.`;
      }

      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error reading content:', error);
      return {
        content: [{ type: 'text', text: `❌ Error reading content: ${error.message}` }]
      };
    }
  }

  // Private helper methods
  private async ensureInteractionScript(): Promise<void> {
    if (!this.page) return;

    try {
      // Check if interaction script is already loaded
      const hasScript = await this.page.evaluate(() => {
        return typeof (window as any).__AGENT_PAGE__ !== 'undefined';
      });

      if (!hasScript) {
        console.log('💉 Injecting interaction script...');
        // Simplified injection - would need actual script content
        await this.page.evaluate(() => {
          (window as any).__AGENT_PAGE__ = {
            execute: function(actionId: string, params: any) {
              console.log('Executing action:', actionId, params);
              return { success: true, actionId, params };
            }
          };
        });
      }
    } catch (error) {
      console.error('❌ Error injecting interaction script:', error);
    }
  }

  private async ensureAgentPageGenerator(): Promise<void> {
    if (!this.page) return;

    try {
      // Check if agent page generator is already loaded
      const hasGenerator = await this.page.evaluate(() => {
        return typeof (window as any).__AGENT_PAGE_GENERATOR__ !== 'undefined';
      });

      if (!hasGenerator) {
        console.log('💉 Injecting agent page generator...');
        // Simplified injection - would need actual script content
        await this.page.evaluate(() => {
          (window as any).__AGENT_PAGE_GENERATOR__ = {
            generateManifest: function() {
              return { actions: [], elements: [], forms: [] };
            }
          };
        });
      }
    } catch (error) {
      console.error('❌ Error injecting agent page generator:', error);
    }
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