#!/usr/bin/env node

// Test script to verify all interactive element types work correctly
const { JSDOM } = require('jsdom');
const { NodeHtmlMarkdown } = require('node-html-markdown');

async function testAllElementTypes() {
  console.log('🧪 Testing All Interactive Element Types...\n');

  // Comprehensive HTML with all interactive element types that Supapup handles
  const testHtml = `
    <html>
      <body>
        <h1>Interactive Elements Test Page</h1>
        
        <nav>
          <a href="/home" data-mcp-id="nav_home_link_1" data-mcp-action="click" data-mcp-type="link">Home</a>
          <a href="/about" data-mcp-id="nav_about_link_2" data-mcp-action="click" data-mcp-type="link">About Us</a>
          <a href="" data-mcp-id="empty_link_3" data-mcp-action="click" data-mcp-type="link"></a>
        </nav>
        
        <form>
          <h2>Form Elements</h2>
          
          <!-- Text inputs -->
          <label for="username">Username:</label>
          <input type="text" id="username" name="username" placeholder="Enter username" 
                 data-mcp-id="username_text_4" data-mcp-action="fill" data-mcp-type="text">
          
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" placeholder="user@example.com"
                 data-mcp-id="email_input_5" data-mcp-action="fill" data-mcp-type="email">
          
          <label for="password">Password:</label>
          <input type="password" id="password" name="password"
                 data-mcp-id="password_input_6" data-mcp-action="fill" data-mcp-type="password">
          
          <!-- Textarea -->
          <label for="message">Message:</label>
          <textarea id="message" name="message" placeholder="Your message here"
                   data-mcp-id="message_textarea_7" data-mcp-action="fill" data-mcp-type="textarea">Default text</textarea>
          
          <!-- Select dropdown -->
          <label for="country">Country:</label>
          <select id="country" name="country" data-mcp-id="country_select_8" data-mcp-action="select" data-mcp-type="select">
            <option value="">Choose country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
          </select>
          
          <!-- Checkboxes -->
          <input type="checkbox" id="newsletter" name="newsletter" value="yes"
                 data-mcp-id="newsletter_checkbox_9" data-mcp-action="toggle" data-mcp-type="checkbox">
          <label for="newsletter">Subscribe to newsletter</label>
          
          <!-- Radio buttons -->
          <input type="radio" id="plan_basic" name="plan" value="basic"
                 data-mcp-id="plan_basic_radio_10" data-mcp-action="select" data-mcp-type="radio">
          <label for="plan_basic">Basic Plan</label>
          
          <input type="radio" id="plan_pro" name="plan" value="pro"
                 data-mcp-id="plan_pro_radio_11" data-mcp-action="select" data-mcp-type="radio">
          <label for="plan_pro">Pro Plan</label>
          
          <!-- Buttons -->
          <button type="button" data-mcp-id="cancel_button_12" data-mcp-action="click" data-mcp-type="button">Cancel</button>
          <button type="submit" data-mcp-id="submit_button_13" data-mcp-action="click" data-mcp-type="submit">Submit Form</button>
          
          <!-- Input buttons -->
          <input type="button" value="Reset" data-mcp-id="reset_input_button_14" data-mcp-action="click" data-mcp-type="button">
          <input type="submit" value="Save" data-mcp-id="save_submit_15" data-mcp-action="click" data-mcp-type="submit">
          
          <!-- File input -->
          <label for="avatar">Upload Avatar:</label>
          <input type="file" id="avatar" name="avatar" accept="image/*"
                 data-mcp-id="avatar_file_16" data-mcp-action="upload" data-mcp-type="file">
          
          <!-- Number input -->
          <label for="age">Age:</label>
          <input type="number" id="age" name="age" min="1" max="120"
                 data-mcp-id="age_number_17" data-mcp-action="fill" data-mcp-type="number">
          
          <!-- Date input -->
          <label for="birthday">Birthday:</label>
          <input type="date" id="birthday" name="birthday"
                 data-mcp-id="birthday_date_18" data-mcp-action="fill" data-mcp-type="date">
          
          <!-- Range slider -->
          <label for="volume">Volume:</label>
          <input type="range" id="volume" name="volume" min="0" max="100" value="50"
                 data-mcp-id="volume_range_19" data-mcp-action="set" data-mcp-type="range">
        </form>
        
        <!-- Standalone elements -->
        <div>
          <h2>Other Interactive Elements</h2>
          
          <!-- Image with action -->
          <img src="/logo.png" alt="Logo" data-mcp-id="logo_image_20" data-mcp-action="click" data-mcp-type="image">
          
          <!-- Div with click action -->
          <div data-mcp-id="toggle_panel_21" data-mcp-action="click" data-mcp-type="div">Click to toggle panel</div>
          
          <!-- Span with action -->
          <span data-mcp-id="close_modal_22" data-mcp-action="click" data-mcp-type="span">×</span>
        </div>
      </body>
    </html>
  `;

  try {
    console.log('1️⃣ Creating JSDOM and finding elements...');
    const dom = new JSDOM(testHtml);
    const document = dom.window.document;
    
    const mcpElements = document.querySelectorAll('[data-mcp-id]');
    console.log(`   Found ${mcpElements.length} elements with data-mcp-id\n`);

    console.log('2️⃣ Testing element replacement logic...\n');
    
    // Track replacement results by element type
    const results = {
      links: [],
      inputs: [],
      buttons: [],
      textareas: [],
      selects: [],
      other: []
    };
    
    mcpElements.forEach((element, index) => {
      const mcpId = element.getAttribute('data-mcp-id');
      const tagName = element.tagName;
      const type = element.type || element.getAttribute('data-mcp-type');
      const text = element.textContent?.trim() || element.value || element.alt || '';
      
      let markdown = '';
      let category = 'other';
      
      // Use the same logic as in the actual implementation
      switch (tagName) {
        case 'INPUT':
          category = 'inputs';
          if (type === 'submit' || type === 'button') {
            markdown = `[Button: ${mcpId}] ${text || element.value || 'Button'}`;
          } else {
            // Get label text
            let label = '';
            if (element.labels && element.labels.length > 0) {
              label = element.labels[0].textContent?.trim() || '';
            } else {
              const prevSibling = element.previousElementSibling;
              if (prevSibling && prevSibling.tagName === 'LABEL') {
                label = prevSibling.textContent?.trim() || '';
              }
            }
            label = label || element.placeholder || element.name || 'Input';
            markdown = `${label}: [Input: ${mcpId}] (${type})`;
          }
          break;
          
        case 'BUTTON':
          category = 'buttons';
          markdown = `[Button: ${mcpId}] ${text || 'Button'}`;
          break;
          
        case 'A':
          category = 'links';
          if (text && text.length > 0) {
            markdown = `[Link: ${mcpId}] ${text}`;
          } else {
            markdown = `[Link: ${mcpId}]`;
          }
          break;
          
        case 'SELECT':
          category = 'selects';
          let selectLabel = '';
          if (element.labels && element.labels.length > 0) {
            selectLabel = element.labels[0].textContent?.trim() || '';
          } else {
            const prevSibling = element.previousElementSibling;
            if (prevSibling && prevSibling.tagName === 'LABEL') {
              selectLabel = prevSibling.textContent?.trim() || '';
            }
          }
          selectLabel = selectLabel || 'Select';
          markdown = `${selectLabel}: [Select: ${mcpId}]`;
          break;
          
        case 'TEXTAREA':
          category = 'textareas';
          let textareaLabel = '';
          if (element.labels && element.labels.length > 0) {
            textareaLabel = element.labels[0].textContent?.trim() || '';
          } else {
            const prevSibling = element.previousElementSibling;
            if (prevSibling && prevSibling.tagName === 'LABEL') {
              textareaLabel = prevSibling.textContent?.trim() || '';
            }
          }
          textareaLabel = textareaLabel || element.placeholder || 'Text Area';
          markdown = `${textareaLabel}: [TextArea: ${mcpId}]`;
          break;
          
        default:
          category = 'other';
          markdown = `[${tagName}: ${mcpId}]`;
      }
      
      results[category].push({
        id: mcpId,
        tagName,
        type,
        text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        markdown
      });
      
      // Replace element with text node
      const textNode = document.createTextNode(markdown);
      element.parentNode?.replaceChild(textNode, element);
    });

    console.log('3️⃣ Replacement Results by Category:\n');
    
    Object.entries(results).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`   📂 ${category.toUpperCase()} (${items.length} items):`);
        items.forEach(item => {
          console.log(`      • ${item.id} (${item.tagName}${item.type ? `/${item.type}` : ''}) → "${item.markdown}"`);
        });
        console.log('');
      }
    });

    console.log('4️⃣ Converting to final markdown...\n');
    const nhm = new NodeHtmlMarkdown({
      strongDelimiter: '**',
      emDelimiter: '*',
      bulletMarker: '-',
      maxConsecutiveNewlines: 2,
    });
    
    const finalMarkdown = nhm.translate(document.body.innerHTML);
    
    console.log('5️⃣ Final Markdown Output (first 1000 chars):');
    console.log('═'.repeat(60));
    console.log(finalMarkdown.substring(0, 1000) + (finalMarkdown.length > 1000 ? '\n...[TRUNCATED]...' : ''));
    console.log('═'.repeat(60));
    
    // Count different element types in final markdown
    const elementCounts = {
      inputs: (finalMarkdown.match(/\[Input:/g) || []).length,
      buttons: (finalMarkdown.match(/\[Button:/g) || []).length,
      links: (finalMarkdown.match(/\[Link:/g) || []).length,
      selects: (finalMarkdown.match(/\[Select:/g) || []).length,
      textareas: (finalMarkdown.match(/\[TextArea:/g) || []).length,
      other: (finalMarkdown.match(/\[(IMG|DIV|SPAN):/g) || []).length
    };
    
    console.log('\n6️⃣ Element Count Verification:');
    Object.entries(elementCounts).forEach(([type, count]) => {
      const expected = results[type]?.length || 0;
      const status = count === expected ? '✅' : '❌';
      console.log(`   ${status} ${type}: ${count}/${expected} found in final markdown`);
    });
    
    const totalExpected = Object.values(results).reduce((sum, items) => sum + items.length, 0);
    const totalFound = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
    
    console.log(`\n🎯 Overall Result: ${totalFound}/${totalExpected} elements properly converted ${totalFound === totalExpected ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testAllElementTypes();