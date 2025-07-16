#!/usr/bin/env node

/**
 * Test the new DevToolsAgentPageGenerator integration
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testNewIntegration() {
  console.log('🧪 Testing NEW DevToolsAgentPageGenerator integration...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Navigate to comprehensive page
    const testFile = path.resolve(__dirname, 'examples/comprehensive-elements.html');
    const fileUrl = `file://${testFile}`;
    
    console.log('📍 Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // Import and use the NEW DevToolsAgentPageGenerator
    const { DevToolsAgentPageGenerator } = require('./dist/devtools-agent-page-generator.js');
    const generator = new DevToolsAgentPageGenerator(page);
    
    console.log('\n🔍 TESTING NEW GENERATOR:');
    console.log('='.repeat(60));
    
    const result = await generator.generateAgentPage();
    
    console.log(result.content);
    console.log('\n📊 ELEMENT ANALYSIS:');
    console.log('='.repeat(40));
    console.log(`✅ Total elements found: ${result.elements.length}`);
    
    // Test a few interactions
    console.log('\n🧪 Testing interactions...');
    
    // Test filling a text input
    const textInput = result.elements.find(el => el.id === 'textInput');
    if (textInput) {
      const fillResult = await page.evaluate((id) => {
        try {
          window.__AGENT_PAGE__.execute(id, { value: 'Hello World!' });
          const el = document.querySelector(`[data-mcp-id="${id}"]`);
          return { success: true, value: el.value };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, textInput.id);
      
      console.log(`Text input test: ${fillResult.success ? '✅ SUCCESS' : '❌ FAILED'} - ${fillResult.value || fillResult.error}`);
    }
    
    // Test clicking a button
    const submitButton = result.elements.find(el => el.action === 'click' && el.tagName === 'button');
    if (submitButton) {
      const clickResult = await page.evaluate((id) => {
        try {
          let clicked = false;
          const el = document.querySelector(`[data-mcp-id="${id}"]`);
          const handler = () => { clicked = true; };
          el.addEventListener('click', handler);
          
          window.__AGENT_PAGE__.execute(id);
          
          el.removeEventListener('click', handler);
          return { success: clicked };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, submitButton.id);
      
      console.log(`Button click test: ${clickResult.success ? '✅ SUCCESS' : '❌ FAILED'} - ${clickResult.error || 'Click detected'}`);
    }
    
    console.log('\n✅ Integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (browser) {
      console.log('\n🔚 Keeping browser open for inspection...');
      // await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  testNewIntegration().catch(console.error);
}