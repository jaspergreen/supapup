# Installing Supapup as an MCP Server

## 1. Build Supapup
```bash
cd /Users/cobusswart/Source/automate/supapup
npm install
npm run build
```

## 2. Add to Claude Desktop Configuration

Edit your Claude Desktop config file:

**On macOS:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**On Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

## 3. Add Supapup to the Configuration

Add this to your `mcpServers` section:

```json
{
  "mcpServers": {
    "supapup": {
      "command": "node",
      "args": ["/Users/cobusswart/Source/automate/supapup/dist/index.js"],
      "env": {}
    }
  }
}
```

If you already have other MCP servers, add Supapup to the existing list:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "supapup": {
      "command": "node",
      "args": ["/Users/cobusswart/Source/automate/supapup/dist/index.js"],
      "env": {}
    }
  }
}
```

## 4. Restart Claude Desktop

After saving the config file, completely quit and restart Claude Desktop.

## 5. Verify Installation

In a new Claude conversation, you should see Supapup in the MCP tools list. You can ask Claude:
- "What MCP tools are available?"
- "Can you list the Supapup tools?"

## Testing the E-commerce Challenge

Once installed, you can test the e-commerce flow:

1. **Start the browser:**
   "Launch the Supapup browser"

2. **Navigate to the demo:**
   "Navigate to file:///Users/cobusswart/Source/automate/supapup/examples/ecommerce/index.html"

3. **Complete the challenge:**
   "Complete the e-commerce purchase flow: login, add products to cart, and checkout"

The MCP Bridge will allow Claude to:
- Detect available actions on each page
- Click the login button to reveal the form
- Fill in credentials
- Navigate between pages
- Add products to cart
- Complete the checkout process
- Track the order

All without taking screenshots or guessing at selectors!