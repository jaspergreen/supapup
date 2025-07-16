/**
 * Form automation tools for Supapup
 * Enables filling entire forms with JSON data
 */

import { Page } from 'puppeteer';

export interface FormData {
  [fieldId: string]: string | boolean | number;
}

export interface FormFillResult {
  success: boolean;
  filled: string[];
  errors: string[];
  warnings: string[];
}

export class FormTools {
  constructor(private page: Page) {}

  /**
   * Fill an entire form using a JSON object
   * Maps JSON keys to element IDs or data-mcp-ids
   */
  async fillForm(formData: FormData, options?: {
    formId?: string;
    submitAfter?: boolean;
    validateRequired?: boolean;
  }): Promise<FormFillResult> {
    const result: FormFillResult = {
      success: true,
      filled: [],
      errors: [],
      warnings: []
    };

    try {
      // Execute in browser context
      const fillResult = await this.page.evaluate(({ data, opts }) => {
        const filled: string[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Helper to fill a single field
        function fillField(element: Element, value: any): boolean {
          const tagName = element.tagName.toLowerCase();
          const type = element.getAttribute('type')?.toLowerCase();

          try {
            if (tagName === 'input') {
              if (type === 'checkbox' || type === 'radio') {
                (element as HTMLInputElement).checked = Boolean(value);
                element.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (type === 'number') {
                (element as HTMLInputElement).value = String(Number(value));
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                (element as HTMLInputElement).value = String(value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
              return true;
            } else if (tagName === 'textarea') {
              (element as HTMLTextAreaElement).value = String(value);
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            } else if (tagName === 'select') {
              const selectEl = element as HTMLSelectElement;
              const inputValue = String(value);
              
              // Try to find option by value first
              let option = Array.from(selectEl.options).find(opt => opt.value === inputValue);
              
              // If not found by value, try by display text (case-insensitive)
              if (!option && inputValue) {
                option = Array.from(selectEl.options).find(opt => 
                  opt.textContent?.trim().toLowerCase() === inputValue.toLowerCase()
                );
              }
              
              // If still not found, try partial match on display text
              if (!option && inputValue) {
                option = Array.from(selectEl.options).find(opt => 
                  opt.textContent?.trim().toLowerCase().includes(inputValue.toLowerCase())
                );
              }
              
              if (option) {
                selectEl.value = option.value;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              } else {
                warnings.push(`No matching option for select field: ${inputValue}. Available options: ${Array.from(selectEl.options).filter(opt => opt.value).map(opt => `"${opt.textContent?.trim()}" (${opt.value})`).join(', ')}`);
                return false;
              }
            }
          } catch (e) {
            errors.push(`Error filling field: ${e}`);
            return false;
          }

          return false;
        }

        // Try to find fields by various methods
        for (const [key, value] of Object.entries(data)) {
          let element: Element | null = null;
          let foundBy = '';

          // 1. Try by data-mcp-id
          element = document.querySelector(`[data-mcp-id="${key}"]`);
          if (element) foundBy = 'data-mcp-id';

          // 2. Try by id
          if (!element) {
            element = document.getElementById(key);
            if (element) foundBy = 'id';
          }

          // 3. Try by name
          if (!element) {
            element = document.querySelector(`[name="${key}"]`);
            if (element) foundBy = 'name';
          }

          // 4. Try by data-mcp-id with common prefixes
          if (!element && opts?.formId) {
            element = document.querySelector(`[data-mcp-id="${opts.formId}-${key}"]`);
            if (element) foundBy = 'data-mcp-id-prefixed';
          }

          if (element) {
            if (fillField(element, value)) {
              filled.push(`${key} (found by ${foundBy})`);
            }
          } else {
            warnings.push(`Field not found: ${key}`);
          }
        }

        // Validate required fields if requested
        if (opts?.validateRequired) {
          const requiredFields = document.querySelectorAll('[required], [data-required="true"]');
          requiredFields.forEach(field => {
            const id = field.getAttribute('data-mcp-id') || field.id || field.getAttribute('name');
            const value = (field as HTMLInputElement).value;
            if (!value || value.trim() === '') {
              warnings.push(`Required field empty: ${id}`);
            }
          });
        }

        return { filled, errors, warnings };
      }, { data: formData, opts: options });

      result.filled = fillResult.filled;
      result.errors = fillResult.errors;
      result.warnings = fillResult.warnings;
      result.success = fillResult.errors.length === 0;

      // Submit form if requested
      if (options?.submitAfter && result.success) {
        const submitResult = await this.submitForm(options.formId);
        if (!submitResult.success) {
          result.success = false;
          result.errors.push(...submitResult.errors);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Form fill failed: ${error}`);
    }

    return result;
  }

  /**
   * Submit a form by ID or find the first form
   */
  async submitForm(formId?: string): Promise<{ success: boolean; errors: string[] }> {
    try {
      const submitted = await this.page.evaluate((id) => {
        let form: HTMLFormElement | null = null;

        if (id) {
          // Try by id
          form = document.getElementById(id) as HTMLFormElement;
          // Try by data-mcp-id
          if (!form) {
            form = document.querySelector(`[data-mcp-id="${id}"]`) as HTMLFormElement;
          }
        } else {
          // Find first form
          form = document.querySelector('form');
        }

        if (form && form.tagName === 'FORM') {
          // Check if there's a submit button to click instead
          const submitBtn = form.querySelector('[type="submit"], [data-mcp-action="click"][data-mcp-type="submit"]');
          if (submitBtn) {
            (submitBtn as HTMLElement).click();
          } else {
            form.submit();
          }
          return true;
        }

        // Try to find a submit button outside the form
        const submitBtn = document.querySelector('[type="submit"], [data-mcp-action="click"][data-mcp-type="submit"]');
        if (submitBtn) {
          (submitBtn as HTMLElement).click();
          return true;
        }

        return false;
      }, formId);

      return {
        success: submitted,
        errors: submitted ? [] : ['No form or submit button found']
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Submit failed: ${error}`]
      };
    }
  }

  /**
   * Get current form data as JSON
   */
  async getFormData(formId?: string): Promise<FormData> {
    return await this.page.evaluate((id?: string) => {
      const data: FormData = {};
      
      let selector = '[data-mcp-id]';
      if (id) {
        // Get fields within specific form
        selector = `#${id} [data-mcp-id], [data-mcp-id^="${id}-"]`;
      }

      const fields = document.querySelectorAll(selector);
      fields.forEach(field => {
        const mcpId = field.getAttribute('data-mcp-id') || '';
        const tagName = field.tagName.toLowerCase();
        const type = field.getAttribute('type')?.toLowerCase();

        if (tagName === 'input') {
          if (type === 'checkbox' || type === 'radio') {
            data[mcpId] = (field as HTMLInputElement).checked;
          } else {
            data[mcpId] = (field as HTMLInputElement).value;
          }
        } else if (tagName === 'textarea') {
          data[mcpId] = (field as HTMLTextAreaElement).value;
        } else if (tagName === 'select') {
          data[mcpId] = (field as HTMLSelectElement).value;
        }
      });

      return data;
    }, formId);
  }

  /**
   * Validate form data against rules
   */
  async validateForm(formId?: string): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
  }> {
    return await this.page.evaluate((id?: string) => {
      const errors: Array<{ field: string; message: string }> = [];
      
      let selector = '[data-mcp-id]';
      if (id) {
        selector = `#${id} [data-mcp-id], [data-mcp-id^="${id}-"]`;
      }

      const fields = document.querySelectorAll(selector);
      fields.forEach(field => {
        const mcpId = field.getAttribute('data-mcp-id') || '';
        const required = field.hasAttribute('required') || field.getAttribute('data-required') === 'true';
        const type = field.getAttribute('type')?.toLowerCase();
        const value = (field as HTMLInputElement).value;

        // Required field validation
        if (required && (!value || value.trim() === '')) {
          errors.push({ field: mcpId, message: 'This field is required' });
        }

        // Type-specific validation
        if (value && value.trim() !== '') {
          if (type === 'email' && !value.includes('@')) {
            errors.push({ field: mcpId, message: 'Invalid email format' });
          } else if (type === 'tel' && !/^[+\d\s\-()]+$/.test(value)) {
            errors.push({ field: mcpId, message: 'Invalid phone number format' });
          } else if (type === 'url' && !value.match(/^https?:\/\//)) {
            errors.push({ field: mcpId, message: 'URL must start with http:// or https://' });
          }
        }
      });

      return {
        valid: errors.length === 0,
        errors
      };
    }, formId);
  }

  /**
   * Detect all forms on the page and generate JSON templates
   */
  async detectForms(): Promise<any> {
    try {
      const forms = await this.page.evaluate(() => {
        const formTemplates: any[] = [];
        
        // Only find actual form elements
        const allContainers = Array.from(document.querySelectorAll('form'));
        
        allContainers.forEach((container, index) => {
          const fields = Array.from(container.querySelectorAll('input, textarea, select, button[type="submit"]'));
          
          if (fields.length === 0) return;
          
          const formId = container.id || `form-${index}`;
          const formTemplate: any = {
            formId,
            formName: getFormName(container),
            fields: [],
            jsonTemplate: {},
            example: {},
            description: ''
          };
          
          fields.forEach((field: any) => {
            const fieldInfo = extractFieldInfo(field);
            if (fieldInfo) {
              formTemplate.fields.push(fieldInfo);
              formTemplate.jsonTemplate[fieldInfo.id] = getFieldTemplate(fieldInfo);
              formTemplate.example[fieldInfo.id] = getFieldExample(fieldInfo);
            }
          });
          
          if (formTemplate.fields.length > 0) {
            formTemplate.description = `Form with ${formTemplate.fields.length} fields: ${formTemplate.fields.map((f: any) => f.type).join(', ')}`;
            formTemplates.push(formTemplate);
          }
        });
        
        return formTemplates;
        
        function getFormName(container: Element): string {
          const title = container.querySelector('h1, h2, h3, legend, .form-title, .title');
          if (title) return title.textContent?.trim() || 'Unnamed Form';
          
          const aria = container.getAttribute('aria-label');
          if (aria) return aria;
          
          const id = container.id;
          if (id) return id.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          return 'Unnamed Form';
        }
        
        function extractFieldInfo(field: Element): any {
          const tagName = field.tagName.toLowerCase();
          const type = field.getAttribute('type') || tagName;
          const id = field.id || field.getAttribute('data-mcp-id') || field.getAttribute('name') || `field-${Math.random().toString(36).substr(2, 9)}`;
          
          const label = getFieldLabel(field);
          const placeholder = field.getAttribute('placeholder') || '';
          const required = field.hasAttribute('required');
          
          return {
            id,
            type,
            name: field.getAttribute('name') || id,
            required,
            placeholder,
            label,
            value: (field as any).value || '',
            tagName
          };
        }
        
        function getFieldLabel(field: Element): string {
          // Try to find associated label
          const id = field.id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent?.trim() || '';
          }
          
          // Check if field is inside a label
          const parentLabel = field.closest('label');
          if (parentLabel) return parentLabel.textContent?.trim() || '';
          
          // Look for nearby text
          const prev = field.previousElementSibling;
          if (prev && prev.textContent) return prev.textContent.trim();
          
          return field.getAttribute('placeholder') || field.getAttribute('name') || '';
        }
        
        function getFieldTemplate(fieldInfo: any): any {
          switch (fieldInfo.type) {
            case 'email': return 'user@example.com';
            case 'password': return 'string';
            case 'number': return 0;
            case 'checkbox': return false;
            case 'radio': return 'option';
            case 'select': return 'option';
            default: return 'string';
          }
        }
        
        function getFieldExample(fieldInfo: any): any {
          switch (fieldInfo.type) {
            case 'email': return 'john.doe@example.com';
            case 'password': return 'mySecurePassword123';
            case 'text':
              if (fieldInfo.label.toLowerCase().includes('name')) return 'John Doe';
              if (fieldInfo.label.toLowerCase().includes('phone')) return '+1-555-123-4567';
              return 'Sample text';
            case 'number': return 42;
            case 'checkbox': return true;
            case 'radio': return 'yes';
            case 'select': return 'option1';
            default: return 'example value';
          }
        }
      });
      
      return {
        content: [{
          type: 'text',
          text: `📋 Form Detection Results\n\nFound ${forms.length} form(s):\n\n${JSON.stringify(forms, null, 2)}`
        }]
      };
      
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `❌ Form detection failed: ${error.message}`
        }]
      };
    }
  }
}