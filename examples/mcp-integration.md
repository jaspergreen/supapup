# MCP Integration Examples

## Setting up Supapup with Claude Desktop

### 1. Installation

```bash
npm install -g supapup
```

### 2. Configure Claude Desktop

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

### 3. Using Supapup in Claude

Once configured, you can ask Claude to:

```
"Navigate to https://github.com and search for 'supapup'"
```

Claude will:
1. Use the `navigate` tool to go to GitHub
2. See the agent page representation with semantic IDs
3. Use `execute_action` to interact with the search box
4. Execute the search

## Advanced MCP Usage

### Combining Multiple Tools

```
"Go to Wikipedia, search for 'artificial intelligence', 
and create a visual summary of the main topics"
```

Claude will:
1. Navigate to Wikipedia
2. Search for the topic
3. Use `devtools_visual_element_map` to analyze the page
4. Extract key information using `evaluate_script`
5. Generate a summary

### Debugging Web Applications

```
"Help me debug why the login button on my app at 
localhost:3000 isn't working"
```

Claude will:
1. Navigate to your local app
2. Use `inspect_element` to examine the button
3. Set breakpoints with `set_breakpoint`
4. Monitor network requests with `get_network_logs`
5. Provide debugging insights

### Performance Analysis

```
"Analyze the performance of example.com and suggest 
improvements"
```

Claude will:
1. Navigate to the site
2. Use `get_performance_metrics` for timing data
3. Check `get_accessibility_tree` for a11y issues
4. Analyze network requests
5. Provide optimization recommendations

## Programmatic Usage

### As a Library

```javascript
import { SupapupServer } from 'supapup';

// Create and start server
const server = new SupapupServer();
await server.run();

// Server is now running and available via MCP
```

### Custom MCP Client

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Connect to Supapup server
const client = new Client({
  name: 'my-app',
  version: '1.0.0'
});

// Use Supapup tools
const result = await client.callTool({
  name: 'navigate',
  arguments: { url: 'https://example.com' }
});
```

## Best Practices

1. **Use Semantic IDs**: Rely on the semantic IDs provided by agent pages rather than CSS selectors

2. **Handle Dynamic Content**: Use `waitForChanges` parameter or explicit waits for AJAX content

3. **Visual Debugging**: Use `devtools_visual_element_map` when you need to see what's on the page

4. **Chunk Large Pages**: Let Supapup automatically handle large pages and screenshots

5. **Monitor Performance**: Use network and performance tools to ensure your automation isn't causing issues