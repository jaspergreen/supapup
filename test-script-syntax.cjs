#!/usr/bin/env node

/**
 * Test script to isolate the JavaScript syntax error
 */

const puppeteer = require('puppeteer');

async function testScriptSyntax() {
  console.log('🧪 Testing Script Syntax...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Get the actual script that's being injected
    const { DevToolsAgentPageGenerator } = require('./dist/generators/devtools-agent-page-generator.js');
    const generator = new DevToolsAgentPageGenerator(page);
    
    // Get the script content
    const script = generator.getGeneratorScript();
    
    console.log('📄 Script length:', script.length);
    console.log('📄 First 500 characters:');
    console.log(script.substring(0, 500));
    console.log('...\n');
    
    // Test if the script can be parsed as JavaScript
    try {
      new Function(script);
      console.log('✅ Script syntax is valid JavaScript');
    } catch (syntaxError) {
      console.log('❌ Script syntax error:', syntaxError.message);
      console.log('❌ Error at position:', syntaxError.message.match(/position (\\d+)/)?.[1]);
      
      // Find the problematic line
      const lines = script.split('\n');
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 for newline
        console.log(`Line ${i + 1} (chars ${charCount - lines[i].length - 1}-${charCount - 1}): ${lines[i]}`);
        if (i > 50) break; // Don't print too many lines
      }
      
      return;
    }
    
    // Try to evaluate the script in the browser
    console.log('🔍 Testing script evaluation in browser...');
    try {
      await page.evaluate(script);
      console.log('✅ Script evaluates successfully in browser');
      
      // Test the actual function
      const result = await page.evaluate(() => {
        if (typeof window.__DEVTOOLS_AGENT_GENERATOR__ !== 'undefined') {
          return 'Generator injected successfully';
        }
        return 'Generator not found';
      });
      
      console.log('📊 Generator status:', result);
      
    } catch (evalError) {
      console.log('❌ Script evaluation error:', evalError.message);
      
      // Try to find the exact line causing the issue
      const errorMatch = evalError.message.match(/line (\\d+)/);
      if (errorMatch) {
        const lineNum = parseInt(errorMatch[1]);
        const lines = script.split('\n');
        console.log(`\\n❌ Error at line ${lineNum}:`);
        console.log(`${lineNum - 1}: ${lines[lineNum - 2] || ''}`);
        console.log(`${lineNum}: ${lines[lineNum - 1] || ''} <-- ERROR HERE`);
        console.log(`${lineNum + 1}: ${lines[lineNum] || ''}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testScriptSyntax().catch(console.error);