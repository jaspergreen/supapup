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

<div align="center">

## 🎬 [Watch Demo Video](https://youtu.be/Dz3ybvq5YNc)

See Supapup in action - automated web testing with AI agents

</div>

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

<div align="center">

### 🎥 [See it in Action - Watch Demo](https://youtu.be/Dz3ybvq5YNc)

</div>

---

Supapup is an intelligent web automation tool that bridges the gap between AI agents and web browsers. It wraps Puppeteer with Model Context Protocol (MCP) support, providing a structured, predictable interface for programmatic web interaction.

## ✨ Features

### 🤖 Agent-Aware Web Pages
- **Semantic Element IDs**: Instead of brittle CSS selectors, use meaningful IDs like `form-login-email`
- **Structured Representation**: Web pages are presented as organized, actionable interfaces
- **Automatic Element Detection**: Intelligently identifies interactive elements on any page
- **Visual Element Mapping**: Number-based element identification for easy interaction
- **Unique ID Generation**: Handles duplicate elements intelligently - multiple "Add to Cart" buttons get unique IDs with product context

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

### Install with npm

```bash
npm install -g supapup
```

### Using with Claude CLI

1. First, ensure you have Claude CLI installed:
```bash
npm install -g @anthropic/claude-cli
```

2. Configure Supapup as an MCP server:
```bash
claude mcp add supapup "supapup"
```

3. Start using Supapup in Claude:
```bash
claude "Navigate to example.com and find all buttons"
```

For more Claude CLI MCP configuration:
```bash
claude mcp help
```

### Using with Gemini CLI

1. Install Gemini CLI:
```bash
npm install -g @google/gemini-cli
```

2. Configure Supapup in your Gemini config:
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

### As a Library

```bash
npm install supapup
```

### From Source

```bash
git clone https://github.com/jaspergreen/supapup.git
cd supapup
npm install
npm run build
```

## 🚀 Quick Start

### With Claude CLI

```bash
# Add Supapup to Claude CLI
claude mcp add supapup "supapup"

# Use it in a conversation
claude "Navigate to https://example.com and click the login button"

# Or start an interactive session
claude --interactive
```

### With Gemini CLI

```bash
# Configure in gemini-config.json then:
gemini "Use Supapup to navigate to example.com and find all forms"
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

### Testing a Website

```bash
claude "Test the login flow on https://myapp.com - try logging in with test credentials and tell me if it works"

claude "Navigate to https://shop.example.com and add 3 different products to cart, then check if the cart total is calculated correctly"
```

### Debugging API Errors

```bash
claude "Go to https://myapp.com/dashboard and check the network logs for any failed API calls. Tell me what's causing the 404 errors"

claude "Monitor the API requests on https://example.com/form when I submit the form. Check if the auth token is being sent correctly"
```

### Visual Debugging

```bash
claude "Why does the submit button on https://mysite.com/contact look broken? Take a screenshot and inspect its CSS"

claude "The layout on https://myapp.com is messed up on mobile. Can you check how it looks at 375px width and tell me what's wrong?"
```

### Finding Elements

```bash
claude "I can't find the logout button on https://app.example.com. Can you help me locate it?"

claude "Show me all the forms on https://example.com and tell me which fields are required"
```

### Performance Testing

```bash
claude "Check the performance metrics for https://mysite.com and tell me what's making it load slowly"

claude "Test https://heavysite.com and identify which resources are taking the longest to load"
```

### Automated Testing

```bash
claude "Run through the checkout process on https://shop.com: add item to cart, go to checkout, fill in the form with test data, but stop before placing the order"

claude "Test all the navigation links on https://mysite.com and tell me if any are broken"
```

## 🏗️ Architecture

Supapup consists of several specialized modules:

- **Agent Page Generator**: Creates structured representations of web pages
- **Element Detector**: Automatically identifies interactive elements
- **ID Generator**: Creates unique, semantic IDs incorporating context from parent forms, headings, and element properties
- **Debugging Tools**: Full Chrome DevTools Protocol integration
- **Network Tools**: Comprehensive request/response monitoring
- **Page Analysis**: Performance metrics and accessibility analysis
- **DevTools Elements**: Visual element mapping and manipulation

### ID Generation Strategy

Supapup ensures every element gets a unique, meaningful ID by:
1. Extracting context from parent containers (forms, sections, headings)
2. Including semantic meaning (label text, placeholder, button text)
3. Adding element type suffixes (button, link, input, checkbox)
4. Appending unique indices to guarantee no duplicates
5. Handling dynamic content with stable ID regeneration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jaspergreen/supapup.git
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

- [GitHub Repository](https://github.com/jaspergreen/supapup)
- [NPM Package](https://www.npmjs.com/package/supapup)
- [Issue Tracker](https://github.com/jaspergreen/supapup/issues)

---

<p align="center">
  Made with ❤️ for AI agents and developers
</p>