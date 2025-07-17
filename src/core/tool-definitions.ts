export class ToolDefinitions {
  static getToolDefinitions() {
    return [
      // Browser Management Tools
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL and generate agent page (auto-launches browser if needed)',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
            visible: { type: 'boolean', description: 'Optional: set browser visibility for this session (true=visible, false=headless)' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_close',
        description: 'Close the browser instance',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'browser_set_visibility',
        description: 'Control browser visibility (headless/visible mode). Requires browser restart to take effect.',
        inputSchema: {
          type: 'object',
          properties: {
            visible: { type: 'boolean', description: 'true to show browser window, false for headless mode' },
            restart: { type: 'boolean', description: 'Whether to restart browser immediately (default: true)' },
          },
          required: ['visible'],
        },
      },
      {
        name: 'browser_open_in_tab',
        description: 'Open any content in a new browser tab (HTML, text, JSON, images, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to display in the tab' },
            contentType: { type: 'string', description: 'MIME type of content (text/html, text/plain, application/json, image/jpeg, etc.)', default: 'text/html' },
            title: { type: 'string', description: 'Optional title for the tab' },
          },
          required: ['content'],
        },
      },
      {
        name: 'browser_list_tabs',
        description: 'List all open browser tabs with their titles and URLs',
        inputSchema: { type: 'object', additionalProperties: false, properties: {} },
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

      // Agent Interaction Tools
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
        name: 'agent_generate_page',
        description: 'Generate agent page view of current webpage',
        inputSchema: {
          type: 'object',
          properties: {
            enhanced: { type: 'boolean', description: 'Use enhanced detection for better element identification' },
            mode: { type: 'string', enum: ['auto', 'react', 'vue', 'angular', 'vanilla'], description: 'Detection mode' },
          },
        },
      },
      {
        name: 'agent_remap_page',
        description: 'Re-scan and remap the current page after DOM changes (useful after AJAX updates)',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Timeout in ms (default 5000)' },
            waitForSelector: { type: 'string', description: 'Optional: wait for specific selector before remapping' },
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
            waitForNavigation: { type: 'boolean', description: 'Expect navigation/redirect' },
            waitForSelector: { type: 'string', description: 'Wait for specific element to appear' },
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
      {
        name: 'get_agent_page_chunk',
        description: 'Retrieve a specific chunk of a large agent page that was automatically paginated',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Agent page chunk ID returned from navigation' },
            chunk: { type: 'number', description: 'Chunk number to retrieve (1-based)' },
          },
          required: ['id', 'chunk'],
        },
      },
      {
        name: 'agent_read_content',
        description: 'Extract readable page content in markdown format - perfect for reading articles, search results, or any page text. Supports pagination for large content.',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['markdown', 'text'], description: 'Output format: "markdown" (default) or "text"' },
            page: { type: 'number', description: 'Page number for paginated content (1-based). Use when content is too long.' },
            pageSize: { type: 'number', description: 'Characters per page (default: 20000). Adjust for smaller/larger chunks.' },
            maxElements: { type: 'number', description: 'Max DOM elements to process per page (default: 100). Use for very large pages like Wikipedia.' },
          },
        },
      },

      // Screenshot Tools
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
        name: 'browser_navigate_and_capture_loading_sequence',
        description: 'Navigate to a URL while capturing visual loading sequence to debug loading states, CLS issues, and progressive rendering. Optimized for speed with low-resolution captures.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
            captureInterval: { type: 'number', description: 'Milliseconds between captures - agent configurable (default: 500, try 250 for faster sites, 1000 for slower)' },
            maxDuration: { type: 'number', description: 'Maximum capture duration in milliseconds (default: 10000)' },
            quality: { type: 'number', description: 'JPEG quality 1-100 (default: 30 for speed, increase for detail)' },
            stopOnNetworkIdle: { type: 'boolean', description: 'Stop capturing when network becomes idle (default: true)' },
            viewport: { 
              type: 'object', 
              description: 'Viewport size for captures (default: {width: 1200, height: 800})',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' }
              }
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'get_loading_sequence_frame',
        description: 'Retrieve a specific frame from a loading sequence capture to see intermediate loading states',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Loading sequence ID from browser_navigate_and_capture_loading_sequence' },
            frame: { type: 'number', description: 'Frame number to retrieve (1-based)' },
          },
          required: ['id', 'frame'],
        },
      },

      // Server Tools
      {
        name: 'server_info',
        description: 'Get Supapup server version and build information',
        inputSchema: { type: 'object', properties: {} },
      },

      // Form Tools
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
        inputSchema: { type: 'object', properties: {} },
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

      // Debug Tools
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

      // Network Tools
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
                  modifyHeaders: { type: 'object', description: 'Headers to add/modify' },
                  modifyPayload: { description: 'Payload modifications (object will be merged)' },
                  block: { type: 'boolean', description: 'Block this request entirely' },
                },
              },
            },
          },
          required: ['enable'],
        },
      },
      {
        name: 'network_throttle',
        description: 'Control network speed to simulate slow connections (useful for testing long AJAX calls)',
        inputSchema: {
          type: 'object',
          properties: {
            preset: { type: 'string', enum: ['slow-3g', 'fast-3g', 'offline', 'no-throttling'], description: 'Network preset: "slow-3g", "fast-3g", "offline", "no-throttling"' },
            downloadThroughput: { type: 'number', description: 'Download speed in bytes/second (custom)' },
            uploadThroughput: { type: 'number', description: 'Upload speed in bytes/second (custom)' },
            latency: { type: 'number', description: 'Network latency in milliseconds (custom)' },
          },
          required: ['preset'],
        },
      },

      // Page Analysis Tools
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

      // DevTools Elements
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
            type: { type: 'string', enum: ['innerHTML', 'outerHTML', 'attribute'], description: 'Modification type: "innerHTML", "outerHTML", or "attribute"' },
            value: { type: 'string', description: 'New value for attribute or innerHTML' },
            attribute: { type: 'string', description: 'Attribute name to modify (optional, for attribute changes)' },
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

      // Storage Tools
      {
        name: 'storage_get',
        description: 'Get localStorage, sessionStorage, and cookies for current page',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['all', 'localStorage', 'sessionStorage', 'cookies'], description: 'Type of storage to retrieve (default: all)' },
          },
        },
      },
      {
        name: 'storage_set',
        description: 'Set a value in localStorage or sessionStorage',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['localStorage', 'sessionStorage'], description: 'Storage type' },
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
            type: { type: 'string', enum: ['localStorage', 'sessionStorage'], description: 'Storage type' },
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
            type: { type: 'string', enum: ['all', 'localStorage', 'sessionStorage', 'cookies'], description: 'What to clear (default: all)' },
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
    ];
  }
}