#!/usr/bin/env node

/**
 * Standalone test for DevToolsAgentPageGenerator
 * Tests the new unified agent page generation approach
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testDevToolsAgentPage() {
  console.log('🧪 Testing DevTools Agent Page Generator...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Keep visible for debugging
      defaultViewport: null,
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Test with ecommerce example
    const testFile = path.resolve(__dirname, '../../examples/ecommerce/index.html');
    const fileUrl = `file://${testFile}`;
    
    console.log('📍 Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // Import and use the generator (simulate the TypeScript class)
    const generatorCode = `
      // Import the generator logic inline for testing
      ${getDevToolsGeneratorScript()}
    `;
    
    await page.evaluate(generatorCode);
    
    console.log('\n🔍 INITIAL STATE (before clicking login button):');
    console.log('='.repeat(60));
    
    // Test initial state
    const initialResult = await page.evaluate(() => {
      return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
    });
    
    console.log(initialResult.content);
    console.log('\n📊 Elements found:', initialResult.elements.length);
    initialResult.elements.forEach(el => {
      console.log(`  - ${el.id} (${el.type}) - ${el.action}: "${el.label || el.text}"`);
    });
    
    // Click the login button to show the form
    console.log('\n🔄 Clicking login button to show form...');
    await page.click('#showLoginBtn');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for animation
    
    console.log('\n🔍 AFTER CLICKING LOGIN (form visible):');
    console.log('='.repeat(60));
    
    // Test after form is shown
    const formResult = await page.evaluate(() => {
      return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
    });
    
    console.log(formResult.content);
    console.log('\n📊 Elements found:', formResult.elements.length);
    formResult.elements.forEach(el => {
      console.log(`  - ${el.id} (${el.type}) - ${el.action}: "${el.label || el.text}"`);
    });
    
    // Test form submission example
    console.log('\n🧪 Testing form interaction...');
    await page.type('#firstName', 'John');
    await page.type('#lastName', 'Doe');
    await page.type('#email', 'demo@example.com');
    await page.type('#password', 'password123');
    
    console.log('\n🔍 AFTER FILLING FORM:');
    console.log('='.repeat(60));
    
    const filledResult = await page.evaluate(() => {
      return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
    });
    
    console.log(filledResult.content);
    
    // Performance test
    console.log('\n⚡ PERFORMANCE TEST:');
    console.log('='.repeat(30));
    
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
      });
    }
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / 10;
    
    console.log(`Average generation time: ${avgTime.toFixed(2)}ms`);
    console.log(`Throughput: ${(1000 / avgTime).toFixed(1)} generations/second`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (browser) {
      console.log('\n🔚 Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Get the generator script as a string (for inline evaluation)
 */
function getDevToolsGeneratorScript() {
  return `
    // Only inject once
    if (typeof window.__DEVTOOLS_AGENT_GENERATOR__ === 'undefined') {
      
      window.__DEVTOOLS_AGENT_GENERATOR__ = {
        
        generate() {
          const result = {
            content: '',
            elements: [],
            actions: [],
            title: document.title,
            url: window.location.href
          };
          
          const usedIds = new Set();
          let elementCounter = 0;
          
          // Start with title and basic info
          result.content += document.title + '\\n';
          result.content += '='.repeat(document.title.length) + '\\n\\n';
          
          // Process visible content in reading order
          this.processContentNode(document.body, result, usedIds, elementCounter, '');
          
          // Add actions summary
          if (result.elements.length > 0) {
            result.content += '\\nACTIONS AVAILABLE:\\n';
            result.elements.forEach(el => {
              const example = this.generateActionExample(el);
              if (example) {
                result.content += '- ' + example + '\\n';
                result.actions.push(example);
              }
            });
          }
          
          return result;
        },
        
        /**
         * Process content nodes in reading order
         */
        processContentNode(node, result, usedIds, elementCounter, indent) {
          if (!node || !this.isNodeVisible(node)) return;
          
          // Skip script, style, and other non-content elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'meta', 'link', 'head'].includes(tagName)) {
              return;
            }
          }
          
          // Handle text nodes - but avoid duplicating text from parent elements
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text && text.length > 0) {
              // Only add text if parent is not a structural element that will handle it
              const parent = node.parentElement;
              if (parent && !this.isStructuralElement(parent) && !this.isInteractiveElement(parent)) {
                result.content += indent + text + '\\n';
              }
            }
            return;
          }
          
          // Handle element nodes
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const tagName = element.tagName.toLowerCase();
            
            // Check if this is an interactive element
            if (this.isInteractiveElement(element)) {
              const agentElement = this.processInteractiveElement(element, usedIds, elementCounter);
              if (agentElement) {
                result.elements.push(agentElement);
                elementCounter++;
                
                // Add inline representation
                const inlineRep = this.createInlineRepresentation(agentElement);
                result.content += indent + inlineRep + '\\n';
                return; // Don't process children of interactive elements
              }
            }
            
            // Handle structural elements
            const newIndent = this.handleStructuralElement(element, result, indent);
            
            // Process children only if this element didn't handle its own text
            if (!this.elementHandlesOwnText(element)) {
              Array.from(element.childNodes).forEach(child => {
                this.processContentNode(child, result, usedIds, elementCounter, newIndent);
              });
            }
          }
        },
        
        /**
         * Check if element is visible using modern API
         */
        isNodeVisible(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.parentElement && this.isElementVisible(node.parentElement);
          }
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            return this.isElementVisible(node);
          }
          
          return false;
        },
        
        /**
         * Modern visibility detection
         */
        isElementVisible(element) {
          if (!element) return false;
          
          // Use modern checkVisibility API if available
          if (typeof element.checkVisibility === 'function') {
            return element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
              contentVisibilityAuto: true,
              opacityProperty: true,
              visibilityProperty: true
            });
          }
          
          // Fallback visibility check
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || 
              style.visibility === 'hidden' || 
              style.opacity === '0') {
            return false;
          }
          
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return false;
          }
          
          return true;
        },
        
        /**
         * Check if element is interactive
         */
        isInteractiveElement(element) {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();
          
          // Form elements
          if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
            return type !== 'hidden';
          }
          
          // Form submit buttons (including those outside form tags)
          if (tagName === 'button' && (type === 'submit' || !type)) return true;
          if (tagName === 'input' && type === 'submit') return true;
          
          // Links and clickable elements
          if (tagName === 'a' && element.href) return true;
          if (element.hasAttribute('onclick')) return true;
          if (element.getAttribute('role') === 'button') return true;
          if (element.getAttribute('role') === 'link') return true;
          
          return false;
        },

        /**
         * Check if element is structural (handles its own text)
         */
        isStructuralElement(element) {
          const tagName = element.tagName.toLowerCase();
          return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'label'].includes(tagName);
        },

        /**
         * Check if element handles its own text content
         */
        elementHandlesOwnText(element) {
          const tagName = element.tagName.toLowerCase();
          return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label'].includes(tagName);
        },
        
        /**
         * Process interactive element into agent element
         */
        processInteractiveElement(element, usedIds, counter) {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase() || tagName;
          
          // Generate semantic ID
          const id = this.generateSemanticId(element, usedIds);
          
          // Determine action type
          let action = 'click';
          if (tagName === 'input') {
            if (['text', 'email', 'password', 'tel', 'url', 'search'].includes(type)) {
              action = 'fill';
            } else if (['checkbox', 'radio'].includes(type)) {
              action = 'toggle';
            } else if (type === 'date') {
              action = 'fill';
            }
          } else if (tagName === 'textarea') {
            action = 'fill';
          } else if (tagName === 'select') {
            action = 'select';
          }
          
          // Get label and context
          const label = this.getElementLabel(element);
          const text = element.textContent?.trim() || label || element.placeholder || '';
          
          const agentElement = {
            id,
            type,
            action,
            text,
            label,
            tagName,
            placeholder: element.placeholder || '',
            required: element.hasAttribute('required'),
            checked: element.checked,
            value: element.value || ''
          };
          
          // Add options for select elements
          if (tagName === 'select') {
            agentElement.options = Array.from(element.options).map(opt => opt.textContent.trim()).filter(Boolean);
          }
          
          return agentElement;
        },
        
        /**
         * Generate semantic ID for element
         */
        generateSemanticId(element, usedIds) {
          // Try existing ID first
          if (element.id && !usedIds.has(element.id)) {
            usedIds.add(element.id);
            return element.id;
          }
          
          // Try name attribute
          if (element.name && !usedIds.has(element.name)) {
            usedIds.add(element.name);
            return element.name;
          }
          
          // Special handling for submit buttons
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();
          if (tagName === 'button' && (type === 'submit' || !type)) {
            const text = element.textContent?.trim();
            if (text) {
              const submitId = 'submit-' + text.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 20);
              if (!usedIds.has(submitId)) {
                usedIds.add(submitId);
                return submitId;
              }
            }
            // Fallback for submit buttons
            const submitFallback = 'form-submit';
            if (!usedIds.has(submitFallback)) {
              usedIds.add(submitFallback);
              return submitFallback;
            }
          }
          
          // Generate from label/context for form fields
          if (['input', 'textarea', 'select'].includes(tagName)) {
            const label = this.getElementLabel(element);
            if (label) {
              const baseId = label.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 30);
              
              if (baseId && !usedIds.has(baseId)) {
                usedIds.add(baseId);
                return baseId;
              }
              
              // Add counter if needed
              for (let i = 1; i <= 10; i++) {
                const numberedId = baseId + '-' + i;
                if (!usedIds.has(numberedId)) {
                  usedIds.add(numberedId);
                  return numberedId;
                }
              }
            }
          }
          
          // Fallback to type-based ID
          let baseType = tagName;
          if (type && type !== tagName) {
            baseType = type;
          }
          
          for (let i = 1; i <= 100; i++) {
            const fallbackId = baseType + '-' + i;
            if (!usedIds.has(fallbackId)) {
              usedIds.add(fallbackId);
              return fallbackId;
            }
          }
          
          // Ultimate fallback
          const ultimateId = element.tagName.toLowerCase() + '-' + Date.now();
          usedIds.add(ultimateId);
          return ultimateId;
        },
        
        /**
         * Get label for element
         */
        getElementLabel(element) {
          // Try explicit label first
          if (element.id) {
            const label = document.querySelector(\`label[for="\${element.id}"]\`);
            if (label) {
              return this.extractCleanText(label, element);
            }
          }
          
          // Try parent label
          const parentLabel = element.closest('label');
          if (parentLabel) {
            return this.extractCleanText(parentLabel, element);
          }
          
          // Try aria-label
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            return ariaLabel.trim();
          }
          
          // Try placeholder as fallback
          const placeholder = element.getAttribute('placeholder');
          if (placeholder) {
            return placeholder.trim();
          }
          
          // Try previous sibling that looks like a label
          let prev = element.previousElementSibling;
          while (prev && prev !== prev.parentElement.firstElementChild) {
            const text = prev.textContent?.trim();
            if (text && text.length > 0 && text.length < 100 && 
                (text.endsWith('*') || text.endsWith(':') || prev.tagName.toLowerCase() === 'label')) {
              return text;
            }
            prev = prev.previousElementSibling;
          }
          
          // Try finding nearby text in parent container
          const parentText = this.findNearbyLabelText(element);
          if (parentText) return parentText;
          
          return '';
        },

        /**
         * Extract clean text from label, excluding the form element itself
         */
        extractCleanText(labelElement, formElement) {
          const labelText = labelElement.textContent || '';
          const formText = formElement.textContent || '';
          
          // Remove form element text from label text
          let cleanText = labelText.replace(formText, '').trim();
          
          // Clean up common label artifacts
          cleanText = cleanText.replace(/\s+/g, ' ');
          cleanText = cleanText.replace(/^\s*:\s*|\s*:\s*$/g, '');
          
          return cleanText;
        },

        /**
         * Find nearby label text in parent container
         */
        findNearbyLabelText(element) {
          const parent = element.parentElement;
          if (!parent) return '';
          
          // Look for text nodes or small elements before this element
          const walker = document.createTreeWalker(
            parent,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: (node) => {
                if (node === element) return NodeFilter.FILTER_REJECT;
                if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent.trim();
                  return text.length > 0 && text.length < 100 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const tagName = node.tagName.toLowerCase();
                  return ['span', 'div', 'label'].includes(tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_REJECT;
              }
            }
          );
          
          let node;
          let lastText = '';
          while (node = walker.nextNode()) {
            if (node === element) break;
            
            const text = node.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) {
              lastText = text;
            }
          }
          
          return lastText;
        },
        
        /**
         * Create inline representation of interactive element
         */
        createInlineRepresentation(agentElement) {
          const { type, action, text, label, placeholder, options } = agentElement;
          
          let displayText = label || text || placeholder || type;
          displayText = displayText.substring(0, 50); // Limit length
          
          let actionText = action.toUpperCase();
          if (action === 'fill') actionText = 'INPUT';
          else if (action === 'select') actionText = 'SELECT';
          else if (action === 'toggle') actionText = 'CHECKBOX';
          else if (action === 'click') actionText = 'BUTTON';
          
          let result = \`**[\${actionText}: \${displayText}]** (ID: \${agentElement.id})\`;
          
          // Add options for select
          if (options && options.length > 0) {
            result += '\\n  Options: ' + options.slice(0, 7).join(', ');
            if (options.length > 7) result += ', ...';
          }
          
          return result;
        },
        
        /**
         * Handle structural elements (headings, paragraphs, etc.)
         */
        handleStructuralElement(element, result, indent) {
          const tagName = element.tagName.toLowerCase();
          
          // Headings
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            const level = parseInt(tagName[1]);
            const text = element.textContent.trim();
            if (text) {
              result.content += '\\n' + '#'.repeat(level) + ' ' + text + '\\n\\n';
            }
            return indent;
          }
          
          // Paragraphs and divs with text
          if (['p', 'div'].includes(tagName)) {
            const directText = this.getDirectTextContent(element);
            if (directText.trim()) {
              result.content += '\\n' + directText.trim() + '\\n';
            }
            return indent;
          }
          
          // Lists
          if (tagName === 'ul' || tagName === 'ol') {
            result.content += '\\n';
            return indent;
          }
          
          if (tagName === 'li') {
            return indent + '- ';
          }
          
          return indent;
        },
        
        /**
         * Get direct text content (not from children)
         */
        getDirectTextContent(element) {
          let text = '';
          Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              text += node.textContent;
            }
          });
          return text;
        },
        
        /**
         * Generate action example for element
         */
        generateActionExample(element) {
          const { id, action, type, options } = element;
          
          if (action === 'fill') {
            if (type === 'email') {
              return \`execute_action({actionId: "\${id}", params: {value: "user@example.com"}}) → Fill email\`;
            } else if (type === 'password') {
              return \`execute_action({actionId: "\${id}", params: {value: "password123"}}) → Fill password\`;
            } else if (type === 'tel') {
              return \`execute_action({actionId: "\${id}", params: {value: "+1234567890"}}) → Fill phone\`;
            } else {
              return \`execute_action({actionId: "\${id}", params: {value: "text"}}) → Fill \${element.label || type}\`;
            }
          } else if (action === 'select' && options && options.length > 0) {
            return \`execute_action({actionId: "\${id}", params: {value: "\${options[0]}"}}) → Select option\`;
          } else if (action === 'toggle') {
            return \`execute_action({actionId: "\${id}"}) → Toggle \${element.label || 'checkbox'}\`;
          } else {
            return \`execute_action({actionId: "\${id}"}) → Click \${element.label || element.text || 'button'}\`;
          }
        }
        
      };
    }
  `;
}

// Run the test
if (require.main === module) {
  testDevToolsAgentPage().catch(console.error);
}