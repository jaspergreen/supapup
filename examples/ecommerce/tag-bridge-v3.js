// Tag Bridge v3 - with event expectations
// This bridge tells agents what to expect after actions

window.__MCP_TAG_BRIDGE__ = {
  // Event expectations queue
  expectations: [],
  
  // Recent events for polling
  recentEvents: [],
  
  // Get all tagged elements with their properties
  getElementMap() {
    const elements = document.querySelectorAll('[data-mcp-id]');
    const elementMap = {
      forms: {},
      buttons: {},
      links: {},
      inputs: {},
      state: {},
      products: {}
    };
    
    elements.forEach(el => {
      const id = el.getAttribute('data-mcp-id');
      const type = el.getAttribute('data-mcp-type') || el.tagName.toLowerCase();
      const info = {
        id: id,
        type: type,
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
        visible: !el.hidden && el.offsetParent !== null,
        disabled: el.disabled || false,
        value: el.value || '',
        attributes: {}
      };
      
      // Collect all data-mcp attributes
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-mcp-')) {
          info.attributes[attr.name] = attr.value;
        }
      });
      
      // Check for expected events after actions
      if (el.getAttribute('data-mcp-expects')) {
        info.expects = el.getAttribute('data-mcp-expects');
      }
      
      // Categorize elements
      if (el.tagName === 'FORM' || type === 'form') {
        elementMap.forms[id] = info;
      } else if (el.tagName === 'BUTTON' || type === 'button' || type === 'submit') {
        elementMap.buttons[id] = info;
      } else if (el.tagName === 'A' || type === 'link') {
        elementMap.links[id] = info;
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        elementMap.inputs[id] = info;
      } else if (type === 'state') {
        elementMap.state[id] = info;
      } else if (type === 'product') {
        elementMap.products[id] = info;
      }
    });
    
    return elementMap;
  },
  
  // Execute action and return expectations
  execute(action, elementId, params = {}) {
    const element = document.querySelector(`[data-mcp-id="${elementId}"]`) || 
                   document.getElementById(elementId);
    
    if (!element) {
      return { 
        success: false, 
        error: 'Element not found',
        expectsEvent: false 
      };
    }
    
    let result = { 
      success: true, 
      expectsEvent: false,
      eventType: null,
      eventTimeout: 10000 
    };
    
    // Check if this element expects an event after action
    const expects = element.getAttribute('data-mcp-expects');
    if (expects) {
      const [eventType, timeout] = expects.split(':');
      result.expectsEvent = true;
      result.eventType = eventType;
      result.eventTimeout = parseInt(timeout) || 10000;
      
      // Add to expectations
      this.addExpectation({
        action: action,
        elementId: elementId,
        eventType: eventType,
        timeout: result.eventTimeout,
        timestamp: Date.now()
      });
    }
    
    switch (action) {
      case 'click':
        element.click();
        result.action = 'clicked';
        break;
        
      case 'fill':
        if ('value' in element) {
          element.value = params.value || '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          result.action = 'filled';
          result.value = params.value;
        }
        break;
        
      case 'submit':
        if (element.tagName === 'FORM') {
          element.submit();
          result.action = 'submitted';
        }
        break;
        
      default:
        result.success = false;
        result.error = 'Unknown action';
    }
    
    return result;
  },
  
  // Add expectation for future event
  addExpectation(expectation) {
    this.expectations.push(expectation);
    console.log('[BRIDGE] Expecting event:', expectation);
  },
  
  // Poll for expected events
  pollForEvents(since = 0) {
    // Return recent events since timestamp
    const events = this.recentEvents.filter(e => e.timestamp > since);
    
    // Check if any match expectations
    const matched = events.filter(event => {
      return this.expectations.some(exp => 
        exp.eventType === event.type &&
        event.timestamp > exp.timestamp
      );
    });
    
    return {
      events: events,
      matchedExpectations: matched,
      hasExpectedEvent: matched.length > 0
    };
  },
  
  // Monitor for events
  setupEventMonitor() {
    // Override dialogs
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;
    
    window.alert = (message) => {
      this.addEvent({
        type: 'dialog',
        subtype: 'alert',
        message: String(message || ''),
        timestamp: Date.now()
      });
      return originalAlert.call(window, message);
    };
    
    window.confirm = (message) => {
      this.addEvent({
        type: 'dialog',
        subtype: 'confirm',
        message: String(message || ''),
        timestamp: Date.now()
      });
      return originalConfirm.call(window, message);
    };
    
    window.prompt = (message, defaultValue) => {
      const event = {
        type: 'dialog',
        subtype: 'prompt',
        message: String(message || ''),
        defaultValue: defaultValue,
        timestamp: Date.now()
      };
      this.addEvent(event);
      
      // Create prompt response form
      this.createPromptForm(event);
      
      return defaultValue || '';
    };
    
    // Monitor DOM changes
    const observer = new MutationObserver((mutations) => {
      const significant = mutations.some(m => 
        m.type === 'childList' && m.addedNodes.length > 0
      );
      
      if (significant) {
        this.addEvent({
          type: 'dom_change',
          mutations: mutations.length,
          timestamp: Date.now()
        });
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Monitor navigation
    window.addEventListener('beforeunload', () => {
      this.addEvent({
        type: 'navigation',
        action: 'leaving',
        timestamp: Date.now()
      });
    });
  },
  
  // Add event to recent events
  addEvent(event) {
    this.recentEvents.push(event);
    
    // Keep only last 50 events
    if (this.recentEvents.length > 50) {
      this.recentEvents = this.recentEvents.slice(-50);
    }
    
    // Log for agent to see
    console.log('[BRIDGE_EVENT]', JSON.stringify(event));
  },
  
  // Create form for prompt response
  createPromptForm(promptEvent) {
    const form = document.createElement('div');
    form.id = 'mcp-prompt-response';
    form.setAttribute('data-mcp-id', 'prompt-response-form');
    form.setAttribute('data-mcp-type', 'prompt-form');
    form.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: yellow;
      border: 3px solid red;
      padding: 15px;
      z-index: 999999;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    form.innerHTML = `
      <h4 style="margin: 0 0 10px 0;">Agent: Respond to Prompt</h4>
      <p style="margin: 5px 0;">${promptEvent.message}</p>
      <input type="text" id="mcp-prompt-input" 
             data-mcp-id="prompt-input"
             placeholder="Your response..." 
             style="width: 200px; padding: 5px;">
      <button data-mcp-id="prompt-submit" 
              onclick="window.__MCP_TAG_BRIDGE__.submitPromptResponse()">
        Submit
      </button>
    `;
    
    document.body.appendChild(form);
  },
  
  // Submit prompt response
  submitPromptResponse() {
    const input = document.getElementById('mcp-prompt-input');
    const form = document.getElementById('mcp-prompt-response');
    
    if (input && form) {
      const response = input.value;
      
      this.addEvent({
        type: 'prompt_response',
        response: response,
        timestamp: Date.now()
      });
      
      // Remove form
      form.remove();
      
      console.log('[BRIDGE] Prompt response submitted:', response);
    }
  },
  
  // Get human-readable state
  getTextRepresentation() {
    const elements = this.getElementMap();
    const parts = [`PAGE: ${document.title}`, `URL: ${window.location.pathname}`];
    
    // Add sections
    if (Object.keys(elements.forms).length > 0) {
      parts.push('\nFORMS:');
      Object.entries(elements.forms).forEach(([id, form]) => {
        parts.push(`  ${id}: ${form.text || 'Form'}`);
        
        // Show related inputs
        Object.entries(elements.inputs).forEach(([inputId, input]) => {
          if (input.attributes['data-mcp-form'] === id) {
            const expects = input.attributes['data-mcp-expects'] || '';
            parts.push(`    - ${inputId} (${input.type})${expects ? ' [expects: ' + expects + ']' : ''}`);
          }
        });
      });
    }
    
    if (Object.keys(elements.buttons).length > 0) {
      parts.push('\nBUTTONS:');
      Object.entries(elements.buttons).forEach(([id, btn]) => {
        const expects = btn.attributes['data-mcp-expects'] || '';
        parts.push(`  - ${id}: "${btn.text}"${expects ? ' [expects: ' + expects + ']' : ''}`);
      });
    }
    
    if (this.expectations.length > 0) {
      parts.push('\nEXPECTING EVENTS:');
      this.expectations.forEach(exp => {
        parts.push(`  - ${exp.eventType} (from ${exp.action} on ${exp.elementId})`);
      });
    }
    
    if (this.recentEvents.length > 0) {
      parts.push('\nRECENT EVENTS:');
      this.recentEvents.slice(-5).forEach(event => {
        parts.push(`  - ${event.type}: ${event.message || event.subtype || ''}`);
      });
    }
    
    return parts.join('\n');
  }
};

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.__MCP_TAG_BRIDGE__.setupEventMonitor();
  });
} else {
  window.__MCP_TAG_BRIDGE__.setupEventMonitor();
}