import { Page } from 'puppeteer';
import { DevToolsAgentPageGenerator } from './../generators/devtools-agent-page-generator.js';
// AgentPageScript removed - DevToolsAgentPageGenerator handles its own injection
import { ContentExtractor } from './../generators/content-extractor.js';
import { NavigationMonitor } from './../monitors/navigation-monitor.js';
import { PageSettleDetector } from './../core/page-settle-detector.js';
import { randomUUID } from 'crypto';

interface AgentPageChunk {
  id: string;
  totalChunks: number;
  chunks: string[];
  metadata: {
    url: string;
    title: string;
    totalElements: number;
    timestamp: Date;
    elementRanges: Array<{ start: number; end: number }>;
  };
}

export class AgentTools {
  private page: Page | null = null;
  private currentManifest: any = null;
  private screenshotChunkData: Map<string, any> | null = null;
  private agentPageChunkData: Map<string, AgentPageChunk> = new Map();
  private browserTools: any = null;

  constructor() {
  }

  // Initialize with page and manifest from BrowserTools
  initialize(page: Page | null, manifest: any, browserTools?: any): void {
    this.page = page;
    this.currentManifest = manifest;
    if (browserTools) {
      this.browserTools = browserTools;
    }
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

      // Check if we should wait for changes (default: true)
      const waitForChanges = params.waitForChanges !== false;
      
      if (!waitForChanges) {
        // Simple execution without waiting
        const result = await this.page.evaluate(
          (args: { actionId: string; params: any }) => {
            const agentPage = (window as any).__AGENT_PAGE__;
            if (!agentPage) {
              throw new Error('Agent page interaction not available');
            }
            return agentPage.execute(args.actionId, args.params);
          },
          { actionId, params }
        );
        console.log(`✅ Action executed:`, result);
        return {
          content: [{ type: 'text', text: `✅ Action completed: ${JSON.stringify(result)}` }]
        };
      }

      // Use PageSettleDetector for robust change detection
      const detector = new PageSettleDetector(this.page);
      console.log('⏳ Setting up comprehensive page settlement detection...');

      // Perform action and wait for settlement
      const { actionResult, settleResult } = await detector.performActionAndWaitForSettle(
        async () => {
          return await this.page!.evaluate(
            (args: { actionId: string; params: any }) => {
              const agentPage = (window as any).__AGENT_PAGE__;
              if (!agentPage) {
                throw new Error('Agent page interaction not available');
              }
              return agentPage.execute(args.actionId, args.params);
            },
            { actionId, params }
          );
        },
        {
          domIdleTime: 500,
          networkIdleTime: 500,
          globalTimeout: 10000,
          ignoredSelectors: ['.ad-banner', '.clock', '[data-timestamp]'],
          ignoredAttributes: ['data-timestamp', 'data-time']
        }
      );

      console.log(`✅ Action executed:`, actionResult);
      console.log(`📊 Settlement result:`, {
        settled: settleResult.settled,
        hasChanges: settleResult.hasChanges,
        navigated: settleResult.navigated,
        dialogHandled: settleResult.dialogHandled,
        duration: `${settleResult.duration}ms`
      });

      // Always regenerate page if any changes detected
      if (settleResult.hasChanges || settleResult.navigated || settleResult.dialogHandled) {
        console.log(`📄 Changes detected, regenerating agent page...`);
        
        // Re-generate the agent page with new content
        const agentPage = await this.generateAgentPage();
        
        let responseText = `✅ Action completed: ${JSON.stringify(actionResult)}\n\n`;
        
        // Provide detailed change information
        if (settleResult.navigated) {
          responseText += `🌐 Page navigated\n`;
        }
        if (settleResult.changes.domMutations) {
          responseText += `🔄 DOM changes detected (${settleResult.changes.newElements} added, ${settleResult.changes.removedElements} removed)\n`;
        }
        if (settleResult.dialogHandled) {
          responseText += `💬 Dialog handled: ${settleResult.changes.dialogType}\n`;
        }
        
        responseText += `\n📄 Agent page updated:\n\n${agentPage}`;
        
        return {
          content: [{ type: 'text', text: responseText }]
        };
      } else {
        // No changes detected
        return {
          content: [{ type: 'text', text: `✅ Action completed: ${JSON.stringify(actionResult)}\n\n⏸️ No page changes detected` }]
        };
      }

    } catch (error: any) {
      console.error('❌ Action execution failed:', error);
      return {
        content: [{ type: 'text', text: `❌ Action failed: ${error.message}` }]
      };
    }
  }

  async discoverActions(): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log('🔍 Discovering available actions...');

      // Generate agent page which also updates currentManifest
      await this.generateAgentPage();
      const manifest = this.currentManifest;

      if (!manifest || !manifest.elements || manifest.elements.length === 0) {
        return {
          content: [{ type: 'text', text: 'No interactive elements found on the current page.' }]
        };
      }

      // Create action list
      const actions = manifest.elements.map((element: any) => {
        const params = element.action === 'fill' ? `, params: {value: "text"}` : '';
        return `execute_action({actionId: "${element.id}"${params}}) → ${element.description}`;
      });

      const actionsList = actions.join('\n');

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
      await this.ensureInteractionScript();

      // Generate agent page which also updates currentManifest
      const agentPage = await this.generateAgentPage();

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

      console.log('🔄 Remapping page after changes...');

      // Wait for selector if provided
      if (waitForSelector) {
        console.log(`⏳ Waiting for selector: ${waitForSelector}`);
        try {
          await this.page.waitForSelector(waitForSelector, { timeout });
        } catch (timeoutError) {
          console.log('⚠️ Timeout waiting for selector, proceeding with remap...');
        }
      }

      // Wait a bit for DOM to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Re-inject and regenerate
      const agentPage = await this.generateAgentPage();
      
      return {
        content: [{ type: 'text', text: `🔄 Page remapped\n\n${agentPage}` }]
      };

    } catch (error: any) {
      console.error('❌ Error remapping page:', error);
      return {
        content: [{ type: 'text', text: `❌ Error remapping page: ${error.message}` }]
      };
    }
  }

  async waitForChanges(timeout: number = 5000, waitForNavigation: boolean = false, waitForSelector?: string, waitForText?: string): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log(`⏳ Waiting for changes (timeout: ${timeout}ms)...`);

      // Use PageSettleDetector for comprehensive change detection
      const detector = new PageSettleDetector(this.page);
      
      const settleResult = await detector.waitForPageSettle({
        domIdleTime: 500,
        networkIdleTime: 500,
        globalTimeout: timeout,
        waitForSelector: waitForSelector,
        waitForFunction: waitForText ? `() => document.body.textContent?.includes("${waitForText}")` : undefined,
        ignoredSelectors: ['.ad-banner', '.clock', '[data-timestamp]'],
        ignoredAttributes: ['data-timestamp', 'data-time']
      });

      console.log(`📊 Settlement result:`, {
        settled: settleResult.settled,
        hasChanges: settleResult.hasChanges,
        navigated: settleResult.navigated,
        duration: `${settleResult.duration}ms`
      });

      // Re-generate agent page
      const agentPage = await this.generateAgentPage();
      
      let responseText = '✅ Changes detected and page updated\n\n';
      
      if (settleResult.navigated) {
        responseText = '🌐 Navigation detected\n\n';
      } else if (settleResult.changes.domMutations) {
        responseText = `🔄 DOM changes detected (${settleResult.changes.newElements} added, ${settleResult.changes.removedElements} removed)\n\n`;
      }
      
      responseText += agentPage;
      
      return {
        content: [{ type: 'text', text: responseText }]
      };

    } catch (error: any) {
      console.error('❌ Error waiting for changes:', error);
      return {
        content: [{ type: 'text', text: `❌ Timeout or error waiting for changes: ${error.message}` }]
      };
    }
  }

  async getPageChunk(page: number, maxElements: number = 150): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log(`📄 Getting page chunk ${page} (max ${maxElements} elements)...`);

      // For content-based chunking, use the new DevToolsAgentPageGenerator
      const html = await this.page.evaluate(() => document.documentElement.outerHTML);
      const generator = new DevToolsAgentPageGenerator(this.page);
      const result = await generator.generateAgentPage();

      const pageSize = 20000; // Characters per page
      const startPos = (page - 1) * pageSize;
      const endPos = startPos + pageSize;
      const chunk = result.content.slice(startPos, endPos);
      
      if (!chunk.trim()) {
        return {
          content: [{ type: 'text', text: `❌ Page ${page} is empty or doesn't exist` }]
        };
      }

      const totalPages = Math.ceil(result.content.length / pageSize);
      
      let response = `📄 Page ${page} of ${totalPages}\n`;
      response += `📊 Elements on this page: ${result.elements ? result.elements.length : 0}\n\n`;
      response += chunk;

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

  async readContent(format: string = 'markdown', page?: number, pageSize: number = 20000, maxElements: number = 100): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log(`📖 Reading page content (format: ${format}, page: ${page || 'all'})...`);

      const url = await this.page.url();
      const html = await this.page.evaluate(() => document.documentElement.outerHTML);
      
      const result = ContentExtractor.extractReadableContent(html, url, { 
        maxElements
      });

      if (page) {
        // Return specific page
        const startPos = (page - 1) * pageSize;
        const endPos = startPos + pageSize;
        const chunk = result.content.slice(startPos, endPos);
        
        if (!chunk.trim()) {
          return {
            content: [{ type: 'text', text: `❌ Page ${page} is empty or doesn't exist` }]
          };
        }

        const totalPages = Math.ceil(result.content.length / pageSize);
        
        let response = `📖 Content Page ${page} of ${totalPages}\n`;
        response += `📏 Total content: ${result.content.length} characters\n\n`;
        response += chunk;

        return {
          content: [{ type: 'text', text: response }]
        };
      }

      // Return full content with pagination info
      const totalPages = Math.ceil(result.content.length / pageSize);
      let response = `📖 Page Content (${format})\n`;
      response += `📏 ${result.content.length} characters`;
      
      if (totalPages > 1) {
        response += ` across ${totalPages} pages`;
        response += `\n💡 Use agent_read_content({page: N}) to get specific pages`;
      }
      
      response += `\n\n${result.content}`;

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

  async getPageState(): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Navigate to a page first.');
      }

      console.log('📊 Getting current page state...');

      const url = await this.page.url();
      const title = await this.page.title();

      return {
        content: [{ 
          type: 'text', 
          text: `Current page: ${title}\nURL: ${url}\nManifest available: ${!!this.currentManifest}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error getting page state:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting page state: ${error.message}` }]
      };
    }
  }

  async getAgentPageChunk(id: string, chunk: number): Promise<any> {
    try {
      // Try local chunk data first
      let chunkData = this.agentPageChunkData.get(id);
      
      // If not found locally, check BrowserTools
      if (!chunkData && this.browserTools) {
        const browserChunks = this.browserTools.getAgentPageChunkData();
        chunkData = browserChunks.get(id);
      }
      
      if (!chunkData) {
        throw new Error(`Agent page chunk ID not found: ${id}`);
      }

      if (chunk < 1 || chunk > chunkData.totalChunks) {
        throw new Error(`Invalid chunk number: ${chunk}. Available chunks: 1-${chunkData.totalChunks}`);
      }

      const pageContent = chunkData.chunks[chunk - 1];
      
      // Validate chunk data before returning
      if (!pageContent || pageContent.length === 0) {
        throw new Error(`Agent page chunk ${chunk} is empty or invalid. This may be due to a chunking error.`);
      }
      
      // Get element range for this chunk
      const elementRange = chunkData.metadata.elementRanges[chunk - 1];
      const elementsInChunk = elementRange ? (elementRange.end - elementRange.start + 1) : 0;
      
      // Navigation instructions
      const prevChunk = Math.max(1, chunk - 1);
      const nextChunk = Math.min(chunkData.totalChunks, chunk + 1);
      const navigationText = chunk === 1 ? 
        `\n⏭️ Next: get_agent_page_chunk({id: "${id}", chunk: ${nextChunk}})` :
        chunk === chunkData.totalChunks ?
        `\n⏮️ Previous: get_agent_page_chunk({id: "${id}", chunk: ${prevChunk}})` :
        `\n⏮️ Previous: get_agent_page_chunk({id: "${id}", chunk: ${prevChunk}})\n⏭️ Next: get_agent_page_chunk({id: "${id}", chunk: ${nextChunk}})`;

      let response = `📄 Agent Page Chunk ${chunk} of ${chunkData.totalChunks}\n`;
      response += `📍 URL: ${chunkData.metadata.url}\n`;
      response += `📊 Elements in this chunk: ${elementsInChunk}\n`;
      response += `📋 Chunk ID: ${id}${navigationText}\n\n`;
      response += pageContent;

      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error getting agent page chunk:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting agent page chunk: ${error.message}` }]
      };
    }
  }

  // Private helper methods
  private async ensureInteractionScript(): Promise<void> {
    try {
      // DevToolsAgentPageGenerator handles its own interaction script injection
    } catch (error: any) {
      console.error('❌ Error ensuring interaction script:', error);
      throw new Error(`Failed to inject interaction script: ${error.message}`);
    }
  }

  // Removed - DevToolsAgentPageGenerator is now the single source of truth

  private async generateAgentPage(): Promise<string> {
    try {
      if (!this.page) throw new Error('Page not initialized');

      // Single source of truth - DevToolsAgentPageGenerator
      const generator = new DevToolsAgentPageGenerator(this.page);
      const result = await generator.generateAgentPage();
      
      // Store elements for other methods that need them
      this.currentManifest = {
        elements: result.elements.map((el: any) => ({
          id: el.id,
          type: el.type,
          action: el.action,
          description: el.label || el.text || `${el.action} ${el.type}`,
          context: el.label || ''
        })),
        summary: `Found ${result.elements.length} interactive elements`,
        url: result.url,
        title: result.title,
        content: result.content
      };
      
      // Check if content needs to be chunked (20k chars is roughly 5k tokens)
      const TOKEN_LIMIT = 20000; // Conservative limit for agent pages
      if (result.content.length > TOKEN_LIMIT) {
        console.log(`📦 Agent page too large (${result.content.length} chars), creating chunks...`);
        
        // Create chunks based on logical sections
        const chunks = this.chunkAgentPage(result.content, result.elements);
        
        // Store chunked data
        const chunkId = randomUUID();
        this.agentPageChunkData.set(chunkId, {
          id: chunkId,
          totalChunks: chunks.length,
          chunks: chunks.map(c => c.content),
          metadata: {
            url: result.url,
            title: result.title,
            totalElements: result.elements.length,
            timestamp: new Date(),
            elementRanges: chunks.map(c => ({ start: c.startElement, end: c.endElement }))
          }
        });
        
        // Return first chunk with instructions
        const url = await this.page.url();
        let response = `✅ Navigation successful\n📍 URL: ${url}\n\n`;
        response += `⚠️ Large page detected (${result.content.length} characters)\n`;
        response += `📦 Content split into ${chunks.length} chunks\n`;
        response += `📋 Chunk ID: ${chunkId}\n`;
        response += `🔍 Use get_agent_page_chunk({id: "${chunkId}", chunk: 2}) for next chunk\n\n`;
        response += chunks[0].content;
        
        return response;
      }
      
      // Return the complete agent page with navigation header
      const url = await this.page.url();
      return `✅ Navigation successful\n📍 URL: ${url}\n\n${result.content}`;
      
    } catch (error: any) {
      console.error('❌ Agent page generation failed:', error.message);
      throw new Error(`Agent page generation failed: ${error.message}`);
    }
  }

  private chunkAgentPage(content: string, elements: any[]): Array<{ content: string; startElement: number; endElement: number }> {
    const chunks: Array<{ content: string; startElement: number; endElement: number }> = [];
    const CHUNK_SIZE = 18000; // Leave room for headers
    
    // Split content by major sections (forms, navigation, etc.)
    const sections = content.split(/\n(?=## )/); // Split on section headers
    
    let currentChunk = '';
    let currentStartElement = 0;
    let currentEndElement = 0;
    let elementIndex = 0;
    
    for (const section of sections) {
      // Count elements in this section
      const sectionElementCount = (section.match(/\[\w+-[\w-]+\]/g) || []).length;
      
      // If adding this section would exceed limit, save current chunk
      if (currentChunk && (currentChunk.length + section.length > CHUNK_SIZE)) {
        chunks.push({
          content: currentChunk.trim(),
          startElement: currentStartElement,
          endElement: currentEndElement
        });
        currentChunk = '';
        currentStartElement = elementIndex;
      }
      
      currentChunk += (currentChunk ? '\n\n' : '') + section;
      currentEndElement = elementIndex + sectionElementCount - 1;
      elementIndex += sectionElementCount;
      
      // If current chunk is getting large, save it
      if (currentChunk.length > CHUNK_SIZE) {
        chunks.push({
          content: currentChunk.trim(),
          startElement: currentStartElement,
          endElement: currentEndElement
        });
        currentChunk = '';
        currentStartElement = elementIndex;
      }
    }
    
    // Add remaining content
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        startElement: currentStartElement,
        endElement: Math.max(currentEndElement, elements.length - 1)
      });
    }
    
    return chunks;
  }

  // Utility method to clean up old chunks
  cleanupOldChunks(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    for (const [id, chunk] of this.agentPageChunkData.entries()) {
      if (now - chunk.metadata.timestamp.getTime() > maxAge) {
        this.agentPageChunkData.delete(id);
        console.log(`🧹 Cleaned up old agent page chunks: ${id}`);
      }
    }
  }
}