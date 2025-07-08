#!/usr/bin/env node

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
          // Not JSON
        }
      }
    });

    this.server.stderr.on('data', (data) => {
      console.log('Server:', data.toString().trim());
    });

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

async function testDevTools() {
  console.log('Testing Supapup Developer Tools...\n');
  
  const client = new MCPClient();
  
  try {
    await client.start();
    
    // 1. Launch browser
    console.log('1. Launching browser...');
    await client.callTool('launch_browser', { headless: false });
    console.log('✓ Browser launched');

    // 2. Navigate to test page
    console.log('\n2. Navigating to DevTools test page...');
    const testPagePath = `file://${join(__dirname, 'examples/test-devtools.html')}`;
    await client.callTool('navigate', { url: testPagePath });
    console.log('✓ Navigated to test page');

    // Wait for page to load and generate some logs
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Get console logs
    console.log('\n3. Getting console logs...');
    let response = await client.callTool('get_console_logs');
    let logs = JSON.parse(response.result?.content?.[0]?.text || '{}').logs;
    console.log(`✓ Found ${logs.length} console logs`);
    console.log('Sample logs:', logs.slice(0, 3).map(log => `  [${log.type}] ${log.text}`).join('\n'));

    // 4. Get error logs only
    console.log('\n4. Getting error logs only...');
    response = await client.callTool('get_console_logs', { type: 'error' });
    logs = JSON.parse(response.result?.content?.[0]?.text || '{}').logs;
    console.log(`✓ Found ${logs.length} error logs`);

    // 5. Trigger network activity
    console.log('\n5. Triggering network activity...');
    await client.callTool('evaluate_script', {
      script: `document.querySelector('button[onclick="makeApiCall()"]').click()`
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. Get network logs
    console.log('\n6. Getting network logs...');
    response = await client.callTool('get_network_logs');
    const networkLogs = JSON.parse(response.result?.content?.[0]?.text || '{}').logs;
    console.log(`✓ Found ${networkLogs.length} network requests`);
    networkLogs.forEach(log => {
      console.log(`  ${log.method} ${log.url.substring(0, 50)}... [${log.status}] ${log.duration}ms`);
    });

    // 7. Inspect an element
    console.log('\n7. Inspecting button element...');
    response = await client.callTool('inspect_element', { selector: '.test-button' });
    const element = JSON.parse(response.result?.content?.[0]?.text || '{}').element;
    console.log('✓ Element inspected:');
    console.log(`  Tag: ${element.tagName}`);
    console.log(`  Class: ${element.className}`);
    console.log(`  Background: ${element.computedStyles.backgroundColor}`);
    console.log(`  Position: ${element.boundingBox.x}, ${element.boundingBox.y}`);

    // 8. Get page resources
    console.log('\n8. Getting page resources...');
    response = await client.callTool('get_page_resources');
    const resources = JSON.parse(response.result?.content?.[0]?.text || '{}').resources;
    console.log('✓ Page resources:');
    console.log(`  Scripts: ${resources.scripts.length}`);
    console.log(`  Stylesheets: ${resources.stylesheets.length}`);
    console.log(`  Images: ${resources.images.length}`);
    console.log(`  Links: ${resources.links.length}`);

    // 9. Get performance metrics
    console.log('\n9. Getting performance metrics...');
    response = await client.callTool('get_performance_metrics');
    const metrics = JSON.parse(response.result?.content?.[0]?.text || '{}').metrics;
    console.log('✓ Performance metrics:');
    console.log(`  JS Heap Used: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Documents: ${metrics.Documents}`);
    console.log(`  Nodes: ${metrics.Nodes}`);

    // 10. Execute custom JavaScript
    console.log('\n10. Executing custom JavaScript...');
    response = await client.callTool('evaluate_script', {
      script: `
        const buttons = document.querySelectorAll('button');
        return {
          buttonCount: buttons.length,
          pageTitle: document.title,
          timestamp: new Date().toISOString()
        };
      `
    });
    const jsResult = JSON.parse(response.result?.content?.[0]?.text || '{}').result;
    console.log('✓ JavaScript executed:');
    console.log(`  Found ${jsResult.buttonCount} buttons`);
    console.log(`  Page title: ${jsResult.pageTitle}`);

    // 11. Test 404 detection
    console.log('\n11. Testing 404 network detection...');
    await client.callTool('evaluate_script', {
      script: `document.querySelector('button[onclick="load404()"]').click()`
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    response = await client.callTool('get_network_logs', { status: 404 });
    const notFoundLogs = JSON.parse(response.result?.content?.[0]?.text || '{}').logs;
    console.log(`✓ Found ${notFoundLogs.length} 404 requests`);

    // Wait to see results
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 12. Close browser
    console.log('\n12. Closing browser...');
    await client.callTool('close_browser');
    console.log('✓ Browser closed');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    client.stop();
    console.log('\n✅ Developer tools test completed!');
  }
}

testDevTools().catch(console.error);