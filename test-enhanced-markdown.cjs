#!/usr/bin/env node

// Test script to debug enhanced markdown generation
const { JSDOM } = require('jsdom');
const { NodeHtmlMarkdown } = require('node-html-markdown');

async function testEnhancedMarkdown() {
  console.log('🧪 Testing Enhanced Markdown Generation...\n');

  // Sample HTML with data-mcp-id attributes (like what the browser would have)
  const testHtml = `
    <html>
      <body>
        <h1>HTML Forms Tutorial</h1>
        <p>An HTML form is used to collect user input.</p>
        
        <h2>Text Fields</h2>
        <p>The input type="text" defines a single-line input field for text input.</p>
        <p>A form with input fields for text:</p>
        
        <form>
          <label for="fname">First name:</label>
          <input type="text" id="fname" name="fname" data-mcp-id="fname_text_144" data-mcp-action="fill" data-mcp-type="text">
          
          <label for="lname">Last name:</label>
          <input type="text" id="lname" name="lname" data-mcp-id="lname_text_145" data-mcp-action="fill" data-mcp-type="text">
          
          <input type="submit" value="Submit" data-mcp-id="submit_146" data-mcp-action="click" data-mcp-type="submit">
        </form>
        
        <p>This is how the HTML code above will be displayed in a browser.</p>
      </body>
    </html>
  `;

  try {
    console.log('1️⃣ Creating JSDOM...');
    const dom = new JSDOM(testHtml);
    const document = dom.window.document;
    
    console.log('2️⃣ Finding elements with data-mcp-id...');
    const mcpElements = document.querySelectorAll('[data-mcp-id]');
    console.log(`   Found ${mcpElements.length} elements with data-mcp-id`);
    
    mcpElements.forEach((element, index) => {
      const mcpId = element.getAttribute('data-mcp-id');
      const tagName = element.tagName;
      const type = element.type || element.getAttribute('data-mcp-type');
      console.log(`   ${index + 1}. ${mcpId} (${tagName}, type: ${type})`);
    });

    console.log('\n3️⃣ Replacing elements with markdown...');
    mcpElements.forEach((element, index) => {
      const mcpId = element.getAttribute('data-mcp-id');
      const tagName = element.tagName;
      const type = element.type || element.getAttribute('data-mcp-type');
      const text = element.textContent?.trim() || element.value || '';
      
      let markdown = '';
      
      switch (tagName) {
        case 'INPUT':
          if (type === 'submit' || type === 'button') {
            markdown = `[Button: ${mcpId}] ${text || element.value || 'Button'}`;
          } else {
            const label = element.labels?.[0]?.textContent?.trim() || 
                         element.placeholder || 
                         element.previousElementSibling?.textContent?.trim() || 
                         'Input';
            markdown = `${label}: [Input: ${mcpId}] (${type})`;
          }
          break;
          
        case 'BUTTON':
          markdown = `[Button: ${mcpId}] ${text || 'Button'}`;
          break;
          
        case 'A':
          markdown = `[Link: ${mcpId}] ${text}`;
          break;
          
        default:
          markdown = `[${tagName}: ${mcpId}]`;
      }
      
      console.log(`   Replacing: ${mcpId} -> "${markdown}"`);
      
      // Replace element with text node
      const textNode = document.createTextNode(markdown);
      element.parentNode?.replaceChild(textNode, element);
    });

    console.log('\n4️⃣ Converting to markdown...');
    const nhm = new NodeHtmlMarkdown({
      strongDelimiter: '**',
      emDelimiter: '*',
      bulletMarker: '-',
      maxConsecutiveNewlines: 2,
    });
    
    const bodyHtml = document.body.innerHTML;
    console.log('   Body HTML after replacement:');
    console.log('   ' + bodyHtml.substring(0, 300) + '...\n');
    
    const markdown = nhm.translate(bodyHtml);
    
    console.log('5️⃣ Final markdown result:');
    console.log('═'.repeat(50));
    console.log(markdown);
    console.log('═'.repeat(50));
    
    // Check if our replacements are in the final markdown
    const hasReplacements = markdown.includes('[Input:') || markdown.includes('[Button:');
    console.log(`\n✅ Success: ${hasReplacements ? 'Interactive elements found in markdown!' : '❌ No interactive elements in markdown'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testEnhancedMarkdown();