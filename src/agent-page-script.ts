export class AgentPageScript {
  static generate(): string {
    return `
      class AgentPageGenerator {
        static generate() {
          const usedIds = new Set();
          const elements = this.findInteractiveElements();
          const agentElements = elements.map(element => {
            const context = this.getElementContext(element);
            const id = this.generateId(element, context, usedIds);
            const { type, action } = this.getElementTypeAndAction(element);
            
            return { element, id, type, action, description: this.generateDescription(element, context, type), context };
          });

          return {
            elements: agentElements,
            summary: 'Found ' + agentElements.length + ' interactive elements',
            url: window.location.href,
            title: document.title
          };
        }

        static findInteractiveElements() {
          const selectors = ['input:not([type="hidden"])', 'textarea', 'select', 'button', 'a[href]', '[role="button"]', '[onclick]'];
          const elements = [];
          const MAX_ELEMENTS = 50;
          
          for (const selector of selectors) {
            if (elements.length >= MAX_ELEMENTS) break;
            try {
              const found = document.querySelectorAll(selector);
              elements.push(...Array.from(found).slice(0, MAX_ELEMENTS - elements.length));
            } catch (e) { console.warn('Invalid selector:', selector); }
          }

          return Array.from(new Set(elements)).filter(el => this.isElementVisible(el)).slice(0, MAX_ELEMENTS);
        }

        static isElementVisible(element) {
          if (!element || !element.offsetParent) return false;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }

        static getElementContext(element) {
          const text = element.textContent && element.textContent.trim();
          if (text && text.length < 30) return text;
          const placeholder = element.getAttribute('placeholder');
          if (placeholder) return placeholder;
          return element.tagName.toLowerCase();
        }

        static generateId(element, context, usedIds) {
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          
          let base = tag;
          if (tag === 'input' && type) base = type + '-input';
          if (tag === 'button') {
            const text = element.textContent && element.textContent.trim().toLowerCase();
            if (text && text.length < 15) {
              base = text.replace(/[^a-z0-9\\s-_]/g, '').replace(/\\s+/g, '-');
            }
          }
          
          let id = base;
          let counter = 1;
          while (usedIds.has(id)) {
            id = base + '-' + counter;
            counter++;
          }
          usedIds.add(id);
          return id;
        }

        static getElementTypeAndAction(element) {
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          
          if (tag === 'input') {
            if (type === 'submit') return { type: 'submit', action: 'click' };
            return { type: type || 'text', action: 'fill' };
          }
          if (tag === 'button') return { type: 'button', action: 'click' };
          if (tag === 'select') return { type: 'select', action: 'select' };
          if (tag === 'textarea') return { type: 'textarea', action: 'fill' };
          if (tag === 'a') return { type: 'link', action: 'click' };
          
          return { type: 'element', action: 'click' };
        }

        static generateDescription(element, context, type) {
          if (context && context.length > 2 && context.length < 30) {
            return context + ' (' + type + ')';
          }
          return type + ' element';
        }

        static generateAgentPage(manifest) {
          const lines = ['AGENT PAGE VIEW', '==============================', ''];
          
          if (manifest.elements.length === 0) {
            lines.push('No interactive elements found');
          } else {
            lines.push('Found ' + manifest.elements.length + ' interactive elements:');
            lines.push('');
            manifest.elements.forEach(function(el, i) {
              lines.push((i + 1) + '. ' + el.id + ': ' + el.description);
            });
          }
          
          lines.push('', 'Usage: Use element IDs for interaction', 'Example: execute_action({actionId: "button-submit", params: {}})');
          return lines.join('\\n');
        }

        static applyToDOM(manifest) {
          manifest.elements.forEach(function(el) {
            el.element.setAttribute('data-mcp-id', el.id);
            el.element.setAttribute('data-mcp-type', el.type);
            el.element.setAttribute('data-mcp-action', el.action);
          });
        }
      }
      
      window.AgentPageGenerator = AgentPageGenerator;
      
      window.__AGENT_PAGE__ = {
        version: '2.0.0',
        generated: new Date().toISOString(),
        manifest: null,
        
        execute: function(actionId, params) {
          const element = document.querySelector('[data-mcp-id="' + actionId + '"]');
          if (!element) throw new Error('Element not found: ' + actionId);
          
          const action = element.getAttribute('data-mcp-action');
          
          if (action === 'fill' && params.value !== undefined) {
            element.value = params.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            element.click();
          }
          
          return { success: true, element: actionId };
        },
        
        getState: function() {
          return {
            url: window.location.href,
            title: document.title,
            elementsCount: this.manifest ? this.manifest.elements.length : 0
          };
        },
        
        getElementByNumber: function(elementNumber) {
          const element = document.querySelector('[data-mcp-agent-page-element-' + elementNumber + ']');
          if (!element) {
            throw new Error('Element ' + elementNumber + ' not found. Make sure you ran devtools_visual_element_map first.');
          }
          return element;
        },
        
        clickElement: function(elementNumber) {
          const element = this.getElementByNumber(elementNumber);
          element.click();
          return { success: true, elementNumber: elementNumber, action: 'click' };
        },
        
        fillElement: function(elementNumber, value) {
          const element = this.getElementByNumber(elementNumber);
          if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            throw new Error('Element ' + elementNumber + ' is not a fillable input or textarea');
          }
          return { success: true, elementNumber: elementNumber, action: 'fill', value: value };
        },
        
        highlightElement: function(elementNumber, duration) {
          const element = this.getElementByNumber(elementNumber);
          const originalBorder = element.style.border;
          const originalBoxShadow = element.style.boxShadow;
          
          element.style.border = '3px solid #ff0000';
          element.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(function() {
            element.style.border = originalBorder;
            element.style.boxShadow = originalBoxShadow;
          }, duration || 3000);
          
          return { success: true, elementNumber: elementNumber, action: 'highlight', duration: duration || 3000 };
        }
      };
    `;
  }
}