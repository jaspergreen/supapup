#!/usr/bin/env node

// Test Supapup MCP server through stdio communication
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class MCPClient {
  constructor() {
    this.server = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
  }

  async start() {
    this.server = spawn('node', [join(__dirname, 'dist/index.js')]);
    
    this.server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          const handler = this.pendingRequests.get(response.id);
          if (handler) {
            handler.resolve(response);
            this.pendingRequests.delete(response.id);
          }
        } catch (e) {
          // Not JSON, might be a log message
        }
      }
    });

    this.server.stderr.on('data', (data) => {
      console.log('Server:', data.toString().trim());
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async callTool(toolName, args = {}) {
    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  stop() {
    if (this.server) {
      this.server.kill();
    }
  }
}

async function test() {
  console.log('Testing Supapup MCP Server...\n');
  
  const client = new MCPClient();
  
  try {
    await client.start();
    
    // 1. Launch browser
    console.log('1. Launching browser...');
    let response = await client.callTool('launch_browser', { headless: false });
    console.log('Response:', response.result?.content?.[0]?.text);

    // 2. Navigate to login page
    console.log('\n2. Navigating to login page...');
    const loginPagePath = `file://${join(__dirname, 'examples/login-page.html')}`;
    response = await client.callTool('navigate', { url: loginPagePath });
    const navResult = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('Has bridge:', navResult.hasBridge);
    console.log('Actions:', navResult.actions?.map(a => a.id));

    // 3. Execute login
    console.log('\n3. Logging in with demo credentials...');
    response = await client.callTool('execute_action', {
      actionId: 'fill_and_submit',
      params: { username: 'demo', password: 'password' }
    });
    const loginResult = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('Login result:', loginResult);

    // 4. Get page state
    console.log('\n4. Getting page state...');
    response = await client.callTool('get_page_state');
    const state = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('State:', state);

    // Wait to see result
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Navigate to shopping cart
    console.log('\n5. Navigating to shopping cart...');
    const cartPagePath = `file://${join(__dirname, 'examples/shopping-cart.html')}`;
    response = await client.callTool('navigate', { url: cartPagePath });
    const cartNav = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('Shopping cart actions:', cartNav.actions?.map(a => a.id));

    // 6. Add items to cart
    console.log('\n6. Adding laptop to cart...');
    response = await client.callTool('execute_action', {
      actionId: 'add_to_cart',
      params: { productId: 1, quantity: 2 }
    });
    const addResult = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('Cart total:', addResult.total);

    // 7. Get cart contents
    console.log('\n7. Getting cart contents...');
    response = await client.callTool('execute_action', {
      actionId: 'get_cart'
    });
    const cart = JSON.parse(response.result?.content?.[0]?.text || '{}');
    console.log('Cart:', cart);

    // Wait to see result
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 8. Close browser
    console.log('\n8. Closing browser...');
    response = await client.callTool('close_browser');
    console.log('Response:', response.result?.content?.[0]?.text);

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    client.stop();
    console.log('\nTest completed!');
  }
}

test().catch(console.error);