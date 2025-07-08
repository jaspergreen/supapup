#!/usr/bin/env node

/**
 * Direct test interface for Supapup - uses the ACTUAL MCP server implementation
 * IMPORTANT: This does NOT copy any code - it uses the real SupapupServer class
 * 
 * Run with: npx tsx test-direct.ts <command> [args...]
 * 
 * Examples:
 *   npx tsx test-direct.ts navigate https://google.com
 *   npx tsx test-direct.ts execute form-q-textarea "search term"
 *   npx tsx test-direct.ts wait-for-changes
 *   npx tsx test-direct.ts test-flow captcha
 */

import { writeFileSync } from 'fs';

// Import the actual server class directly from index.ts
import { SupapupServer } from './src/index.js';

// Wrapper that exposes private methods for testing
class DirectSupapupTest extends SupapupServer {
  async launchBrowser(args: any = {}) {
    return super['launchBrowser'](args);
  }
  
  async navigate(args: any) {
    return super['navigate'](args);
  }
  
  async executeAction(args: any) {
    return super['executeAction'](args);
  }
  
  async waitForChanges(args: any) {
    return super['waitForChanges'](args);
  }
  
  async screenshot(args: any) {
    return super['screenshot'](args);
  }
  
  async closeBrowser() {
    return super['closeBrowser']();
  }
  
  getPage() {
    return (this as any).page;
  }
}

// Test flows
async function testGoogleFlow(tester: DirectSupapupTest) {
  console.log('=== TESTING GOOGLE SEARCH FLOW ===\n');
  
  await tester.launchBrowser();
  
  const navResult = await tester.navigate({ url: 'https://www.google.com' });
  console.log(navResult.content[0].text.split('\n').slice(0, 5).join('\n') + '\n...\n');
  
  const fillResult = await tester.executeAction({
    actionId: 'form-q-textarea',
    params: { value: 'MCP protocol' }
  });
  console.log('Fill result:', fillResult.content[0].text);
  
  const clickResult = await tester.executeAction({
    actionId: 'form-btnk-submit',
    waitForChanges: true
  });
  console.log('\nClick result:');
  console.log(clickResult.content[0].text);
}

async function testAjaxFlow(tester: DirectSupapupTest) {
  console.log('=== TESTING AJAX FLOW ===\n');
  
  await tester.launchBrowser();
  
  const testPagePath = `file://${process.cwd()}/test-pages/ajax-test.html`;
  console.log(`Navigating to: ${testPagePath}`);
  
  const navResult = await tester.navigate({ url: testPagePath });
  console.log('Navigation result:');
  console.log(navResult.content[0].text.split('\n').slice(0, 10).join('\n') + '\n...\n');
  
  console.log('Filling search box...');
  const fillResult = await tester.executeAction({
    actionId: 'searchinput-text',
    params: { value: 'test query' }
  });
  console.log('Fill result:', fillResult.content[0].text.split('\n')[0]);
  
  console.log('\nClicking search button (should wait for AJAX)...');
  await new Promise(resolve => setTimeout(resolve, 100));
  const clickResult = await tester.executeAction({
    actionId: 'searchbtn-button',
    waitForChanges: true
  });
  
  console.log('\nClick result:');
  console.log(clickResult.content[0].text);
}

async function testCaptchaFlow(tester: DirectSupapupTest) {
  console.log('=== TESTING CAPTCHA FLOW ===\n');
  
  await tester.launchBrowser();
  
  console.log('Navigating to Google search (should trigger CAPTCHA)...');
  const navResult = await tester.navigate({ url: 'https://www.google.com/search?q=automated+browser+test' });
  
  console.log('Navigation result:');
  console.log(navResult.content[0].text);
  
  if (navResult.content[0].text.includes('CAPTCHA')) {
    console.log('\n✅ CAPTCHA detection working!');
    console.log('\n👤 Please solve the CAPTCHA in the browser window.');
    console.log('⏳ Waiting for you to complete it...\n');
    
    // Now wait for changes automatically
    const waitResult = await tester.waitForChanges({ timeout: 60000 }); // 60 second timeout
    console.log('\n=== After CAPTCHA solved ===');
    console.log(waitResult.content[0].text);
  }
}

// CLI
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const tester = new DirectSupapupTest();
  
  try {
    switch (command) {
      case 'navigate':
        await tester.launchBrowser();
        const navResult = await tester.navigate({ url: args[0] });
        console.log(navResult.content[0].text);
        break;
        
      case 'execute':
        const executeResult = await tester.executeAction({
          actionId: args[0],
          params: args[1] ? { value: args[1] } : {},
          waitForChanges: true
        });
        console.log(executeResult.content[0].text);
        break;
      
      case 'wait-for-changes':
        // First need to connect to existing browser
        try {
          const puppeteer = await import('puppeteer');
          const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222'
          });
          console.log('Connected to existing browser');
          console.log('Waiting for page changes...');
          const waitResult = await tester.waitForChanges({ timeout: 30000 });
          console.log(waitResult.content[0].text);
        } catch (e) {
          console.log('Could not connect to browser. Make sure CAPTCHA test is still running.');
        }
        break;
        
      case 'screenshot':
        const screenshotResult = await tester.screenshot({ fullPage: true });
        console.log('Screenshot taken');
        const imageData = Buffer.from(screenshotResult.content[0].data, 'base64');
        writeFileSync('screenshot.jpg', imageData);
        console.log('Saved to screenshot.jpg');
        break;
        
      case 'test-flow':
        switch (args[0]) {
          case 'google':
            await testGoogleFlow(tester);
            break;
          case 'ajax':
            await testAjaxFlow(tester);
            break;
          case 'captcha':
            await testCaptchaFlow(tester);
            break;
          default:
            console.log('Available test flows: google, ajax, captcha');
        }
        break;
        
      default:
        console.log(`
Supapup Direct Test Interface

Usage:
  npx tsx test-direct.ts navigate <url>
  npx tsx test-direct.ts execute <actionId> [value]
  npx tsx test-direct.ts wait-for-changes
  npx tsx test-direct.ts screenshot
  npx tsx test-direct.ts test-flow google|ajax|captcha

Examples:
  npx tsx test-direct.ts navigate https://google.com
  npx tsx test-direct.ts execute form-q-textarea "search term"
  npx tsx test-direct.ts wait-for-changes
  npx tsx test-direct.ts test-flow captcha
`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Keep process alive for CAPTCHA test
    if ((command === 'test-flow' && args[0] === 'captcha') || 
        command === 'navigate' && args[0]?.includes('google.com/search')) {
      console.log('\nProcess staying alive. Press Ctrl+C to exit when done.');
      // Keep process alive indefinitely
      setInterval(() => {}, 1000);
    } else {
      console.log('\nBrowser remains open. Close manually when done.');
      process.exit(0);
    }
  }
}

main();