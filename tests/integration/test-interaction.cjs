#!/usr/bin/env node

/**
 * Test actual interaction with every detected element
 * First JavaScript, then MCP layer
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testElementInteraction() {
  console.log('🧪 Testing ACTUAL INTERACTION with all detected elements...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Navigate to comprehensive page
    const testFile = path.resolve(__dirname, 'examples/comprehensive-elements.html');
    const fileUrl = `file://${testFile}`;
    
    console.log('📍 Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // Inject the generator script
    const generatorCode = getDevToolsGeneratorScript();
    await page.evaluate(generatorCode);
    
    // Generate agent page and get all elements
    const result = await page.evaluate(() => {
      return window.__DEVTOOLS_AGENT_GENERATOR__.generate();
    });
    
    console.log(`🎯 Found ${result.elements.length} actionable elements to test\n`);
    
    // Test each element interaction
    let successCount = 0;
    let failCount = 0;
    
    for (const element of result.elements) {
      console.log(`\n🔄 Testing: ${element.id} (${element.action})`);
      console.log(`   Type: ${element.tagName}[${element.type}]`);
      console.log(`   Text: "${element.label || element.text}"`);
      
      try {
        // Test the interaction based on action type
        const testResult = await testElementAction(page, element);
        
        if (testResult.success) {
          console.log(`   ✅ SUCCESS: ${testResult.message}`);
          successCount++;
        } else {
          console.log(`   ❌ FAILED: ${testResult.message}`);
          failCount++;
        }
        
      } catch (error) {
        console.log(`   💥 ERROR: ${error.message}`);
        failCount++;
      }
      
      // Small delay to see the interaction
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 INTERACTION TEST RESULTS:`);
    console.log(`=`.repeat(40));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total: ${result.elements.length}`);
    console.log(`📈 Success Rate: ${((successCount / result.elements.length) * 100).toFixed(1)}%`);
    
    if (failCount > 0) {
      console.log(`\n⚠️  Some interactions failed - this indicates:`);
      console.log(`   • Element not properly tagged with data-mcp-id`);
      console.log(`   • JavaScript execution issues`);
      console.log(`   • Element not actually interactable`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (browser) {
      console.log('\n🔚 Keeping browser open for inspection...');
      // Don't close browser so we can inspect the state
      // await browser.close();
    }
  }
}

/**
 * Test interaction with a specific element
 */
async function testElementAction(page, element) {
  const { id, action, type, tagName, options } = element;
  
  try {
    // Check if element exists with data-mcp-id
    const elementExists = await page.evaluate((elementId) => {
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      return el !== null;
    }, id);
    
    if (!elementExists) {
      return { success: false, message: 'Element not found with data-mcp-id' };
    }
    
    // Test interaction based on action type
    switch (action) {
      case 'fill':
        return await testFillAction(page, element);
      case 'select':
        return await testSelectAction(page, element);
      case 'toggle':
        return await testToggleAction(page, element);
      case 'click':
        return await testClickAction(page, element);
      case 'adjust':
        return await testAdjustAction(page, element);
      case 'upload':
        return await testUploadAction(page, element);
      case 'edit':
        return await testEditAction(page, element);
      default:
        return { success: false, message: `Unknown action type: ${action}` };
    }
    
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Test fill action (text inputs, textareas)
 */
async function testFillAction(page, element) {
  const testValue = getTestValue(element.type);
  
  const result = await page.evaluate((elementId, value) => {
    try {
      if (typeof window.__AGENT_PAGE__ === 'undefined') {
        return { success: false, message: '__AGENT_PAGE__ not available' };
      }
      
      window.__AGENT_PAGE__.execute(elementId, { value: value });
      
      // Verify the value was set
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found after execution' };
      }
      
      if (el.value === value) {
        return { success: true, message: `Value set to "${value}"` };
      } else {
        return { success: false, message: `Expected "${value}", got "${el.value}"` };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id, testValue);
  
  return result;
}

/**
 * Test select action (dropdowns)
 */
async function testSelectAction(page, element) {
  if (!element.options || element.options.length === 0) {
    return { success: false, message: 'No options available' };
  }
  
  const testOption = element.options[0];
  
  const result = await page.evaluate((elementId, option) => {
    try {
      window.__AGENT_PAGE__.execute(elementId, { value: option });
      
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found after execution' };
      }
      
      if (el.value === option || el.selectedOptions[0]?.textContent.trim() === option) {
        return { success: true, message: `Selected "${option}"` };
      } else {
        return { success: false, message: `Selection failed for "${option}"` };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id, testOption);
  
  return result;
}

/**
 * Test toggle action (checkboxes, radio buttons)
 */
async function testToggleAction(page, element) {
  const result = await page.evaluate((elementId) => {
    try {
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found' };
      }
      
      const initialState = el.checked;
      
      window.__AGENT_PAGE__.execute(elementId);
      
      const newState = el.checked;
      
      if (newState !== initialState) {
        return { success: true, message: `Toggled from ${initialState} to ${newState}` };
      } else {
        return { success: false, message: `Toggle failed - state unchanged: ${initialState}` };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id);
  
  return result;
}

/**
 * Test click action (buttons, links)
 */
async function testClickAction(page, element) {
  const result = await page.evaluate((elementId) => {
    try {
      // Set up click listener to verify click happened
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found' };
      }
      
      let clicked = false;
      const clickHandler = () => { clicked = true; };
      el.addEventListener('click', clickHandler);
      
      window.__AGENT_PAGE__.execute(elementId);
      
      el.removeEventListener('click', clickHandler);
      
      if (clicked) {
        return { success: true, message: 'Click event fired' };
      } else {
        return { success: false, message: 'Click event not detected' };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id);
  
  return result;
}

/**
 * Test adjust action (range, color inputs)
 */
async function testAdjustAction(page, element) {
  const testValue = element.type === 'color' ? '#ff0000' : '75';
  
  const result = await page.evaluate((elementId, value) => {
    try {
      window.__AGENT_PAGE__.execute(elementId, { value: value });
      
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found after execution' };
      }
      
      if (el.value === value) {
        return { success: true, message: `Adjusted to "${value}"` };
      } else {
        return { success: false, message: `Expected "${value}", got "${el.value}"` };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id, testValue);
  
  return result;
}

/**
 * Test upload action (file inputs)
 */
async function testUploadAction(page, element) {
  // File inputs can't be easily tested programmatically due to security restrictions
  // Just verify the element is accessible
  const result = await page.evaluate((elementId) => {
    try {
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found' };
      }
      
      if (el.type === 'file') {
        return { success: true, message: 'File input accessible (upload not testable)' };
      } else {
        return { success: false, message: 'Not a file input' };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id);
  
  return result;
}

/**
 * Test edit action (contenteditable)
 */
async function testEditAction(page, element) {
  const testValue = 'Test edited content';
  
  const result = await page.evaluate((elementId, value) => {
    try {
      const el = document.querySelector(`[data-mcp-id="${elementId}"]`);
      if (!el) {
        return { success: false, message: 'Element not found' };
      }
      
      const initialContent = el.textContent;
      
      window.__AGENT_PAGE__.execute(elementId, { value: value });
      
      const newContent = el.textContent;
      
      if (newContent.includes(value)) {
        return { success: true, message: `Content changed to "${newContent}"` };
      } else {
        return { success: false, message: `Content not changed: "${newContent}"` };
      }
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, element.id, testValue);
  
  return result;
}

/**
 * Get appropriate test value for input type
 */
function getTestValue(type) {
  switch (type) {
    case 'email': return 'test@example.com';
    case 'password': return 'password123';
    case 'tel': return '+1234567890';
    case 'url': return 'https://example.com';
    case 'number': return '42';
    case 'date': return '2024-01-01';
    case 'time': return '14:30';
    case 'datetime-local': return '2024-01-01T14:30';
    case 'month': return '2024-01';
    case 'week': return '2024-W01';
    default: return 'test value';
  }
}

/**
 * Get the generator script with full implementation
 */
function getDevToolsGeneratorScript() {
  // Read the full script from our test file
  const fs = require('fs');
  const testScript = fs.readFileSync(__filename, 'utf8');
  const scriptMatch = testScript.match(/function getDevToolsGeneratorScript\(\) \{[\s\S]*?return `([\s\S]*?)`;[\s\S]*?\}/);
  
  // Just include the full working script from test-comprehensive-elements.cjs
  return `
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
          
          return result;
        },
        
        processContentNode(node, result, usedIds, elementCounter, indent) {
          if (!node || !this.isNodeVisible(node)) return;
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'meta', 'link', 'head'].includes(tagName)) {
              return;
            }
          }
          
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text && text.length > 0) {
              const parent = node.parentElement;
              if (parent && !this.isStructuralElement(parent) && !this.isInteractiveElement(parent)) {
                result.content += indent + text + '\\n';
              }
            }
            return;
          }
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            
            if (this.isInteractiveElement(element)) {
              const agentElement = this.processInteractiveElement(element, usedIds, elementCounter);
              if (agentElement) {
                result.elements.push(agentElement);
                elementCounter++;
                
                // Apply data attributes to DOM
                element.setAttribute('data-mcp-id', agentElement.id);
                element.setAttribute('data-mcp-type', agentElement.type);
                element.setAttribute('data-mcp-action', agentElement.action);
                
                const inlineRep = this.createInlineRepresentation(agentElement);
                result.content += indent + inlineRep + '\\n';
                return;
              }
            }
            
            const newIndent = this.handleStructuralElement(element, result, indent);
            
            if (!this.elementHandlesOwnText(element)) {
              Array.from(element.childNodes).forEach(child => {
                this.processContentNode(child, result, usedIds, elementCounter, newIndent);
              });
            }
          }
        },
        
        isNodeVisible(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.parentElement && this.isElementVisible(node.parentElement);
          }
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            return this.isElementVisible(node);
          }
          
          return false;
        },
        
        isElementVisible(element) {
          if (!element) return false;
          
          if (typeof element.checkVisibility === 'function') {
            return element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
              contentVisibilityAuto: true,
              opacityProperty: true,
              visibilityProperty: true
            });
          }
          
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
        
        isInteractiveElement(element) {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();
          
          if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
            return type !== 'hidden';
          }
          
          if (tagName === 'button' && (type === 'submit' || !type)) return true;
          if (tagName === 'input' && type === 'submit') return true;
          if (tagName === 'a' && element.href) return true;
          if (element.hasAttribute('onclick')) return true;
          if (element.getAttribute('role') === 'button') return true;
          if (element.getAttribute('role') === 'link') return true;
          if (tagName === 'summary') return true;
          if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') return true;
          
          return false;
        },

        isStructuralElement(element) {
          const tagName = element.tagName.toLowerCase();
          return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'label'].includes(tagName);
        },

        elementHandlesOwnText(element) {
          const tagName = element.tagName.toLowerCase();
          return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label'].includes(tagName);
        },
        
        processInteractiveElement(element, usedIds, counter) {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase() || tagName;
          
          const id = this.generateSemanticId(element, usedIds);
          
          let action = 'click';
          if (tagName === 'input') {
            if (['text', 'email', 'password', 'tel', 'url', 'search', 'number'].includes(type)) {
              action = 'fill';
            } else if (['checkbox', 'radio'].includes(type)) {
              action = 'toggle';
            } else if (['date', 'time', 'datetime-local', 'month', 'week'].includes(type)) {
              action = 'fill';
            } else if (['range', 'color'].includes(type)) {
              action = 'adjust';
            } else if (type === 'file') {
              action = 'upload';
            }
          } else if (tagName === 'textarea') {
            action = 'fill';
          } else if (tagName === 'select') {
            action = 'select';
          } else if (element.hasAttribute('contenteditable')) {
            action = 'edit';
          }
          
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
          
          if (tagName === 'select') {
            agentElement.options = Array.from(element.options).map(opt => opt.textContent.trim()).filter(Boolean);
          }
          
          return agentElement;
        },
        
        generateSemanticId(element, usedIds) {
          if (element.id && !usedIds.has(element.id)) {
            usedIds.add(element.id);
            return element.id;
          }
          
          if (element.name && !usedIds.has(element.name)) {
            usedIds.add(element.name);
            return element.name;
          }
          
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
            const submitFallback = 'form-submit';
            if (!usedIds.has(submitFallback)) {
              usedIds.add(submitFallback);
              return submitFallback;
            }
          }
          
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
              
              for (let i = 1; i <= 10; i++) {
                const numberedId = baseId + '-' + i;
                if (!usedIds.has(numberedId)) {
                  usedIds.add(numberedId);
                  return numberedId;
                }
              }
            }
          }
          
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
          
          const ultimateId = element.tagName.toLowerCase() + '-' + Date.now();
          usedIds.add(ultimateId);
          return ultimateId;
        },
        
        getElementLabel(element) {
          if (element.id) {
            const label = document.querySelector(\`label[for="\${element.id}"]\`);
            if (label) {
              return this.extractCleanText(label, element);
            }
          }
          
          const parentLabel = element.closest('label');
          if (parentLabel) {
            return this.extractCleanText(parentLabel, element);
          }
          
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            return ariaLabel.trim();
          }
          
          const placeholder = element.getAttribute('placeholder');
          if (placeholder) {
            return placeholder.trim();
          }
          
          let prev = element.previousElementSibling;
          while (prev && prev !== prev.parentElement.firstElementChild) {
            const text = prev.textContent?.trim();
            if (text && text.length > 0 && text.length < 100 && 
                (text.endsWith('*') || text.endsWith(':') || prev.tagName.toLowerCase() === 'label')) {
              return text;
            }
            prev = prev.previousElementSibling;
          }
          
          const parentText = this.findNearbyLabelText(element);
          if (parentText) return parentText;
          
          return '';
        },

        extractCleanText(labelElement, formElement) {
          const labelText = labelElement.textContent || '';
          const formText = formElement.textContent || '';
          
          let cleanText = labelText.replace(formText, '').trim();
          cleanText = cleanText.replace(/\s+/g, ' ');
          cleanText = cleanText.replace(/^\s*:\s*|\s*:\s*$/g, '');
          
          return cleanText;
        },

        findNearbyLabelText(element) {
          return '';
        },
        
        createInlineRepresentation(agentElement) {
          const { type, action, text, label, placeholder, options } = agentElement;
          
          let displayText = label || text || placeholder || type;
          displayText = displayText.substring(0, 50);
          
          let actionText = action.toUpperCase();
          if (action === 'fill') actionText = 'INPUT';
          else if (action === 'select') actionText = 'SELECT';
          else if (action === 'toggle') actionText = 'CHECKBOX';
          else if (action === 'click') actionText = 'BUTTON';
          else if (action === 'adjust') actionText = 'RANGE';
          else if (action === 'upload') actionText = 'FILE';
          else if (action === 'edit') actionText = 'EDIT';
          
          let result = \`**[\${actionText}: \${displayText}]** (ID: \${agentElement.id})\`;
          
          if (options && options.length > 0) {
            result += '\\n  Options: ' + options.slice(0, 7).join(', ');
            if (options.length > 7) result += ', ...';
          }
          
          return result;
        },
        
        handleStructuralElement(element, result, indent) {
          return indent;
        }
        
      };
      
      // Also inject the interaction script
      window.__AGENT_PAGE__ = {
        execute: function(actionId, params) {
          const element = document.querySelector('[data-mcp-id="' + actionId + '"]');
          if (!element) throw new Error('Element not found: ' + actionId);
          
          const action = element.getAttribute('data-mcp-action');
          
          if (action === 'fill' && params && params.value !== undefined) {
            element.value = params.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (action === 'toggle') {
            element.checked = !element.checked;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (action === 'select' && params && params.value !== undefined) {
            element.value = params.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (action === 'edit' && params && params.value !== undefined) {
            element.textContent = params.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            element.click();
          }
        }
      };
    }
  `;
}

// Run the test
if (require.main === module) {
  testElementInteraction().catch(console.error);
}