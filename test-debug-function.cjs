#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

// Simple MCP client to test debug_function
async function testDebugFunction() {
  console.log('🧪 Testing debug_function tool response size...');
  
  const supapup = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseData = '';
  
  supapup.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  supapup.stderr.on('data', (data) => {
    console.error('Stderr:', data.toString());
  });

  // Initialize MCP
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  };

  supapup.stdin.write(JSON.stringify(initMessage) + '\n');

  // Wait for init response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Navigate to test page
  const navigateMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'file:///Users/cobusswart/Source/supapup/examples/ecommerce/index.html'
      }
    }
  };

  supapup.stdin.write(JSON.stringify(navigateMessage) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Show login form
  const showLoginMessage = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'agent_execute_action',
      arguments: {
        actionId: 'showloginbtn-button'
      }
    }
  };

  supapup.stdin.write(JSON.stringify(showLoginMessage) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Fill and submit form
  const fillFormMessage = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'form_fill',
      arguments: {
        formData: {
          "loginform-firstname-text": "Test",
          "loginform-lastname-text": "User", 
          "loginform-email-email": "demo@example.com",
          "loginform-password-password": "password123",
          "loginform-terms-checkbox": true
        },
        formId: "loginForm",
        submitAfter: true
      }
    }
  };

  supapup.stdin.write(JSON.stringify(fillFormMessage) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clear response buffer and test debug_function
  responseData = '';
  
  console.log('🔬 Testing debug_function...');
  const debugMessage = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'debug_function',
      arguments: {
        lineNumber: 8,
        triggerAction: 'demoalert-button'
      }
    }
  };

  supapup.stdin.write(JSON.stringify(debugMessage) + '\n');
  
  // Wait for response and measure
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const responseSize = responseData.length;
  const responseTokens = Math.ceil(responseSize / 4); // Rough token estimate
  
  console.log(`📊 Response size: ${responseSize} characters`);
  console.log(`📊 Estimated tokens: ${responseTokens}`);
  console.log(`🚨 Exceeds limit: ${responseTokens > 25000 ? 'YES' : 'NO'}`);
  
  // Write full response to file for analysis
  fs.writeFileSync('/tmp/debug-function-response.json', responseData);
  console.log('📝 Full response written to /tmp/debug-function-response.json');
  
  // Show first 1000 chars
  console.log('\n📄 Response preview (first 1000 chars):');
  console.log(responseData.substring(0, 1000));
  
  supapup.kill();
  
  return { responseSize, responseTokens };
}

testDebugFunction().catch(console.error);