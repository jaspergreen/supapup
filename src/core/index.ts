#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Browser, Page } from 'puppeteer';
import { EventEmitter } from 'events';
import { BrowserRecovery } from './browser-recovery.js';

// Fix MaxListenersExceededWarning
EventEmitter.defaultMaxListeners = 50;
process.setMaxListeners(50);

// Warning suppression (same as original)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  const warningText = warning.toString();
  if (warningText.includes('MaxListenersExceededWarning') ||
      warning.name === 'MaxListenersExceededWarning' ||
      warningText.includes('Chrome') || 
      warningText.includes('puppeteer') || 
      warningText.includes('DevTools') ||
      warningText.includes('Protocol error')) {
    return;
  }
});

const originalWarning = process.emitWarning;
process.emitWarning = (warning: string | Error, options?: any) => {
  const warningText = typeof warning === 'string' ? warning : warning.toString();
  if (warningText.includes('MaxListenersExceededWarning') ||
      warningText.includes('Chrome') || 
      warningText.includes('puppeteer') || 
      warningText.includes('DevTools') ||
      warningText.includes('Protocol error')) {
    return;
  }
  originalWarning.call(process, warning, options);
};

// Stderr suppression (same as original)
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk: any, ...args: any[]): boolean {
  const text = chunk?.toString() || '';
  if (text.includes('DevTools listening') ||
      text.includes('MaxListenersExceededWarning') ||
      text.includes('Possible EventTarget memory leak detected') ||
      text.includes('abort listeners added') ||
      text.includes('(Use `node --trace-warnings') ||
      text.includes('TargetCloseError') ||
      text.includes('Protocol error') ||
      (text.includes('[') && text.includes(']') && text.includes('ERROR')) ||
      (text.includes('(node:') && text.includes(')')) ||
      text.includes('Chrome') ||
      text.includes('puppeteer')) {
    return true;
  }
  // @ts-ignore
  return originalStderrWrite.apply(process.stderr, [chunk, ...args]);
};

// Import tool classes
import { BrowserTools } from './../tools/browser-tools.js';
import { AgentTools } from './../tools/agent-tools.js';
import { ScreenshotTools } from './../tools/screenshot-tools.js';
import { ServerTools } from './server-tools.js';
import { ToolDefinitions } from './tool-definitions.js';

// Import existing specialized tools
import { DevToolsMonitor } from './../generators/devtools.js';
import { ResponsiveTester } from './../tools/responsive-testing.js';
import { DebuggingTools } from './../tools/debugging-tools.js';
import { NetworkTools } from './../tools/network-tools.js';
import { FormTools } from './../tools/form-tools.js';
import { FormDetector } from './../generators/form-detector.js';
import { HumanInteraction } from './../tools/human-interaction.js';
import { PageAnalysis } from './../tools/page-analysis.js';
import { NavigationMonitor } from './../monitors/navigation-monitor.js';
import { DevToolsElements } from './../tools/devtools-elements.js';
import { StorageTools } from './../tools/storage-tools.js';

export class SupapupServer {
  private server: Server;
  private browserRecovery: BrowserRecovery;

  // New tool classes
  private browserTools: BrowserTools;
  private agentTools: AgentTools;
  private screenshotTools: ScreenshotTools;
  private serverTools: ServerTools;

  // Existing specialized tools
  private devtools: DevToolsMonitor | null = null;
  private responsiveTester: ResponsiveTester | null = null;
  private debuggingTools: DebuggingTools | null = null;
  private networkTools: NetworkTools | null = null;
  private pageAnalysis: PageAnalysis | null = null;
  private devToolsElements: DevToolsElements | null = null;
  private storageTools: StorageTools | null = null;
  private formTools: FormTools | null = null;
  private humanInteraction: HumanInteraction | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'supapup',
        version: '0.1.15',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.browserRecovery = new BrowserRecovery();

    // Initialize new tool classes
    this.browserTools = new BrowserTools(this.browserRecovery);
    this.agentTools = new AgentTools();
    this.screenshotTools = new ScreenshotTools();
    this.serverTools = new ServerTools();

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ToolDefinitions.getToolDefinitions()
    }));

    // Crash recovery wrapper
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await this.handleToolRequest(request);
      } catch (error: any) {
        console.error('💥 Tool request crashed:', error);
        
        // Check if this is a browser crash
        const browserHealthy = await this.browserRecovery.checkBrowserHealth(
          this.browserTools.getBrowser(), 
          this.browserTools.getPage()
        );
        
        if (!browserHealthy) {
          console.log('🔧 Browser crash detected, cleaning up...');
          await this.handleBrowserCrash();
          return {
            content: [{ 
              type: 'text', 
              text: `💥 Browser crashed and has been cleaned up. Error: ${error.message}\n\n` +
                    `🔄 You can continue by calling browser_navigate again.` 
            }]
          };
        }
        
        // Non-browser crash, provide helpful error with suggestions
        let errorMessage = `❌ Tool error: ${error.message}`;
        
        // Add contextual help based on common error patterns
        if (error.message.includes('No page available')) {
          errorMessage += `\n\n💡 Quick fix: Use browser_navigate to open a webpage first.`;
        } else if (error.message.includes('not found') || error.message.includes('not available')) {
          errorMessage += `\n\n💡 Troubleshooting:\n- Use agent_generate_page to see available elements\n- Check if the page has finished loading\n- Try agent_remap_page if elements disappeared after page changes`;
        } else if (error.message.includes('timeout') || error.message.includes('waiting')) {
          errorMessage += `\n\n💡 Timeout help:\n- Increase timeout parameter if content is slow to load\n- Check if loading indicators are still visible\n- Use specific selectors with waitForSelector parameter`;
        } else if (error.message.includes('navigation') || error.message.includes('redirect')) {
          errorMessage += `\n\n💡 Navigation tip: Try browser_navigate again or check if the URL is accessible.`;
        }
        
        return {
          content: [{ type: 'text', text: errorMessage }]
        };
      }
    });
  }

  private async handleToolRequest(request: any): Promise<any> {
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    // Initialize tools if we have a page
    await this.initializeToolsIfNeeded();

    switch (toolName) {
      // Browser Tools
      case 'browser_navigate':
        const result = await this.browserTools.navigate(args.url);
        // Update all tools with new page and manifest
        const newPage = this.browserTools.getPage();
        if (newPage) {
          this.agentTools.initialize(newPage, this.browserTools.getCurrentManifest());
          this.screenshotTools.initialize(newPage);
          
          // Update specialized tools with new page reference
          if (this.formTools) (this.formTools as any).page = newPage;
          if (this.debuggingTools) (this.debuggingTools as any).page = newPage;
          if (this.networkTools) (this.networkTools as any).page = newPage;
          if (this.humanInteraction) (this.humanInteraction as any).page = newPage;
          if (this.pageAnalysis) (this.pageAnalysis as any).page = newPage;
          if (this.devToolsElements) (this.devToolsElements as any).page = newPage;
          if (this.storageTools) await this.storageTools.initialize(newPage);
        }
        
        return result;

      case 'browser_close':
        return await this.browserTools.closeBrowser();

      case 'browser_open_in_tab':
        return await this.browserTools.openInTab(args.content, args.contentType, args.title);

      case 'browser_list_tabs':
        return await this.browserTools.listTabs();

      case 'browser_switch_tab':
        const switchResult = await this.browserTools.switchTab(args.index);
        // Update tool references to new page
        const switchPage = this.browserTools.getPage();
        if (switchPage) {
          this.agentTools.initialize(switchPage, this.browserTools.getCurrentManifest());
        }
        const page = this.browserTools.getPage();
        if (page) {
          this.screenshotTools.initialize(page);
        }
        return switchResult;

      // Agent Tools
      case 'agent_execute_action':
        // Refresh all tool page references before action execution
        this.refreshAllToolPageReferences();
        return await this.agentTools.executeAction(args.actionId, args.params);

      case 'agent_get_page_state':
        return await this.agentTools.getPageState();

      case 'agent_discover_actions':
        return await this.agentTools.discoverActions();

      case 'agent_generate_page':
        return await this.agentTools.generatePage(args.enhanced, args.mode);

      case 'agent_remap_page':
        return await this.agentTools.remapPage(args.timeout, args.waitForSelector);

      case 'agent_wait_for_changes':
        return await this.agentTools.waitForChanges(args);

      case 'agent_get_page_chunk':
        return await this.agentTools.getPageChunk(args.page, args.maxElements);

      case 'agent_read_content':
        return await this.agentTools.readContent(args);

      // Screenshot Tools
      case 'screenshot_capture':
        return await this.screenshotTools.capture(args);

      case 'screenshot_paginated':
        return await this.screenshotTools.capturePaginated(args);

      case 'screenshot_get_chunk':
        return await this.screenshotTools.getChunk(args.id, args.chunk);

      case 'browser_navigate_and_capture_loading_sequence':
        return await this.browserTools.navigateAndCaptureLoadingSequence(args.url, args, this.screenshotTools);

      case 'get_loading_sequence_frame':
        return await this.screenshotTools.getLoadingSequenceFrame(args.id, args.frame);

      // Server Tools
      case 'server_info':
        return await this.serverTools.getServerInfo();

      // Form Tools (delegated to existing classes)
      case 'form_fill':
        if (!this.formTools) throw new Error('Form tools not initialized');
        // Update page reference before operation
        const currentPageForFill = this.browserTools.getPage();
        if (currentPageForFill) (this.formTools as any).page = currentPageForFill;
        return await this.formTools.fillForm(args);

      case 'form_detect':
        if (!this.formTools) throw new Error('Form tools not initialized');
        // Update page reference before operation
        const currentPageForDetect = this.browserTools.getPage();
        if (currentPageForDetect) (this.formTools as any).page = currentPageForDetect;
        return await this.formTools.detectForms();

      case 'form_ask_human':
        if (!this.humanInteraction) throw new Error('Human interaction not initialized');
        return await this.humanInteraction.askHumanToIdentifyElement(args.prompt, args.timeout);

      // Debug Tools (delegated to existing classes)
      case 'debug_set_breakpoint':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.setBreakpoint(args);

      case 'debug_remove_breakpoint':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.removeBreakpoint(args.breakpointId);

      case 'debug_continue':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugContinue();

      case 'debug_step_over':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugStepOver();

      case 'debug_step_into':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugStepInto();

      case 'debug_evaluate':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugEvaluate(args);

      case 'debug_get_variables':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugGetVariables();

      case 'debug_function':
        if (!this.debuggingTools) throw new Error('Debugging tools not initialized');
        return await this.debuggingTools.debugFunction(args);

      // Network Tools
      case 'network_get_console_logs':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.getConsoleLogs(args);

      case 'network_get_logs':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.getNetworkLogs(args);

      case 'network_get_api_logs':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.getAPILogs(args);

      case 'network_clear_logs':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.clearLogs();

      case 'network_debug_all_logs':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.debugAllLogs();

      case 'network_replay_request':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.replayAPIRequest(args);

      case 'network_intercept_requests':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        return await this.networkTools.interceptRequests(args);

      case 'network_throttle':
        if (!this.networkTools) throw new Error('Network tools not initialized');
        // This method might not exist - need to check implementation
        return { content: [{ type: 'text', text: 'Network throttling not yet implemented' }] };

      // Page Analysis Tools
      case 'page_get_resources':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        return await this.pageAnalysis.getPageResources();

      case 'page_get_performance':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        return await this.pageAnalysis.getPerformanceMetrics();

      case 'page_get_accessibility':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        return await this.pageAnalysis.getAccessibilityTree();

      case 'page_inspect_element':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        return await this.pageAnalysis.inspectElement(args);

      case 'page_evaluate_script':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        // Update page reference before operation
        const currentPageForEval = this.browserTools.getPage();
        if (currentPageForEval) (this.pageAnalysis as any).page = currentPageForEval;
        return await this.pageAnalysis.evaluateScript(args);

      case 'page_execute_and_wait':
        if (!this.pageAnalysis) throw new Error('Page analysis not initialized');
        // Update page reference before operation
        const currentPageForExecute = this.browserTools.getPage();
        if (currentPageForExecute) (this.pageAnalysis as any).page = currentPageForExecute;
        return await this.pageAnalysis.executeAndWait(args);

      // DevTools Elements
      case 'devtools_inspect_element':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.inspectElement(args);

      case 'devtools_modify_css':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.modifyCSS(args);

      case 'devtools_highlight_element':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.highlightElement(args);

      case 'devtools_modify_html':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.modifyHTML(args);

      case 'devtools_get_computed_styles':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.getComputedStyles(args);

      case 'devtools_visual_element_map':
        if (!this.devToolsElements) throw new Error('DevTools elements not initialized');
        return await this.devToolsElements.createVisualElementMap(args);

      // Storage Tools
      case 'storage_get':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageGet(args);

      case 'storage_set':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageSet(args);

      case 'storage_remove':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageRemove(args);

      case 'storage_clear':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageClear(args);

      case 'storage_export_state':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageExport();

      case 'storage_import_state':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageImport(args);

      case 'storage_get_info':
        if (!this.storageTools) throw new Error('Storage tools not initialized');
        return await this.handleStorageGetInfo();

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async initializeToolsIfNeeded(): Promise<void> {
    const page = this.browserTools.getPage();
    if (!page) return;

    // Initialize existing tools if needed
    if (!this.debuggingTools) {
      this.debuggingTools = new DebuggingTools(page);
    }

    if (!this.networkTools) {
      this.networkTools = new NetworkTools(page);
    }

    if (!this.formTools) {
      this.formTools = new FormTools(page);
    } else {
      // Update page reference for existing formTools
      (this.formTools as any).page = page;
    }

    if (!this.humanInteraction) {
      this.humanInteraction = new HumanInteraction(page);
    }

    if (!this.storageTools) {
      this.storageTools = new StorageTools();
      await this.storageTools.initialize(page);
    }

    if (!this.devToolsElements) {
      this.devToolsElements = new DevToolsElements();
      const client = await page.target().createCDPSession();
      await this.devToolsElements.initialize(page, client);
    }

    if (!this.pageAnalysis) {
      this.pageAnalysis = new PageAnalysis(page);
    }
  }

  /**
   * Refresh all tool page references to prevent detached frame errors
   */
  private refreshAllToolPageReferences(): void {
    const currentPage = this.browserTools.getPage();
    if (!currentPage) return;

    // Update all tool page references
    if (this.formTools) (this.formTools as any).page = currentPage;
    if (this.debuggingTools) (this.debuggingTools as any).page = currentPage;
    if (this.networkTools) (this.networkTools as any).page = currentPage;
    if (this.humanInteraction) (this.humanInteraction as any).page = currentPage;
    if (this.pageAnalysis) (this.pageAnalysis as any).page = currentPage;
    if (this.devToolsElements) (this.devToolsElements as any).page = currentPage;
    // These tools don't exist as class properties - removed
    if (this.devtools) (this.devtools as any).page = currentPage;
    if (this.responsiveTester) (this.responsiveTester as any).page = currentPage;
  }

  private async handleBrowserCrash(): Promise<void> {
    console.log('🧹 Cleaning up crashed browser...');
    await this.browserRecovery.cleanupCrashedBrowser(this.browserTools.getBrowser());
    
    // Record crash for tracking
    this.browserRecovery.recordCrash('Browser crashed - cleaned up and reset');
    
    // Clear browser references to prevent infinite loop
    this.browserTools.clearBrowserReferences();
    
    // Reset tool states
    this.agentTools.initialize(null, null);
    this.screenshotTools.initialize(null);
    
    // Reset existing tools
    this.debuggingTools = null;
    this.networkTools = null;
    this.formTools = null;
    this.humanInteraction = null;
    this.storageTools = null;
    this.devToolsElements = null;
    this.pageAnalysis = null;
    
    this.browserRecovery.resetState();
  }

  // Storage helper methods
  private async handleStorageGet(args: any): Promise<any> {
    const { type = 'all' } = args;
    let result: any = {};
    
    if (type === 'all' || type === 'localStorage') {
      result.localStorage = await this.storageTools!.getLocalStorage();
    }
    if (type === 'all' || type === 'sessionStorage') {
      result.sessionStorage = await this.storageTools!.getSessionStorage();
    }
    if (type === 'all' || type === 'cookies') {
      result.cookies = await this.storageTools!.getCookies();
    }
    
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private async handleStorageSet(args: any): Promise<any> {
    const { type, key, value } = args;
    
    if (type === 'localStorage') {
      await this.storageTools!.setLocalStorage(key, value);
    } else if (type === 'sessionStorage') {
      await this.storageTools!.setSessionStorage(key, value);
    } else {
      throw new Error('Invalid storage type. Use localStorage or sessionStorage');
    }
    
    return { content: [{ type: 'text', text: `Storage ${type} set: ${key} = ${value}` }] };
  }

  private async handleStorageRemove(args: any): Promise<any> {
    const { type, key } = args;
    
    if (type === 'localStorage') {
      await this.storageTools!.removeLocalStorage(key);
    } else if (type === 'sessionStorage') {
      await this.storageTools!.removeSessionStorage(key);
    } else {
      throw new Error('Invalid storage type. Use localStorage or sessionStorage');
    }
    
    return { content: [{ type: 'text', text: `Storage ${type} removed: ${key}` }] };
  }

  private async handleStorageClear(args: any): Promise<any> {
    const { type = 'all' } = args;
    
    if (type === 'all') {
      await this.storageTools!.clearAllStorage();
    } else if (type === 'localStorage') {
      await this.storageTools!.clearLocalStorage();
    } else if (type === 'sessionStorage') {
      await this.storageTools!.clearSessionStorage();
    } else if (type === 'cookies') {
      await this.storageTools!.clearCookies();
    } else {
      throw new Error('Invalid storage type. Use all, localStorage, sessionStorage, or cookies');
    }
    
    return { content: [{ type: 'text', text: `Storage ${type} cleared` }] };
  }

  private async handleStorageExport(): Promise<any> {
    const state = await this.storageTools!.exportStorageState();
    return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] };
  }

  private async handleStorageImport(args: any): Promise<any> {
    const { state } = args;
    await this.storageTools!.importStorageState(state);
    return { content: [{ type: 'text', text: 'Storage state imported successfully' }] };
  }

  private async handleStorageGetInfo(): Promise<any> {
    const info = await this.storageTools!.getStorageInfo();
    return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🤖 Supapup MCP server running (refactored architecture)');
  }
}

// Run the server
const server = new SupapupServer();
server.run().catch(console.error);