/**
 * Form detection and JSON template generation
 * Helps agents understand what data to send for form filling
 */

export interface FormField {
  id: string;
  type: string;
  name: string;
  required: boolean;
  placeholder?: string;
  label?: string;
  value?: any;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FormTemplate {
  formId: string;
  formName: string;
  fields: FormField[];
  jsonTemplate: Record<string, any>;
  example: Record<string, any>;
  description: string;
}

export class FormDetector {
  /**
   * Detect all forms on the page and generate JSON templates
   */
  static detectForms(): FormTemplate[] {
    const forms: FormTemplate[] = [];
    
    // First, find all elements that look like forms
    const formContainers = this.findFormContainers();
    
    formContainers.forEach((container, index) => {
      const fields = this.extractFormFields(container);
      if (fields.length > 0) {
        const formId = container.id || container.getAttribute('data-mcp-id') || `form-${index}`;
        const formName = this.getFormName(container, fields);
        
        forms.push({
          formId,
          formName,
          fields,
          jsonTemplate: this.generateJsonTemplate(fields),
          example: this.generateExampleData(fields),
          description: this.generateFormDescription(fields)
        });
      }
    });
    
    return forms;
  }
  
  /**
   * Find all form containers (actual forms only)
   */
  private static findFormContainers(): Element[] {
    // Only return actual <form> elements, not divs that happen to contain inputs
    return Array.from(document.querySelectorAll('form'));
  }
  
  /**
   * Extract all form fields from a container
   */
  private static extractFormFields(container: Element): FormField[] {
    const fields: FormField[] = [];
    const inputs = container.querySelectorAll('[data-mcp-id]');
    
    inputs.forEach(element => {
      const tagName = element.tagName.toLowerCase();
      const type = element.getAttribute('type') || tagName;
      const mcpAction = element.getAttribute('data-mcp-action');
      
      // Skip non-input elements
      if (!['fill', 'choose', 'toggle', 'select', 'upload'].includes(mcpAction || '')) {
        return;
      }
      
      const field: FormField = {
        id: element.getAttribute('data-mcp-id') || '',
        type: element.getAttribute('data-mcp-type') || type,
        name: element.getAttribute('name') || element.id || '',
        required: element.hasAttribute('required') || 
                 element.getAttribute('aria-required') === 'true' ||
                 this.hasRequiredIndicator(element),
        placeholder: element.getAttribute('placeholder') || undefined,
        label: this.getFieldLabel(element),
        value: this.getCurrentValue(element)
      };
      
      // Add type-specific properties
      if (tagName === 'select') {
        field.options = this.getSelectOptions(element as HTMLSelectElement);
      }
      
      if (tagName === 'input') {
        const inputEl = element as HTMLInputElement;
        field.minLength = inputEl.minLength > 0 ? inputEl.minLength : undefined;
        field.maxLength = inputEl.maxLength > 0 ? inputEl.maxLength : undefined;
        field.pattern = inputEl.pattern || undefined;
      }
      
      fields.push(field);
    });
    
    return fields;
  }
  
  /**
   * Get the label for a field
   */
  private static getFieldLabel(element: Element): string {
    // Try various methods to find the label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    
    // Parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as Element;
      const input = clone.querySelector('input, select, textarea');
      if (input) input.remove();
      return clone.textContent?.trim() || '';
    }
    
    // Look for adjacent label
    const prev = element.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') {
      return prev.textContent?.trim() || '';
    }
    
    // Look for label in parent container
    const parent = element.parentElement;
    if (parent) {
      const label = parent.querySelector('label');
      if (label && !label.querySelector('input, select, textarea')) {
        return label.textContent?.trim() || '';
      }
    }
    
    return '';
  }
  
  /**
   * Check if field has a required indicator (like * or "required" text)
   */
  private static hasRequiredIndicator(element: Element): boolean {
    const label = this.getFieldLabel(element);
    if (label && (label.includes('*') || label.toLowerCase().includes('required'))) {
      return true;
    }
    
    // Check parent container for required indicators
    const parent = element.parentElement;
    if (parent) {
      const text = parent.textContent || '';
      return text.includes('*') || text.toLowerCase().includes('required');
    }
    
    return false;
  }
  
  /**
   * Get current value of a field
   */
  private static getCurrentValue(element: Element): any {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type');
    
    if (tagName === 'input') {
      if (type === 'checkbox' || type === 'radio') {
        return (element as HTMLInputElement).checked;
      }
      return (element as HTMLInputElement).value;
    } else if (tagName === 'textarea') {
      return (element as HTMLTextAreaElement).value;
    } else if (tagName === 'select') {
      return (element as HTMLSelectElement).value;
    }
    
    return '';
  }
  
  /**
   * Get options for a select field
   */
  private static getSelectOptions(select: HTMLSelectElement): string[] {
    return Array.from(select.options)
      .filter(opt => opt.value) // Skip empty options
      .map(opt => {
        const displayText = opt.textContent?.trim() || opt.value;
        // If display text is different from value, show both
        if (displayText !== opt.value && displayText.length > 0) {
          return `${displayText} (${opt.value})`;
        }
        return opt.value;
      });
  }
  
  /**
   * Generate a JSON template with field types
   */
  private static generateJsonTemplate(fields: FormField[]): Record<string, any> {
    const template: Record<string, any> = {};
    
    fields.forEach(field => {
      let value: any = `<${field.type}>`;
      
      // Provide more specific templates based on type
      switch (field.type) {
        case 'email':
          value = '<email@example.com>';
          break;
        case 'phone':
        case 'tel':
          value = '<+1234567890>';
          break;
        case 'password':
          value = '<password>';
          break;
        case 'number':
          value = '<number>';
          break;
        case 'date':
          value = '<YYYY-MM-DD>';
          break;
        case 'checkbox':
        case 'radio':
          value = '<true|false>';
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            // Show user-friendly options with note about display text
            const displayOptions = field.options.map(opt => {
              if (opt.includes('(') && opt.includes(')')) {
                // Extract display text from format "Display Text (value)"
                const match = opt.match(/^(.+?)\s*\((.+?)\)$/);
                if (match) return match[1]; // Return display text
              }
              return opt;
            });
            value = `<${displayOptions.join('|')}> (use display text or technical value)`;
          }
          break;
        case 'url':
          value = '<https://example.com>';
          break;
        default:
          value = '<string>';
      }
      
      // Add required indicator
      if (field.required) {
        template[field.id] = `${value} (required)`;
      } else {
        template[field.id] = `${value} (optional)`;
      }
    });
    
    return template;
  }
  
  /**
   * Generate example data for the form
   */
  private static generateExampleData(fields: FormField[]): Record<string, any> {
    const example: Record<string, any> = {};
    
    fields.forEach(field => {
      // Skip optional fields in example (show minimal required data)
      if (!field.required) return;
      
      switch (field.type) {
        case 'email':
          example[field.id] = 'john.doe@example.com';
          break;
        case 'phone':
        case 'tel':
          example[field.id] = '+1 (555) 123-4567';
          break;
        case 'password':
          example[field.id] = 'SecurePass123!';
          break;
        case 'text':
          if (field.label?.toLowerCase().includes('first')) {
            example[field.id] = 'John';
          } else if (field.label?.toLowerCase().includes('last')) {
            example[field.id] = 'Doe';
          } else if (field.label?.toLowerCase().includes('address')) {
            example[field.id] = '123 Main Street';
          } else if (field.label?.toLowerCase().includes('city')) {
            example[field.id] = 'New York';
          } else if (field.label?.toLowerCase().includes('zip') || field.label?.toLowerCase().includes('postal')) {
            example[field.id] = '10001';
          } else {
            example[field.id] = 'Example text';
          }
          break;
        case 'number':
          example[field.id] = 123;
          break;
        case 'date':
          example[field.id] = '1990-01-01';
          break;
        case 'checkbox':
          example[field.id] = true;
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            example[field.id] = field.options[0];
          }
          break;
        case 'url':
          example[field.id] = 'https://example.com';
          break;
        default:
          example[field.id] = 'Example value';
      }
    });
    
    return example;
  }
  
  /**
   * Generate a description of the form
   */
  private static generateFormDescription(fields: FormField[]): string {
    const requiredCount = fields.filter(f => f.required).length;
    const optionalCount = fields.length - requiredCount;
    
    let description = `Form with ${fields.length} fields`;
    if (requiredCount > 0) {
      description += ` (${requiredCount} required`;
      if (optionalCount > 0) {
        description += `, ${optionalCount} optional`;
      }
      description += ')';
    }
    
    // Add field type summary
    const types = new Set(fields.map(f => f.type));
    description += '. Field types: ' + Array.from(types).join(', ');
    
    return description;
  }
  
  /**
   * Try to determine form name/purpose
   */
  private static getFormName(container: Element, fields: FormField[]): string {
    // Check for heading
    const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      return heading.textContent?.trim() || 'Form';
    }
    
    // Check for form title/legend
    const legend = container.querySelector('legend');
    if (legend) {
      return legend.textContent?.trim() || 'Form';
    }
    
    // Try to infer from fields
    const fieldTypes = fields.map(f => f.type);
    const fieldLabels = fields.map(f => f.label?.toLowerCase() || '').join(' ');
    
    if (fieldTypes.includes('email') && fieldTypes.includes('password')) {
      if (fieldLabels.includes('register') || fieldLabels.includes('sign up')) {
        return 'Registration Form';
      }
      return 'Login Form';
    }
    
    if (fieldLabels.includes('contact') || fieldLabels.includes('message')) {
      return 'Contact Form';
    }
    
    if (fieldLabels.includes('payment') || fieldLabels.includes('card')) {
      return 'Payment Form';
    }
    
    if (fieldLabels.includes('search')) {
      return 'Search Form';
    }
    
    return 'Form';
  }
}