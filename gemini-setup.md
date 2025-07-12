# Using Supapup with Gemini CLI

## Installation
Supapup v0.1.11 is now installed globally via npm.

## Configuration for Gemini CLI

Add to your Gemini CLI MCP configuration:

```json
{
  "mcpServers": {
    "supapup": {
      "command": "supapup",
      "args": [],
      "env": {}
    }
  }
}
```

## Quick Start

1. Start Gemini CLI
2. The supapup MCP server will be available automatically
3. Use commands like:
   - Navigate to a website: `Use supapup to go to google.com`
   - Take a screenshot: `Use supapup to take a screenshot`
   - Read page content: `Use supapup to read the content of this page`
   - Fill forms: `Use supapup to search for "weather"`

## Available Tools

All MCP tools are available through natural language commands:
- `browser_navigate` - Navigate to URLs
- `agent_execute_action` - Click buttons, fill forms
- `agent_read_content` - Extract page text in markdown
- `screenshot_capture` - Take screenshots
- `form_fill` - Fill entire forms with data
- And many more...

## Example Usage

```
> Use supapup to navigate to github.com and read the main content
> Use supapup to search for "python tutorials" on google
> Use supapup to take a screenshot of the current page
```

The MCP server handles all the complexity - just describe what you want to do!