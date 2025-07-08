#!/usr/bin/env node

// Test script to demonstrate Supapup usage
// Run after building: node examples/test-supapup.js

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simulate MCP client interaction
async function testSupapup() {
  console.log('Starting Supapup test...\n');

  // Start Supapup server
  const supapup = spawn('node', [join(__dirname, '../dist/index.js')]);

  // Helper to send JSON-RPC request
  function sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };
    
    supapup.stdin.write(JSON.stringify(request) + '\n');
  }

  // Helper to wait for response
  function waitForResponse() {
    return new Promise((resolve) => {
      supapup.stdout.once('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (e) {
          console.error('Failed to parse response:', data.toString());
        }
      });
    });
  }

  // Error handler
  supapup.stderr.on('data', (data) => {
    console.log('Server log:', data.toString());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test sequence
    console.log('1. Launching browser...');
    sendRequest('tools/call', {
      name: 'launch_browser',
      arguments: { headless: false }
    });
    let response = await waitForResponse();
    console.log('Response:', response.result?.content?.[0]?.text || 'No response');

    console.log('\n2. Navigating to login page...');
    const loginPagePath = `file://${join(__dirname, 'login-page.html')}`;
    sendRequest('tools/call', {
      name: 'navigate',
      arguments: { url: loginPagePath }
    });
    response = await waitForResponse();
    console.log('Response:', JSON.parse(response.result?.content?.[0]?.text || '{}'));

    console.log('\n3. Discovering actions...');
    sendRequest('tools/call', {
      name: 'discover_actions',
      arguments: {}
    });
    response = await waitForResponse();
    console.log('Available actions:', JSON.parse(response.result?.content?.[0]?.text || '{}'));

    console.log('\n4. Executing login...');
    sendRequest('tools/call', {
      name: 'execute_action',
      arguments: {
        actionId: 'fill_and_submit',
        params: {
          username: 'demo',
          password: 'password'
        }
      }
    });
    response = await waitForResponse();
    console.log('Login result:', JSON.parse(response.result?.content?.[0]?.text || '{}'));

    console.log('\n5. Getting page state...');
    sendRequest('tools/call', {
      name: 'get_page_state',
      arguments: {}
    });
    response = await waitForResponse();
    console.log('Page state:', JSON.parse(response.result?.content?.[0]?.text || '{}'));

    // Wait a bit to see the result
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n6. Closing browser...');
    sendRequest('tools/call', {
      name: 'close_browser',
      arguments: {}
    });
    response = await waitForResponse();
    console.log('Response:', response.result?.content?.[0]?.text || 'No response');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Clean up
    supapup.kill();
  }
}

// Run the test
testSupapup().catch(console.error);