import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page } from 'puppeteer';
import { DevToolsMonitor } from './devtools.js';
import { ResponsiveTester } from './responsive-testing.js';
import { ActionMonitor } from './action-monitor.js';
import { AgentPageGenerator } from './agent-page-generator.js';
import { HTMLParser } from './html-parser.js';
import { DebuggingTools } from './debugging-tools.js';
import { NetworkTools } from './network-tools.js';
import { PageAnalysis } from './page-analysis.js';
import { DOMMonitor } from './dom-monitor.js';
import { NavigationMonitor } from './navigation-monitor.js';
import { DevToolsElements } from './devtools-elements.js';
import { AgentPageScript } from './agent-page-script.js';
import * as fs from 'fs';

export class SupapupServer {
  private server: Server;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private devtools: DevToolsMonitor | null = null;
  private responsiveTester: ResponsiveTester | null = null;
  private actionMonitor: ActionMonitor | null = null;
  private debuggingTools: DebuggingTools | null = null;
  private networkTools: NetworkTools | null = null;
  private pageAnalysis: PageAnalysis | null = null;
  private devToolsElements: DevToolsElements | null = null;
  private currentManifest: any = null;
  private screenshotChunkData: Map<string, any> | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'supapup',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'navigate',
          description: 'Navigate to a URL and generate agent page (auto-launches browser if needed)',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to navigate to' },
            },
            required: ['url'],
          },
        },
        {
          name: 'execute_action',
          description: 'Execute an action on the agent page',
          inputSchema: {
            type: 'object',
            properties: {
              actionId: { type: 'string', description: 'ID of the action to execute' },
              params: { type: 'object', description: 'Parameters for the action' },
            },
            required: ['actionId'],
          },
        },
        {
          name: 'screenshot',
          description: 'Take a screenshot with advanced options',
          inputSchema: {
            type: 'object',
            properties: {
              fullPage: { type: 'boolean', description: 'Capture the full page' },
              quality: { type: 'number', description: 'Quality for JPEG/WebP (0-100)' },
              selector: { type: 'string', description: 'CSS selector to capture specific element' },
              scrollTo: { type: 'number', description: 'Y position to scroll to before screenshot' },
              viewport: { 
                type: 'object', 
                description: 'Set viewport dimensions before screenshot',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
              },
            },
          },
        },
        {
          name: 'screenshot_paginated',
          description: 'Take screenshots of a long page in segments, suitable for processing one at a time',
          inputSchema: {
            type: 'object',
            properties: {
              segments: { type: 'number', description: 'Number of segments to split the page into (default: auto-calculate)' },
              quality: { type: 'number', description: 'Quality for JPEG (0-100, default: 50 for smaller size)' },
              overlap: { type: 'number', description: 'Pixels of overlap between segments (default: 100)' },
            },
          },
        },
        {
          name: 'screenshot_chunk',
          description: 'Get a specific chunk of a large screenshot that was automatically paginated',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Screenshot ID returned from the initial screenshot' },
              chunk: { type: 'number', description: 'Chunk number to retrieve (1-based)' },
            },
            required: ['id', 'chunk'],
          },
        },
        {
          name: 'close_browser',
          description: 'Close the browser instance',
          inputSchema: { type: 'object', properties: {} },
        },
        // Debugging tools
        {
          name: 'set_breakpoint',
          description: 'Set a breakpoint at a specific line in JavaScript code',
          inputSchema: {
            type: 'object',
            properties: {
              lineNumber: { type: 'number', description: 'Line number (1-based)' },
              url: { type: 'string', description: 'Script URL or "inline" for inline scripts' },
              condition: { type: 'string', description: 'Optional breakpoint condition' },
            },
            required: ['lineNumber'],
          },
        },
        {
          name: 'remove_breakpoint',
          description: 'Remove a previously set breakpoint',
          inputSchema: {
            type: 'object',
            properties: {
              breakpointId: { type: 'string', description: 'Breakpoint ID from set_breakpoint' },
            },
            required: ['breakpointId'],
          },
        },
        {
          name: 'debug_continue',
          description: 'Resume execution after hitting a breakpoint',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'debug_step_over',
          description: 'Step over the current line during debugging',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'debug_step_into',
          description: 'Step into function calls during debugging',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'debug_evaluate',
          description: 'Evaluate expression in the current debug context',
          inputSchema: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'JavaScript expression to evaluate' },
            },
            required: ['expression'],
          },
        },
        {
          name: 'debug_get_variables',
          description: 'Get local variables in the current debug scope',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'debug_function',
          description: 'Debug a JavaScript function by setting breakpoint and auto-triggering it',
          inputSchema: {
            type: 'object',
            properties: {
              lineNumber: { type: 'number', description: 'Line number to debug (1-based)' },
              triggerAction: { type: 'string', description: 'Optional: specific action ID to trigger' },
            },
            required: ['lineNumber'],
          },
        },
        // Network and logging tools
        {
          name: 'get_console_logs',
          description: 'Get console logs from the page',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Filter by log type (log, error, warning, info)' },
            },
          },
        },
        {
          name: 'get_network_logs',
          description: 'Get network request logs',
          inputSchema: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'Filter by HTTP method' },
              status: { type: 'number', description: 'Filter by HTTP status code' },
            },
          },
        },
        {
          name: 'get_api_logs',
          description: 'Get detailed API request logs with headers, payload, response, and initiator',
          inputSchema: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'Filter by HTTP method (GET, POST, etc.)' },
              status: { type: 'number', description: 'Filter by HTTP status code' },
              urlPattern: { type: 'string', description: 'Regex pattern to filter URLs' },
              since: { type: 'string', description: 'ISO date string to get logs since' },
            },
          },
        },
        {
          name: 'clear_logs',
          description: 'Clear console and network logs',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'replay_api_request',
          description: 'Replay an API request with modified payload/headers',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL of the request to replay' },
              method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE, etc.)' },
              headers: { type: 'object', description: 'Headers to send (will merge with original headers)' },
              payload: { description: 'Request body/payload (can be object or string)' },
              modifyOriginal: { type: 'boolean', description: 'If true, modify the original request data. If false, replace entirely.' },
            },
            required: ['url'],
          },
        },
        {
          name: 'intercept_requests',
          description: 'Intercept and modify API requests before they are sent',
          inputSchema: {
            type: 'object',
            properties: {
              enable: { type: 'boolean', description: 'Enable or disable request interception' },
              rules: {
                type: 'array',
                description: 'Array of interception rules',
                items: {
                  type: 'object',
                  properties: {
                    urlPattern: { type: 'string', description: 'Regex pattern to match URLs' },
                    block: { type: 'boolean', description: 'Block this request entirely' },
                    modifyHeaders: { type: 'object', description: 'Headers to add/modify' },
                    modifyPayload: { description: 'Payload modifications (object will be merged)' },
                  },
                },
              },
            },
            required: ['enable'],
          },
        },
        // Page analysis tools
        {
          name: 'get_page_state',
          description: 'Get the current state from the agent page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'discover_actions',
          description: 'Get available actions from the agent page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_page_resources',
          description: 'Get all page resources (scripts, stylesheets, images, links)',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_performance_metrics',
          description: 'Get page performance metrics',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_accessibility_tree',
          description: 'Get the accessibility tree of the page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'inspect_element',
          description: 'Inspect an element and get its properties, styles, and attributes',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to inspect' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'evaluate_script',
          description: 'Execute JavaScript in the page context',
          inputSchema: {
            type: 'object',
            properties: {
              script: { type: 'string', description: 'JavaScript code to execute' },
            },
            required: ['script'],
          },
        },
        {
          name: 'execute_and_wait',
          description: 'Execute an action and wait for any changes',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action to execute (click, fill, submit, evaluate)' },
              selector: { type: 'string', description: 'CSS selector for the target element' },
              value: { type: 'string', description: 'Value for fill actions' },
              code: { type: 'string', description: 'JavaScript code for evaluate actions' },
              waitTime: { type: 'number', description: 'How long to wait for changes (ms)' },
            },
            required: ['action'],
          },
        },
        {
          name: 'generate_agent_page',
          description: 'Generate agent page view of current webpage',
          inputSchema: {
            type: 'object',
            properties: {
              enhanced: { type: 'boolean', description: 'Use enhanced detection for better element identification' },
              mode: { type: 'string', description: 'Detection mode', enum: ['auto', 'react', 'vue', 'angular', 'vanilla'] },
            },
          },
        },
        {
          name: 'remap_page',
          description: 'Re-scan and remap the current page after DOM changes (useful after AJAX updates)',
          inputSchema: {
            type: 'object',
            properties: {
              waitForSelector: { type: 'string', description: 'Optional: wait for specific selector before remapping' },
              timeout: { type: 'number', description: 'Timeout in ms (default 5000)' },
            },
          },
        },
        {
          name: 'wait_for_changes',
          description: 'Wait for page changes (navigation, AJAX, DOM updates) and return new agent page',
          inputSchema: {
            type: 'object',
            properties: {
              timeout: { type: 'number', description: 'Max time to wait in ms (default 5000)' },
              waitForSelector: { type: 'string', description: 'Wait for specific element to appear' },
              waitForNavigation: { type: 'boolean', description: 'Expect navigation/redirect' },
              waitForText: { type: 'string', description: 'Wait for specific text to appear' },
            },
          },
        },
        {
          name: 'get_agent_page_chunk',
          description: 'Get more elements when a page has too many to show at once. Use this after navigate shows "MORE ELEMENTS AVAILABLE"',
          inputSchema: {
            type: 'object',
            properties: {
              page: { type: 'number', description: 'Batch number to fetch (e.g., 2 for second batch, 3 for third)' },
              maxElements: { type: 'number', description: 'Elements per batch (default: 150)' },
            },
            required: ['page'],
          },
        },
        // DevTools Elements tools
        {
          name: 'devtools_inspect_element',
          description: 'Inspect an element using DevTools to get detailed properties, styles, and attributes',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to inspect' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'devtools_modify_css',
          description: 'Modify CSS properties of an element through DevTools',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to modify' },
              property: { type: 'string', description: 'CSS property name (e.g., "display", "color", "width")' },
              value: { type: 'string', description: 'CSS property value (e.g., "none", "red", "100px")' },
            },
            required: ['selector', 'property', 'value'],
          },
        },
        {
          name: 'devtools_highlight_element',
          description: 'Highlight an element on the page using DevTools highlighting',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to highlight' },
              duration: { type: 'number', description: 'How long to highlight in milliseconds (default: 3000)' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'devtools_modify_html',
          description: 'Modify the HTML content or attributes of an element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to modify' },
              attribute: { type: 'string', description: 'Attribute name to modify (optional, for attribute changes)' },
              value: { type: 'string', description: 'New value for attribute or innerHTML' },
              type: { type: 'string', description: 'Modification type: "innerHTML", "outerHTML", or "attribute"', enum: ['innerHTML', 'outerHTML', 'attribute'] },
            },
            required: ['selector', 'value', 'type'],
          },
        },
        {
          name: 'devtools_get_computed_styles',
          description: 'Get all computed styles and CSS variables for an element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'devtools_visual_element_map',
          description: 'DEBUG TOOL: Creates a visual map of ALL page elements with numbered labels and colored borders. Use ONLY when agent page fails or element not found. Returns screenshot + element map.',
          inputSchema: {
            type: 'object',
            properties: {
              includeAll: { type: 'boolean', description: 'Include ALL elements (true) or just interactive elements (false, default)' },
            },
          },
        },
        {
          name: 'open_in_tab',
          description: 'Open any content in a new browser tab (HTML, text, JSON, images, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Content to display in the tab' },
              contentType: { 
                type: 'string', 
                description: 'MIME type of content (text/html, text/plain, application/json, image/jpeg, etc.)',
                default: 'text/html'
              },
              title: { type: 'string', description: 'Optional title for the tab' },
            },
            required: ['content'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'navigate':
          return await this.navigate(request.params.arguments || {});
        case 'execute_action':
          return await this.executeAction(request.params.arguments || {});
        case 'screenshot':
          return await this.screenshot(request.params.arguments || {});
        case 'screenshot_paginated':
          return await this.screenshotPaginated(request.params.arguments || {});
        case 'screenshot_chunk':
          return await this.screenshotChunk(request.params.arguments || {});
        case 'close_browser':
          return await this.closeBrowser();
        // Debugging tools
        case 'set_breakpoint':
          return await this.debuggingTools!.setBreakpoint(request.params.arguments || {});
        case 'remove_breakpoint':
          return await this.debuggingTools!.removeBreakpoint(request.params.arguments || {});
        case 'debug_continue':
          return await this.debuggingTools!.debugContinue();
        case 'debug_step_over':
          return await this.debuggingTools!.debugStepOver();
        case 'debug_step_into':
          return await this.debuggingTools!.debugStepInto();
        case 'debug_evaluate':
          return await this.debuggingTools!.debugEvaluate(request.params.arguments || {});
        case 'debug_get_variables':
          return await this.debuggingTools!.debugGetVariables();
        case 'debug_function':
          return await this.debuggingTools!.debugFunction(request.params.arguments || {});
        // Network and logging tools
        case 'get_console_logs':
          return await this.networkTools!.getConsoleLogs(request.params.arguments || {});
        case 'get_network_logs':
          return await this.networkTools!.getNetworkLogs(request.params.arguments || {});
        case 'get_api_logs':
          return await this.networkTools!.getAPILogs(request.params.arguments || {});
        case 'clear_logs':
          return await this.networkTools!.clearLogs();
        case 'replay_api_request':
          return await this.networkTools!.replayAPIRequest(request.params.arguments || {});
        case 'intercept_requests':
          return await this.networkTools!.interceptRequests(request.params.arguments || {});
        // Page analysis tools
        case 'get_page_state':
          return await this.pageAnalysis!.getPageState();
        case 'discover_actions':
          return await this.pageAnalysis!.discoverActions();
        case 'get_page_resources':
          return await this.pageAnalysis!.getPageResources();
        case 'get_performance_metrics':
          return await this.pageAnalysis!.getPerformanceMetrics();
        case 'get_accessibility_tree':
          return await this.pageAnalysis!.getAccessibilityTree();
        case 'inspect_element':
          return await this.pageAnalysis!.inspectElement(request.params.arguments || {});
        case 'evaluate_script':
          return await this.pageAnalysis!.evaluateScript(request.params.arguments || {});
        case 'execute_and_wait':
          return await this.pageAnalysis!.executeAndWait(request.params.arguments || {});
        case 'generate_agent_page':
          return await this.pageAnalysis!.generateAgentPage(request.params.arguments || {});
        case 'remap_page':
          return await this.remapPage(request.params.arguments || {});
        case 'wait_for_changes':
          return await this.waitForChanges(request.params.arguments || {});
        case 'get_agent_page_chunk':
          return await this.getAgentPageChunk(request.params.arguments || {});
        // DevTools Elements tools
        case 'devtools_inspect_element':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.inspectElement(request.params.arguments as { selector: string });
        case 'devtools_modify_css':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.modifyCSS(request.params.arguments as { selector: string; property: string; value: string });
        case 'devtools_highlight_element':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.highlightElement(request.params.arguments as { selector: string; duration?: number });
        case 'devtools_modify_html':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.modifyHTML(request.params.arguments as { selector: string; value: string; type: 'innerHTML' | 'outerHTML' | 'attribute'; attribute?: string });
        case 'devtools_get_computed_styles':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.getComputedStyles(request.params.arguments as { selector: string });
        case 'devtools_visual_element_map':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.createVisualElementMap(request.params.arguments as { includeAll?: boolean });
        case 'open_in_tab':
          return await this.openInTab(request.params.arguments as { content: string; contentType?: string; title?: string });
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  // Core browser management
  private async launchBrowser(args: any) {
    try {
      this.browser = await puppeteer.launch({
        headless: args.headless ?? false,
        args: ['--remote-debugging-port=9222'],
      });

      // Get existing pages
      const pages = await this.browser.pages();
      
      // Use existing page if available, otherwise create new one
      if (pages.length > 0) {
        this.page = pages[0];
        // Close any extra blank pages
        for (let i = 1; i < pages.length; i++) {
          await pages[i].close();
        }
      } else {
        this.page = await this.browser.newPage();
      }
      
      // Wait for page to be fully ready before proceeding
      // // console.error('[LaunchBrowser] Waiting for page to be ready...');
      await this.page.goto('about:blank');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Don't initialize tools yet - wait until after navigation

      return {
        content: [
          {
            type: 'text',
            text: 'Browser launched successfully',
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to launch browser: ${error?.message || error}`,
          },
        ],
      };
    }
  }

  private async navigate(args: any): Promise<any> {
    // Auto-launch browser if not already open
    if (!this.browser || !this.page) {
      // console.error('[Navigate] No browser detected, launching new instance...');
      const launchResult = await this.launchBrowser({ headless: false });
      if (launchResult.content[0].text.includes('Failed')) {
        return launchResult; // Return the error
      }
    }
    
    // TypeScript null check
    if (!this.page) {
      throw new Error('Page not initialized after browser launch');
    }

    try {
      // console.error(`[Navigate] Starting navigation to ${args.url}`);
      const startTime = Date.now();

      await this.page.goto(args.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // console.error(`[Navigate] Page loaded in ${Date.now() - startTime}ms`);
      
      // Initialize tools after navigation is complete
      if (!this.devtools) {
        // Wait a bit longer for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.devtools = new DevToolsMonitor(this.page);
        this.responsiveTester = new ResponsiveTester();
        this.actionMonitor = new ActionMonitor();
        this.debuggingTools = new DebuggingTools(this.page);
        this.networkTools = new NetworkTools(this.page);
        this.pageAnalysis = new PageAnalysis(this.page);
        this.devToolsElements = new DevToolsElements();
        
        // Initialize DevToolsElements with CDP session immediately
        try {
          const client = await this.page.target().createCDPSession();
          await this.devToolsElements.initialize(this.page, client);
          // console.error('[Navigate] DevToolsElements initialized with CDP');
        } catch (err) {
          // console.error('[Navigate] DevToolsElements CDP setup error:', err);
        }
        
        // console.error(`[Navigate] Tools initialized`);
      }
      
      // Wait a bit for dynamic content
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate manifest and tag elements directly in the browser
      const scriptStart = Date.now();
      
      // First compile the browser agent generator
      let browserScript: string;
      try {
        browserScript = fs.readFileSync('./dist/browser-agent-generator.js', 'utf8')
          .replace(/export function/g, 'function');
      } catch (e) {
        // Fallback: inject the function directly
        browserScript = fs.readFileSync('./src/browser-agent-generator.ts', 'utf8')
          .replace(/export function/g, 'function')
          .replace(/: Element/g, '')
          .replace(/: string/g, '')
          .replace(/: boolean/g, '')
          .replace(/: number/g, '');
      }
      
      // Inject the function
      await this.page.evaluate(browserScript);
      
      // Run it to generate manifest and tag elements with pagination
      const manifest = await this.page.evaluate(() => {
        // @ts-ignore
        return generateAgentPageInBrowser({ maxElements: 150, startIndex: 0 });
      });
      
      // console.error(`[Navigate] Generated manifest with ${manifest.elements.length} elements (all tagged in browser)`);
      
      // Verify tagging worked
      const taggedCount = await this.page.evaluate(() => {
        return document.querySelectorAll('[data-mcp-id]').length;
      });
      // console.error(`[Navigate] Verified ${taggedCount} elements have data-mcp-id attributes`);
      
      // Create agent page text representation
      const agentPage = AgentPageGenerator.generateAgentPage(manifest);
      
      // Inject the interaction handler (elements already have data-mcp attributes)
      await this.injectInteractionScript(manifest);
      // console.error(`[Navigate] Injected interaction script in ${Date.now() - scriptStart}ms`);
      // console.error(`[Navigate] Total time: ${Date.now() - startTime}ms`);

      this.currentManifest = manifest;
      
      // Check if we landed on a CAPTCHA page
      const currentUrl = this.page.url();
      const title = await this.page.title();
      const captchaIndicators = [
        'sorry/index',
        'recaptcha',
        'captcha',
        'unusual traffic',
        'automated requests'
      ];
      
      const isCaptcha = captchaIndicators.some(indicator => 
        currentUrl.toLowerCase().includes(indicator) ||
        title.toLowerCase().includes(indicator)
      );
      
      if (isCaptcha) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ CAPTCHA/verification page detected\n\n` +
                    `📍 Current URL: ${currentUrl}\n\n` +
                    `🤖 As an automation tool, I cannot solve CAPTCHAs.\n\n` +
                    `👤 Please:\n` +
                    `1. Go to the browser window\n` +
                    `2. Complete the CAPTCHA manually\n` +
                    `3. Once done, use wait_for_changes tool to continue\n\n` +
                    `The browser will remain open for your interaction.`,
            },
          ],
        };
      }
      
      let responseText = `✅ Navigation successful\n` +
                          `📍 URL: ${args.url}\n\n` +
                          `${agentPage}\n\n` +
                          `Interface available at window.__AGENT_PAGE__`;

      // Add pagination warning if needed
      if (manifest.pagination && manifest.pagination.hasMore) {
        responseText += `\n\n⚠️ LARGE PAGE DETECTED: Too many elements for a single response\n` +
                        `• Total elements found: ${manifest.pagination.totalElements}\n` +
                        `• Elements shown: ${manifest.pagination.returnedElements} (batch 1 of ${manifest.pagination.totalPages})\n` +
                        `• Why limited: Prevents response size errors\n` +
                        `• To see more: Use get_agent_page_chunk(page: 2) for next batch\n` +
                        `• Most important elements (forms, navigation) are prioritized in batch 1`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: args.url,
              hasBridge: false,
              error: `Navigation failed: ${error}`,
            }),
          },
        ],
      };
    }
  }

  private async executeAction(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    try {
      // Store original URL before action
      const originalUrl = this.page.url();
      
      // Execute the action
      const result = await this.page.evaluate(
        (actionId: string, params: any) => {
          const agentPage = (window as any).__AGENT_PAGE__;
          if (agentPage && agentPage.execute) {
            return agentPage.execute(actionId, params);
          }
          throw new Error(`Agent page interface not found`);
        },
        args.actionId,
        args.params || {}
      );

      // Check if we should wait for DOM changes
      const shouldWait = args.waitForChanges !== false && 
                        (result.element?.includes('submit') || 
                         result.element?.includes('search') ||
                         result.element?.includes('button') ||
                         args.waitForChanges === true);

      if (shouldWait) {
        // console.error(`[ExecuteAction] Waiting for changes after ${args.actionId}...`);
        
        // First, wait a bit to see if navigation starts
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check for navigation/redirect FIRST
        const navCheck = await NavigationMonitor.checkForNavigation(this.page, originalUrl);
        
        let changed = false;
        if (!navCheck.navigated) {
          // Only wait for DOM changes if no navigation occurred
          changed = await DOMMonitor.waitForChangesAndRemap(this.page, {
            timeout: args.waitTimeout || 5000,
            waitForSelector: args.waitForSelector,
            debounceMs: 500
          });
        }
        
        if (navCheck.navigated) {
          // console.error(`[ExecuteAction] Navigation detected to: ${navCheck.newUrl}`);
          
          if (navCheck.isCaptcha) {
            return {
              content: [
                {
                  type: 'text',
                  text: `⚠️ CAPTCHA/verification page detected\n\n` +
                        `📍 Current URL: ${navCheck.newUrl}\n\n` +
                        `🤖 As an automation tool, I cannot solve CAPTCHAs.\n\n` +
                        `👤 Please:\n` +
                        `1. Go to the browser window\n` +
                        `2. Complete the CAPTCHA manually\n` +
                        `3. Once done, use wait_for_changes tool to continue\n\n` +
                        `The browser will remain open for your interaction.`,
                },
              ],
            };
          }
          
          // Handle normal navigation - re-run full page generation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Re-inject agent page script for new page
          const newManifest = await this.injectAgentPageScript();
          if (!newManifest) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Failed to generate agent page after navigation to: ${navCheck.newUrl}`,
                },
              ],
            };
          }
          
          const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Action executed: ${args.actionId}\n\n` +
                      `🔄 Navigated to: ${navCheck.newUrl}\n` +
                      `📋 Found ${newManifest.elements.length} elements on new page\n\n` +
                      `${agentPage}\n\n` +
                      `Interface available at window.__AGENT_PAGE__`,
              },
            ],
          };
        }
        
        if (changed) {
          // console.error(`[ExecuteAction] DOM changed, regenerating agent page...`);
          
          // Re-inject agent page script to ensure it's available
          const newManifest = await this.injectAgentPageScript();
          if (!newManifest) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Failed to regenerate agent page after DOM changes`,
                },
              ],
            };
          }
          
          // console.error(`[ExecuteAction] Found ${newManifest.elements.length} elements after DOM update`);
          
          // Generate new agent page text
          const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
          
          // Return success with new agent page
          return {
            content: [
              {
                type: 'text',
                text: `✅ Action executed: ${args.actionId}\n\n` +
                      `🔄 Page updated with ${newManifest.elements.length} elements\n\n` +
                      `${agentPage}\n\n` +
                      `Interface updated at window.__AGENT_PAGE__`,
              },
            ],
          };
        }
      }

      // Return simple success if no DOM changes expected
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, result }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Execution failed: ${error}`,
            }),
          },
        ],
      };
    }
  }

  private async remapPage(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    try {
      // console.error(`[RemapPage] Starting page remap...`);
      
      // Wait for any pending changes if requested
      if (args.waitForSelector || args.timeout) {
        const changed = await DOMMonitor.waitForChangesAndRemap(this.page, {
          timeout: args.timeout || 5000,
          waitForSelector: args.waitForSelector
        });
        
        if (!changed) {
          // console.error(`[RemapPage] Timeout waiting for changes`);
        }
      }
      
      // Re-inject agent page script and generate manifest
      const manifest = await this.injectAgentPageScript();
      if (!manifest) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to remap page - could not inject agent script`,
            },
          ],
        };
      }
      
      // console.error(`[RemapPage] Found ${manifest.elements.length} elements`);
      
      // Generate new agent page text
      const agentPage = AgentPageGenerator.generateAgentPage(manifest);
      
      return {
        content: [
          {
            type: 'text',
            text: `🔄 Page remapped successfully\n` +
                  `📍 Found ${manifest.elements.length} interactive elements\n\n` +
                  `${agentPage}\n\n` +
                  `Interface updated at window.__AGENT_PAGE__`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Remap failed: ${error?.message || error}`,
          },
        ],
      };
    }
  }

  private async injectAgentPageScript() {
    if (!this.page) return null;
    
    try {
      // Check if current page is a CAPTCHA before doing anything
      const currentUrl = this.page.url();
      const title = await this.page.title();
      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());
      
      const captchaIndicators = [
        'sorry/index',
        'recaptcha',
        'captcha',
        'unusual traffic',
        'automated requests',
        'verify you\'re human',
        'not a robot',
        'select all images',
        'click verify once there are none left'
      ];
      
      const isCaptcha = captchaIndicators.some(indicator => 
        currentUrl.toLowerCase().includes(indicator) ||
        title.toLowerCase().includes(indicator) ||
        pageText.includes(indicator)
      );
      
      if (isCaptcha) {
        // console.error('[InjectAgentScript] CAPTCHA page detected');
        // Still inject the script for basic functionality, but mark as CAPTCHA
        const basicManifest = {
          elements: [],
          url: currentUrl,
          title: title,
          isCaptcha: true
        };
        return basicManifest;
      }
      
      // Inject browser agent generator script
      let browserScript: string;
      try {
        browserScript = fs.readFileSync('./dist/browser-agent-generator.js', 'utf8')
          .replace(/export function/g, 'function');
      } catch (e) {
        browserScript = fs.readFileSync('./src/browser-agent-generator.ts', 'utf8')
          .replace(/export function/g, 'function')
          .replace(/: Element/g, '')
          .replace(/: string/g, '')
          .replace(/: boolean/g, '')
          .replace(/: number/g, '');
      }
      
      await this.page.evaluate(browserScript);
      
      // Generate manifest
      const manifest = await this.page.evaluate(() => {
        // @ts-ignore
        return generateAgentPageInBrowser();
      });
      
      // Inject interaction script
      await this.injectInteractionScript(manifest);
      this.currentManifest = manifest;
      
      return manifest;
    } catch (error) {
      // console.error('[InjectAgentScript] Failed:', error);
      return null;
    }
  }

  private async waitForChanges(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    try {
      const originalUrl = this.page.url();
      // console.error(`[WaitForChanges] Starting from URL: ${originalUrl}`);
      
      // Wait for navigation or DOM changes
      const navigationPromise = this.page.waitForNavigation({ 
        timeout: args.timeout || 30000,
        waitUntil: 'domcontentloaded' 
      }).then(() => true).catch(() => false);
      
      // Also wait for DOM changes
      const domPromise = DOMMonitor.waitForChangesAndRemap(this.page, {
        timeout: args.timeout || 30000,
        waitForSelector: args.waitForSelector,
        debounceMs: 1000
      });
      
      // Wait for either navigation or DOM changes
      const [navigated, domChanged] = await Promise.all([navigationPromise, domPromise]);
      
      // console.error(`[WaitForChanges] Navigation: ${navigated}, DOM changed: ${domChanged}`);
      
      const currentUrl = this.page.url();
      const urlChanged = currentUrl !== originalUrl;
      
      if (urlChanged || navigated) {
        // console.error(`[WaitForChanges] Page navigated to: ${currentUrl}`);
        
        // Wait a bit for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-inject agent page script for new page
        const newManifest = await this.injectAgentPageScript();
        if (!newManifest) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to generate agent page for new location: ${currentUrl}`,
              },
            ],
          };
        }
        
        // Check if it's a CAPTCHA page
        if ((newManifest as any).isCaptcha) {
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ CAPTCHA/verification page detected\n\n` +
                      `📍 Current URL: ${currentUrl}\n\n` +
                      `🤖 As an automation tool, I cannot solve CAPTCHAs.\n\n` +
                      `👤 Please:\n` +
                      `1. Go to the browser window\n` +
                      `2. Complete the CAPTCHA manually\n` +
                      `3. Call wait_for_changes tool again to continue\n\n` +
                      `The browser will remain open for your interaction.`,
              },
            ],
          };
        }
        
        const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Navigation detected and page updated\n\n` +
                    `📍 New URL: ${currentUrl}\n` +
                    `📋 Found ${newManifest.elements.length} elements\n\n` +
                    `${agentPage}\n\n` +
                    `You can now continue interacting with the page.`,
            },
          ],
        };
      } else if (domChanged) {
        // Just DOM changes, no navigation - re-inject script to be safe
        const newManifest = await this.injectAgentPageScript();
        if (!newManifest) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to regenerate agent page after DOM changes`,
              },
            ],
          };
        }
        
        // Check if it's a CAPTCHA page
        if ((newManifest as any).isCaptcha) {
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ CAPTCHA/verification page detected\n\n` +
                      `📍 Current URL: ${this.page?.url()}\n\n` +
                      `🤖 As an automation tool, I cannot solve CAPTCHAs.\n\n` +
                      `👤 Please:\n` +
                      `1. Go to the browser window\n` +
                      `2. Complete the CAPTCHA manually\n` +
                      `3. Call wait_for_changes tool again to continue\n\n` +
                      `The browser will remain open for your interaction.`,
              },
            ],
          };
        }
        
        const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Page content updated\n\n` +
                    `📋 Found ${newManifest.elements.length} elements\n\n` +
                    `${agentPage}\n\n` +
                    `Page has been remapped with new content.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `⏱️ Timeout: No changes detected within ${args.timeout || 30000}ms\n\n` +
                    `The page appears to be unchanged. You may want to:\n` +
                    `• Check if the manual action was completed\n` +
                    `• Try interacting with the page again\n` +
                    `• Use remap_page to force a refresh of the element map`,
            },
          ],
        };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error waiting for changes: ${error?.message || error}`,
          },
        ],
      };
    }
  }

  private async getAgentPageChunk(args: any): Promise<any> {
    if (!this.page) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ No page loaded. Navigate to a page first.',
          },
        ],
      };
    }

    if (!this.currentManifest || !this.currentManifest.pagination) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ No pagination info available. This page may not have been paginated.',
          },
        ],
      };
    }

    const { page: requestedPage, maxElements = 150 } = args;
    const pagination = this.currentManifest.pagination;

    if (requestedPage < 1 || requestedPage > pagination.totalPages) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Invalid page number. Valid range: 1-${pagination.totalPages}`,
          },
        ],
      };
    }

    try {
      // Calculate start index for the requested page
      const startIndex = (requestedPage - 1) * maxElements;

      // Re-run the browser agent generator with the new offset
      const manifest = await this.page.evaluate((options) => {
        // @ts-ignore
        return generateAgentPageInBrowser(options);
      }, { maxElements, startIndex });

      // Update current manifest with the new chunk
      this.currentManifest = manifest;

      // Generate agent page text
      const agentPage = AgentPageGenerator.generateAgentPage(manifest);

      return {
        content: [
          {
            type: 'text',
            text: `📄 Page ${requestedPage} of ${manifest.pagination.totalPages}\n\n${agentPage}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error fetching page chunk: ${error?.message || error}`,
          },
        ],
      };
    }
  }

  private async screenshot(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    // Token estimation: ~1.37 tokens per character for base64 image
    // Safe limit: 15000 tokens ≈ 11000 base64 characters
    // This translates to roughly ~8KB of binary data
    const MAX_BASE64_LENGTH = 11000;
    const TOKEN_BUFFER = 0.8; // Safety buffer to account for other content
    const SAFE_BASE64_LENGTH = Math.floor(MAX_BASE64_LENGTH * TOKEN_BUFFER);

    let testScreenshot: Buffer | undefined;

    if (args.fullPage) {
      // For full page screenshots, check if we need to split
      const viewport = await this.page.viewport();
      if (!viewport) {
        throw new Error('Could not get viewport dimensions');
      }

      // Get the full page dimensions
      const dimensions = await this.page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }));

      // Take initial screenshot to check size
      let testScreenshot: Buffer | undefined;
      let base64Length: number;
      
      try {
        testScreenshot = await this.page.screenshot({
          fullPage: true,
          quality: args.quality || 50, // Lower quality for size check
          type: 'jpeg',
        }) as Buffer;
        base64Length = testScreenshot.toString('base64').length;
      } catch (error) {
        // If full page screenshot fails, it's likely too large
        // Force chunking by setting a large base64Length
        testScreenshot = undefined;
        base64Length = SAFE_BASE64_LENGTH + 1;
        // console.error('[Screenshot] Full page screenshot failed, forcing chunking:', error);
      }
      
      if (base64Length > SAFE_BASE64_LENGTH) {
        // Calculate how many chunks we need
        const overlap = args.overlap || 100;
        const effectiveViewportHeight = viewport.height - overlap;
        const chunksNeeded = Math.ceil(dimensions.height / effectiveViewportHeight);
        const maxChunks = 20; // Reasonable limit for screenshots
        const actualChunks = Math.min(chunksNeeded, maxChunks);
        const chunkHeight = Math.ceil(dimensions.height / actualChunks);

        // Store screenshot metadata for chunking
        if (!this.screenshotChunkData) {
          this.screenshotChunkData = new Map();
        }
        
        const screenshotId = `screenshot_${Date.now()}`;
        this.screenshotChunkData.set(screenshotId, {
          dimensions,
          viewport,
          overlap,
          quality: args.quality || 50,
          totalChunks: actualChunks,
          chunkHeight,
        });

        // Take the first chunk (top of page)
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const firstChunk = await this.page.screenshot({
          fullPage: false,
          quality: args.quality || 50,
          type: 'jpeg',
        });

        const firstChunkBase64 = (firstChunk as Buffer).toString('base64');
        
        // Open screenshot in new tab if requested
        if (args.openInNewTab !== false) {
          try {
            const newPage = await this.browser!.newPage();
            await newPage.goto(`data:image/jpeg;base64,${firstChunkBase64}`);
            // console.error('[Screenshot] Opened first chunk in new tab');
          } catch (error) {
            // console.error('[Screenshot] Failed to open screenshot in new tab:', error);
          }
        }

        // Return first chunk with pagination info
        return {
          content: [
            {
              type: 'image',
              data: firstChunkBase64,
              mimeType: 'image/jpeg',
            },
            {
              type: 'text',
              text: `📸 LARGE SCREENSHOT - Showing chunk 1 of ${actualChunks}\n\n` +
                    `Page dimensions: ${dimensions.width}x${dimensions.height}px\n` +
                    `• Currently showing: Top section (0-${viewport.height}px)\n` +
                    `• Total chunks: ${actualChunks}\n` +
                    `• To see next chunk: screenshot_chunk(id: "${screenshotId}", chunk: 2)\n` +
                    `• Why chunked: Full page is ${Math.round(base64Length / 1000)}KB, exceeds token limits\n\n` +
                    `Each chunk captures ~${viewport.height}px with ${overlap}px overlap.`,
            },
          ],
        };
      }
    }

    // Handle scrolling if requested
    if (args.scrollTo !== undefined) {
      await this.page.evaluate((y) => window.scrollTo(0, y), args.scrollTo);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for scroll
    }

    // Handle viewport resize if requested
    if (args.viewport) {
      await this.page.setViewport({
        width: args.viewport.width,
        height: args.viewport.height,
      });
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for resize
    }

    // Handle element-specific screenshot
    if (args.selector) {
      const element = await this.page.$(args.selector);
      if (!element) {
        return {
          content: [{
            type: 'text',
            text: `❌ Element not found: ${args.selector}`,
          }],
        };
      }

      const screenshot = await element.screenshot({
        quality: args.quality || 80,
        type: 'jpeg',
      });

      const screenshotBase64 = (screenshot as Buffer).toString('base64');
      
      // Open screenshot in new tab if requested (not for system screenshots)
      if (args.openInNewTab !== false) {
        try {
          const newPage = await this.browser!.newPage();
          await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
          // console.error('[Screenshot] Opened element screenshot in new tab');
        } catch (error) {
          // console.error('[Screenshot] Failed to open element screenshot in new tab:', error);
        }
      }

      return {
        content: [{
          type: 'image',
          data: screenshotBase64,
          mimeType: 'image/jpeg',
        }],
      };
    }

    // Normal screenshot (viewport or full page if small enough)
    let screenshot: Buffer;
    
    if (args.fullPage && testScreenshot) {
      // Use the test screenshot if it succeeded
      screenshot = testScreenshot;
    } else {
      // Take a new screenshot (viewport or full page if small enough)
      screenshot = await this.page.screenshot({
        fullPage: args.fullPage || false,
        quality: args.quality || 80,
        type: 'jpeg',
      }) as Buffer;
    }

    const screenshotBase64 = (screenshot as Buffer).toString('base64');
    
    // Open screenshot in new tab if requested (not for system screenshots)
    if (args.openInNewTab !== false) {
      try {
        const newPage = await this.browser!.newPage();
        await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
        // console.error('[Screenshot] Opened screenshot in new tab');
      } catch (error) {
        // console.error('[Screenshot] Failed to open screenshot in new tab:', error);
      }
    }
    
    // Check if even viewport screenshot is too large
    if (screenshotBase64.length > SAFE_BASE64_LENGTH && !args.fullPage) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Screenshot size warning: The image is ${Math.round(screenshotBase64.length / 1000)}KB in base64, which may cause token limit issues. Consider reducing quality (current: ${args.quality || 80}) or capturing a specific element instead.`,
          },
          {
            type: 'image',
            data: screenshotBase64,
            mimeType: 'image/jpeg',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'image',
          data: screenshotBase64,
          mimeType: 'image/jpeg',
        },
      ],
    };
  }

  private async screenshotPaginated(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    const viewport = await this.page.viewport();
    if (!viewport) {
      throw new Error('Could not get viewport dimensions');
    }

    // Get the full page dimensions
    const dimensions = await this.page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));

    // Calculate segments
    const overlap = args.overlap || 100;
    const quality = args.quality || 50;
    const effectiveViewportHeight = viewport.height - overlap;
    
    let segments = args.segments;
    if (!segments) {
      segments = Math.ceil(dimensions.height / effectiveViewportHeight);
    }
    
    // Limit segments to a reasonable number
    segments = Math.min(segments, 20);
    
    const segmentHeight = Math.ceil(dimensions.height / segments);
    
    // Generate segment information
    const segmentInfo = [];
    for (let i = 0; i < segments; i++) {
      const scrollY = i * (segmentHeight - overlap);
      const isLast = i === segments - 1;
      
      segmentInfo.push({
        index: i + 1,
        scrollY: scrollY,
        height: isLast ? dimensions.height - scrollY : segmentHeight,
        instruction: `screenshot --scrollTo ${scrollY} --quality ${quality}`,
      });
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `📸 Page Segmentation Complete\n\n` +
                `Page dimensions: ${dimensions.width}x${dimensions.height}px\n` +
                `Viewport: ${viewport.width}x${viewport.height}px\n` +
                `Segments: ${segments}\n` +
                `Segment height: ~${segmentHeight}px\n` +
                `Overlap: ${overlap}px\n` +
                `Quality: ${quality}\n\n` +
                `To capture all segments, execute these commands in sequence:\n\n` +
                segmentInfo.map(seg => 
                  `${seg.index}. Scroll to Y=${seg.scrollY}px:\n` +
                  `   mcp__supapup__screenshot(scrollTo: ${seg.scrollY}, quality: ${quality})`
                ).join('\n\n') +
                `\n\nProcess each screenshot individually to avoid token limits.\n` +
                `Each segment will be approximately ${Math.round((segmentHeight * viewport.width * 3) / 1024 / 1024 * 0.1)}MB as JPEG.`,
        },
      ],
    };
  }

  private async screenshotChunk(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    if (!this.screenshotChunkData) {
      return {
        content: [{
          type: 'text',
          text: '❌ No screenshot chunks available. Take a full-page screenshot first to generate chunks.',
        }],
      };
    }

    const { id, chunk } = args;
    const chunkData = this.screenshotChunkData.get(id);
    
    if (!chunkData) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot ID "${id}" not found. Take a new full-page screenshot to generate chunks.`,
        }],
      };
    }

    if (chunk < 1 || chunk > chunkData.totalChunks) {
      return {
        content: [{
          type: 'text',
          text: `❌ Invalid chunk number. Must be between 1 and ${chunkData.totalChunks}.`,
        }],
      };
    }

    // Calculate scroll position for this chunk
    const effectiveViewportHeight = chunkData.viewport.height - chunkData.overlap;
    const scrollY = (chunk - 1) * effectiveViewportHeight;

    // Scroll to the chunk position
    await this.page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Take the screenshot
    const screenshot = await this.page.screenshot({
      fullPage: false,
      quality: chunkData.quality,
      type: 'jpeg',
    });

    const screenshotBase64 = (screenshot as Buffer).toString('base64');
    
    // Open screenshot in new tab
    try {
      const newPage = await this.browser!.newPage();
      await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
      // console.error(`[Screenshot] Opened chunk ${chunk} in new tab`);
    } catch (error) {
      // console.error('[Screenshot] Failed to open screenshot in new tab:', error);
    }

    const startY = scrollY;
    const endY = Math.min(scrollY + chunkData.viewport.height, chunkData.dimensions.height);
    const nextChunk = chunk + 1;
    
    return {
      content: [
        {
          type: 'image',
          data: screenshotBase64,
          mimeType: 'image/jpeg',
        },
        {
          type: 'text',
          text: `📸 SCREENSHOT CHUNK ${chunk} of ${chunkData.totalChunks}\n\n` +
                `Page section: ${startY}-${endY}px\n` +
                `• Dimensions: ${chunkData.dimensions.width}x${chunkData.dimensions.height}px\n` +
                `• Viewport: ${chunkData.viewport.width}x${chunkData.viewport.height}px\n` +
                `• Overlap: ${chunkData.overlap}px\n\n` +
                (nextChunk <= chunkData.totalChunks 
                  ? `• Next chunk: screenshot_chunk(id: "${id}", chunk: ${nextChunk})`
                  : '• This is the last chunk') +
                `\n• Quality: ${chunkData.quality}`,
        },
      ],
    };
  }

  async openInTab(args: { content: string; contentType?: string; title?: string }) {
    if (!this.browser || !this.page) {
      const launchResult = await this.launchBrowser({ headless: false });
      if (launchResult.content[0].text.includes('Failed')) {
        return launchResult; // Return the error
      }
    }
    
    const contentType = args.contentType || 'text/html';
    let dataUrl: string;
    
    try {
      // Handle different content types
      if (contentType.startsWith('image/') && args.content.startsWith('data:')) {
        // Already a data URL for images
        dataUrl = args.content;
      } else if (contentType.startsWith('image/')) {
        // Base64 image content
        dataUrl = `data:${contentType};base64,${args.content}`;
      } else {
        // Text-based content (HTML, JSON, plain text, etc.)
        const encodedContent = encodeURIComponent(args.content);
        dataUrl = `data:${contentType};charset=utf-8,${encodedContent}`;
      }

      // Create new tab and navigate to content
      const newPage = await this.browser!.newPage();
      
      // Set title if provided
      if (args.title) {
        await newPage.evaluateOnNewDocument((title) => {
          document.title = title;
        }, args.title);
      }
      
      await newPage.goto(dataUrl);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Content opened in new browser tab\n` +
                  `• Content type: ${contentType}\n` +
                  `• Content size: ${args.content.length} characters\n` +
                  (args.title ? `• Tab title: ${args.title}\n` : '') +
                  `• Tab URL: ${dataUrl.substring(0, 100)}${dataUrl.length > 100 ? '...' : ''}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to open content in tab: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.devtools = null;
      this.responsiveTester = null;
      this.actionMonitor = null;
      this.debuggingTools = null;
      this.networkTools = null;
      this.pageAnalysis = null;
      this.screenshotChunkData = null;
    }

    return {
      content: [
        {
          type: 'text',
          text: 'Browser closed',
        },
      ],
    };
  }

  // Helper methods for new agent page generation approach

  private async injectInteractionScript(manifest: any) {
    // Generate element tagging script
    const attributeScript = HTMLParser.generateAttributeScript(manifest);
    
    // Get the complete agent page script with helper functions
    const agentPageScript = AgentPageScript.generate();
    
    // Inject complete interaction script
    await this.page!.addScriptTag({
      content: `
        ${attributeScript}
        ${agentPageScript}
        
        // Update manifest after script is loaded
        window.__AGENT_PAGE__.manifest = ${JSON.stringify(manifest, (key, value) => key === 'element' ? undefined : value)};
      `
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // console.error('Supapup MCP server running on stdio');
  }
}

// Only run server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SupapupServer();
  server.run().catch(console.error);
}