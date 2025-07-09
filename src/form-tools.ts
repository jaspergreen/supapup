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
}