#!/usr/bin/env node

/**
 * Test the extracted script to find the exact syntax error
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testExtractedScript() {
  console.log('🧪 Testing Extracted Script...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Read the extracted script
    const script = fs.readFileSync('./extracted-script.js', 'utf8');
    
    console.log('📄 Script length:', script.length);
    console.log('📄 First 300 characters:');
    console.log(script.substring(0, 300));
    console.log('...\n');
    
    // Try to evaluate the script
    console.log('🔍 Testing script evaluation...');
    try {
      const result = await page.evaluate(script);
      console.log('✅ Script evaluation successful');
      
      // Test the generator
      const generatorResult = await page.evaluate(() => {
        if (typeof window.__DEVTOOLS_AGENT_GENERATOR__ !== 'undefined') {
          return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
        }
        return null;
      });
      
      console.log('📊 Generator result:', generatorResult ? 'Success' : 'Failed');
      if (generatorResult) {
        console.log('📄 Content length:', generatorResult.content.length);
        console.log('📄 Elements found:', generatorResult.elements.length);
      }
      
    } catch (evalError) {
      console.log('❌ Script evaluation error:', evalError.message);
      
      // Let's try to find the problematic line
      console.log('\\n🔍 Analyzing the error...');
      
      // Show some lines around the error
      const lines = script.split('\n');
      
      // Try to run syntax check with Node.js
      console.log('\\n🔍 Running Node.js syntax check...');
      try {
        new Function(script);
        console.log('✅ Script syntax is valid according to Node.js');
      } catch (syntaxError) {
        console.log('❌ Node.js syntax error:', syntaxError.message);
        
        // Extract line number if available
        const lineMatch = syntaxError.message.match(/line (\\d+)/);
        if (lineMatch) {
          const lineNum = parseInt(lineMatch[1]);
          console.log(`\\n❌ Error at line ${lineNum}:`);
          console.log(`${lineNum - 1}: ${lines[lineNum - 2] || ''}`);
          console.log(`${lineNum}: ${lines[lineNum - 1] || ''} <-- ERROR HERE`);
          console.log(`${lineNum + 1}: ${lines[lineNum] || ''}`);
        }
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
testExtractedScript().catch(console.error);