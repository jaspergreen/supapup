/**
 * Browser-side agent page generation
 * This runs directly in the browser context to find and tag elements
 */

export function generateAgentPageInBrowser(options?: { maxElements?: number; startIndex?: number }) {
  const MAX_ELEMENTS = options?.maxElements || 150; // Default limit
  const START_INDEX = options?.startIndex || 0;
  // Element detector functions
  const INTERACTIVE_SELECTORS = [
    'input:not([type="hidden"])',
    'textarea',
    'select',
    'button',
    'input[type="submit"]',
    'input[type="button"]',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="spinbutton"]',
    '[role="switch"]',
    '[role="tab"]',
    '[contenteditable="true"]',
    '[onclick]',
    'summary'
  ];

  function isVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  function getElementType(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase();

    if (tagName === 'input') {
      switch (type) {
        case 'email': return 'email';
        case 'password': return 'password';
        case 'text': return 'text';
        case 'number': return 'number';
        case 'tel': return 'phone';
        case 'url': return 'url';
        case 'search': return 'search';
        case 'checkbox': return 'checkbox';
        case 'radio': return 'radio';
        case 'submit': return 'submit';
        case 'button': return 'button';
        case 'file': return 'file';
        default: return 'input';
      }
    }

    if (tagName === 'textarea') return 'textarea';
    if (tagName === 'select') return 'select';
    if (tagName === 'button') return 'button';
    if (tagName === 'a') return 'link';
    if (role === 'tab') return 'tab';
    if (role === 'button') return 'button';
    if (role === 'link') return 'link';
    
    return 'element';
  }

  function getElementAction(element: Element, type: string): string {
    if (type === 'textarea' || type.includes('input') || type === 'select') {
      return 'fill';
    }
    if (type === 'checkbox' || type === 'radio') {
      return 'toggle';
    }
    return 'click';
  }

  function getElementContext(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent?.trim() || '';
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const placeholder = element.getAttribute('placeholder');
    const name = element.getAttribute('name');
    const id = element.getAttribute('id');
    
    // Build context string
    let context = '';
    
    if (tagName === 'a' || tagName === 'button') {
      context = text.substring(0, 50);
    } else if (ariaLabel) {
      context = ariaLabel;
    } else if (placeholder) {
      context = placeholder;
    } else if (title) {
      context = title;
    } else if (name) {
      context = name;
    } else if (id) {
      context = id;
    }
    
    return context;
  }

  function generateElementId(element: Element, index: number): string {
    const type = getElementType(element);
    const context = getElementContext(element);
    const name = element.getAttribute('name');
    const id = element.getAttribute('id');
    
    // Build ID parts
    const parts = [];
    
    // Add form context if in a form
    const form = element.closest('form');
    if (form) {
      const formName = form.getAttribute('name') || form.getAttribute('id') || 'form';
      parts.push(formName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    }
    
    // Add semantic name
    if (name) {
      parts.push(name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    } else if (id) {
      parts.push(id.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    } else if (context) {
      parts.push(context.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20));
    }
    
    // Add type
    parts.push(type);
    
    // If still no meaningful parts, use index
    if (parts.length === 0 || (parts.length === 1 && parts[0] === type)) {
      parts.push(`element-${index}`);
    }
    
    return parts.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  // First, clear old data-mcp attributes to handle removed elements
  document.querySelectorAll('[data-mcp-id]').forEach(el => {
    el.removeAttribute('data-mcp-id');
    el.removeAttribute('data-mcp-type');
    el.removeAttribute('data-mcp-action');
  });
  
  // Find all interactive elements (including previously tagged ones)
  const allElements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS.join(',')))
    .filter(el => isVisible(el));

  console.log(`[Browser] Found ${allElements.length} total interactive elements`);

  // Apply pagination
  const totalElements = allElements.length;
  const endIndex = Math.min(START_INDEX + MAX_ELEMENTS, totalElements);
  const elements = allElements.slice(START_INDEX, endIndex);
  const hasMore = endIndex < totalElements;

  console.log(`[Browser] Processing elements ${START_INDEX} to ${endIndex} of ${totalElements}`);

  // Tag elements and build manifest
  const manifestElements = elements.map((element, index) => {
    const type = getElementType(element);
    const action = getElementAction(element, type);
    const context = getElementContext(element);
    const id = generateElementId(element, index);
    
    // TAG THE ELEMENT DIRECTLY IN THE BROWSER!
    element.setAttribute('data-mcp-id', id);
    element.setAttribute('data-mcp-type', type);
    element.setAttribute('data-mcp-action', action);
    
    return {
      id,
      type,
      action,
      description: `${type}: ${context || 'untitled'}`,
      context: context
    };
  });

  // Count tagged elements for verification
  const taggedCount = document.querySelectorAll('[data-mcp-id]').length;
  console.log(`[Browser] Successfully tagged ${taggedCount} elements`);

  // Create pagination-aware summary
  let summary = '';
  if (hasMore) {
    summary = `Showing ${manifestElements.length} of ${totalElements} elements (too many for one response - showing batch ${Math.floor(START_INDEX / MAX_ELEMENTS) + 1})`;
  } else {
    summary = `Found ${manifestElements.length} interactive elements`;
  }

  return {
    elements: manifestElements,
    summary,
    forms: [],
    navigation: [],
    pagination: {
      totalElements,
      returnedElements: manifestElements.length,
      startIndex: START_INDEX,
      endIndex,
      hasMore,
      currentPage: Math.floor(START_INDEX / MAX_ELEMENTS) + 1,
      totalPages: Math.ceil(totalElements / MAX_ELEMENTS),
      maxElementsPerPage: MAX_ELEMENTS
    }
  };
}