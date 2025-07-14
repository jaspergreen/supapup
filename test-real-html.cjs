#!/usr/bin/env node

// Test script with real browser HTML content
const { JSDOM } = require('jsdom');
const { NodeHtmlMarkdown } = require('node-html-markdown');

async function testWithRealHTML() {
  console.log('🧪 Testing with simulated real HTML (without data-mcp-id)...\n');

  // This simulates what we get from page.content() - clean HTML without data-mcp-id
  const realHtml = `
    <html>
      <body>
        <h1>HTML Forms</h1>
        <p>An HTML form is used to collect user input.</p>
        
        <h2>Text Fields</h2>
        <p>A form with input fields for text:</p>
        
        <form>
          <label for="fname">First name:</label>
          <input type="text" id="fname" name="fname">
          
          <label for="lname">Last name:</label>
          <input type="text" id="lname" name="lname">
          
          <input type="submit" value="Submit">
        </form>
        
        <p>This is how the HTML code above will be displayed in a browser.</p>
      </body>
    </html>
  `;

  try {
    console.log('1️⃣ Testing what happens with real HTML (no data-mcp-id)...');
    const dom = new JSDOM(realHtml);
    const document = dom.window.document;
    
    const mcpElements = document.querySelectorAll('[data-mcp-id]');
    console.log(`   Found ${mcpElements.length} elements with data-mcp-id`);
    
    if (mcpElements.length === 0) {
      console.log('   ❌ No data-mcp-id attributes found - this explains the issue!');
      console.log('   💡 The browser HTML doesn\'t include the agent page attributes');
      
      console.log('\n2️⃣ This is why enhanced markdown shows empty Interactive Elements section');
      console.log('   The generateEnhancedMarkdown method gets HTML without data-mcp-id attributes');
      console.log('   So it finds 0 elements to replace and just returns regular markdown');
    }
    
    // Convert as-is to see what we get
    const nhm = new NodeHtmlMarkdown({
      strongDelimiter: '**',
      emDelimiter: '*',
      bulletMarker: '-',
    });
    
    const markdown = nhm.translate(document.body.innerHTML);
    console.log('\n3️⃣ Regular markdown (what we currently get):');
    console.log('═'.repeat(50));
    console.log(markdown);
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithRealHTML();