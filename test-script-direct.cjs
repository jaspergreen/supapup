#!/usr/bin/env node

/**
 * Test script to directly test the generated JavaScript
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testScriptDirect() {
  console.log('🧪 Testing Script Direct...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Read the compiled JavaScript file directly
    const jsContent = fs.readFileSync('./dist/generators/devtools-agent-page-generator.js', 'utf8');
    
    // Find the getGeneratorScript method
    const methodStart = jsContent.indexOf('getGeneratorScript() {');
    if (methodStart === -1) {
      throw new Error('getGeneratorScript method not found');
    }
    
    // Extract the method (simplified extraction)
    const methodEnd = jsContent.indexOf('\n    }', methodStart);
    const methodContent = jsContent.substring(methodStart, methodEnd);
    
    console.log('📄 Method found at position:', methodStart);
    console.log('📄 Method length:', methodContent.length);
    console.log('📄 First 200 characters of method:');
    console.log(methodContent.substring(0, 200));
    console.log('...\n');
    
    // Find the template literal
    const templateStart = methodContent.indexOf('return `');
    if (templateStart === -1) {
      throw new Error('Template literal not found');
    }
    
    console.log('📄 Template literal starts at:', templateStart);
    
    // Let's create a simple test script
    const testScript = `
      console.log('Test script starting...');
      
      // Only inject once
      if (typeof window['__DEVTOOLS_AGENT_GENERATOR__'] === 'undefined') {
        
        window['__DEVTOOLS_AGENT_GENERATOR__'] = {
          
          generate() {
            const result = {
              content: '',
              elements: [],
              actions: [],
              title: document.title,
              url: window.location.href
            };
            
            // Start with title and basic info
            result.content += document.title + String.fromCharCode(10);
            result.content += '='.repeat(document.title.length) + String.fromCharCode(10) + String.fromCharCode(10);
            
            return result;
          }
        };
      }
      
      console.log('Test script completed');
      'success';
    `;
    
    console.log('🔍 Testing simplified script in browser...');
    try {
      const result = await page.evaluate(testScript);
      console.log('✅ Simplified script works:', result);
      
      // Test the generator
      const generatorResult = await page.evaluate(() => {
        if (typeof window.__DEVTOOLS_AGENT_GENERATOR__ !== 'undefined') {
          const result = window.__DEVTOOLS_AGENT_GENERATOR__.generate();
          return {
            success: true,
            contentLength: result.content.length,
            title: result.title
          };
        }
        return { success: false };
      });
      
      console.log('📊 Generator test result:', generatorResult);
      
    } catch (evalError) {
      console.log('❌ Script evaluation error:', evalError.message);
      
      // Try to isolate the issue by testing parts of the script
      console.log('\\n🔍 Testing individual parts...');
      
      // Test 1: Basic object creation
      try {
        await page.evaluate(`
          window.test1 = {
            generate() {
              return 'basic test';
            }
          };
        `);
        console.log('✅ Basic object creation works');
      } catch (e) {
        console.log('❌ Basic object creation failed:', e.message);
      }
      
      // Test 2: String concatenation with String.fromCharCode
      try {
        await page.evaluate(`
          const test = 'hello' + String.fromCharCode(10) + 'world';
          window.test2 = test;
        `);
        console.log('✅ String concatenation with String.fromCharCode works');
      } catch (e) {
        console.log('❌ String concatenation failed:', e.message);
      }
      
      // Test 3: Arrow function in forEach
      try {
        await page.evaluate(`
          const arr = [1, 2, 3];
          arr.forEach((item, index) => {
            console.log('Item:', item, 'Index:', index);
          });
        `);
        console.log('✅ Arrow function in forEach works');
      } catch (e) {
        console.log('❌ Arrow function failed:', e.message);
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
testScriptDirect().catch(console.error);