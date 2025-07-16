#!/usr/bin/env node

/**
 * Simple test to just navigate and see what happens
 */

const puppeteer = require('puppeteer');

async function testSimpleNavigation() {
  console.log('🧪 Testing Simple Navigation...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to the ecommerce page
    const testUrl = 'file:///Users/cobusswart/Source/supapup/examples/ecommerce/index.html';
    console.log('📍 Navigating to:', testUrl);
    await page.goto(testUrl);
    
    // Click the login button to show the form
    console.log('🔄 Clicking login button...');
    await page.click('#showLoginBtn');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Just check if the form is visible
    const formVisible = await page.evaluate(() => {
      const form = document.querySelector('#loginForm');
      return form ? form.style.display !== 'none' : false;
    });
    
    console.log('📄 Form visible:', formVisible);
    
    // Count the form elements
    const formElements = await page.evaluate(() => {
      const form = document.querySelector('#loginForm');
      if (!form) return [];
      
      const elements = form.querySelectorAll('input, select, textarea, button');
      return Array.from(elements).map(el => ({
        tagName: el.tagName.toLowerCase(),
        type: el.type || 'unknown',
        id: el.id || 'no-id',
        placeholder: el.placeholder || 'no-placeholder'
      }));
    });
    
    console.log('📊 Form elements found:', formElements.length);
    formElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName} (${el.type}) - ID: ${el.id}, Placeholder: ${el.placeholder}`);
    });
    
    // This demonstrates what the form tools section should show
    console.log('\\n🔧 FORM TOOLS SECTION (what should be generated):');
    const fieldsList = formElements.map(el => `${el.id}: "value"`).join(', ');
    console.log(`- form_fill({formData: {${fieldsList}}}) -> Fill entire form`);
    
    console.log('\\n✅ Navigation test completed successfully!');
    console.log('The form detection logic should work with these elements.');
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (browser) await browser.close();
  }
}

// Run the test
testSimpleNavigation().catch(console.error);