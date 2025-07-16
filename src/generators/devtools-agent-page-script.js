// DevTools Agent Page Generator - Browser-side script
// This script runs in the browser context to generate agent pages

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
      result.content += document.title + '\n';
      result.content += '='.repeat(document.title.length) + '\n\n';
      
      // Process visible content in reading order
      this.processContentNode(document.body, result, usedIds, elementCounter, '');
      
      // Add forms and actions summary
      if (result.elements.length > 0) {
        // Group elements by forms first
        const forms = this.groupElementsByForms(result.elements);
        
        // Add form fill tool reference if forms exist
        if (forms.length > 0) {
          result.content += '\nFORM TOOLS:\n';
          forms.forEach((form, index) => {
            const fieldsList = form.fields.map((f) => f.id + ': "value"').join(', ');
            result.content += '- form_fill({formData: {' + fieldsList + '}}) -> Fill entire form\n';
          });
          result.content += '\n';
        }
        
        // Add individual actions
        result.content += '\nACTIONS AVAILABLE:\n';
        result.elements.forEach(el => {
          const example = this.generateActionExample(el);
          if (example) {
            result.content += '- ' + example + '\n';
            result.actions.push(example);
          }
        });
        
        // Add stats
        result.content += '\nINTERACTIVE ELEMENTS: ' + result.elements.length + ' total\n';
        const actionStats = this.getActionStats(result.elements);
        Object.entries(actionStats).forEach(([action, count]) => {
          result.content += '- ' + action + ': ' + count + ' elements\n';
        });
      }
      
      return result;
    },
    
    // Process content nodes in reading order
    processContentNode(node, result, usedIds, elementCounter, indent) {
      if (!node || !this.isNodeVisible(node)) return;
      
      // Skip script, style, and other non-content elements
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'meta', 'link', 'head'].includes(tagName)) {
          return;
        }
      }
      
      // Handle text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text && text.length > 0) {
          const parent = node.parentElement;
          if (parent && !this.isStructuralElement(parent) && !this.isInteractiveElement(parent)) {
            result.content += indent + text + '\n';
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
            result.content += indent + inlineRep + '\n';
            return;
          }
        }
        
        // Handle structural elements
        const newIndent = this.handleStructuralElement(element, result, indent);
        
        // Process children
        if (!this.elementHandlesOwnText(element)) {
          Array.from(element.childNodes).forEach(child => {
            this.processContentNode(child, result, usedIds, elementCounter, newIndent);
          });
        }
      }
    },
    
    // Check if element is visible using modern API
    isNodeVisible(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.parentElement && this.isElementVisible(node.parentElement);
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        return this.isElementVisible(node);
      }
      
      return false;
    },
    
    // Modern visibility detection
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
    
    // Check if element is interactive
    isInteractiveElement(element) {
      const tagName = element.tagName.toLowerCase();
      const type = element.type && element.type.toLowerCase();
      
      // Form elements
      if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
        return type !== 'hidden';
      }
      
      // Links and clickable elements
      if (tagName === 'a' && element.href) return true;
      if (element.hasAttribute('onclick')) return true;
      if (element.getAttribute('role') === 'button') return true;
      if (element.getAttribute('role') === 'link') return true;
      
      return false;
    },
    
    // Check if element is structural
    isStructuralElement(element) {
      const tagName = element.tagName.toLowerCase();
      return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'label'].includes(tagName);
    },
    
    // Check if element handles its own text content
    elementHandlesOwnText(element) {
      const tagName = element.tagName.toLowerCase();
      return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label'].includes(tagName);
    },
    
    // Process interactive element into agent element
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
        } else if (['date', 'time', 'datetime-local'].includes(type)) {
          action = 'fill';
        }
      } else if (tagName === 'textarea') {
        action = 'fill';
      } else if (tagName === 'select') {
        action = 'select';
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
    
    // Generate semantic ID for element
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
      
      // Generate from label/context for form fields
      const tagName = element.tagName.toLowerCase();
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
        }
      }
      
      // Fallback to type-based ID
      const type = (element.type && element.type.toLowerCase()) || tagName;
      for (let i = 1; i <= 100; i++) {
        const fallbackId = type + '-' + i;
        if (!usedIds.has(fallbackId)) {
          usedIds.add(fallbackId);
          return fallbackId;
        }
      }
      
      // Ultimate fallback
      const ultimateId = tagName + '-' + Date.now();
      usedIds.add(ultimateId);
      return ultimateId;
    },
    
    // Get label for element
    getElementLabel(element) {
      // Try explicit label first
      if (element.id) {
        const label = document.querySelector('label[for="' + element.id + '"]');
        if (label) {
          return label.textContent.trim();
        }
      }
      
      // Try parent label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        return parentLabel.textContent.trim();
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
      
      return '';
    },
    
    // Create inline representation of interactive element
    createInlineRepresentation(agentElement) {
      const { type, action, text, label, placeholder, options } = agentElement;
      
      let displayText = label || text || placeholder || type;
      displayText = displayText.substring(0, 50);
      
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
    
    // Handle structural elements
    handleStructuralElement(element, result, indent) {
      const tagName = element.tagName.toLowerCase();
      
      // Headings
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const level = parseInt(tagName[1]);
        const text = element.textContent.trim();
        if (text) {
          result.content += '\n' + '#'.repeat(level) + ' ' + text + '\n\n';
        }
        return indent;
      }
      
      // Paragraphs
      if (['p', 'div'].includes(tagName)) {
        const directText = this.getDirectTextContent(element);
        if (directText.trim()) {
          result.content += '\n' + directText.trim() + '\n';
        }
        return indent;
      }
      
      return indent;
    },
    
    // Get direct text content
    getDirectTextContent(element) {
      let text = '';
      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      });
      return text;
    },
    
    // Group elements by forms
    groupElementsByForms(elements) {
      const forms = [];
      const formElements = document.querySelectorAll('form');
      
      formElements.forEach((formElement, index) => {
        const formId = formElement.id || 'form-' + (index + 1);
        const formFields = [];
        
        // Get all interactive elements within the form
        const formInteractiveElements = formElement.querySelectorAll('input, textarea, select, button');
        
        // Match them with our processed elements
        elements.forEach(element => {
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
        }
      });
      
      return forms;
    },
    
    // Check if DOM element matches our processed element
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
      }
      
      return false;
    },
    
    // Get statistics about action types
    getActionStats(elements) {
      const stats = {};
      elements.forEach(element => {
        const action = element.action || 'unknown';
        stats[action] = (stats[action] || 0) + 1;
      });
      return stats;
    },
    
    // Generate action example for element
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
        }
      } else {
        element.click();
      }
      
      return { success: true, actionId: actionId, action: action };
    }
  };
}