
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
            
            const usedIds = new Set();
            let elementCounter = 0;
            
            // Start with title and basic info
            result.content += document.title + String.fromCharCode(10);
            result.content += '='.repeat(document.title.length) + String.fromCharCode(10) + String.fromCharCode(10);
            
            // Process visible content in reading order
            this.processContentNode(document.body, result, usedIds, elementCounter, '');
            
            // Add forms and actions summary
            if (result.elements.length > 0) {
              // Group elements by forms first
              const forms = this.groupElementsByForms(result.elements);
              
              // Add form fill tool reference if forms exist
              if (forms.length > 0) {
                result.content += String.fromCharCode(10) + 'FORM TOOLS:' + String.fromCharCode(10);
                forms.forEach((form, index) => {
                  const fieldsList = form.fields.map((f) => f.id + ': "value"').join(', ');
                  result.content += '- form_fill({formData: {' + fieldsList + '}}) -> Fill entire form' + String.fromCharCode(10);
                });
                result.content += String.fromCharCode(10);
              }
              
              // Add individual actions
              result.content += String.fromCharCode(10) + 'ACTIONS AVAILABLE:' + String.fromCharCode(10);
              result.elements.forEach(el => {
                const example = this.generateActionExample(el);
                if (example) {
                  result.content += '- ' + example + String.fromCharCode(10);
                  result.actions.push(example);
                }
              });
              
              // Add stats
              result.content += String.fromCharCode(10) + 'INTERACTIVE ELEMENTS: ' + result.elements.length + ' total' + String.fromCharCode(10);
              const actionStats = this.getActionStats(result.elements);
              Object.entries(actionStats).forEach(([action, count]) => {
                result.content += '- ' + action + ': ' + count + ' elements' + String.fromCharCode(10);
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
                  result.content += indent + text + String.fromCharCode(10);
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
                  
                  // Apply data attributes to DOM immediately
                  element.setAttribute('data-mcp-id', agentElement.id);
                  element.setAttribute('data-mcp-type', agentElement.type);
                  element.setAttribute('data-mcp-action', agentElement.action);
                  
                  // Add inline representation
                  const inlineRep = this.createInlineRepresentation(agentElement);
                  result.content += indent + inlineRep + String.fromCharCode(10);
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
            const type = element.type && element.type.toLowerCase();
            
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
            if (tagName === 'summary') return true;
            if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') return true;
            
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
            const type = (element.type && element.type.toLowerCase()) || tagName;
            
            // Generate semantic ID
            const id = this.generateSemanticId(element, usedIds);
            
            // Determine action type
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
            
            // Get label and context
            const label = this.getElementLabel(element);
            const text = (element.textContent && element.textContent.trim()) || label || element.placeholder || '';
            
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
            const type = element.type && element.type.toLowerCase();
            if (tagName === 'button' && (type === 'submit' || !type)) {
              const text = element.textContent && element.textContent.trim();
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
              const label = document.querySelector('label[for="' + element.id + '"]');
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
              const text = prev.textContent && prev.textContent.trim();
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
              
              const text = node.textContent && node.textContent.trim();
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
            
            let result = '**[' + actionText + ': ' + displayText + ']** (ID: ' + agentElement.id + ')';
            
            // Add options for select
            if (options && options.length > 0) {
              result += '\n  Options: ' + options.slice(0, 7).join(', ');
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
                result.content += String.fromCharCode(10) + '#'.repeat(level) + ' ' + text + String.fromCharCode(10) + String.fromCharCode(10);
              }
              return indent;
            }
            
            // Paragraphs and divs with text
            if (['p', 'div'].includes(tagName)) {
              const directText = this.getDirectTextContent(element);
              if (directText.trim()) {
                result.content += String.fromCharCode(10) + directText.trim() + String.fromCharCode(10);
              }
              return indent;
            }
            
            // Lists
            if (tagName === 'ul' || tagName === 'ol') {
              result.content += String.fromCharCode(10);
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
           * Group elements by forms
           */
          groupElementsByForms(elements) {
            const forms = [];
            const formMap = new Map();
            
            // Find all form elements on the page
            const formElements = document.querySelectorAll('form');
            console.log('Found form elements:', formElements.length);
            
            formElements.forEach((formElement, index) => {
              const formId = formElement.id || 'form-' + (index + 1);
              
              // Find all interactive elements within this form
              const formFields = [];
              
              // Get all interactive elements within the form
              const formInteractiveElements = formElement.querySelectorAll('input, textarea, select, button');
              
              // Match them with our processed elements
              elements.forEach(element => {
                // Find matching DOM element by comparing various attributes
                for (let domElement of formInteractiveElements) {
                  if (this.isMatchingElement(domElement, element)) {
                    formFields.push(element);
                    break;
                  }
                }
              });
              
              if (formFields.length > 0) {
                forms.push({
                  id: formId,
                  fields: formFields
                });
                console.log('Form ' + formId + ' has ' + formFields.length + ' fields');
              }
            });
            
            console.log('Forms found:', forms.length, 'Elements checked:', elements.length);
            return forms;
          },
          
          /**
           * Check if DOM element matches our processed element
           */
          isMatchingElement(domElement, processedElement) {
            // Match by ID first
            if (domElement.id && domElement.id === processedElement.id) {
              return true;
            }
            
            // Match by name
            if (domElement.name && domElement.name === processedElement.id) {
              return true;
            }
            
            // Match by type and label combination
            const domType = (domElement.type && domElement.type.toLowerCase()) || domElement.tagName.toLowerCase();
            const processedType = processedElement.type;
            
            if (domType === processedType) {
              const domLabel = this.getElementLabel(domElement);
              if (domLabel && domLabel === processedElement.label) {
                return true;
              }
              
              // Match by placeholder
              if (domElement.placeholder && domElement.placeholder === processedElement.placeholder) {
                return true;
              }
              
              // Match by text content for buttons
              if (domElement.tagName.toLowerCase() === 'button' && 
                  domElement.textContent && domElement.textContent.trim() === processedElement.text) {
                return true;
              }
            }
            
            return false;
          },
          
          /**
           * Get statistics about action types
           */
          getActionStats(elements) {
            const stats = {};
            elements.forEach(element => {
              const action = element.action || 'unknown';
              stats[action] = (stats[action] || 0) + 1;
            });
            return stats;
          },
          
          /**
           * Generate action example for element
           */
          generateActionExample(element) {
            const { id, action, type, options } = element;
            
            if (action === 'fill') {
              if (type === 'email') {
                return 'execute_action({actionId: "' + id + '", params: {value: "user@example.com"}}) -> Fill email';
              } else if (type === 'password') {
                return 'execute_action({actionId: "' + id + '", params: {value: "password123"}}) -> Fill password';
              } else if (type === 'tel') {
                return 'execute_action({actionId: "' + id + '", params: {value: "+1234567890"}}) -> Fill phone';
              } else {
                return 'execute_action({actionId: "' + id + '", params: {value: "text"}}) -> Fill ' + (element.label || type);
              }
            } else if (action === 'select' && options && options.length > 0) {
              return 'execute_action({actionId: "' + id + '", params: {value: "' + options[0] + '"}}) -> Select option';
            } else if (action === 'toggle') {
              return 'execute_action({actionId: "' + id + '"}) -> Toggle ' + (element.label || 'checkbox');
            } else {
              return 'execute_action({actionId: "' + id + '"}) -> Click ' + (element.label || element.text || 'button');
            }
          }
          
        };
        
        // Also inject the interaction script
        window['__AGENT_PAGE__'] = {
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
              // Handle select elements - need to find the right option
              if (element.tagName.toLowerCase() === 'select') {
                const options = Array.from(element.options);
                const option = options.find(opt => 
                  opt.value === params.value || 
                  opt.textContent.trim() === params.value
                );
                if (option) {
                  element.value = option.value;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  throw new Error('Option not found: ' + params.value);
                }
              } else {
                element.value = params.value;
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else if (action === 'adjust' && params && params.value !== undefined) {
              element.value = params.value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (action === 'edit' && params && params.value !== undefined) {
              element.textContent = params.value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (action === 'upload') {
              // File uploads can't be programmatically set for security reasons
              throw new Error('File upload requires manual user interaction');
            } else {
              // Default: click the element
              element.click();
            }
            
            return { success: true, actionId: actionId, action: action };
          }
        };
      }
    `;
