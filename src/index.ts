#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { EventEmitter } from 'events';

// Fix MaxListenersExceededWarning
EventEmitter.defaultMaxListeners = 50;
process.setMaxListeners(50);

// Remove any existing warning listeners first
process.removeAllListeners('warning');

// Add our filtered warning handler
process.on('warning', (warning) => {
  const warningText = warning.toString();
  
  // Filter out MaxListenersExceededWarning completely
  if (warningText.includes('MaxListenersExceededWarning') ||
      warning.name === 'MaxListenersExceededWarning') {
    return; // Ignore this warning
  }
  
  // Filter out other Puppeteer/Chrome warnings
  if (warningText.includes('Chrome') || 
      warningText.includes('puppeteer') || 
      warningText.includes('DevTools') ||
      warningText.includes('Protocol error')) {
    return;
  }
  
  // For other warnings, output them
  // console.warn(warning);
});

// Also override emitWarning to catch it at the source
const originalWarning = process.emitWarning;
process.emitWarning = (warning: string | Error, options?: any) => {
  const warningText = typeof warning === 'string' ? warning : warning.toString();
  
  // Filter out MaxListenersExceededWarning
  if (warningText.includes('MaxListenersExceededWarning')) {
    return;
  }
  // Filter out other Puppeteer/Chrome warnings
  if (warningText.includes('Chrome') || 
      warningText.includes('puppeteer') || 
      warningText.includes('DevTools') ||
      warningText.includes('Protocol error')) {
    return;
  }
  // Call original warning for other warnings
  originalWarning.call(process, warning, options);
};

// Suppress stderr output for Chrome/Puppeteer errors
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk: any, ...args: any[]): boolean {
  const text = chunk?.toString() || '';
  
  // Filter out specific warning/error patterns
  if (text.includes('DevTools listening') ||
      text.includes('MaxListenersExceededWarning') ||
      text.includes('Possible EventTarget memory leak detected') ||
      text.includes('abort listeners added') ||
      text.includes('(Use `node --trace-warnings') ||
      text.includes('TargetCloseError') ||
      text.includes('Protocol error') ||
      (text.includes('[') && text.includes(']') && text.includes('ERROR')) ||
      (text.includes('(node:') && text.includes(')')) || // Catches (node:12345) format
      text.includes('Chrome') ||
      text.includes('puppeteer')) {
    return true;
  }
  // @ts-ignore
  return originalStderrWrite.apply(process.stderr, [chunk, ...args]);
};
import { DevToolsMonitor } from './devtools.js';
import { ResponsiveTester } from './responsive-testing.js';
import { ActionMonitor } from './action-monitor.js';
import { AgentPageGenerator } from './agent-page-generator.js';
import { HTMLParser } from './html-parser.js';
import { DebuggingTools } from './debugging-tools.js';
import { NetworkTools } from './network-tools.js';
import { FormTools } from './form-tools.js';
import { FormDetector } from './form-detector.js';
import { HumanInteraction } from './human-interaction.js';
import { PageAnalysis } from './page-analysis.js';
import { DOMMonitor } from './dom-monitor.js';
import { NavigationMonitor } from './navigation-monitor.js';
import { DevToolsElements } from './devtools-elements.js';
import { AgentPageScript } from './agent-page-script.js';
import { StorageTools } from './storage-tools.js';
import { ContentExtractor } from './content-extractor.js';
import { WaitStateManager } from './wait-state-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Apply stealth plugin
puppeteer.use(StealthPlugin());

// Centralized CAPTCHA message generator
function getCaptchaMessage(url: string, details?: {
  detectionType?: 'url' | 'robot' | 'general';
  robotTestResult?: any;
}): any {
  const { detectionType = 'general', robotTestResult } = details || {};
  
  let text = `🤖 Whoops! Seems like I am a robot... Any humans around?\n`;
  
  switch (detectionType) {
    case 'url':
      text += `⚠️ CAPTCHA detected - need human help!\n\n`;
      break;
    case 'robot':
      text += `⚠️ Bot-blocking detected - need human help!\n\n`;
      break;
    default:
      text += `⚠️ CAPTCHA/verification detected - need human help!\n\n`;
  }
  
  text += `📍 Current URL: ${url}\n\n`;
  
  // Add robot test details if available
  if (robotTestResult && detectionType === 'robot') {
    text += `🔒 Bot-blocking mechanisms detected:\n` +
            `   • Cross-origin iframes: ${robotTestResult.crossOriginIframes || 0}\n` +
            `   • Protected elements: ${robotTestResult.protectedElements || 0}\n` +
            `   • Anti-bot scripts: ${robotTestResult.hasAntiBot ? 'Yes' : 'No'}\n` +
            `   • Human-only elements: ${robotTestResult.humanOnlyElements || 0}\n\n`;
  }
  
  text += `👤 Hey human! Could you please:\n` +
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
  private storageTools: StorageTools | null = null;
  private formTools: FormTools | null = null;
  private humanInteraction: HumanInteraction | null = null;
  private currentManifest: any = null;
  private screenshotChunkData: Map<string, any> | null = null;
  private cdpSession: any | null = null; // Store CDP session for reuse
  private waitStateManager: WaitStateManager;
  private navigationListeners: Map<string, Function> = new Map();

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

    this.waitStateManager = WaitStateManager.getInstance();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'browser_navigate',
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
          name: 'agent_execute_action',
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
          name: 'form_fill',
          description: 'Fill an entire form with JSON data. Keys should match element IDs or data-mcp-ids',
          inputSchema: {
            type: 'object',
            properties: {
              formData: { 
                type: 'object', 
                description: 'JSON object with field IDs as keys and values to fill',
                additionalProperties: true
              },
              formId: { type: 'string', description: 'Optional form ID to target specific form' },
              submitAfter: { type: 'boolean', description: 'Submit form after filling' },
              validateRequired: { type: 'boolean', description: 'Check if required fields are filled' },
            },
            required: ['formData'],
          },
        },
        {
          name: 'form_detect',
          description: 'Detect all forms on the page and get JSON templates with examples for form filling',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'form_ask_human',
          description: 'Ask a human to visually identify an element by clicking on it',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'What to ask the human (e.g., "Click on the squiggly animation at the bottom")' },
              timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'screenshot_capture',
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
          name: 'screenshot_get_chunk',
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
          name: 'browser_close',
          description: 'Close the browser instance',
          inputSchema: { type: 'object', properties: {} },
        },
        // Debugging tools
        {
          name: 'debug_set_breakpoint',
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
          name: 'debug_remove_breakpoint',
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
          name: 'network_get_console_logs',
          description: 'Get console logs from the page',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Filter by log type (log, error, warning, info)' },
            },
          },
        },
        {
          name: 'network_get_logs',
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
          name: 'network_get_api_logs',
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
          name: 'network_clear_logs',
          description: 'Clear console and network logs',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'network_debug_all_logs',
          description: 'DEBUG: Show all captured network logs with isAPI status',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'network_replay_request',
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
          name: 'network_intercept_requests',
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
          name: 'agent_get_page_state',
          description: 'Get the current state from the agent page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'agent_discover_actions',
          description: 'Get available actions from the agent page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'page_get_resources',
          description: 'Get all page resources (scripts, stylesheets, images, links)',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'page_get_performance',
          description: 'Get page performance metrics',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'page_get_accessibility',
          description: 'Get the accessibility tree of the page',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'page_inspect_element',
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
          name: 'page_evaluate_script',
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
          name: 'page_execute_and_wait',
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
          name: 'agent_generate_page',
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
          name: 'agent_remap_page',
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
          name: 'agent_wait_for_changes',
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
          name: 'agent_get_page_chunk',
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
        // Content Extraction tools
        {
          name: 'agent_read_content',
          description: 'Extract readable page content in markdown format - perfect for reading articles, search results, or any page text. Supports pagination for large content.',
          inputSchema: {
            type: 'object',
            properties: {
              format: { 
                type: 'string', 
                description: 'Output format: "markdown" (default) or "text"',
                enum: ['markdown', 'text']
              },
              page: {
                type: 'number',
                description: 'Page number for paginated content (1-based). Use when content is too long.'
              },
              pageSize: {
                type: 'number',
                description: 'Characters per page (default: 20000). Adjust for smaller/larger chunks.'
              },
              maxElements: {
                type: 'number',
                description: 'Max DOM elements to process per page (default: 100). Use for very large pages like Wikipedia.'
              },
            },
          },
        },
        // Network throttling tool
        {
          name: 'network_throttle',
          description: 'Control network speed to simulate slow connections (useful for testing long AJAX calls)',
          inputSchema: {
            type: 'object',
            properties: {
              preset: { 
                type: 'string', 
                description: 'Network preset: "slow-3g", "fast-3g", "offline", "no-throttling"',
                enum: ['slow-3g', 'fast-3g', 'offline', 'no-throttling']
              },
              downloadThroughput: { type: 'number', description: 'Download speed in bytes/second (custom)' },
              uploadThroughput: { type: 'number', description: 'Upload speed in bytes/second (custom)' },
              latency: { type: 'number', description: 'Network latency in milliseconds (custom)' }
            },
            required: ['preset'],
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
          description: 'Modify CSS properties of an element through DevTools. IMPORTANT: Use exact parameter names: "selector", "property", "value" (NOT element_selector, property_name, or property_value). Example: {"selector": "h1", "property": "background", "value": "red"}',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector of the element to modify (use "selector" not "element_selector")' },
              property: { type: 'string', description: 'CSS property name like "background", "color", "transform" (use "property" not "property_name")' },
              value: { type: 'string', description: 'CSS property value like "red", "scale(1.2)", "none" (use "value" not "property_value")' },
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
          name: 'browser_open_in_tab',
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
        {
          name: 'browser_list_tabs',
          description: 'List all open browser tabs with their titles and URLs',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'browser_switch_tab',
          description: 'Switch to a specific browser tab by index',
          inputSchema: {
            type: 'object',
            properties: {
              index: { type: 'number', description: 'Tab index (0-based) from list_tabs' },
            },
            required: ['index'],
          },
        },
        // Storage management tools
        {
          name: 'storage_get',
          description: 'Get localStorage, sessionStorage, and cookies for current page',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['all', 'localStorage', 'sessionStorage', 'cookies'],
                description: 'Type of storage to retrieve (default: all)' 
              },
            },
          },
        },
        {
          name: 'storage_set',
          description: 'Set a value in localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['localStorage', 'sessionStorage'],
                description: 'Storage type' 
              },
              key: { type: 'string', description: 'Storage key' },
              value: { type: 'string', description: 'Storage value' },
            },
            required: ['type', 'key', 'value'],
          },
        },
        {
          name: 'storage_remove',
          description: 'Remove a value from localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['localStorage', 'sessionStorage'],
                description: 'Storage type' 
              },
              key: { type: 'string', description: 'Storage key to remove' },
            },
            required: ['type', 'key'],
          },
        },
        {
          name: 'storage_clear',
          description: 'Clear storage data (localStorage, sessionStorage, cookies, or all)',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['all', 'localStorage', 'sessionStorage', 'cookies'],
                description: 'What to clear (default: all)' 
              },
            },
          },
        },
        {
          name: 'storage_export_state',
          description: 'Export complete storage state for session persistence',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'storage_import_state',
          description: 'Import previously exported storage state',
          inputSchema: {
            type: 'object',
            properties: {
              state: { 
                type: 'object',
                description: 'Storage state object from export_storage_state',
                properties: {
                  localStorage: { type: 'object' },
                  sessionStorage: { type: 'object' },
                  cookies: { type: 'array' },
                },
              },
            },
            required: ['state'],
          },
        },
        {
          name: 'storage_get_info',
          description: 'Get storage usage and quota information',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'browser_navigate':
          return await this.navigate(request.params.arguments || {});
        case 'agent_execute_action':
          return await this.executeAction(request.params.arguments || {});
        case 'form_fill':
          return await this.fillForm(request.params.arguments || {});
        case 'form_detect':
          return await this.detectForms();
        case 'form_ask_human':
          return await this.askHuman(request.params.arguments || {});
        case 'screenshot_capture':
          return await this.screenshot(request.params.arguments || {});
        case 'screenshot_paginated':
          return await this.screenshotPaginated(request.params.arguments || {});
        case 'screenshot_get_chunk':
          return await this.screenshotChunk(request.params.arguments || {});
        case 'browser_close':
          return await this.closeBrowser();
        // Debugging tools
        case 'debug_set_breakpoint':
          return await this.debuggingTools!.setBreakpoint(request.params.arguments || {});
        case 'debug_remove_breakpoint':
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
        case 'network_get_console_logs':
          return await this.networkTools!.getConsoleLogs(request.params.arguments || {});
        case 'network_get_logs':
          return await this.networkTools!.getNetworkLogs(request.params.arguments || {});
        case 'network_get_api_logs':
          return await this.networkTools!.getAPILogs(request.params.arguments || {});
        case 'network_clear_logs':
          return await this.networkTools!.clearLogs();
        case 'network_debug_all_logs':
          return await this.networkTools!.debugAllLogs();
        case 'network_replay_request':
          return await this.networkTools!.replayAPIRequest(request.params.arguments || {});
        case 'network_intercept_requests':
          return await this.networkTools!.interceptRequests(request.params.arguments || {});
        // Page analysis tools
        case 'agent_get_page_state':
          return await this.pageAnalysis!.getPageState();
        case 'agent_discover_actions':
          return await this.pageAnalysis!.discoverActions();
        case 'page_get_resources':
          return await this.pageAnalysis!.getPageResources();
        case 'page_get_performance':
          return await this.pageAnalysis!.getPerformanceMetrics();
        case 'page_get_accessibility':
          return await this.pageAnalysis!.getAccessibilityTree();
        case 'page_inspect_element':
          return await this.pageAnalysis!.inspectElement(request.params.arguments || {});
        case 'page_evaluate_script':
          return await this.pageAnalysis!.evaluateScript(request.params.arguments || {});
        case 'page_execute_and_wait':
          return await this.pageAnalysis!.executeAndWait(request.params.arguments || {});
        case 'agent_generate_page':
          return await this.pageAnalysis!.generateAgentPage(request.params.arguments || {});
        case 'agent_remap_page':
          return await this.remapPage(request.params.arguments || {});
        case 'agent_wait_for_changes':
          return await this.waitForChanges(request.params.arguments || {});
        case 'agent_get_page_chunk':
          return await this.getAgentPageChunk(request.params.arguments || {});
        // Content Extraction tools
        case 'agent_read_content':
          return await this.readPageContent(request.params.arguments || {});
        // Network throttling
        case 'network_throttle':
          return await this.setNetworkThrottling(request.params.arguments || {});
        // DevTools Elements tools
        case 'devtools_inspect_element':
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          return await this.devToolsElements.inspectElement(request.params.arguments as { selector: string });
        case 'devtools_modify_css':
          if (!this.page || !this.browser) {
            return {
              content: [{ type: 'text', text: '❌ No browser or page loaded. Please navigate to a page first.' }],
            };
          }
          if (!this.devToolsElements) {
            return {
              content: [{ type: 'text', text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' }],
            };
          }
          
          // Validate required parameters
          const cssParams = request.params.arguments as any;
          if (!cssParams.selector || !cssParams.property || !cssParams.value) {
            const missing = [];
            if (!cssParams.selector) missing.push('selector');
            if (!cssParams.property) missing.push('property');
            if (!cssParams.value) missing.push('value');
            
            // Check for common parameter naming mistakes
            const suggestions = [];
            if (cssParams.element_selector) suggestions.push('Use "selector" instead of "element_selector"');
            if (cssParams.property_name) suggestions.push('Use "property" instead of "property_name"');
            if (cssParams.property_value) suggestions.push('Use "value" instead of "property_value"');
            
            let errorMsg = `❌ Missing required parameters: ${missing.join(', ')}\n\n`;
            errorMsg += `Required format: {"selector": "h1", "property": "background", "value": "red"}`;
            if (suggestions.length > 0) {
              errorMsg += `\n\n💡 Parameter naming issues detected:\n${suggestions.join('\n')}`;
            }
            
            return {
              content: [{ type: 'text', text: errorMsg }],
            };
          }
          
          // Try to initialize DevToolsElements if not already done
          if (!this.devToolsElements.isInitialized()) {
            try {
              // Reuse existing CDP session or create a new one
              if (!this.cdpSession) {
                this.cdpSession = await this.page.target().createCDPSession();
              }
              await this.devToolsElements.initialize(this.page, this.cdpSession);
            } catch (err) {
              return {
                content: [{ type: 'text', text: '❌ Failed to initialize DevTools Elements. Please try again.' }],
              };
            }
          }
          return await this.devToolsElements.modifyCSS(cssParams as { selector: string; property: string; value: string });
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
        case 'browser_open_in_tab':
          return await this.openInTab(request.params.arguments as { content: string; contentType?: string; title?: string });
        case 'browser_list_tabs':
          return await this.listTabs();
        case 'browser_switch_tab':
          return await this.switchTab(request.params.arguments as { index: number });
        // Storage management
        case 'storage_get':
          return await this.getStorage(request.params.arguments as { type?: string });
        case 'storage_set':
          return await this.setStorage(request.params.arguments as { type: string; key: string; value: string });
        case 'storage_remove':
          return await this.removeStorage(request.params.arguments as { type: string; key: string });
        case 'storage_clear':
          return await this.clearStorage(request.params.arguments as { type?: string });
        case 'storage_export_state':
          return await this.exportStorageState();
        case 'storage_import_state':
          return await this.importStorageState(request.params.arguments as { state: any });
        case 'storage_get_info':
          return await this.getStorageInfo();
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
        args: [
          '--remote-debugging-port=9222',
          // Stability flags only - let stealth plugin handle anti-detection
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });

      // Set up browser crash detection
      this.browser.on('disconnected', () => {
        console.error('[Browser] Browser disconnected/crashed!');
        this.browser = null;
        this.page = null;
        // Clear all tool instances
        this.devtools = null;
        this.responsiveTester = null;
        this.actionMonitor = null;
        this.debuggingTools = null;
        this.networkTools = null;
        this.pageAnalysis = null;
        this.devToolsElements = null;
        this.storageTools = null;
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
      
      // Clean up any existing navigation listeners first
      this.cleanupNavigationListeners();
      
      // Set up page crash detection
      const errorHandler = (error: Error) => {
        console.error('[Page] Page crashed:', error);
      };
      this.page.on('error', errorHandler);
      this.navigationListeners.set('error', errorHandler);
      
      // Set up console error monitoring for JavaScript errors
      const consoleHandler = (msg: any) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Detect memory-related errors
          if (text.includes('out of memory') || text.includes('Maximum call stack')) {
            console.error('[Page] Memory exhaustion detected:', text);
          }
        }
      };
      this.page.on('console', consoleHandler);
      this.navigationListeners.set('console', consoleHandler);
      
      // Intercept navigation attempts to prevent crashes
      await this.page.setRequestInterception(true);
      const requestHandler = (request: any) => {
        const url = request.url();
        
        // Log all navigation attempts for debugging
        if (request.isNavigationRequest()) {
          console.error(`[Navigation] Attempting to navigate to: ${url}`);
          
          // Block suspicious navigation patterns that might cause crashes
          if (url.includes('about:blank#blocked') || 
              url.includes('chrome-error://') ||
              url.includes('javascript:') ||
              (url === 'about:blank' && request.frame() !== this.page?.mainFrame())) {
            console.error(`[Navigation] Blocked suspicious navigation: ${url}`);
            request.abort();
            return;
          }
        }
        
        request.continue();
      };
      this.page.on('request', requestHandler);
      this.navigationListeners.set('request', requestHandler);
      
      
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
      // Provide detailed error information
      let errorMessage = `Failed to launch browser: ${error?.message || error}`;
      
      // Add common troubleshooting tips
      if (error?.message?.includes('No usable sandbox') || error?.message?.includes('Running as root')) {
        errorMessage += '\n\nTry running with --no-sandbox flag or as a non-root user.';
      } else if (error?.message?.includes('Failed to launch the browser process')) {
        errorMessage += '\n\nPuppeteer may not have downloaded the browser. Try reinstalling the package.';
      } else if (error?.message?.includes('Timeout')) {
        errorMessage += '\n\nBrowser launch timed out. This might be due to system resources or missing dependencies.';
      }
      
      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
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
      
      // Track redirects to prevent infinite loops
      let redirectCount = 0;
      const maxRedirects = 10;
      const visitedUrls = new Set<string>();
      
      // Set up redirect tracking
      const onResponse = (response: any) => {
        const status = response.status();
        const url = response.url();
        
        // Track redirects
        if (status >= 300 && status < 400) {
          redirectCount++;
          // console.error(`[Navigate] Redirect ${redirectCount}: ${url}`);
          
          // Check for redirect loops
          if (visitedUrls.has(url)) {
            throw new Error(`Redirect loop detected: ${url}`);
          }
          visitedUrls.add(url);
          
          if (redirectCount > maxRedirects) {
            throw new Error(`Too many redirects (${redirectCount}). Possible infinite redirect attack.`);
          }
        }
      };
      
      this.page.on('response', onResponse);
      this.navigationListeners.set('response', onResponse);
      
      // Inject enhanced dialog overrides before navigation
      await this.page.evaluateOnNewDocument(() => {
        (function() {
          // Helper functions for agents
          (window as any).click_alert = function(index: number) {
            const alerts = document.querySelectorAll('[data-mcp-type="alert"]');
            if (alerts[index - 1]) {
              const okBtn = alerts[index - 1].querySelector('[data-mcp-id="alert-ok"]') as HTMLElement;
              if (okBtn) { okBtn.click(); return true; }
            }
            return false;
          };
          
          (window as any).fill_prompt = function(index: number, value: string) {
            const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
            if (prompts[index - 1]) {
              const input = prompts[index - 1].querySelector('[data-mcp-id="prompt-input"]') as HTMLInputElement;
              if (input) {
                input.value = value;
                input.style.background = '#ffffaa';
                return true;
              }
            }
            return false;
          };
          
          (window as any).click_prompt = function(index: number, accept: boolean) {
            const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
            if (prompts[index - 1]) {
              const btn = accept ? 
                prompts[index - 1].querySelector('[data-mcp-id="prompt-ok"]') :
                prompts[index - 1].querySelector('[data-mcp-id="prompt-cancel"]');
              if (btn) { (btn as HTMLElement).click(); return true; }
            }
            return false;
          };
          
          (window as any).click_confirm = function(index: number, accept: boolean) {
            const confirms = document.querySelectorAll('[data-mcp-type="confirm"]');
            if (confirms[index - 1]) {
              const btn = accept ? 
                confirms[index - 1].querySelector('[data-mcp-id="confirm-ok"]') :
                confirms[index - 1].querySelector('[data-mcp-id="confirm-cancel"]');
              if (btn) { (btn as HTMLElement).click(); return true; }
            }
            return false;
          };
          
          (window as any).list_dialogs = function() {
            const alerts = document.querySelectorAll('[data-mcp-type="alert"]');
            const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
            const confirms = document.querySelectorAll('[data-mcp-type="confirm"]');
            return { alerts: alerts.length, prompts: prompts.length, confirms: confirms.length };
          };
          
          // Enhanced dialog overrides
          window.alert = function(message) {
            console.log('[MCP] Alert intercepted:', message);
            const alertNum = document.querySelectorAll('[data-mcp-type="alert"]').length + 1;
            const alertDiv = document.createElement('div');
            alertDiv.id = 'mcp-alert-' + Date.now();
            alertDiv.setAttribute('data-mcp-id', 'alert-dialog-' + alertNum);
            alertDiv.setAttribute('data-mcp-type', 'alert');
            alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#ff4444;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:300px;';
            alertDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;">🚨 Alert #' + alertNum + '</div><div style="margin-bottom:10px;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.8;">Agent: Use click_alert(' + alertNum + ') to dismiss</div><button data-mcp-id="alert-ok" onclick="this.parentElement.remove();" style="background:white;color:#ff4444;border:none;padding:5px 10px;border-radius:3px;">OK</button>';
            document.body.appendChild(alertDiv);
            console.log('[MCP] Alert helper: click_alert(' + alertNum + ')');
            return undefined;
          };
          
          window.prompt = function(message, defaultValue) {
            console.log('[MCP] Prompt intercepted:', message);
            const promptNum = document.querySelectorAll('[data-mcp-type="prompt"]').length + 1;
            const promptDiv = document.createElement('div');
            promptDiv.id = 'mcp-prompt-' + Date.now();
            promptDiv.setAttribute('data-mcp-id', 'prompt-dialog-' + promptNum);
            promptDiv.setAttribute('data-mcp-type', 'prompt');
            promptDiv.style.cssText = 'position:fixed;top:20px;left:20px;background:#44ff44;color:black;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:350px;';
            promptDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;color:black;">📝 Prompt #' + promptNum + '</div><div style="margin-bottom:10px;color:black;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.7;color:black;">Agent: fill_prompt(' + promptNum + ', "text") then click_prompt(' + promptNum + ', true)</div><input type="text" data-mcp-id="prompt-input" value="' + (defaultValue || '') + '" style="width:250px;padding:5px;margin-bottom:10px;border:1px solid #ccc;border-radius:3px;"><br><button data-mcp-id="prompt-ok" onclick="this.parentElement.remove();" style="background:#44ff44;color:white;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="prompt-cancel" onclick="this.parentElement.remove();" style="background:#ff4444;color:white;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
            document.body.appendChild(promptDiv);
            console.log('[MCP] Prompt helpers: fill_prompt(' + promptNum + ', "text"), click_prompt(' + promptNum + ', true/false)');
            return null;
          };
          
          window.confirm = function(message) {
            console.log('[MCP] Confirm intercepted:', message);
            const confirmNum = document.querySelectorAll('[data-mcp-type="confirm"]').length + 1;
            const confirmDiv = document.createElement('div');
            confirmDiv.id = 'mcp-confirm-' + Date.now();
            confirmDiv.setAttribute('data-mcp-id', 'confirm-dialog-' + confirmNum);
            confirmDiv.setAttribute('data-mcp-type', 'confirm');
            confirmDiv.style.cssText = 'position:fixed;top:80px;right:20px;background:#4444ff;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:300px;';
            confirmDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;">❓ Confirm #' + confirmNum + '</div><div style="margin-bottom:10px;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.8;">Agent: click_confirm(' + confirmNum + ', true) or click_confirm(' + confirmNum + ', false)</div><button data-mcp-id="confirm-ok" onclick="this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="confirm-cancel" onclick="this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
            document.body.appendChild(confirmDiv);
            console.log('[MCP] Confirm helper: click_confirm(' + confirmNum + ', true/false)');
            return false;
          };
          
          console.log('[MCP] Enhanced dialog overrides with helper functions installed');
        })();
      });

      // Inject agent page interface before navigation
      await this.page.evaluateOnNewDocument(() => {
        // Create window.__AGENT_PAGE__ interface
        (window as any).__AGENT_PAGE__ = {
          version: '2.0.0',
          generated: new Date().toISOString(),
          manifest: null,
          
          execute: function(actionId: string, params: any) {
            const element = document.querySelector('[data-mcp-id="' + actionId + '"]');
            if (!element) throw new Error('Element not found: ' + actionId);
            
            const action = element.getAttribute('data-mcp-action');
            
            if (action === 'fill') {
              if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                element.value = params.value || '';
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else if (action === 'click') {
              element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            } else if (action === 'check') {
              if (element instanceof HTMLInputElement && element.type === 'checkbox') {
                element.checked = params.checked !== false;
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else if (action === 'toggle') {
              if (element instanceof HTMLInputElement) {
                const inputType = element.type;
                
                if (inputType === 'checkbox') {
                  // For checkboxes, toggle the checked state
                  // If params.value is provided, use that; otherwise toggle current state
                  if (params && params.value !== undefined) {
                    element.checked = Boolean(params.value);
                  } else {
                    element.checked = !element.checked;
                  }
                  
                  // Dispatch proper events for form validation
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (inputType === 'radio') {
                  // For radio buttons, always set to checked
                  element.checked = true;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } else {
                // For other elements with toggle action, fall back to click
                (element as HTMLElement).click();
              }
            } else if (action === 'select' || action === 'choose') {
              if (element instanceof HTMLSelectElement) {
                const selectEl = element as HTMLSelectElement;
                const inputValue = params.value || '';
                
                // Try to find option by value first
                let option = Array.from(selectEl.options).find(opt => opt.value === inputValue);
                
                // If not found by value, try by display text (case-insensitive)
                if (!option && inputValue) {
                  option = Array.from(selectEl.options).find(opt => 
                    opt.textContent?.trim().toLowerCase() === inputValue.toLowerCase()
                  );
                }
                
                // If still not found, try partial match on display text
                if (!option && inputValue) {
                  option = Array.from(selectEl.options).find(opt => 
                    opt.textContent?.trim().toLowerCase().includes(inputValue.toLowerCase())
                  );
                }
                
                if (option) {
                  selectEl.value = option.value;
                  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  throw new Error(`No option found for "${inputValue}". Available options: ${Array.from(selectEl.options).filter(opt => opt.value).map(opt => `"${opt.textContent?.trim()}" (${opt.value})`).join(', ')}`);
                }
              }
            }
            
            return { success: true, action: action };
          }
        };
        
        console.log('[MCP] Agent page interface installed');
      });
      
      try {
        await this.page.goto(args.url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000, // Reduced timeout to prevent hanging
        });
      } catch (error: any) {
        // Clean up listener
        this.page.off('response', onResponse);
        
        // Check if it's a navigation timeout
        if (error.message?.includes('timeout') || error.message?.includes('Navigation timeout')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Navigation timeout - the page took too long to load or may be under attack.\nThis could be due to:\n- Infinite redirect loops\n- JavaScript that never completes\n- Deliberate anti-bot measures\n\nError: ${error.message}`
            }]
          };
        }
        throw error;
      } finally {
        // Always clean up the listener
        this.page.off('response', onResponse);
      }

      // console.error(`[Navigate] Page loaded in ${Date.now() - startTime}ms`);
      
      // IMMEDIATE CAPTCHA CHECK - Test for bot-blocking mechanisms
      const pageUrl = this.page.url();
      
      // Always do the robot test - it's more reliable than URL patterns
      // This tests what bots actually can't do, not just URL patterns
      const robotTestResult = await this.page.evaluate(() => {
        try {
          // Test 1: Check for cross-origin iframes (CAPTCHA isolation)
          const iframes = Array.from(document.querySelectorAll('iframe'));
          const crossOriginIframes = iframes.filter(iframe => {
            try {
              // This will throw if cross-origin (CAPTCHA security mechanism)
              const src = iframe.src;
              return src && (
                src.includes('recaptcha') || 
                src.includes('hcaptcha') || 
                src.includes('captcha') ||
                src.includes('challenge')
              );
            } catch (e) {
              return true; // Cross-origin access blocked = likely CAPTCHA
            }
          });
          
          // Test 2: Check for elements that can't be interacted with programmatically
          const protectedElements = document.querySelectorAll([
            '.g-recaptcha',
            '.h-captcha', 
            '[data-sitekey]',
            '.cf-challenge-form',
            '.challenge-form'
          ].join(','));
          
          // Test 3: Check for anti-automation scripts
          const scripts = Array.from(document.querySelectorAll('script'));
          const hasAntiBot = scripts.some(script => {
            const src = script.src || script.textContent || '';
            return src.includes('recaptcha') || 
                   src.includes('hcaptcha') || 
                   src.includes('anti-bot') ||
                   src.includes('challenge');
          });
          
          // Test 4: Check for elements that require human interaction
          const humanOnlyElements = document.querySelectorAll([
            'iframe[title*="reCAPTCHA"]',
            'iframe[title*="hCaptcha"]',
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            '.captcha-container',
            '.verification-container'
          ].join(','));
          
          return {
            crossOriginIframes: crossOriginIframes.length,
            protectedElements: protectedElements.length,
            hasAntiBot,
            humanOnlyElements: humanOnlyElements.length,
            isRobotBlocked: crossOriginIframes.length > 0 || protectedElements.length > 0 || hasAntiBot || humanOnlyElements.length > 0
          };
        } catch (error) {
          // If we can't even run this test, it's likely a CAPTCHA page
          return { isRobotBlocked: true, error: String(error) };
        }
      });
      
      if (robotTestResult.isRobotBlocked) {
        return getCaptchaMessage(pageUrl, { 
          detectionType: 'robot',
          robotTestResult 
        });
      }
      
      // Initialize tools after navigation is complete
      if (!this.devtools) {
        // Wait a bit longer for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clean up existing tools before creating new ones
        await this.cleanupTools();
        
        this.devtools = new DevToolsMonitor(this.page);
        this.responsiveTester = new ResponsiveTester();
        this.actionMonitor = new ActionMonitor();
        this.debuggingTools = new DebuggingTools(this.page);
        this.networkTools = new NetworkTools(this.page);
        this.pageAnalysis = new PageAnalysis(this.page);
        this.devToolsElements = new DevToolsElements();
        this.formTools = new FormTools(this.page);
        this.humanInteraction = new HumanInteraction(this.page);
        this.storageTools = new StorageTools();
        
        // Initialize DevToolsElements with CDP session immediately
        try {
          // Clean up old CDP session if it exists
          if (this.cdpSession) {
            try {
              await this.cdpSession.detach();
            } catch (e) {
              // Ignore errors when detaching
            }
            this.cdpSession = null;
          }
          
          // Create new CDP session
          this.cdpSession = await this.page.target().createCDPSession();
          await this.devToolsElements.initialize(this.page, this.cdpSession);
          // console.error('[Navigate] DevToolsElements initialized with CDP');
        } catch (err) {
          // console.error('[Navigate] DevToolsElements CDP setup error:', err);
        }
        
        // Initialize StorageTools
        await this.storageTools.initialize(this.page);
        
        // console.error(`[Navigate] Tools initialized`);
      }
      
      // Wait a bit for dynamic content
      await new Promise(resolve => setTimeout(resolve, 1000));
      

      // Generate manifest and tag elements directly in the browser
      const scriptStart = Date.now();
      
      // First compile the browser agent generator
      let browserScript: string;
      try {
        browserScript = fs.readFileSync(path.join(__dirname, 'browser-agent-generator.js'), 'utf8')
          .replace(/export function/g, 'function');
      } catch (e) {
        // In development, fallback to TypeScript file
        try {
          browserScript = fs.readFileSync(path.join(__dirname, '..', 'src', 'browser-agent-generator.ts'), 'utf8')
            .replace(/export function/g, 'function')
            .replace(/: Element/g, '')
            .replace(/: string/g, '')
            .replace(/: boolean/g, '')
            .replace(/: number/g, '');
        } catch (fallbackError) {
          throw new Error('Failed to load browser agent generator script');
        }
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
      const agentPageWithTools = AgentPageGenerator.appendToolsSummary(agentPage, this.getToolsSummary());
      
      // Inject the interaction handler (elements already have data-mcp attributes)
      await this.injectInteractionScript(manifest);
      // console.error(`[Navigate] Injected interaction script in ${Date.now() - scriptStart}ms`);
      // console.error(`[Navigate] Total time: ${Date.now() - startTime}ms`);

      this.currentManifest = manifest;
      
      // Check if we landed on a CAPTCHA page
      const currentUrl = this.page.url();
      
      // Fast check: Look for specific CAPTCHA elements in DOM first
      const hasCaptchaElements = await this.page.evaluate(() => {
        const captchaSelectors = [
          '.g-recaptcha',
          '#recaptcha',
          '[data-sitekey]',
          'iframe[src*="recaptcha"]',
          'iframe[title*="reCAPTCHA"]',
          '.cf-challenge-form',
          '.challenge-form',
          'div[class*="captcha"]',
          'div[id*="captcha"]',
          '.h-captcha',
          'iframe[src*="hcaptcha"]'
        ];
        
        return captchaSelectors.some(selector => document.querySelector(selector) !== null);
      });
      
      let isCaptcha = hasCaptchaElements;
      
      if (!isCaptcha) {
        // Fallback: URL and title-based detection
        const title = await this.page.title();
        const captchaIndicators = [
          'sorry/index',
          'recaptcha',
          'captcha',
          'unusual traffic',
          'automated requests'
        ];
        
        isCaptcha = captchaIndicators.some(indicator => 
          currentUrl.toLowerCase().includes(indicator) ||
          title.toLowerCase().includes(indicator)
        );
      }
      
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
                          `${agentPageWithTools}\n\n` +
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

    // Temporarily capture console.error to filter warnings
    const originalConsoleError = console.error;
    const capturedErrors: string[] = [];
    
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      // Filter out MaxListenersExceededWarning
      if (!message.includes('MaxListenersExceededWarning') && 
          !message.includes('Possible EventTarget memory leak')) {
        capturedErrors.push(message);
        originalConsoleError(...args);
      }
    };

    try {
      // Clean up any previous wait states before starting new action
      await this.waitStateManager.cleanup(this.page);
      
      // Store original URL before action
      const originalUrl = this.page.url();
      
      // Setup MutationObserver before action (unless explicitly disabled)
      const shouldWait = args.waitForChanges !== false;
      
      if (shouldWait) {
        await this.waitStateManager.setupMutationObserver(this.page);
      }
      
      // Execute the action
      let result;
      try {
        result = await this.page.evaluate(
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
      } catch (error: any) {
        // If execution context was destroyed, this likely means navigation or major DOM update occurred
        if (error.message && error.message.includes('Execution context was destroyed')) {
          // Wait a bit for potential navigation or AJAX to complete
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check for navigation
          const navCheck = await NavigationMonitor.checkForNavigation(this.page, originalUrl);
          
          // Whether navigated or not, we need to reinject our scripts
          const newManifest = await this.injectAgentPageScript();
          if (!newManifest) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Failed to regenerate agent page after major DOM update`,
                },
              ],
            };
          }
          
          const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
          
          if (navCheck.navigated) {
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Action executed: ${args.actionId}\n\n` +
                        `🔄 Navigated to: ${navCheck.newUrl}\n\n` +
                        `${agentPage}\n\n` +
                        `Interface updated at window.__AGENT_PAGE__`,
                },
              ],
            };
          } else {
            // AJAX update case - DOM was replaced but URL didn't change
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
        // Re-throw if it's not a context destroyed error
        throw error;
      }

      if (shouldWait) {
        // Smart wait: poll for mutations or navigation with timeout
        const maxWaitTime = 30000; // 30 seconds max
        const pollInterval = 100; // Check every 100ms
        const settleTime = 500; // Wait 500ms after last mutation
        const startTime = Date.now();
        
        let lastMutationTime = 0;
        let changed = false;
        let navCheck: any = { navigated: false };
        
        // Poll for changes
        while (Date.now() - startTime < maxWaitTime) {
          // Check for navigation
          navCheck = await NavigationMonitor.checkForNavigation(this.page, originalUrl);
          if (navCheck.navigated) {
            break;
          }
          
          // Check for mutations
          const mutationsDetected = await this.page.evaluate(() => {
            const detected = (window as any).__MUTATION_DETECTED__;
            if (detected) {
              // Reset the flag so we can detect new mutations
              (window as any).__MUTATION_DETECTED__ = false;
              return true;
            }
            return false;
          });
          
          if (mutationsDetected) {
            changed = true;
            lastMutationTime = Date.now();
          }
          
          // If mutations were detected, wait for them to settle
          if (lastMutationTime > 0 && Date.now() - lastMutationTime > settleTime) {
            // DOM has settled after mutations
            break;
          }
          
          // If no activity for 2 seconds, assume done
          if (!changed && Date.now() - startTime > 2000) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, pollInterval));
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
      // Enhanced error handling with helpful alternatives
      const errorMessage = error.toString();
      
      // Check if this is an "element not found" error
      if (errorMessage.includes('Element not found:') || errorMessage.includes('not found')) {
        const actionId = args.actionId;
        
        // Get current elements to suggest alternatives
        try {
          const manifest = await this.page.evaluate(() => {
            const agentPage = (window as any).__AGENT_PAGE__;
            return agentPage ? agentPage.getManifest() : null;
          });
          
          let errorResponse = `❌ Element not found: "${actionId}"\n\n`;
          errorResponse += `💡 This could happen because:\n`;
          errorResponse += `   • The page has changed since the element list was generated\n`;
          errorResponse += `   • The element was dynamically created/removed\n`;
          errorResponse += `   • The element ID has changed due to page updates\n\n`;
          
          errorResponse += `🔧 Try these solutions:\n\n`;
          errorResponse += `1️⃣ **Refresh the page mapping:**\n`;
          errorResponse += `   agent_remap_page() - Re-scan all elements\n\n`;
          
          errorResponse += `2️⃣ **Take a screenshot for visual debugging:**\n`;
          errorResponse += `   screenshot_capture() - See current page state\n\n`;
          
          errorResponse += `3️⃣ **Use visual element map:**\n`;
          errorResponse += `   devtools_visual_element_map() - Get numbered elements overlay\n\n`;
          
          // Find similar elements if manifest is available
          if (manifest && manifest.elements) {
            const similarElements = manifest.elements
              .filter((el: any) => el.id.toLowerCase().includes('welcome') || 
                                  el.id.toLowerCase().includes('demo') ||
                                  el.id.toLowerCase().includes('user') ||
                                  el.id.toLowerCase().includes('link'))
              .slice(0, 5); // Limit to 5 suggestions
              
            if (similarElements.length > 0) {
              errorResponse += `4️⃣ **Similar elements found:**\n`;
              similarElements.forEach((el: any) => {
                errorResponse += `   • ${el.id} (${el.type}) - ${el.action}\n`;
              });
              errorResponse += `\n`;
            }
          }
          
          errorResponse += `5️⃣ **Wait for dynamic changes:**\n`;
          errorResponse += `   agent_wait_for_changes() - Wait for page updates\n\n`;
          
          errorResponse += `Original error: ${errorMessage}`;
          
          return {
            content: [
              {
                type: 'text',
                text: errorResponse,
              },
            ],
          };
        } catch (manifestError) {
          // Fall back to basic error if we can't get manifest
          return {
            content: [
              {
                type: 'text',
                text: `❌ Element not found: "${actionId}"\n\n` +
                      `💡 This might be due to dynamic DOM changes.\n\n` +
                      `🔧 Try:\n` +
                      `   • agent_remap_page() - Refresh element mapping\n` +
                      `   • screenshot_capture() - Visual debugging\n` +
                      `   • devtools_visual_element_map() - Numbered element overlay\n\n` +
                      `Original error: ${errorMessage}`,
              },
            ],
          };
        }
      }
      
      // Check if this is a navigation-related error
      if (errorMessage.includes('Execution context was destroyed') || 
          errorMessage.includes('context was destroyed')) {
        // Try to handle navigation/AJAX case
        try {
          // Wait for potential navigation or AJAX to complete
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const originalUrl = await this.page.url();
          const navCheck = await NavigationMonitor.checkForNavigation(this.page, originalUrl);
          
          // Always try to reinject scripts after context destruction
          const newManifest = await this.injectAgentPageScript();
          if (newManifest) {
            const agentPage = AgentPageGenerator.generateAgentPage(newManifest);
            
            if (navCheck.navigated) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `✅ Action executed: ${args.actionId}\n\n` +
                          `🔄 Navigated to: ${navCheck.newUrl}\n\n` +
                          `${agentPage}\n\n` +
                          `Interface updated at window.__AGENT_PAGE__`,
                  },
                ],
              };
            } else {
              // AJAX update case
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
        } catch (navError) {
          // If navigation check fails, fall through to regular error
        }
      }
      
      // For other errors, return enhanced but simpler message
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Execution failed: ${error}`,
              suggestion: "Try agent_remap_page() if elements seem outdated, or screenshot_capture() for visual debugging",
            }),
          },
        ],
      };
    } finally {
      // Restore original console.error
      console.error = originalConsoleError;
      
      // Always cleanup wait states after action completes
      await this.waitStateManager.cleanup(this.page);
    }
  }

  private async fillForm(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    if (!this.formTools) {
      throw new Error('Form tools not initialized');
    }

    try {
      const result = await this.formTools.fillForm(
        args.formData || {},
        {
          formId: args.formId,
          submitAfter: args.submitAfter || false,
          validateRequired: args.validateRequired || false
        }
      );

      // Format response
      let response = result.success ? '✅ Form filled successfully\n\n' : '❌ Form fill failed\n\n';
      
      if (result.filled.length > 0) {
        response += `📝 Filled fields (${result.filled.length}):\n`;
        result.filled.forEach(field => {
          response += `  • ${field}\n`;
        });
        response += '\n';
      }

      if (result.warnings.length > 0) {
        response += `⚠️ Warnings:\n`;
        result.warnings.forEach(warning => {
          response += `  • ${warning}\n`;
        });
        response += '\n';
      }

      if (result.errors.length > 0) {
        response += `❌ Errors:\n`;
        result.errors.forEach(error => {
          response += `  • ${error}\n`;
        });
      }

      // If form was submitted, wait for navigation
      if (args.submitAfter && result.success) {
        try {
          // Wrap navigation promise to prevent listener leaks
          await new Promise((resolve, reject) => {
            this.page!.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 })
              .then(() => resolve(true))
              .catch((e) => reject(e));
          });
          response += '\n✅ Form submitted and navigation completed';
        } catch (e) {
          // No navigation occurred, might be AJAX form
          response += '\n📋 Form submitted (no navigation detected - may be AJAX)';
        }
      }

      return {
        content: [{ type: 'text', text: response }]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Form fill error: ${error}`,
          },
        ],
      };
    }
  }

  private async detectForms() {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    try {
      // Inject FormDetector and run detection
      const forms = await this.page.evaluate(() => {
        // Inline the FormDetector class for browser execution
        class FormDetector {
          static detectForms() {
            const forms: any[] = [];
            
            // Find all elements with form fields
            const containers = [];
            containers.push(...Array.from(document.querySelectorAll('form')));
            
            // Also find divs with multiple form fields
            const potentialContainers = document.querySelectorAll('div, section');
            potentialContainers.forEach(container => {
              const fields = container.querySelectorAll('[data-mcp-id][data-mcp-action="fill"], [data-mcp-id][data-mcp-action="choose"], [data-mcp-id][data-mcp-action="toggle"]');
              if (fields.length >= 3 && !container.querySelector('form')) {
                containers.push(container);
              }
            });
            
            containers.forEach((container, index) => {
              const fields = this.extractFields(container);
              if (fields.length > 0) {
                const formId = container.id || `form-${index}`;
                const formName = this.getFormName(container, fields);
                
                forms.push({
                  formId,
                  formName,
                  fields,
                  jsonTemplate: this.generateTemplate(fields),
                  example: this.generateExample(fields),
                  description: `${formName}: ${fields.length} fields (${fields.filter(f => f.required).length} required)`
                });
              }
            });
            
            return forms;
          }
          
          static extractFields(container: any) {
            const fields: any[] = [];
            const inputs = container.querySelectorAll('[data-mcp-id]');
            
            inputs.forEach((element: any) => {
              const action = element.getAttribute('data-mcp-action');
              if (!['fill', 'choose', 'toggle', 'select'].includes(action)) return;
              
              const label = this.getLabel(element);
              const field = {
                id: element.getAttribute('data-mcp-id'),
                type: element.getAttribute('data-mcp-type') || element.type || element.tagName.toLowerCase(),
                label: label,
                required: element.hasAttribute('required') || (label && label.includes('*')),
                placeholder: element.placeholder,
                value: element.value
              };
              
              if (element.tagName === 'SELECT') {
                (field as any).options = Array.from(element.options).map((opt: any) => opt.value).filter((v: any) => v);
              }
              
              fields.push(field);
            });
            
            return fields;
          }
          
          static getLabel(element: any) {
            // Try to find associated label
            if (element.id) {
              const label = document.querySelector(`label[for="${element.id}"]`);
              if (label) return label.textContent?.trim() || '';
            }
            
            // Check parent label
            const parentLabel = element.closest('label');
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true);
              const input = clone.querySelector('input, select, textarea');
              if (input) input.remove();
              return clone.textContent.trim();
            }
            
            // Check previous sibling
            const prev = element.previousElementSibling;
            if (prev && prev.tagName === 'LABEL') {
              return prev.textContent.trim();
            }
            
            return '';
          }
          
          static getFormName(container: any, fields: any[]) {
            // Check for heading
            const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) return heading.textContent.trim();
            
            // Infer from fields
            const hasEmail = fields.some((f: any) => f.type === 'email');
            const hasPassword = fields.some((f: any) => f.type === 'password');
            
            if (hasEmail && hasPassword) {
              const hasName = fields.some((f: any) => f.label.toLowerCase().includes('name'));
              return hasName ? 'Registration Form' : 'Login Form';
            }
            
            return 'Form';
          }
          
          static generateTemplate(fields: any[]) {
            const template: any = {};
            fields.forEach((field: any) => {
              let type = '<string>';
              switch (field.type) {
                case 'email': type = '<email>'; break;
                case 'password': type = '<password>'; break;
                case 'phone':
                case 'tel': type = '<phone>'; break;
                case 'number': type = '<number>'; break;
                case 'checkbox': type = '<boolean>'; break;
                case 'select': 
                  type = field.options ? `<${field.options.slice(0, 3).join('|')}>` : '<option>';
                  break;
              }
              template[field.id] = field.required ? `${type} (required)` : `${type} (optional)`;
            });
            return template;
          }
          
          static generateExample(fields: any[]) {
            const example: any = {};
            fields.forEach((field: any) => {
              if (!field.required) return;
              
              switch (field.type) {
                case 'email': example[field.id] = 'user@example.com'; break;
                case 'password': example[field.id] = 'SecurePass123!'; break;
                case 'phone':
                case 'tel': example[field.id] = '+1 (555) 123-4567'; break;
                case 'text':
                  if (field.label.toLowerCase().includes('first')) {
                    example[field.id] = 'John';
                  } else if (field.label.toLowerCase().includes('last')) {
                    example[field.id] = 'Doe';
                  } else if (field.label.toLowerCase().includes('address')) {
                    example[field.id] = '123 Main Street';
                  } else if (field.label.toLowerCase().includes('city')) {
                    example[field.id] = 'New York';
                  } else {
                    example[field.id] = 'Example text';
                  }
                  break;
                case 'number': example[field.id] = 123; break;
                case 'checkbox': example[field.id] = true; break;
                case 'select': 
                  if (field.options && field.options.length > 0) {
                    example[field.id] = field.options[0];
                  }
                  break;
                default: example[field.id] = 'example';
              }
            });
            return example;
          }
        }
        
        return FormDetector.detectForms();
      });

      // Format response
      let response = `📋 FORM DETECTION RESULTS\n`;
      response += `${'='.repeat(40)}\n\n`;

      if (forms.length === 0) {
        response += '❌ No forms detected on this page\n';
      } else {
        response += `Found ${forms.length} form${forms.length > 1 ? 's' : ''} on this page:\n\n`;

        forms.forEach((form, index) => {
          response += `📝 ${index + 1}. ${form.formName}\n`;
          response += `   ID: ${form.formId}\n`;
          response += `   ${form.description}\n\n`;
          
          response += `   JSON Template:\n`;
          response += '   ```json\n';
          response += '   ' + JSON.stringify(form.jsonTemplate, null, 2).split('\n').join('\n   ') + '\n';
          response += '   ```\n\n';
          
          response += `   Example (required fields only):\n`;
          response += '   ```json\n';
          response += '   ' + JSON.stringify(form.example, null, 2).split('\n').join('\n   ') + '\n';
          response += '   ```\n\n';
          
          response += `   To fill this form:\n`;
          response += `   fill_form({\n`;
          response += `     formData: ${JSON.stringify(form.example)},\n`;
          response += `     formId: "${form.formId}",\n`;
          response += `     submitAfter: true\n`;
          response += `   })\n\n`;
        });
      }

      response += `💡 Tips:\n`;
      response += `• Use detect_forms to understand form structure\n`;
      response += `• Copy the example JSON and modify values as needed\n`;
      response += `• Set submitAfter: true to submit after filling\n`;
      response += `• The formId parameter is optional if there's only one form\n`;

      return {
        content: [{ type: 'text', text: response }]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Form detection error: ${error}`,
          },
        ],
      };
    }
  }

  private async askHuman(args: any) {
    if (!this.page) {
      throw new Error('No page loaded. Navigate to a page first.');
    }

    if (!this.humanInteraction) {
      throw new Error('Human interaction tools not initialized');
    }

    try {
      const prompt = args.prompt || 'Please click on the element you want to identify';
      const timeout = args.timeout || 30000;

      // Take a screenshot before asking
      const beforeScreenshot = await this.page.screenshot({ encoding: 'base64' });

      const result = await this.humanInteraction.askHumanToIdentifyElement(prompt, timeout);

      let response = `🤖 HUMAN ELEMENT IDENTIFICATION\n`;
      response += `${'='.repeat(40)}\n\n`;

      if (result.success && result.element) {
        response += `✅ Element successfully identified!\n\n`;
        
        response += `📍 Element Details:\n`;
        response += `  • Selector: ${result.element.selector}\n`;
        response += `  • Tag: ${result.element.tagName}\n`;
        response += `  • Class: ${result.element.className || '(none)'}\n`;
        response += `  • Text: ${result.element.text || '(no text)'}\n`;
        response += `  • Position: ${result.element.position.x}, ${result.element.position.y} (${result.element.position.width}x${result.element.position.height})\n`;
        response += `  • Human Selection ID: ${result.element.id}\n\n`;

        // Add data-mcp-id if element doesn't have one
        const hasMcpId = await this.page.evaluate((selector) => {
          const element = document.querySelector(`[data-human-selected="${selector}"]`);
          if (element && !element.hasAttribute('data-mcp-id')) {
            const id = `human-identified-${Date.now()}`;
            element.setAttribute('data-mcp-id', id);
            element.setAttribute('data-mcp-type', 'human-selected');
            element.setAttribute('data-mcp-action', 'click');
            return id;
          }
          return element?.getAttribute('data-mcp-id') || null;
        }, result.element.id);

        if (hasMcpId) {
          response += `🎯 Element tagged with MCP ID: ${hasMcpId}\n`;
          response += `   You can now interact with it using:\n`;
          response += `   execute_action({actionId: "${hasMcpId}"})\n\n`;
        }

        // Take screenshot after selection
        const afterScreenshot = await this.page.screenshot({ encoding: 'base64' });
        
        response += `📸 Screenshots captured (before and after selection)\n`;
        response += `💡 The element has been highlighted and marked for future reference\n`;

        // Remap the page to include the new element
        await this.remapPage({});
        
      } else if (result.cancelled) {
        response += `❌ Selection cancelled by user\n`;
      } else {
        response += `❌ Failed to identify element: ${result.error || 'Unknown error'}\n`;
      }

      return {
        content: [{ type: 'text', text: response }]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Human interaction error: ${error}`,
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
      
      // Fast check: Look for specific CAPTCHA elements in DOM first
      const hasCaptchaElements = await this.page.evaluate(() => {
        const captchaSelectors = [
          '.g-recaptcha',
          '#recaptcha',
          '[data-sitekey]',
          'iframe[src*="recaptcha"]',
          'iframe[title*="reCAPTCHA"]',
          '.cf-challenge-form',
          '.challenge-form',
          'div[class*="captcha"]',
          'div[id*="captcha"]',
          '.h-captcha',
          'iframe[src*="hcaptcha"]'
        ];
        
        return captchaSelectors.some(selector => document.querySelector(selector) !== null);
      });
      
      if (hasCaptchaElements) {
        var isCaptcha = true;
      } else {
        // Fallback: URL and text-based detection
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
        
        // Fast check: URL first (most reliable for Google, Cloudflare, etc.)
        const urlLower = currentUrl.toLowerCase();
        const isUrlCaptcha = captchaIndicators.some(indicator => urlLower.includes(indicator));
        
        if (isUrlCaptcha) {
          var isCaptcha = true;
        } else {
          // Medium speed check: title
          const title = await this.page.title();
          const titleLower = title.toLowerCase();
          const isTitleCaptcha = captchaIndicators.some(indicator => titleLower.includes(indicator));
          
          if (isTitleCaptcha) {
            var isCaptcha = true;
          } else {
            // Slower check: limited page content (only if URL and title don't match)
            const pageText = await this.page.evaluate(() => {
              // Only check key elements instead of all text for speed
              const selectors = ['h1', 'h2', '.main-content', '#content', 'form', '.error-message', '.challenge'];
              const texts = selectors.map(sel => {
                const elements = document.querySelectorAll(sel);
                return Array.from(elements).map(el => el.textContent || '').join(' ');
              }).join(' ').toLowerCase();
              return texts;
            });
            
            var isCaptcha = captchaIndicators.some(indicator => pageText.includes(indicator));
          }
        }
      }
      
      if (isCaptcha) {
        // console.error('[InjectAgentScript] CAPTCHA page detected');
        // Still inject the script for basic functionality, but mark as CAPTCHA
        const basicManifest = {
          elements: [],
          url: currentUrl,
          title: await this.page.title(),
          isCaptcha: true
        };
        return basicManifest;
      }
      
      // Inject browser agent generator script
      let browserScript: string;
      try {
        browserScript = fs.readFileSync(path.join(__dirname, 'browser-agent-generator.js'), 'utf8')
          .replace(/export function/g, 'function');
      } catch (e) {
        // In development, fallback to TypeScript file
        try {
          browserScript = fs.readFileSync(path.join(__dirname, '..', 'src', 'browser-agent-generator.ts'), 'utf8')
            .replace(/export function/g, 'function')
            .replace(/: Element/g, '')
            .replace(/: string/g, '')
            .replace(/: boolean/g, '')
            .replace(/: number/g, '');
        } catch (fallbackError) {
          throw new Error('Failed to load browser agent generator script');
        }
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

    // Clean up any existing wait states before starting
    await this.waitStateManager.cleanup(this.page);

    try {
      const originalUrl = this.page.url();
      // console.error(`[WaitForChanges] Starting from URL: ${originalUrl}`);
      
      // Create navigation promise with immediate cleanup on resolution
      let navigationResolved = false;
      const navigationPromise = new Promise<boolean>((resolve) => {
        const navPromise = this.page!.waitForNavigation({ 
          timeout: args.timeout || 30000,
          waitUntil: 'domcontentloaded'
        });
        
        navPromise
          .then(() => {
            if (!navigationResolved) {
              navigationResolved = true;
              resolve(true);
            }
          })
          .catch(() => {
            if (!navigationResolved) {
              navigationResolved = true;
              resolve(false);
            }
          });
      });
      
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
          return getCaptchaMessage(currentUrl, { detectionType: 'general' });
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
          return getCaptchaMessage(this.page?.url() || '', { detectionType: 'general' });
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

  /**
   * Get available MCP tools summary for agent reference
   */
  private getToolsSummary(): string {
    const toolCategories: { [key: string]: string[] } = {
      'Browser Control': [],
      'Agent Page': [],
      'Content Reading': [],
      'Forms': [],
      'Screenshots': [],
      'Debugging': [],
      'Network': [],
      'DevTools': [],
      'Storage': [],
      'Other': []
    };

    // Get tools from the tools array defined in the constructor
    const toolsList = [
      { name: 'browser_navigate', description: 'Navigate to a URL and generate agent page (auto-launches browser if needed)' },
      { name: 'browser_close', description: 'Close the browser instance' },
      { name: 'agent_execute_action', description: 'Execute an action on the agent page' },
      { name: 'agent_get_page_state', description: 'Get the current state from the agent page' },
      { name: 'agent_discover_actions', description: 'Get available actions from the agent page' },
      { name: 'agent_generate_page', description: 'Generate agent page view of current webpage' },
      { name: 'agent_remap_page', description: 'Re-scan and remap the current page after DOM changes' },
      { name: 'agent_wait_for_changes', description: 'Wait for page changes and return new agent page' },
      { name: 'agent_get_page_chunk', description: 'Get more elements when page has too many to show at once' },
      { name: 'agent_read_content', description: 'Extract readable page content in markdown format - perfect for reading articles, search results, or any page text' },
      { name: 'form_fill', description: 'Fill an entire form with JSON data' },
      { name: 'form_detect', description: 'Detect all forms on the page and get JSON templates' },
      { name: 'form_ask_human', description: 'Ask a human to visually identify an element by clicking on it' },
      { name: 'screenshot_capture', description: 'Take a screenshot with advanced options' },
      { name: 'screenshot_paginated', description: 'Take screenshots of a long page in segments' },
      { name: 'screenshot_get_chunk', description: 'Get a specific chunk of a large screenshot' },
      { name: 'debug_set_breakpoint', description: 'Set a breakpoint at a specific line in JavaScript code' },
      { name: 'debug_continue', description: 'Resume execution after hitting a breakpoint' },
      { name: 'debug_step_over', description: 'Step over the current line during debugging' },
      { name: 'debug_evaluate', description: 'Evaluate expression in the current debug context' },
      { name: 'network_get_console_logs', description: 'Get console logs from the page' },
      { name: 'network_get_api_logs', description: 'Get detailed API request logs with headers and payload' },
      { name: 'network_replay_request', description: 'Replay an API request with modified payload/headers' },
      { name: 'network_throttle', description: 'Control network speed to simulate slow connections' },
      { name: 'devtools_inspect_element', description: 'Inspect an element using DevTools' },
      { name: 'devtools_modify_css', description: 'Modify CSS properties of an element through DevTools' },
      { name: 'devtools_highlight_element', description: 'Highlight an element on the page using DevTools' },
      { name: 'storage_get', description: 'Get localStorage, sessionStorage, and cookies' },
      { name: 'storage_set', description: 'Set a value in localStorage or sessionStorage' },
    ];

    toolsList.forEach((tool: { name: string; description: string }) => {
      const name = tool.name;
      const desc = tool.description;
      
      if (name.startsWith('browser_')) {
        toolCategories['Browser Control'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('agent_')) {
        if (name === 'agent_read_content') {
          toolCategories['Content Reading'].push(`• ${name}: ${desc}`);
        } else {
          toolCategories['Agent Page'].push(`• ${name}: ${desc}`);
        }
      } else if (name.startsWith('form_')) {
        toolCategories['Forms'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('screenshot_')) {
        toolCategories['Screenshots'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('debug_') || name.includes('debug')) {
        toolCategories['Debugging'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('network_') || name.includes('console') || name.includes('api')) {
        toolCategories['Network'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('devtools_')) {
        toolCategories['DevTools'].push(`• ${name}: ${desc}`);
      } else if (name.startsWith('storage_')) {
        toolCategories['Storage'].push(`• ${name}: ${desc}`);
      } else {
        toolCategories['Other'].push(`• ${name}: ${desc}`);
      }
    });

    const lines: string[] = [];
    lines.push('🛠️ AVAILABLE TOOLS:');
    
    Object.entries(toolCategories).forEach(([category, tools]) => {
      if (tools.length > 0) {
        lines.push(`  ${category}:`);
        tools.forEach(tool => lines.push(`    ${tool}`));
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * Extract readable page content in markdown or text format
   */
  private async setNetworkThrottling(args: any): Promise<any> {
    if (!this.page) {
      return {
        content: [{ type: 'text', text: '❌ No page loaded. Please navigate to a page first.' }],
      };
    }

    try {
      const { preset, downloadThroughput, uploadThroughput, latency } = args;
      
      // Network throttling presets
      const presets: Record<string, any> = {
        'slow-3g': {
          offline: false,
          downloadThroughput: 50000, // 50KB/s
          uploadThroughput: 20000,   // 20KB/s
          latency: 2000              // 2 seconds
        },
        'fast-3g': {
          offline: false,
          downloadThroughput: 150000, // 150KB/s
          uploadThroughput: 75000,    // 75KB/s
          latency: 560               // 560ms
        },
        'offline': {
          offline: true,
          downloadThroughput: 0,
          uploadThroughput: 0,
          latency: 0
        },
        'no-throttling': {
          offline: false,
          downloadThroughput: 0, // 0 means no limit
          uploadThroughput: 0,   // 0 means no limit
          latency: 0
        }
      };

      let config;
      if (preset && presets[preset]) {
        config = presets[preset];
      } else {
        // Custom configuration
        config = {
          offline: false,
          downloadThroughput: downloadThroughput || 0,
          uploadThroughput: uploadThroughput || 0,
          latency: latency || 0
        };
      }

      // Apply network conditions using CDP
      const cdp = await this.page.target().createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', config);
      await cdp.detach();

      return {
        content: [
          {
            type: 'text',
            text: `🌐 Network throttling applied\n\n` +
                  `📊 Configuration:\n` +
                  `  • Preset: ${preset || 'custom'}\n` +
                  `  • Download: ${config.downloadThroughput === 0 ? 'unlimited' : `${(config.downloadThroughput / 1000).toFixed(1)} KB/s`}\n` +
                  `  • Upload: ${config.uploadThroughput === 0 ? 'unlimited' : `${(config.uploadThroughput / 1000).toFixed(1)} KB/s`}\n` +
                  `  • Latency: ${config.latency}ms\n` +
                  `  • Offline: ${config.offline ? 'Yes' : 'No'}\n\n` +
                  `💡 Network conditions will apply to all future requests until changed.`
          }
        ],
      };

    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to set network throttling: ${error.message}`
          }
        ],
      };
    }
  }

  private async readPageContent(args: any): Promise<any> {
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

    try {
      const { format = 'markdown', page, pageSize, maxElements } = args;
      
      // Get the current page HTML
      const html = await this.page.content();
      const url = await this.page.url();
      
      const options = { page, pageSize, maxElements };
      let result;
      
      if (format === 'text') {
        result = ContentExtractor.extractPlainText(html, options);
      } else {
        result = ContentExtractor.extractReadableContent(html, url, options);
      }

      let responseText = `📖 **Page Content** (${format})`;
      
      if (result.pagination) {
        const { currentPage, totalPages, hasMore, totalElements, processedElements } = result.pagination;
        responseText += ` - Page ${currentPage}/${totalPages}`;
        if (totalElements) {
          responseText += ` (${processedElements}/${totalElements} elements)`;
        }
        if (hasMore) {
          responseText += ` (use page: ${currentPage + 1} for next)`;
        }
      }
      
      responseText += `\n\n${result.content}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error extracting page content: ${error?.message || error}`,
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
      let viewport = await this.page.viewport();
      if (!viewport) {
        // Set a default viewport if none exists
        await this.page.setViewport({ width: 1920, height: 1080 });
        viewport = await this.page.viewport();
        if (!viewport) {
          throw new Error('Could not get or set viewport dimensions');
        }
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

        // Validate first chunk screenshot buffer
        if (!firstChunk || firstChunk.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `❌ First chunk screenshot failed: Empty or invalid screenshot buffer. Page may not be fully loaded.`,
            }],
          };
        }

        const firstChunkBase64 = (firstChunk as Buffer).toString('base64');
        
        // Additional validation: ensure base64 string is not empty
        if (!firstChunkBase64 || firstChunkBase64.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `❌ First chunk screenshot failed: Empty base64 conversion. Screenshot buffer may be corrupted.`,
            }],
          };
        }
        
        // Open screenshot in new tab if requested
        if (args.openInNewTab !== false) {
          try {
            const newPage = await this.browser!.newPage();
            await newPage.goto(`data:image/jpeg;base64,${firstChunkBase64}`);
            // console.error('[Screenshot] Opened first chunk in new tab');
            
            // Switch back to original tab
            if (this.page) {
              await this.page.bringToFront();
            }
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

      // Validate element screenshot buffer
      if (!screenshot || screenshot.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `❌ Element screenshot failed: Empty or invalid screenshot buffer for selector ${args.selector}`,
          }],
        };
      }

      const screenshotBase64 = (screenshot as Buffer).toString('base64');
      
      // Additional validation: ensure base64 string is not empty
      if (!screenshotBase64 || screenshotBase64.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `❌ Element screenshot failed: Empty base64 conversion for selector ${args.selector}`,
          }],
        };
      }
      
      // Open screenshot in new tab if requested (not for system screenshots)
      if (args.openInNewTab !== false) {
        try {
          const newPage = await this.browser!.newPage();
          await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
          // console.error('[Screenshot] Opened element screenshot in new tab');
          
          // Switch back to original tab
          if (this.page) {
            await this.page.bringToFront();
          }
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

    // Validate screenshot buffer before converting to base64
    if (!screenshot || screenshot.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot failed: Empty or invalid screenshot buffer. Page may not be fully loaded or accessible.`,
        }],
      };
    }

    const screenshotBase64 = (screenshot as Buffer).toString('base64');
    
    // Additional validation: ensure base64 string is not empty
    if (!screenshotBase64 || screenshotBase64.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot failed: Empty base64 conversion. Screenshot buffer may be corrupted.`,
        }],
      };
    }
    
    // Open screenshot in new tab if requested (not for system screenshots)
    if (args.openInNewTab !== false) {
      try {
        const newPage = await this.browser!.newPage();
        await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
        // console.error('[Screenshot] Opened screenshot in new tab');
        
        // Switch back to original tab
        if (this.page) {
          await this.page.bringToFront();
        }
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

    let viewport = await this.page.viewport();
    if (!viewport) {
      // Set a default viewport if none exists
      await this.page.setViewport({ width: 1920, height: 1080 });
      viewport = await this.page.viewport();
      if (!viewport) {
        throw new Error('Could not get or set viewport dimensions');
      }
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

    // Validate chunk screenshot buffer
    if (!screenshot || screenshot.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Chunk ${chunk} screenshot failed: Empty or invalid screenshot buffer. Page may not be fully loaded.`,
        }],
      };
    }

    const screenshotBase64 = (screenshot as Buffer).toString('base64');
    
    // Additional validation: ensure base64 string is not empty
    if (!screenshotBase64 || screenshotBase64.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Chunk ${chunk} screenshot failed: Empty base64 conversion. Screenshot buffer may be corrupted.`,
        }],
      };
    }
    
    // Open screenshot in new tab
    try {
      const newPage = await this.browser!.newPage();
      await newPage.goto(`data:image/jpeg;base64,${screenshotBase64}`);
      // console.error(`[Screenshot] Opened chunk ${chunk} in new tab`);
      
      // Switch back to original tab
      if (this.page) {
        await this.page.bringToFront();
      }
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

  async listTabs() {
    if (!this.browser) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Browser not initialized. Please navigate to a page first.',
          },
        ],
      };
    }

    try {
      const pages = await this.browser.pages();
      let tabList = '📑 Open Browser Tabs:\n\n';
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const title = await page.title();
        const url = page.url();
        const isCurrentTab = page === this.page ? ' 👈 CURRENT' : '';
        
        tabList += `[${i}] ${title || 'Untitled'}\n`;
        tabList += `    📍 ${url}\n`;
        tabList += `    ${isCurrentTab}\n\n`;
      }
      
      tabList += `💡 Use switch_tab({index: N}) to switch to tab N`;

      return {
        content: [
          {
            type: 'text',
            text: tabList,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  async switchTab(args: { index: number }) {
    if (!this.browser) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Browser not initialized. Please navigate to a page first.',
          },
        ],
      };
    }

    try {
      const pages = await this.browser.pages();
      
      if (args.index < 0 || args.index >= pages.length) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Invalid tab index ${args.index}. Available tabs: 0-${pages.length - 1}`,
            },
          ],
        };
      }

      const targetPage = pages[args.index];
      const title = await targetPage.title();
      const url = targetPage.url();
      
      // Switch to the target tab
      await targetPage.bringToFront();
      this.page = targetPage;
      
      // Clean up existing tools before creating new ones
      await this.cleanupTools();
      
      // Re-initialize tools for the new page
      this.devToolsElements = new DevToolsElements();
      this.networkTools = new NetworkTools(targetPage);
      this.pageAnalysis = new PageAnalysis(targetPage);
      
      // Initialize DevToolsElements with CDP session
      try {
        // Clean up old CDP session if it exists
        if (this.cdpSession) {
          try {
            await this.cdpSession.detach();
          } catch (e) {
            // Ignore errors when detaching
          }
          this.cdpSession = null;
        }
        
        // Create new CDP session for the new page
        this.cdpSession = await targetPage.target().createCDPSession();
        await this.devToolsElements.initialize(targetPage, this.cdpSession);
      } catch (err) {
        // console.error('[SwitchTab] DevToolsElements CDP setup error:', err);
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Switched to tab ${args.index}\n` +
                  `📍 Title: ${title || 'Untitled'}\n` +
                  `🌐 URL: ${url}\n\n` +
                  `💡 All Supapup tools are now connected to this tab`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to switch tab: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // Cleanup method to remove event listeners from existing tools
  private async cleanupTools() {
    if (this.networkTools && typeof this.networkTools.cleanup === 'function') {
      await this.networkTools.cleanup();
    }
    if (this.debuggingTools && typeof this.debuggingTools.cleanup === 'function') {
      await this.debuggingTools.cleanup();
    }
    if (this.devtools && typeof this.devtools.cleanup === 'function') {
      await this.devtools.cleanup();
    }
    if (this.devToolsElements && typeof this.devToolsElements.cleanup === 'function') {
      await this.devToolsElements.cleanup();
    }
    if (this.storageTools && typeof this.storageTools.cleanup === 'function') {
      await this.storageTools.cleanup();
    }
    
    // Clean up CDP session
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch (e) {
        // Ignore errors when detaching
      }
      this.cdpSession = null;
    }
    
    // Clean up page listeners
    this.cleanupPageListeners();
    // Add more cleanup for other tools if needed
  }

  // Clean up page event listeners
  private cleanupPageListeners() {
    if (this.page) {
      // Remove all page event listeners
      this.page.off('error');
      this.page.off('console');
      this.page.off('request');
      this.page.off('response');
      // Turn off request interception to clean up request listeners
      this.page.setRequestInterception(false).catch(() => {
        // Ignore errors when cleaning up
      });
    }
    if (this.browser) {
      this.browser.off('disconnected');
    }
  }

  private cleanupNavigationListeners() {
    if (this.page && this.navigationListeners.size > 0) {
      // Remove all tracked navigation listeners
      for (const [event, handler] of this.navigationListeners) {
        this.page.off(event as any, handler as any);
      }
      this.navigationListeners.clear();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      // Clean up wait states first
      if (this.page) {
        await this.waitStateManager.cleanup(this.page);
      }
      
      // Clean up tools before closing
      await this.cleanupTools();
      
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
    
    // Inject complete interaction script after page loads
    await this.page!.addScriptTag({
      content: `
        // Dialog overrides for MCP compatibility
        (function() {
          const originalAlert = window.alert;
          const originalConfirm = window.confirm;
          const originalPrompt = window.prompt;
          
          window.alert = function(message) {
            console.log('[MCP] Alert intercepted:', message);
            const alertDiv = document.createElement('div');
            alertDiv.id = 'mcp-alert-' + Date.now();
            alertDiv.setAttribute('data-mcp-id', 'alert-dialog');
            alertDiv.setAttribute('data-mcp-type', 'alert');
            alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#ff4444;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);';
            alertDiv.innerHTML = '<div style="margin-bottom:10px;">' + message + '</div><button data-mcp-id="alert-ok" onclick="this.parentElement.remove();" style="background:white;color:#ff4444;border:none;padding:5px 10px;border-radius:3px;">OK</button>';
            document.body.appendChild(alertDiv);
            return undefined;
          };
          
          window.confirm = function(message) {
            console.log('[MCP] Confirm intercepted:', message);
            const confirmDiv = document.createElement('div');
            confirmDiv.id = 'mcp-confirm-' + Date.now();
            confirmDiv.setAttribute('data-mcp-id', 'confirm-dialog');
            confirmDiv.setAttribute('data-mcp-type', 'confirm');
            confirmDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#4444ff;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);';
            confirmDiv.innerHTML = '<div style="margin-bottom:10px;">' + message + '</div><button data-mcp-id="confirm-ok" onclick="window.__MCP_CONFIRM_RESULT__ = true; this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="confirm-cancel" onclick="window.__MCP_CONFIRM_RESULT__ = false; this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
            document.body.appendChild(confirmDiv);
            return false; // Default to false for non-blocking
          };
          
          window.prompt = function(message, defaultValue) {
            console.log('[MCP] Prompt intercepted:', message);
            const promptDiv = document.createElement('div');
            promptDiv.id = 'mcp-prompt-' + Date.now();
            promptDiv.setAttribute('data-mcp-id', 'prompt-dialog');
            promptDiv.setAttribute('data-mcp-type', 'prompt');
            promptDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#44ff44;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);';
            promptDiv.innerHTML = '<div style="margin-bottom:10px;">' + message + '</div><input type="text" data-mcp-id="prompt-input" value="' + (defaultValue || '') + '" style="width:200px;padding:5px;margin-bottom:10px;border:none;border-radius:3px;"><br><button data-mcp-id="prompt-ok" onclick="window.__MCP_PROMPT_RESULT__ = this.parentElement.querySelector(\'[data-mcp-id=\"prompt-input\"]\').value; this.parentElement.remove();" style="background:white;color:#44ff44;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="prompt-cancel" onclick="window.__MCP_PROMPT_RESULT__ = null; this.parentElement.remove();" style="background:white;color:#44ff44;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
            document.body.appendChild(promptDiv);
            return null; // Default to null for non-blocking
          };
          
          console.log('[MCP] Dialog overrides installed');
        })();
        
        ${attributeScript}
        ${agentPageScript}
        
        // Update manifest after script is loaded
        window.__AGENT_PAGE__.manifest = ${JSON.stringify(manifest, (key, value) => key === 'element' ? undefined : value)};
      `
    });
  }

  // Storage management methods
  private async getStorage(args: { type?: string }) {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      const type = args.type || 'all';
      let data: any = {};

      if (type === 'all' || type === 'localStorage') {
        data.localStorage = await this.storageTools.getLocalStorage();
      }
      if (type === 'all' || type === 'sessionStorage') {
        data.sessionStorage = await this.storageTools.getSessionStorage();
      }
      if (type === 'all' || type === 'cookies') {
        data.cookies = await this.storageTools.getCookies();
      }

      const formatted = this.storageTools.formatStorageData(data);
      return {
        content: [{ type: 'text', text: formatted }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error getting storage: ${error.message}` }],
      };
    }
  }

  private async setStorage(args: { type: string; key: string; value: string }) {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      if (args.type === 'localStorage') {
        await this.storageTools.setLocalStorage(args.key, args.value);
      } else if (args.type === 'sessionStorage') {
        await this.storageTools.setSessionStorage(args.key, args.value);
      } else {
        throw new Error(`Invalid storage type: ${args.type}`);
      }

      return {
        content: [{ type: 'text', text: `✅ Set ${args.type}.${args.key} = "${args.value}"` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error setting storage: ${error.message}` }],
      };
    }
  }

  private async removeStorage(args: { type: string; key: string }) {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      if (args.type === 'localStorage') {
        await this.storageTools.removeLocalStorage(args.key);
      } else if (args.type === 'sessionStorage') {
        await this.storageTools.removeSessionStorage(args.key);
      } else {
        throw new Error(`Invalid storage type: ${args.type}`);
      }

      return {
        content: [{ type: 'text', text: `✅ Removed ${args.type}.${args.key}` }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error removing storage: ${error.message}` }],
      };
    }
  }

  private async clearStorage(args: { type?: string }) {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      const type = args.type || 'all';

      if (type === 'all') {
        await this.storageTools.clearAllStorage();
        return {
          content: [{ type: 'text', text: '✅ Cleared all storage (localStorage, sessionStorage, cookies)' }],
        };
      } else if (type === 'localStorage') {
        await this.storageTools.clearLocalStorage();
        return {
          content: [{ type: 'text', text: '✅ Cleared localStorage' }],
        };
      } else if (type === 'sessionStorage') {
        await this.storageTools.clearSessionStorage();
        return {
          content: [{ type: 'text', text: '✅ Cleared sessionStorage' }],
        };
      } else if (type === 'cookies') {
        await this.storageTools.clearCookies();
        return {
          content: [{ type: 'text', text: '✅ Cleared cookies' }],
        };
      } else {
        throw new Error(`Invalid storage type: ${type}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error clearing storage: ${error.message}` }],
      };
    }
  }

  private async exportStorageState() {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      const state = await this.storageTools.exportStorageState();
      return {
        content: [
          { 
            type: 'text', 
            text: '✅ Storage state exported\n\n' + 
                  '💾 Save this state object to persist the session:\n\n' +
                  '```json\n' + JSON.stringify(state, null, 2) + '\n```' 
          }
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error exporting storage: ${error.message}` }],
      };
    }
  }

  private async importStorageState(args: { state: any }) {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      await this.storageTools.importStorageState(args.state);
      return {
        content: [{ type: 'text', text: '✅ Storage state imported successfully' }],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error importing storage: ${error.message}` }],
      };
    }
  }

  private async getStorageInfo() {
    if (!this.storageTools) {
      return {
        content: [{ type: 'text', text: '❌ Storage tools not initialized. Please navigate to a page first.' }],
      };
    }

    try {
      const info = await this.storageTools.getStorageInfo();
      const usageMB = (info.usage / 1024 / 1024).toFixed(2);
      const quotaMB = (info.quota / 1024 / 1024).toFixed(2);
      const percentUsed = ((info.usage / info.quota) * 100).toFixed(2);

      return {
        content: [
          { 
            type: 'text', 
            text: `📊 Storage Information\n` +
                  `====================\n\n` +
                  `📈 Usage: ${usageMB} MB / ${quotaMB} MB (${percentUsed}%)\n` +
                  `💾 Available: ${((info.quota - info.usage) / 1024 / 1024).toFixed(2)} MB` 
          }
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Error getting storage info: ${error.message}` }],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // MCP servers should not output to stderr during normal operation
    // as it can be interpreted as errors by MCP clients
    
    // Handle process termination signals
    process.on('SIGINT', async () => {
      if (this.browser) {
        await this.closeBrowser();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      if (this.browser) {
        await this.closeBrowser();
      }
      process.exit(0);
    });
  }
}

// Only run server if this is the main module
// Check if this file is being run directly (handles symlinks too)
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith('/dist/index.js')
);

if (isMainModule) {
  const server = new SupapupServer();
  server.run().catch(console.error);
}