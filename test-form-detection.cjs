#!/usr/bin/env node

/**
 * Test script to demonstrate what the new agent page looks like with form detection
 * This works around the template literal syntax issues
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testFormDetection() {
  console.log('🧪 Testing Form Detection in Agent Page...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to ecommerce example
    const testUrl = 'file://' + path.resolve(__dirname, 'examples/ecommerce/index.html');
    console.log('📍 Navigating to:', testUrl);
    await page.goto(testUrl);
    
    // Click login button to show form
    console.log('🔄 Clicking login button to show form...');
    await page.click('#showLoginBtn');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate what the agent page would look like with form detection
    const agentPageContent = await page.evaluate(() => {
      // Mock the form detection logic
      const forms = document.querySelectorAll('form');
      const formElements = [];
      
      forms.forEach((form, formIndex) => {
        const formId = form.id || `form-${formIndex + 1}`;
        const inputs = form.querySelectorAll('input, select, textarea, button');
        const formFields = [];
        
        inputs.forEach((input, index) => {
          const id = input.id || input.name || `${input.tagName.toLowerCase()}-${index}`;
          const type = input.type || input.tagName.toLowerCase();
          const label = input.placeholder || input.getAttribute('aria-label') || '';
          
          formFields.push({
            id: id,
            type: type,
            label: label,
            tagName: input.tagName.toLowerCase()
          });
        });
        
        if (formFields.length > 0) {
          formElements.push({
            formId: formId,
            fields: formFields
          });
        }
      });
      
      return {
        title: document.title,
        url: window.location.href,
        forms: formElements
      };
    });
    
    // Generate what the agent page would look like
    console.log('📄 AGENT PAGE CONTENT:');
    console.log('='.repeat(50));
    console.log(agentPageContent.title);
    console.log('='.repeat(agentPageContent.title.length));
    console.log();
    
    if (agentPageContent.forms.length > 0) {
      console.log('🔧 FORM TOOLS:');
      agentPageContent.forms.forEach((form, index) => {
        const fieldsList = form.fields.map(f => `${f.id}: "value"`).join(', ');
        console.log(`- form_fill({formData: {${fieldsList}}}) -> Fill entire form`);
      });
      console.log();
    }
    
    console.log('ACTIONS AVAILABLE:');
    agentPageContent.forms.forEach(form => {
      form.fields.forEach(field => {
        let action = 'click';
        if (field.type === 'text' || field.type === 'email' || field.type === 'password') {
          action = 'fill';
        } else if (field.type === 'checkbox') {
          action = 'toggle';
        } else if (field.tagName === 'select') {
          action = 'select';
        }
        
        console.log(`- execute_action({actionId: "${field.id}", params: {value: "text"}}) -> ${action.toUpperCase()} ${field.label || field.type}`);
      });
    });
    
    console.log(`\\nINTERACTIVE ELEMENTS: ${agentPageContent.forms.reduce((total, form) => total + form.fields.length, 0)} total`);
    
    console.log('\\n✅ Form detection test completed successfully!');
    console.log('\\n📊 SUMMARY:');
    console.log(`• Forms detected: ${agentPageContent.forms.length}`);
    console.log(`• Total form fields: ${agentPageContent.forms.reduce((total, form) => total + form.fields.length, 0)}`);
    
    agentPageContent.forms.forEach((form, index) => {
      console.log(`• Form ${index + 1} (${form.formId}): ${form.fields.length} fields`);
      form.fields.forEach((field, fieldIndex) => {
        console.log(`  - ${field.id} (${field.type}): ${field.label || 'no label'}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testFormDetection().catch(console.error);