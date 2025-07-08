/**
 * Runtime Agent Page Generator
 * Intelligently detects and tags interactive elements for AI agents
 */

export interface AgentElement {
  element: Element;
  id: string;
  type: string;
  action: string;
  description: string;
  context: string;
  parent?: string;
  expects?: string;
}

export interface PaginationInfo {
  totalElements: number;
  returnedElements: number;
  startIndex: number;
  endIndex: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  maxElementsPerPage: number;
}

export interface AgentPageManifest {
  elements: AgentElement[];
  summary: string;
  forms: FormGroup[];
  navigation: NavigationGroup[];
  pagination?: PaginationInfo;
}

export interface FormGroup {
  id: string;
  name: string;
  action: string;
  fields: AgentElement[];
  submit?: AgentElement;
}

export interface NavigationGroup {
  type: 'main' | 'breadcrumb' | 'pagination' | 'tabs' | 'menu';
  items: AgentElement[];
}

/**
 * Smart element detector - identifies interactive elements worth tagging
 */
export class ElementDetector {
  private static readonly INTERACTIVE_SELECTORS = [
    // Form elements
    'input:not([type="hidden"])',
    'textarea',
    'select',
    'button',
    'input[type="submit"]',
    'input[type="button"]',
    
    // Links and navigation
    'a[href]',
    'nav a',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    
    // Interactive elements
    '[onclick]',
    '[tabindex="0"]',
    '[tabindex="-1"]',
    '.btn',
    '.button',
    '.link',
    
    // Form-like elements
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="checkbox"]',
    '[role="radio"]'
  ];

  private static readonly IGNORE_SELECTORS = [
    '[style*="display: none"]',
    '[style*="visibility: hidden"]',
    '[hidden]',
    '[disabled]',
    '.hidden',
    'script',
    'style',
    'meta',
    'title'
  ];

  /**
   * Find all interactive elements on the page
   */
  static findInteractiveElements(): Element[] {
    const elements: Element[] = [];
    
    // Get all potentially interactive elements
    this.INTERACTIVE_SELECTORS.forEach(selector => {
      try {
        const found = document.querySelectorAll(selector);
        // console.error(`[ElementDetector] Selector "${selector}" found ${found.length} elements`);
        elements.push(...Array.from(found));
      } catch (e) {
        console.warn(`Invalid selector: ${selector}`, e);
      }
    });

    // Remove duplicates and filter out hidden/disabled elements
    const uniqueElements = Array.from(new Set(elements));
    // console.error(`[ElementDetector] Found ${uniqueElements.length} unique elements before filtering`);
    
    const interactive = uniqueElements.filter(el => this.isElementInteractive(el));
    // console.error(`[ElementDetector] Found ${interactive.length} interactive elements after filtering`);
    
    return interactive;
  }

  /**
   * Check if element is actually interactive and visible
   */
  private static isElementInteractive(element: Element): boolean {
    // Skip if matches ignore selectors
    for (const ignoreSelector of this.IGNORE_SELECTORS) {
      try {
        if (element.matches(ignoreSelector)) {
          // console.error(`[ElementDetector] Element filtered by ignore selector: ${ignoreSelector}`);
          return false;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    // Check visibility
    if (!this.isElementVisible(element)) {
      // console.error(`[ElementDetector] Element filtered - not visible: ${element.tagName}`);
      return false;
    }

    // Check if it's actually interactive
    return this.hasInteractiveCapability(element);
  }

  /**
   * Check if element is visible to users
   */
  private static isElementVisible(element: Element): boolean {
    // In JSDOM environment, simplified visibility check
    if (typeof window !== 'undefined' && !(window as any).chrome) {
      // Likely JSDOM - only check basic attributes
      return !(
        element.hasAttribute('hidden') ||
        element.getAttribute('style')?.includes('display: none') ||
        element.getAttribute('style')?.includes('visibility: hidden')
      );
    }
    
    // Full browser environment
    const style = window.getComputedStyle(element);
    
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.hasAttribute('hidden') ||
      (element as HTMLElement).offsetParent === null
    );
  }

  /**
   * Check if element has interactive capabilities
   */
  private static hasInteractiveCapability(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    
    // Form elements are always interactive
    if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
      return true;
    }

    // Links with href
    if (tagName === 'a' && element.hasAttribute('href')) {
      return true;
    }

    // Elements with interactive roles
    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'menuitem', 'tab'].includes(role)) {
      return true;
    }

    // Elements with click handlers or tabindex
    if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
      return true;
    }

    // Elements with interactive classes (common patterns)
    const className = element.className.toLowerCase();
    if (className.includes('btn') || className.includes('button') || className.includes('link')) {
      return true;
    }

    return false;
  }

  /**
   * Get the form that contains this element, if any
   */
  static getParentForm(element: Element): HTMLFormElement | null {
    return element.closest('form');
  }

  /**
   * Get semantic context for an element (nearby labels, headings, etc.)
   */
  static getElementContext(element: Element): string {
    const contexts: string[] = [];

    // Direct label
    const label = this.getAssociatedLabel(element);
    if (label) contexts.push(label);

    // Placeholder text
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) contexts.push(placeholder);

    // Title or aria-label
    const title = element.getAttribute('title') || element.getAttribute('aria-label');
    if (title) contexts.push(title);

    // Button/link text content
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length < 100) {
      contexts.push(textContent);
    }

    // Nearby heading (look up the DOM tree)
    const nearbyHeading = this.findNearbyHeading(element);
    if (nearbyHeading) contexts.push(nearbyHeading);

    return contexts.filter(Boolean).join(' ').trim();
  }

  /**
   * Find label associated with form element
   */
  private static getAssociatedLabel(element: Element): string | null {
    // Label with for attribute
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || null;
    }

    // Parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || null;
    }

    // aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent?.trim() || null;
    }

    return null;
  }

  /**
   * Find nearby heading that provides context
   */
  private static findNearbyHeading(element: Element): string | null {
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 5) {
      // Look for headings in current container
      const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) {
        return heading.textContent?.trim() || null;
      }

      // Check if current element is a heading
      if (/^h[1-6]$/i.test(current.tagName)) {
        return current.textContent?.trim() || null;
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }
}

/**
 * Intelligent ID generator - creates semantic, context-aware IDs
 */
export class IDGenerator {
  private static usedIds = new Set<string>();

  /**
   * Generate a semantic ID for an element
   */
  static generateId(element: Element, context: string): string {
    const parts: string[] = [];

    // Determine element type and action
    const { type, action } = this.getElementTypeAndAction(element);
    
    // Get semantic name from context
    const semanticName = this.extractSemanticName(element, context);
    
    // Build ID parts
    if (type === 'form') {
      parts.push('form');
    } else {
      // Add parent form context if applicable
      const form = ElementDetector.getParentForm(element);
      if (form) {
        const formName = this.getFormName(form);
        if (formName) parts.push('form', formName);
      }
    }

    // Add semantic name
    if (semanticName) {
      parts.push(semanticName);
    }

    // Add type/action context
    if (type !== 'form') {
      parts.push(type);
    }

    // Create base ID
    let baseId = parts.join('-').toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure uniqueness
    return this.ensureUnique(baseId);
  }

  /**
   * Determine element type and action
   */
  private static getElementTypeAndAction(element: Element): { type: string; action: string } {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase();

    // Form elements
    if (tagName === 'input') {
      switch (type) {
        case 'email': return { type: 'email', action: 'fill' };
        case 'password': return { type: 'password', action: 'fill' };
        case 'text': return { type: 'text', action: 'fill' };
        case 'number': return { type: 'number', action: 'fill' };
        case 'tel': return { type: 'phone', action: 'fill' };
        case 'url': return { type: 'url', action: 'fill' };
        case 'search': return { type: 'search', action: 'fill' };
        case 'checkbox': return { type: 'checkbox', action: 'toggle' };
        case 'radio': return { type: 'radio', action: 'select' };
        case 'submit': return { type: 'submit', action: 'click' };
        case 'button': return { type: 'button', action: 'click' };
        case 'file': return { type: 'file', action: 'upload' };
        default: return { type: 'input', action: 'fill' };
      }
    }

    if (tagName === 'textarea') return { type: 'textarea', action: 'fill' };
    if (tagName === 'select') return { type: 'select', action: 'choose' };
    if (tagName === 'button') return { type: 'button', action: 'click' };
    if (tagName === 'form') return { type: 'form', action: 'submit' };

    // Links and navigation
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href?.startsWith('#')) return { type: 'anchor', action: 'scroll' };
      if (href?.startsWith('mailto:')) return { type: 'email-link', action: 'click' };
      if (href?.startsWith('tel:')) return { type: 'phone-link', action: 'click' };
      return { type: 'link', action: 'navigate' };
    }

    // Role-based detection
    if (role === 'button') return { type: 'button', action: 'click' };
    if (role === 'link') return { type: 'link', action: 'navigate' };
    if (role === 'textbox') return { type: 'textbox', action: 'fill' };
    if (role === 'combobox') return { type: 'combobox', action: 'choose' };
    if (role === 'checkbox') return { type: 'checkbox', action: 'toggle' };
    if (role === 'radio') return { type: 'radio', action: 'select' };
    if (role === 'tab') return { type: 'tab', action: 'select' };
    if (role === 'menuitem') return { type: 'menu-item', action: 'click' };

    // Fallback
    return { type: 'element', action: 'click' };
  }

  /**
   * Extract semantic name from context and element
   */
  private static extractSemanticName(element: Element, context: string): string {
    const candidates: string[] = [];

    // Use context text
    if (context) {
      candidates.push(context);
    }

    // Use name attribute
    const name = element.getAttribute('name');
    if (name) candidates.push(name);

    // Use id attribute (clean it up)
    const id = element.getAttribute('id');
    if (id) candidates.push(id);

    // Use class names that look semantic
    const className = element.className;
    if (className) {
      const semanticClasses = className.split(' ')
        .filter(cls => /^[a-z-_]+$/i.test(cls) && cls.length > 2)
        .filter(cls => !cls.match(/^(btn|input|form|field|control|component)$/));
      candidates.push(...semanticClasses);
    }

    // Pick the best candidate
    const best = candidates
      .map(c => this.cleanSemanticName(c))
      .filter(Boolean)
      .find(name => name.length > 0);

    return best || 'unnamed';
  }

  /**
   * Clean and normalize semantic names
   */
  private static cleanSemanticName(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3) // Max 3 words
      .join('-')
      .replace(/^(the|a|an)-/, '') // Remove articles
      .replace(/-$/, '');
  }

  /**
   * Get form name from form element
   */
  private static getFormName(form: HTMLFormElement): string {
    // Try name attribute
    if (form.name) return this.cleanSemanticName(form.name);

    // Try id attribute
    if (form.id) return this.cleanSemanticName(form.id);

    // Try class names
    const className = form.className;
    if (className) {
      const semanticClass = className.split(' ')
        .find(cls => /^[a-z-_]+$/i.test(cls) && cls.length > 2);
      if (semanticClass) return this.cleanSemanticName(semanticClass);
    }

    // Try action URL
    const action = form.action;
    if (action) {
      const path = new URL(action, window.location.href).pathname;
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && lastSegment !== 'index') {
        return this.cleanSemanticName(lastSegment);
      }
    }

    return 'main';
  }

  /**
   * Ensure ID is unique by adding suffix if needed
   */
  private static ensureUnique(baseId: string): string {
    if (!this.usedIds.has(baseId)) {
      this.usedIds.add(baseId);
      return baseId;
    }

    let counter = 2;
    while (this.usedIds.has(`${baseId}-${counter}`)) {
      counter++;
    }

    const uniqueId = `${baseId}-${counter}`;
    this.usedIds.add(uniqueId);
    return uniqueId;
  }

  /**
   * Reset used IDs (for new page or testing)
   */
  static reset(): void {
    this.usedIds.clear();
  }
}

/**
 * Agent page generator - creates the final agent page and text representation
 */
export class AgentPageGenerator {
  /**
   * Generate complete agent page manifest for the current page
   */
  static generate(): AgentPageManifest {
    // Reset ID generator for fresh start
    IDGenerator.reset();

    // Find all interactive elements
    const elements = ElementDetector.findInteractiveElements();

    // Convert to agent elements
    const agentElements: AgentElement[] = elements.map(element => {
      const context = ElementDetector.getElementContext(element);
      const id = IDGenerator.generateId(element, context);
      const { type, action } = this.getElementTypeAndAction(element);
      
      return {
        element,
        id,
        type,
        action,
        description: this.generateDescription(element, context, type, action),
        context,
        parent: this.getParentId(element),
        expects: this.getExpectedBehavior(element, action)
      };
    });

    // Group into forms and navigation
    const forms = this.groupIntoForms(agentElements);
    const navigation = this.groupIntoNavigation(agentElements);

    // Generate summary
    const summary = this.generatePageSummary(agentElements, forms, navigation);

    return {
      elements: agentElements,
      summary,
      forms,
      navigation
    };
  }

  /**
   * Apply agent page tags to DOM - add data-mcp attributes
   */
  static applyToDOM(manifest: AgentPageManifest): void {
    manifest.elements.forEach(agentElement => {
      const { element, id, type, action, parent, expects } = agentElement;
      
      // Set core attributes
      element.setAttribute('data-mcp-id', id);
      element.setAttribute('data-mcp-type', type);
      element.setAttribute('data-mcp-action', action);
      
      // Set optional attributes
      if (parent) {
        element.setAttribute('data-mcp-parent', parent);
      }
      
      if (expects) {
        element.setAttribute('data-mcp-expects', expects);
      }
    });
  }

  /**
   * Generate agent page view - text representation for AI agents
   */
  static generateAgentPage(manifest: AgentPageManifest): string {
    const lines: string[] = [];
    
    lines.push('AGENT PAGE VIEW');
    lines.push('='.repeat(30));
    lines.push('');
    
    // Page summary
    lines.push(manifest.summary);
    lines.push('');

    // Forms section
    if (manifest.forms.length > 0) {
      lines.push('📋 FORMS:');
      manifest.forms.forEach(form => {
        lines.push(`  ${form.name.toUpperCase()}`);
        
        form.fields.forEach(field => {
          const expects = field.expects ? ` (${field.expects})` : '';
          lines.push(`    ├─ ${field.description} → ${field.id}${expects}`);
        });
        
        if (form.submit) {
          const expects = form.submit.expects ? ` (${form.submit.expects})` : '';
          lines.push(`    └─ ${form.submit.description} → ${form.submit.id}${expects}`);
        }
        lines.push('');
      });
    }

    // Navigation section
    if (manifest.navigation.length > 0) {
      lines.push('🧭 NAVIGATION:');
      manifest.navigation.forEach(nav => {
        lines.push(`  ${nav.type.toUpperCase()}:`);
        nav.items.forEach(item => {
          lines.push(`    • ${item.description} → ${item.id}`);
        });
        lines.push('');
      });
    }

    // Standalone elements
    const standaloneElements = manifest.elements.filter(el => 
      !manifest.forms.some(form => 
        form.fields.includes(el) || form.submit === el
      ) &&
      !manifest.navigation.some(nav => nav.items.includes(el))
    );

    if (standaloneElements.length > 0) {
      lines.push('🎛️ OTHER CONTROLS:');
      standaloneElements.forEach(element => {
        const expects = element.expects ? ` (${element.expects})` : '';
        lines.push(`  • ${element.description} → ${element.id}${expects}`);
      });
      lines.push('');
    }

    lines.push('Usage: Use semantic IDs for interaction');
    lines.push('Example: execute_action({actionId: "form-login-email", params: {value: "user@example.com"}})');

    // Add pagination info if present
    if (manifest.pagination && manifest.pagination.hasMore) {
      lines.push('');
      lines.push('⚠️ MORE ELEMENTS AVAILABLE:');
      lines.push(`  • Currently showing: ${manifest.pagination.returnedElements} elements (batch ${manifest.pagination.currentPage} of ${manifest.pagination.totalPages})`);
      lines.push(`  • Total on page: ${manifest.pagination.totalElements} elements`);
      lines.push(`  • To see next batch: get_agent_page_chunk(page: ${manifest.pagination.currentPage + 1})`);
      lines.push(`  • Why batched: Response size limits`);
    }

    return lines.join('\n');
  }

  /**
   * Get element type and action (reuse from IDGenerator)
   */
  private static getElementTypeAndAction(element: Element): { type: string; action: string } {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase();

    // Form elements
    if (tagName === 'input') {
      switch (type) {
        case 'email': return { type: 'email', action: 'fill' };
        case 'password': return { type: 'password', action: 'fill' };
        case 'text': return { type: 'text', action: 'fill' };
        case 'number': return { type: 'number', action: 'fill' };
        case 'tel': return { type: 'phone', action: 'fill' };
        case 'url': return { type: 'url', action: 'fill' };
        case 'search': return { type: 'search', action: 'fill' };
        case 'checkbox': return { type: 'checkbox', action: 'toggle' };
        case 'radio': return { type: 'radio', action: 'select' };
        case 'submit': return { type: 'submit', action: 'click' };
        case 'button': return { type: 'button', action: 'click' };
        case 'file': return { type: 'file', action: 'upload' };
        default: return { type: 'input', action: 'fill' };
      }
    }

    if (tagName === 'textarea') return { type: 'textarea', action: 'fill' };
    if (tagName === 'select') return { type: 'select', action: 'choose' };
    if (tagName === 'button') return { type: 'button', action: 'click' };
    if (tagName === 'form') return { type: 'form', action: 'submit' };

    // Links and navigation
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href?.startsWith('#')) return { type: 'anchor', action: 'scroll' };
      if (href?.startsWith('mailto:')) return { type: 'email-link', action: 'click' };
      if (href?.startsWith('tel:')) return { type: 'phone-link', action: 'click' };
      return { type: 'link', action: 'navigate' };
    }

    // Role-based detection
    if (role === 'button') return { type: 'button', action: 'click' };
    if (role === 'link') return { type: 'link', action: 'navigate' };
    if (role === 'textbox') return { type: 'textbox', action: 'fill' };
    if (role === 'combobox') return { type: 'combobox', action: 'choose' };
    if (role === 'checkbox') return { type: 'checkbox', action: 'toggle' };
    if (role === 'radio') return { type: 'radio', action: 'select' };
    if (role === 'tab') return { type: 'tab', action: 'select' };
    if (role === 'menuitem') return { type: 'menu-item', action: 'click' };

    return { type: 'element', action: 'click' };
  }

  /**
   * Generate human-readable description
   */
  private static generateDescription(element: Element, context: string, type: string, action: string): string {
    // Use context if available and descriptive
    if (context && context.length > 2 && context.length < 50) {
      return `${context} (${type})`;
    }

    // Generate from element properties
    const tagName = element.tagName.toLowerCase();
    const inputType = element.getAttribute('type');
    
    if (tagName === 'input' && inputType) {
      return `${inputType} field`;
    }
    
    if (tagName === 'button') {
      const text = element.textContent?.trim();
      return text ? `${text} button` : 'button';
    }
    
    if (tagName === 'a') {
      const text = element.textContent?.trim();
      return text ? `${text} link` : 'link';
    }
    
    if (tagName === 'select') {
      return 'dropdown menu';
    }
    
    return `${type} element`;
  }

  /**
   * Get parent element ID if applicable
   */
  private static getParentId(element: Element): string | undefined {
    const form = ElementDetector.getParentForm(element);
    if (form && form !== element) {
      // Generate form ID (this should match what IDGenerator would create)
      const formContext = ElementDetector.getElementContext(form);
      return IDGenerator.generateId(form, formContext);
    }
    return undefined;
  }

  /**
   * Determine expected behavior after action
   */
  private static getExpectedBehavior(element: Element, action: string): string | undefined {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    
    // Form submission
    if ((tagName === 'button' && type === 'submit') || 
        (tagName === 'input' && type === 'submit')) {
      return 'navigation:3000';
    }
    
    // Links that navigate
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        return 'navigation:2000';
      }
    }
    
    // Buttons that might trigger actions
    if (tagName === 'button' || (tagName === 'input' && type === 'button')) {
      const text = element.textContent?.toLowerCase() || '';
      const onclick = element.getAttribute('onclick') || '';
      
      if (text.includes('submit') || text.includes('send') || 
          onclick.includes('submit') || onclick.includes('form')) {
        return 'navigation:3000';
      }
      
      if (text.includes('delete') || text.includes('remove') || 
          text.includes('save') || text.includes('update')) {
        return 'dialog:2000';
      }
    }
    
    return undefined;
  }

  /**
   * Group elements into forms
   */
  private static groupIntoForms(elements: AgentElement[]): FormGroup[] {
    const formMap = new Map<Element, AgentElement[]>();
    const formElements = new Map<Element, AgentElement>();
    
    // Group elements by their parent form
    elements.forEach(element => {
      const form = ElementDetector.getParentForm(element.element);
      if (form) {
        if (element.element === form) {
          formElements.set(form, element);
        } else {
          if (!formMap.has(form)) {
            formMap.set(form, []);
          }
          formMap.get(form)!.push(element);
        }
      }
    });

    // Convert to FormGroup objects
    const forms: FormGroup[] = [];
    
    formMap.forEach((formFields, formElement) => {
      const formBridgeElement = formElements.get(formElement);
      
      // Separate submit buttons from regular fields
      const fields = formFields.filter(el => 
        !['submit', 'button'].includes(el.type) || el.type === 'button'
      );
      const submitButton = formFields.find(el => el.type === 'submit');
      
      // Get form name
      const formName = this.getFormName(formElement, formBridgeElement);
      
      forms.push({
        id: formBridgeElement?.id || `form-${forms.length + 1}`,
        name: formName,
        action: formElement.getAttribute('action') || 'submit',
        fields,
        submit: submitButton
      });
    });

    return forms;
  }

  /**
   * Group elements into navigation sections
   */
  private static groupIntoNavigation(elements: AgentElement[]): NavigationGroup[] {
    const navigation: NavigationGroup[] = [];
    const usedElements = new Set<AgentElement>();

    // Main navigation (nav elements)
    const navElements = elements.filter(el => 
      el.element.closest('nav') && el.type === 'link'
    );
    if (navElements.length > 0) {
      navigation.push({
        type: 'main',
        items: navElements
      });
      navElements.forEach(el => usedElements.add(el));
    }

    // Breadcrumbs
    const breadcrumbElements = elements.filter(el => 
      el.element.closest('[class*="breadcrumb"]') && el.type === 'link'
    );
    if (breadcrumbElements.length > 0) {
      navigation.push({
        type: 'breadcrumb',
        items: breadcrumbElements
      });
      breadcrumbElements.forEach(el => usedElements.add(el));
    }

    // Tabs
    const tabElements = elements.filter(el => el.type === 'tab');
    if (tabElements.length > 0) {
      navigation.push({
        type: 'tabs',
        items: tabElements
      });
      tabElements.forEach(el => usedElements.add(el));
    }

    // Other links (not in nav or breadcrumbs)
    const otherLinks = elements.filter(el => 
      el.type === 'link' && !usedElements.has(el)
    );
    if (otherLinks.length > 0) {
      navigation.push({
        type: 'menu',
        items: otherLinks
      });
    }

    return navigation;
  }

  /**
   * Generate page summary
   */
  private static generatePageSummary(elements: AgentElement[], forms: FormGroup[], navigation: NavigationGroup[]): string {
    const parts: string[] = [];
    
    parts.push(`Found ${elements.length} interactive elements`);
    
    if (forms.length > 0) {
      const formNames = forms.map(f => f.name).join(', ');
      parts.push(`${forms.length} forms (${formNames})`);
    }
    
    if (navigation.length > 0) {
      const navTypes = navigation.map(n => n.type).join(', ');
      parts.push(`Navigation: ${navTypes}`);
    }

    return parts.join(' • ');
  }

  /**
   * Get form name for grouping
   */
  private static getFormName(formElement: Element, formAgentElement?: AgentElement): string {
    if (formAgentElement) {
      return formAgentElement.context || 'form';
    }
    
    const name = formElement.getAttribute('name');
    if (name) return name;
    
    const id = formElement.getAttribute('id');
    if (id) return id;
    
    return 'form';
  }
}