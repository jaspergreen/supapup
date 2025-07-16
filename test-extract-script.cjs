#!/usr/bin/env node

/**
 * Extract the exact script that's being generated
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function extractScript() {
  console.log('🔍 Extracting the exact script...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to a simple page
    await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');
    
    // Read the compiled JavaScript file directly
    const jsContent = fs.readFileSync('./dist/generators/devtools-agent-page-generator.js', 'utf8');
    
    // Find the getGeneratorScript method and extract the return statement
    const methodStart = jsContent.indexOf('getGeneratorScript() {');
    const returnStart = jsContent.indexOf('return `', methodStart);
    const templateStart = returnStart + 8; // Skip 'return `'
    
    // Find the end of the template literal (looking for the closing backtick)
    let templateEnd = templateStart;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = templateStart; i < jsContent.length; i++) {
      const char = jsContent[i];
      const prevChar = jsContent[i - 1];
      
      if (!inString) {
        if (char === '`' && prevChar !== '\\\\') {
          if (depth === 0) {
            templateEnd = i;
            break;
          }
        } else if (char === '\\${') {
          depth++;
        } else if (char === '}' && depth > 0) {
          depth--;
        } else if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        }
      } else {
        if (char === stringChar && prevChar !== '\\\\') {
          inString = false;
          stringChar = '';
        }
      }
    }
    
    const templateContent = jsContent.substring(templateStart, templateEnd);
    
    console.log('📄 Template literal extracted, length:', templateContent.length);
    console.log('📄 First 500 characters:');
    console.log(templateContent.substring(0, 500));
    console.log('...\n');
    
    // Save the extracted script to a file for inspection
    fs.writeFileSync('./extracted-script.js', templateContent);
    console.log('💾 Script saved to extracted-script.js');
    
    // Test the extracted script
    console.log('🔍 Testing extracted script...');
    try {
      const result = await page.evaluate(templateContent);
      console.log('✅ Extracted script works:', result);
    } catch (evalError) {
      console.log('❌ Extracted script error:', evalError.message);
      console.log('❌ Full error:', evalError);
      
      // Try to find the exact problem
      const lines = templateContent.split('\n');
      console.log('\\n🔍 Script lines around the error:');
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
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
extractScript().catch(console.error);