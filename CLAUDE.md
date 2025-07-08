# CLAUDE.md

This file provides guidance to AI assistants (Claude Code, Gemini CLI, etc.) when working with code in this repository.

## Project Overview

Supapup is an MCP (Model Context Protocol) server that wraps Puppeteer with intelligent web interaction capabilities. It provides an agent-aware interface for programmatic web interaction, featuring automatic element detection, debugging tools, and comprehensive network monitoring.

## For Claude Code (claude.ai/code)

When using Supapup with Claude Code, the MCP server provides direct access to all tools. You can navigate websites, interact with elements, debug JavaScript, and monitor network traffic seamlessly.

## For Gemini CLI

When using Supapup with Gemini CLI or other AI assistants, you can:
1. Run Supapup as a standalone MCP server
2. Use the examples in `/examples` directory
3. Integrate via the programmatic API

## Build and Development Commands

```bash
# Build the project
npm run build

# Development mode with hot reload
npm run dev

# Start the built application
npm start
```

## Core Concept: Web Pages for AI Agents

Supapup creates a "web page for agents" - a structured, predictable interface that abstracts away DOM complexity. Instead of agents having to take screenshots, hunt for elements with brittle selectors, or deal with dynamic content, Supapup provides:

- **Stable API**: Semantic IDs like `form-login-email` that are predictable and meaningful
- **Clear Actions**: Each element has an explicit action type (fill, click, navigate, toggle)
- **Direct Execution**: Simple interface via `execute_action({actionId: "form-login-email", params: {value: "test@example.com"}})`
- **Structured Representation**: Organized view of forms, navigation, and controls

### Complete Agent Navigation Flow

1. **Agent calls navigate** → Supapup checks if browser is running, launches if needed, or connects to existing instance
2. **Navigate to URL** → Waits for full page render with JavaScript execution complete
3. **Extract HTML** → Parses page content with JSDOM to find all interactive elements
4. **Enrich with data attributes** → Adds `data-mcp-id`, `data-mcp-type`, `data-mcp-action` to each element in the DOM
5. **Generate agent page** → Creates structured text representation with semantic IDs, grouped by forms/navigation/controls
6. **Inject helper JavaScript** → Adds `window.__AGENT_PAGE__.execute()` method for element interaction
7. **Return agent page to agent** → Agent receives a "map" of the page with clear instructions for interaction

This design enables agents to interact with web pages efficiently without visual analysis or DOM inspection, significantly speeding up web automation tasks.

## Architecture

### Core Components

**MCP Server (src/index.ts:17-627)**
- `SupapupServer` class implements the MCP protocol server
- Manages browser lifecycle and tool routing
- Coordinates between specialized modules for different capabilities

**Agent Page Generation (src/agent-page-generator.ts)**
- `ElementDetector` automatically identifies interactive elements on web pages
- `IDGenerator` creates semantic, context-aware IDs for elements
- `AgentPageGenerator` creates structured representations for AI agents
- Applies `data-mcp-*` attributes to DOM elements for reliable interaction

**HTML Parsing (src/html-parser.ts)**
- `HTMLParser` processes HTML content using JSDOM in Node.js environment
- Generates manifests from HTML content for pages without direct browser access
- Creates element selectors for DOM manipulation

**Debugging Tools (src/debugging-tools.ts)**
- `DebuggingTools` provides full JavaScript debugging capabilities
- Supports breakpoints, step-through debugging, and variable inspection
- Integrates with Chrome DevTools Protocol for debugging support

**Network Monitoring (src/network-tools.ts)**
- `NetworkTools` logs all network requests and console output
- Provides API request replay and modification capabilities
- Supports request interception with custom rules

**Page Analysis (src/page-analysis.ts)**
- Provides accessibility tree analysis and performance metrics
- Handles JavaScript execution and DOM manipulation
- Manages page state and action discovery

### MCP Tool Categories

1. **Browser Management**: launch_browser, navigate, close_browser, screenshot
2. **Element Interaction**: execute_action, discover_actions, get_page_state
3. **Visual Element Mapping**: devtools_visual_element_map - creates numbered visual map of elements
4. **Debugging**: set_breakpoint, debug_continue, debug_step_over, debug_evaluate
5. **Network Analysis**: get_network_logs, get_api_logs, replay_api_request, intercept_requests
6. **Page Analysis**: get_accessibility_tree, inspect_element, get_performance_metrics

### Key Design Patterns

**Agent Page Flow**:
1. Navigate to URL → Browser-side element detection and tagging
2. Generate manifest with `generateAgentPageInBrowser()` 
3. Elements are tagged directly with `data-mcp-id` attributes
4. Inject interaction script → `injectInteractionScript()`
5. Execute actions via `window.__AGENT_PAGE__.execute()`

**Dynamic DOM Handling**:
- After actions that trigger AJAX/DOM changes, Supapup automatically:
  1. Checks for navigation/redirects immediately (including CAPTCHA pages)
  2. If no navigation, waits for DOM mutations to settle
  3. Re-maps all elements with new `data-mcp-id` attributes
  4. Returns updated agent page to the caller
- The agent receives the NEW agent page in the execute_action response
- Manual remapping available via `remap_page` tool
- Explicit waiting available via `wait_for_changes` tool

**Agent Workflow for Dynamic Pages**:
1. `navigate` → receive initial agent page
2. `execute_action` with `waitForChanges: true` → automatically waits and returns new agent page
3. Agent can immediately use new element IDs from the returned page
4. For complex scenarios: `execute_action` followed by `wait_for_changes`

**Element Detection Strategy**:
- Interactive selectors defined in `ElementDetector.INTERACTIVE_SELECTORS`
- Visibility and interactivity validation
- Semantic context extraction from labels, placeholders, and nearby headings
- Intelligent ID generation using context and form structure

**Debugging Integration**:
- Uses Chrome DevTools Protocol for real debugging capabilities
- Supports conditional breakpoints and expression evaluation
- Maintains pause state for step-through debugging

**Visual Element Mapping** (NEW):
- `devtools_visual_element_map` creates a screenshot with numbered elements
- Each interactive element gets a persistent `data-mcp-agent-page-element-{number}` attribute
- JavaScript helper functions available after mapping:
  - `window.__AGENT_PAGE__.clickElement(1)` - Click element by number
  - `window.__AGENT_PAGE__.fillElement(25, "text")` - Fill input by number
  - `window.__AGENT_PAGE__.highlightElement(100, 3000)` - Highlight element
  - `window.__AGENT_PAGE__.getElementByNumber(1)` - Get DOM element reference
- Perfect for visual debugging and when semantic IDs aren't sufficient

## Common Development Patterns

### Adding New Tools
1. Add tool definition to `tools` array in `src/index.ts:46-318`
2. Add handler case in `CallToolRequestSchema` switch statement
3. Implement tool method in appropriate specialized class
4. Follow MCP response format with `content` array

### Working with Page Elements
- Use `ElementDetector.findInteractiveElements()` for discovery
- Generate semantic IDs with `IDGenerator.generateId()`
- Access elements via `data-mcp-id` attributes
- Execute actions through `window.__AGENT_PAGE__.execute()`

### Network Request Monitoring
- All requests automatically logged in `NetworkTools.networkLogs`
- Filter by method, status, or URL patterns
- Replay requests with modified headers/payload
- Intercept and modify requests with custom rules

### Screenshot Chunking
- Screenshots automatically chunked when they exceed token limits (8,800 base64 chars)
- Use `screenshot_paginated` for explicit pagination control
- Retrieve chunks with `screenshot_chunk` tool
- Handles large pages gracefully without token errors

## Testing

The project includes extensive test files demonstrating different capabilities:
- `test-agent-generator.js` - Agent page generation testing
- `test-complex-page.cjs` - Complex page interaction testing  
- `test-supapup-flow.cjs` - End-to-end workflow testing
- `test-debug.html` - Debugging capabilities testing

## MCP Integration

This is a complete MCP server implementation. Run with:
```bash
npm run build && node dist/index.js
```

The server communicates via stdio and provides all tools through the MCP protocol. Client applications can discover and use all available tools through standard MCP calls.