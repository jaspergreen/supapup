# MCP Client Guide - Using MCP Servers from Node.js

This guide shows how to consume MCP servers from regular Node.js applications, not just AI assistants.

## Overview

MCP servers can be used by any client application that implements the MCP protocol. This includes:
- AI assistants (Claude, Gemini, etc.)
- Custom Node.js applications
- Testing scripts
- Automation tools
- Web applications (with a backend proxy)

## Basic MCP Client Implementation

### 1. Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 2. Simple Client Example

```typescript
// mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private serverProcess: any;

  constructor() {
    this.client = new Client({
      name: 'my-mcp-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }

  async connect(serverCommand: string, serverArgs: string[] = []) {
    // Spawn the MCP server process
    this.serverProcess = spawn(serverCommand, serverArgs, {
      stdio: ['pipe', 'pipe', 'inherit'] // stdin, stdout, stderr
    });

    // Create transport using server's stdio
    this.transport = new StdioClientTransport({
      stdin: this.serverProcess.stdout,
      stdout: this.serverProcess.stdin
    });

    // Connect client to server
    await this.client.connect(this.transport);
    console.log('Connected to MCP server');

    // Discover available tools
    const tools = await this.client.request({
      method: 'tools/list'
    }, {});
    
    console.log('Available tools:', tools);
    return tools;
  }

  async callTool(toolName: string, args: any = {}) {
    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      }, {});

      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  async disconnect() {
    await this.client.close();
    this.serverProcess.kill();
    console.log('Disconnected from MCP server');
  }
}

// Usage example
async function main() {
  const client = new MCPClient();
  
  try {
    // Connect to Supapup MCP server
    await client.connect('supapup');
    
    // Navigate to a website
    const navResult = await client.callTool('browser_navigate', {
      url: 'https://example.com'
    });
    console.log('Navigation result:', navResult);
    
    // Take a screenshot
    const screenshotResult = await client.callTool('screenshot', {
      name: 'example-page'
    });
    console.log('Screenshot taken');
    
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
```

## Advanced Client Features

### 1. Resource Reading

```typescript
async getResources() {
  const resources = await this.client.request({
    method: 'resources/list'
  }, {});
  
  return resources;
}

async readResource(uri: string) {
  const content = await this.client.request({
    method: 'resources/read',
    params: { uri }
  }, {});
  
  return content;
}
```

### 2. Prompt Handling

```typescript
async getPrompts() {
  const prompts = await this.client.request({
    method: 'prompts/list'
  }, {});
  
  return prompts;
}

async runPrompt(name: string, args: any = {}) {
  const result = await this.client.request({
    method: 'prompts/get',
    params: {
      name,
      arguments: args
    }
  }, {});
  
  return result;
}
```

### 3. Event Handling

```typescript
// Listen for server notifications
this.client.on('notification', (notification) => {
  console.log('Server notification:', notification);
});

// Handle errors
this.client.on('error', (error) => {
  console.error('Client error:', error);
});
```

## Real-World Example: Web Scraper

```typescript
// web-scraper.ts
import { MCPClient } from './mcp-client';

class WebScraper {
  private client: MCPClient;

  constructor() {
    this.client = new MCPClient();
  }

  async scrapeWebsite(url: string) {
    await this.client.connect('supapup');
    
    try {
      // Navigate to the page
      console.log(`Navigating to ${url}...`);
      const pageData = await this.client.callTool('browser_navigate', { url });
      
      // Extract content
      console.log('Reading page content...');
      const content = await this.client.callTool('agent_read_content', {
        format: 'markdown'
      });
      
      // Get performance metrics
      const metrics = await this.client.callTool('get_performance_metrics');
      
      return {
        url,
        content: content.content[0].text,
        metrics: metrics.content[0].text,
        timestamp: new Date()
      };
      
    } finally {
      await this.client.disconnect();
    }
  }

  async scrapeMultiple(urls: string[]) {
    const results = [];
    
    for (const url of urls) {
      try {
        const data = await this.scrapeWebsite(url);
        results.push(data);
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        results.push({ url, error: error.message });
      }
    }
    
    return results;
  }
}

// Usage
const scraper = new WebScraper();
scraper.scrapeMultiple([
  'https://example.com',
  'https://news.ycombinator.com',
  'https://reddit.com'
]).then(results => {
  console.log('Scraping complete:', results);
});
```

## Testing MCP Servers

```typescript
// test-mcp-server.ts
import { describe, test, expect } from '@jest/globals';
import { MCPClient } from './mcp-client';

describe('MCP Server Tests', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('my-mcp-server');
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test('should list available tools', async () => {
    const tools = await client.getTools();
    expect(tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
  });

  test('should process data', async () => {
    const result = await client.callTool('process_data', {
      data: 'hello world',
      algorithm: 'transform'
    });
    
    expect(result.content[0].text).toContain('HELLO WORLD');
  });
});
```

## Web Application Integration

```typescript
// server.ts - Express backend that uses MCP
import express from 'express';
import { MCPClient } from './mcp-client';

const app = express();
app.use(express.json());

// Create a pool of MCP clients
class MCPClientPool {
  private clients: MCPClient[] = [];
  private available: MCPClient[] = [];

  async initialize(size: number, serverCommand: string) {
    for (let i = 0; i < size; i++) {
      const client = new MCPClient();
      await client.connect(serverCommand);
      this.clients.push(client);
      this.available.push(client);
    }
  }

  async acquire(): Promise<MCPClient> {
    if (this.available.length === 0) {
      // Wait for a client to become available
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.acquire();
    }
    return this.available.pop()!;
  }

  release(client: MCPClient) {
    this.available.push(client);
  }
}

const clientPool = new MCPClientPool();
await clientPool.initialize(5, 'supapup');

// API endpoint that uses MCP
app.post('/api/screenshot', async (req, res) => {
  const { url } = req.body;
  const client = await clientPool.acquire();
  
  try {
    await client.callTool('browser_navigate', { url });
    const screenshot = await client.callTool('screenshot', {
      name: 'api-screenshot'
    });
    
    res.json({
      success: true,
      screenshot: screenshot.content[0].data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    clientPool.release(client);
  }
});

app.listen(3000, () => {
  console.log('API server with MCP integration running on port 3000');
});
```

## Direct Protocol Communication

For more control, you can communicate directly with the MCP server:

```typescript
// direct-protocol.ts
import { spawn } from 'child_process';
import readline from 'readline';

class DirectMCPClient {
  private server: any;
  private rl: readline.Interface;
  private requestId = 0;

  async connect(serverCommand: string) {
    this.server = spawn(serverCommand, [], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    this.rl = readline.createInterface({
      input: this.server.stdout,
      crlfDelay: Infinity
    });

    // Listen for responses
    this.rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        console.log('Response:', response);
      } catch (e) {
        // Not JSON, might be a log message
      }
    });
  }

  sendRequest(method: string, params: any = {}) {
    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    this.server.stdin.write(JSON.stringify(request) + '\n');
  }

  disconnect() {
    this.rl.close();
    this.server.kill();
  }
}

// Usage
const client = new DirectMCPClient();
await client.connect('my-mcp-server');

// Send raw protocol messages
client.sendRequest('tools/list');
client.sendRequest('tools/call', {
  name: 'example_tool',
  arguments: { message: 'Hello MCP!' }
});
```

## Best Practices for MCP Clients

1. **Connection Management**
   - Reuse connections when possible
   - Implement connection pooling for high-throughput applications
   - Handle connection failures gracefully

2. **Error Handling**
   - Always wrap tool calls in try-catch blocks
   - Implement retry logic for transient failures
   - Log errors comprehensively

3. **Resource Cleanup**
   - Always disconnect properly
   - Kill server processes on client exit
   - Implement timeout mechanisms

4. **Performance**
   - Use connection pools for web applications
   - Batch operations when possible
   - Monitor server resource usage

5. **Security**
   - Validate all inputs before sending to MCP server
   - Run MCP servers with minimal permissions
   - Use environment variables for sensitive configuration

## Debugging MCP Communication

```typescript
// Enable debug logging
process.env.DEBUG = 'mcp:*';

// Log all protocol messages
this.transport.on('message', (msg) => {
  console.log('Protocol message:', JSON.stringify(msg, null, 2));
});
```

## Summary

MCP servers are not limited to AI assistants - any Node.js application can consume them. This enables:
- Building custom automation tools
- Creating web APIs backed by MCP servers
- Testing MCP servers programmatically
- Integrating MCP tools into existing applications

The MCP protocol is simple JSON-RPC over stdio, making it easy to integrate into any application that can spawn processes and communicate via standard streams.