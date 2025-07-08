# Supapup 🐾

<p align="center">
  <strong>MCP-aware Puppeteer wrapper for intelligent web automation</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#mcp-tools">MCP Tools</a> •
  <a href="#examples">Examples</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## 🚀 See the Difference

### ❌ With Regular Puppeteer MCP
```console
$ puppeteer navigate https://example.com
✓ Navigated to https://example.com

$ puppeteer screenshot
✓ Screenshot taken (800x600)
[📸 High token cost image data...]

$ # Now what? Need to inspect elements, write selectors, execute JS...
```

### ✅ With Supapup
```console
$ supapup navigate https://example.com
✅ Navigation successful
📍 URL: https://example.com

AGENT PAGE VIEW
==============================
Found 42 interactive elements

📝 FORMS:
  • form: login-form
    - email: form-login-email
    - password: form-login-password  
    - submit: form-login-submit

🎛️ CONTROLS:
  • link: sign-up → signup-link
  • link: forgot-password → forgot-password-link
  • button: get-started → get-started-button
  
✨ Ready to interact! No screenshots needed.
Example: execute_action({actionId: "form-login-email", params: {value: "user@example.com"}})
```

**The Result?**
- ⚡ **10x faster** - Instant structured data vs screenshots + manual inspection
- 💰 **90% fewer tokens** - Text-based output instead of images
- 🎯 **Zero complexity** - Semantic IDs ready to use, no CSS selectors needed
- 🔄 **Dynamic handling** - Automatically remaps after page changes

---

Supapup is an intelligent web automation tool that bridges the gap between AI agents and web browsers. It wraps Puppeteer with Model Context Protocol (MCP) support, providing a structured, predictable interface for programmatic web interaction.

## ✨ Features

### 🤖 Agent-Aware Web Pages
- **Semantic Element IDs**: Instead of brittle CSS selectors, use meaningful IDs like `form-login-email`
- **Structured Representation**: Web pages are presented as organized, actionable interfaces
- **Automatic Element Detection**: Intelligently identifies interactive elements on any page
- **Visual Element Mapping**: Number-based element identification for easy interaction

### 🔍 Advanced Debugging
- **JavaScript Breakpoints**: Set conditional breakpoints and step through code
- **Variable Inspection**: Examine local variables and expressions during debugging
- **Automated Function Debugging**: Trigger and debug specific functions automatically

### 📊 Network Monitoring
- **Request/Response Logging**: Capture all network traffic with headers and payloads
- **API Request Replay**: Replay requests with modified parameters
- **Request Interception**: Modify requests on-the-fly with custom rules
- **Performance Metrics**: Track page load times and resource usage

### 🎯 Smart Navigation
- **CAPTCHA Detection**: Automatically identifies CAPTCHA pages
- **Dynamic Content Handling**: Waits for AJAX/DOM changes after actions
- **Chunked Screenshots**: Handles large pages by splitting screenshots automatically
- **Browser Tab Management**: Open content directly in new tabs

## 📦 Installation

### As an MCP Server

```bash
npm install -g supapup
```

### As a Library

```bash
npm install supapup
```

### From Source

```bash
git clone https://github.com/yourusername/supapup.git
cd supapup
npm install
npm run build
```

## 🚀 Quick Start

### Using with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supapup": {
      "command": "npx",
      "args": ["supapup"]
    }
  }
}
```

### Basic Usage Example

```javascript
import { SupapupServer } from 'supapup';

const server = new SupapupServer();
await server.run();
```

## 🛠️ MCP Tools

### Browser Management
- `navigate` - Navigate to a URL and get agent-friendly page representation
- `screenshot` - Capture screenshots with automatic chunking for large pages
- `close_browser` - Close the browser instance

### Element Interaction
- `execute_action` - Execute actions on elements using semantic IDs
- `discover_actions` - Find all available actions on the current page
- `get_page_state` - Get current page state and element count

### Visual Element Mapping
- `devtools_visual_element_map` - Create numbered visual map of page elements
- JavaScript helpers for numbered elements:
  - `window.__AGENT_PAGE__.clickElement(1)` - Click element 1
  - `window.__AGENT_PAGE__.fillElement(25, "text")` - Fill element 25
  - `window.__AGENT_PAGE__.highlightElement(100)` - Highlight element 100
  - `window.__AGENT_PAGE__.getElementByNumber(1)` - Get element DOM reference

### Debugging
- `set_breakpoint` - Set JavaScript breakpoints with optional conditions
- `debug_continue` - Resume execution after breakpoint
- `debug_step_over` - Step over current line
- `debug_evaluate` - Evaluate expressions in debug context
- `debug_get_variables` - Get local variables at breakpoint

### Network Analysis
- `get_network_logs` - Get all network requests
- `get_api_logs` - Get detailed API request/response logs
- `replay_api_request` - Replay requests with modifications
- `intercept_requests` - Set up request interception rules

### Page Analysis
- `get_performance_metrics` - Get page load and runtime metrics
- `get_accessibility_tree` - Get page accessibility structure
- `inspect_element` - Get detailed element properties
- `evaluate_script` - Execute JavaScript in page context

## 📚 Examples

### Basic Web Automation

```javascript
// Navigate to a page
await navigate({ url: 'https://example.com' });

// Execute an action using semantic ID
await execute_action({ 
  actionId: 'search-input', 
  params: { value: 'AI automation' } 
});

// Click submit button
await execute_action({ 
  actionId: 'search-submit' 
});
```

### Visual Element Interaction

```javascript
// Create visual map
await devtools_visual_element_map();

// Use JavaScript helpers to interact
await evaluate_script({
  script: `
    window.__AGENT_PAGE__.fillElement(5, "user@example.com");
    window.__AGENT_PAGE__.clickElement(10);
  `
});
```

### Network Monitoring

```javascript
// Get API logs
const logs = await get_api_logs({ 
  urlPattern: 'api.example.com' 
});

// Replay request with modifications
await replay_api_request({
  url: 'https://api.example.com/data',
  headers: { 'Authorization': 'Bearer new-token' }
});
```

### Debugging

```javascript
// Set breakpoint
await set_breakpoint({ 
  lineNumber: 42, 
  url: 'https://example.com/script.js' 
});

// Trigger and debug
await debug_function({ lineNumber: 42 });

// Inspect variables
const vars = await debug_get_variables();
```

## 🏗️ Architecture

Supapup consists of several specialized modules:

- **Agent Page Generator**: Creates structured representations of web pages
- **Element Detector**: Automatically identifies interactive elements
- **Debugging Tools**: Full Chrome DevTools Protocol integration
- **Network Tools**: Comprehensive request/response monitoring
- **Page Analysis**: Performance metrics and accessibility analysis
- **DevTools Elements**: Visual element mapping and manipulation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/supapup.git
cd supapup

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Running Tests

```bash
# Run test scripts
node test-agent-generator.js
node test-complex-page.cjs
node test-supapup-flow.cjs
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on top of [Puppeteer](https://pptr.dev/)
- Implements [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Inspired by the need for better AI-browser interaction

## 🔗 Links

- [GitHub Repository](https://github.com/yourusername/supapup)
- [NPM Package](https://www.npmjs.com/package/supapup)
- [Issue Tracker](https://github.com/yourusername/supapup/issues)

---

<p align="center">
  Made with ❤️ for AI agents and developers
</p>