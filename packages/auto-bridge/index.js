// @supapup/auto-bridge - Zero Config MCP Bridge Generator
// User just imports this ONCE in their app, and it works!

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const patterns = {
    forms: new Set(),
    buttons: new Set(),
    inputs: new Set(),
    navigation: new Set()
  };

  // Monkey-patch React.createElement to intercept ALL component renders
  if (window.React) {
    const original = window.React.createElement;
    window.React.createElement = function(type, props, ...children) {
      // Analyze what's being rendered
      if (typeof type === 'string') {
        // HTML elements
        if (type === 'form' && props?.onSubmit) {
          patterns.forms.add({
            id: props.id || props.name || 'form_' + patterns.forms.size,
            action: 'submit',
            inputs: extractFormInputs(children)
          });
        } else if (type === 'button' && props?.onClick) {
          patterns.buttons.add({
            id: props.id || children[0]?.toString().toLowerCase().replace(/\s+/g, '_'),
            action: 'click',
            text: children[0]
          });
        }
      }
      
      return original.apply(this, arguments);
    };
  }

  // For Vue apps
  if (window.Vue) {
    window.Vue.mixin({
      mounted() {
        analyzeVueComponent(this);
      }
    });
  }

  // Analyze DOM periodically for vanilla JS
  setInterval(() => {
    // Find forms
    document.querySelectorAll('form').forEach(form => {
      if (!form.dataset.mcpAnalyzed) {
        form.dataset.mcpAnalyzed = 'true';
        patterns.forms.add({
          id: form.id || form.name || 'form_' + patterns.forms.size,
          action: 'submit',
          selector: form.id ? `#${form.id}` : 'form',
          inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            name: input.name || input.id,
            type: input.type,
            selector: input.id ? `#${input.id}` : `[name="${input.name}"]`
          }))
        });
      }
    });

    // Find navigation
    document.querySelectorAll('a[href], [data-route], [onclick*="navigate"]').forEach(link => {
      if (!link.dataset.mcpAnalyzed) {
        link.dataset.mcpAnalyzed = 'true';
        patterns.navigation.add({
          id: 'navigate_' + (link.textContent || link.href).toLowerCase().replace(/\s+/g, '_'),
          action: 'navigate',
          target: link.href || link.dataset.route,
          text: link.textContent
        });
      }
    });

    // Generate and expose bridge
    generateBridge();
  }, 1000);

  function generateBridge() {
    const actions = [];
    
    // Convert patterns to actions
    patterns.forms.forEach(form => {
      actions.push({
        id: form.id + '_submit',
        type: 'form',
        description: `Submit form ${form.id}`,
        selector: form.selector,
        inputs: form.inputs.reduce((acc, input) => {
          acc[input.name] = input.type === 'number' ? 'number' : 'string';
          return acc;
        }, {})
      });
    });

    patterns.buttons.forEach(button => {
      actions.push({
        id: button.id,
        type: 'click',
        description: `Click ${button.text}`,
        selector: `#${button.id}`
      });
    });

    patterns.navigation.forEach(nav => {
      actions.push({
        id: nav.id,
        type: 'navigate',
        description: `Navigate to ${nav.text}`,
        target: nav.target
      });
    });

    // Create bridge object
    window.__MCP_BRIDGE__ = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      framework: detectFramework(),
      
      getManifest() {
        return {
          page: window.location.pathname,
          actions: actions,
          state: detectPageState()
        };
      },

      getActions() {
        return actions;
      },

      execute(actionId, params = {}) {
        const action = actions.find(a => a.id === actionId);
        if (!action) throw new Error(`Action ${actionId} not found`);

        switch (action.type) {
          case 'form':
            return executeFormSubmit(action, params);
          case 'click':
            return executeClick(action);
          case 'navigate':
            return executeNavigate(action);
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }
      },

      getState() {
        return detectPageState();
      }
    };

    // Dev helper - show what we found
    if (window.__SUPAPUP_DEBUG__) {
      console.log('🌉 MCP Bridge Generated:', {
        forms: patterns.forms.size,
        buttons: patterns.buttons.size,
        navigation: patterns.navigation.size,
        actions: actions
      });
    }
  }

  function detectFramework() {
    if (window.React) return 'react';
    if (window.Vue) return 'vue';
    if (window.ng) return 'angular';
    return 'vanilla';
  }

  function detectPageState() {
    return {
      url: window.location.href,
      title: document.title,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, select, textarea').length,
      buttons: document.querySelectorAll('button, [type="submit"]').length
    };
  }

  function executeFormSubmit(action, params) {
    const form = document.querySelector(action.selector);
    if (!form) throw new Error('Form not found');

    // Fill form inputs
    Object.entries(params).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"], #${name}`);
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Submit form
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
    
    // If not prevented, try clicking submit button
    if (!submitEvent.defaultPrevented) {
      const submitBtn = form.querySelector('[type="submit"], button');
      submitBtn?.click();
    }

    return { success: true };
  }

  function executeClick(action) {
    const element = document.querySelector(action.selector);
    if (!element) throw new Error('Element not found');
    
    element.click();
    return { success: true };
  }

  function executeNavigate(action) {
    if (action.target.startsWith('http')) {
      window.location.href = action.target;
    } else {
      // Try React Router
      if (window.history?.pushState) {
        window.history.pushState({}, '', action.target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
    return { success: true };
  }

  // Expose for debugging
  window.__SUPAPUP__ = {
    patterns,
    regenerate: generateBridge,
    debug: () => { window.__SUPAPUP_DEBUG__ = true; generateBridge(); }
  };
}