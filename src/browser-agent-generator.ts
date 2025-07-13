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
    const tagName = element.tagName.toLowerCase();
    const inputType = element.getAttribute('type')?.toLowerCase();
    
    // Form inputs that need filling
    if (tagName === 'input') {
      switch (inputType) {
        case 'checkbox': return 'toggle';
        case 'radio': return 'select';
        case 'submit': return 'click';
        case 'button': return 'click';
        case 'file': return 'upload';
        default: return 'fill'; // All text-like inputs
      }
    }
    
    if (tagName === 'textarea') return 'fill';
    if (tagName === 'select') return 'choose';
    
    // Everything else is click
    return 'click';
  }

  function getAssociatedLabel(element: Element): string | null {
    // Label with for attribute
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || null;
    }

    // Parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Get text content but exclude the input element itself
      const clone = parentLabel.cloneNode(true) as Element;
      const input = clone.querySelector('input, select, textarea');
      if (input) input.remove();
      return clone.textContent?.trim() || null;
    }

    // aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent?.trim() || null;
    }

    return null;
  }
  
  function getElementContext(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent?.trim() || '';
    
    // For buttons and links, use their text content
    if (tagName === 'a' || tagName === 'button') {
      // For buttons, try to include product context
      if (tagName === 'button') {
        const container = element.closest('div');
        if (container) {
          const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
          if (heading && heading.textContent) {
            return `${text} - ${heading.textContent.trim()}`;
          }
        }
      }
      return text.substring(0, 50);
    }
    
    // For form inputs, prioritize label over placeholder
    const label = getAssociatedLabel(element);
    if (label) {
      return label.replace(/\*$/, '').trim(); // Remove trailing asterisk
    }
    
    // Fall back to other attributes
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    const title = element.getAttribute('title');
    if (title) return title;
    
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;
    
    const name = element.getAttribute('name');
    if (name) return name;
    
    const id = element.getAttribute('id');
    if (id) return id;
    
    return '';
  }

  function generateElementId(element: Element, index: number): string {
    const type = getElementType(element);
    const tagName = element.tagName.toLowerCase();
    
    // Collect ALL context information
    const contextParts = [];
    
    // 1. Element's own attributes
    const id = element.getAttribute('id');
    const name = element.getAttribute('name');
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const placeholder = element.getAttribute('placeholder');
    const value = element.getAttribute('value');
    const href = element.getAttribute('href');
    const className = element.className;
    
    // 2. Element's text content
    const ownText = element.textContent?.trim() || '';
    
    // 3. Form context
    const form = element.closest('form');
    if (form) {
      const formId = form.getAttribute('id') || form.getAttribute('name') || 'form';
      contextParts.push(`FORM[${formId}]`);
    }
    
    // 4. Parent container context (especially for e-commerce)
    const container = element.closest('div, section, article, li');
    if (container) {
      // Get ALL text from container for maximum context
      const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
      const price = container.querySelector('[class*="price"], [data-price]');
      const description = container.querySelector('p, .description, [class*="desc"]');
      
      if (heading?.textContent) {
        contextParts.push(`PRODUCT[${heading.textContent.trim()}]`);
      }
      
      if (price?.textContent) {
        const priceMatch = price.textContent.match(/\$?[\d,]+\.?\d*/);
        if (priceMatch) {
          contextParts.push(`PRICE[${priceMatch[0]}]`);
        }
      }
      
      if (description?.textContent && description !== element) {
        contextParts.push(`DESC[${description.textContent.trim().substring(0, 50)}]`);
      }
    }
    
    // 5. Associated label
    const label = getAssociatedLabel(element);
    if (label) {
      contextParts.push(`LABEL[${label}]`);
    }
    
    // 6. Build comprehensive ID
    const idParts = [];
    
    // Add all available attributes
    if (id) idParts.push(`ID{${id}}`);
    if (name) idParts.push(`NAME{${name}}`);
    if (ariaLabel) idParts.push(`ARIA{${ariaLabel}}`);
    if (title) idParts.push(`TITLE{${title}}`);
    if (placeholder) idParts.push(`PLACEHOLDER{${placeholder}}`);
    if (href) idParts.push(`HREF{${href.replace(/[\/\?#]/g, '_')}}`);
    if (className) idParts.push(`CLASS{${className.replace(/\s+/g, '_')}}`);
    
    // Add context information
    contextParts.forEach(part => idParts.push(part));
    
    // Add element type and text
    if (ownText && tagName !== 'form') {
      idParts.push(`TEXT{${ownText.substring(0, 50)}}`);
    }
    idParts.push(`TYPE{${type}}`);
    
    // Add position information for disambiguation
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const position = siblings.indexOf(element);
      idParts.push(`POS{${position}}`);
    }
    
    // Add unique index
    idParts.push(`IDX{${index}}`);
    
    // Create a balanced ID that's informative but not overwhelming
    const essentialParts = [];
    
    // 1. Use HTML ID as primary identifier if available (most reliable)
    if (id) {
      essentialParts.push(id);
    }
    // 2. Or use name attribute
    else if (name) {
      essentialParts.push(name);
    }
    // 3. For product buttons, include product name from context
    else if (contextParts.some(p => p.startsWith('PRODUCT['))) {
      const productPart = contextParts.find(p => p.startsWith('PRODUCT['));
      const productName = productPart!.match(/PRODUCT\[(.*?)\]/)?.[1] || '';
      if (productName) {
        essentialParts.push(productName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      }
      
      // Also add price for extra context
      const pricePart = contextParts.find(p => p.startsWith('PRICE['));
      if (pricePart) {
        const price = pricePart.match(/PRICE\[(.*?)\]/)?.[1] || '';
        essentialParts.push(`price_${price.replace(/[^0-9]/g, '')}`);
      }
    }
    // 4. For form fields, use label text
    else if (label) {
      essentialParts.push(label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 25));
    }
    // 5. For other elements, use their text content
    else if (ownText && tagName !== 'form') {
      essentialParts.push(ownText.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 25));
    }
    
    // Always add type for clarity
    essentialParts.push(type);
    
    // Always add index for uniqueness
    essentialParts.push(index.toString());
    
    // Create the final ID
    let finalId = essentialParts.join('_')
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    // Ensure it starts with a letter for valid CSS selector
    if (!/^[a-zA-Z]/.test(finalId)) {
      finalId = `element_${finalId}`;
    }
    
    return finalId;
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

  // console.log(`[Browser] Found ${allElements.length} total interactive elements`);

  // Apply pagination
  const totalElements = allElements.length;
  const endIndex = Math.min(START_INDEX + MAX_ELEMENTS, totalElements);
  const elements = allElements.slice(START_INDEX, endIndex);
  const hasMore = endIndex < totalElements;

  // console.log(`[Browser] Processing elements ${START_INDEX} to ${endIndex} of ${totalElements}`);

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
      description: context || `${type} field`,
      context: context
    };
  });

  // Count tagged elements for verification
  const taggedCount = document.querySelectorAll('[data-mcp-id]').length;
  // console.log(`[Browser] Successfully tagged ${taggedCount} elements`);

  // Group elements into forms
  function groupElementsIntoForms(manifestElements: any[], domElements: Element[]): any[] {
    const formMap = new Map<Element, any[]>();
    
    // Group elements by their parent form
    manifestElements.forEach((manifestElement, index) => {
      const domElement = domElements[index];
      const form = domElement.closest('form');
      
      if (form) {
        if (!formMap.has(form)) {
          formMap.set(form, []);
        }
        formMap.get(form)!.push(manifestElement);
      }
    });
    
    // Convert to form objects
    const forms: any[] = [];
    formMap.forEach((formElements, formElement) => {
      // Separate submit buttons from regular fields
      const fields = formElements.filter(el => 
        !['submit', 'button'].includes(el.type) || el.type === 'button'
      );
      const submitButton = formElements.find(el => el.type === 'submit');
      
      // Get form name
      const formName = formElement.getAttribute('name') || 
                      formElement.getAttribute('id') || 
                      'Form';
      
      forms.push({
        id: formElement.getAttribute('id') || `form-${forms.length + 1}`,
        name: formName,
        action: formElement.getAttribute('action') || 'submit',
        fields,
        submit: submitButton
      });
    });
    
    return forms;
  }

  // Create pagination-aware summary
  let summary = '';
  if (hasMore) {
    summary = `Showing ${manifestElements.length} of ${totalElements} elements (too many for one response - showing batch ${Math.floor(START_INDEX / MAX_ELEMENTS) + 1})`;
  } else {
    summary = `Found ${manifestElements.length} interactive elements`;
  }

  // Group elements into forms
  const forms = groupElementsIntoForms(manifestElements, elements);
  
  return {
    elements: manifestElements,
    summary,
    forms,
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