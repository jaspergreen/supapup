// Action Monitor - Executes actions and monitors for changes
// This captures EVERYTHING that happens after an action

export interface ActionResult {
  action: string;
  target: string;
  startState: PageState;
  endState: PageState;
  changes: Change[];
  events: any[];
  duration: number;
}

export interface PageState {
  url: string;
  title: string;
  elements: Record<string, any>;
  console: any[];
  errors: any[];
  dialogs: any[];
  forms: Record<string, any>;
  timestamp: number;
}

export interface Change {
  type: 'navigation' | 'dom' | 'console' | 'error' | 'dialog' | 'form' | 'network';
  description: string;
  data: any;
  timestamp: number;
}

export class ActionMonitor {
  // Capture complete page state
  static async captureState(page: any): Promise<PageState> {
    const state = await page.evaluate(() => {
      // Capture all form values
      const forms: Record<string, any> = {};
      document.querySelectorAll('form').forEach((form, i) => {
        const formData: Record<string, any> = {
          id: form.id || `form-${i}`,
          action: form.action,
          method: form.method,
          fields: {}
        };
        
        form.querySelectorAll('input, textarea, select').forEach((field: any) => {
          formData.fields[field.name || field.id || `field-${Object.keys(formData.fields).length}`] = {
            type: field.type || field.tagName.toLowerCase(),
            value: field.value,
            disabled: field.disabled,
            required: field.required
          };
        });
        
        forms[formData.id] = formData;
      });
      
      // Capture visible elements
      const elements: Record<string, any> = {};
      document.querySelectorAll('[id], [data-mcp-id], button, a, input, select, textarea').forEach((el: any) => {
        const id = el.id || el.getAttribute('data-mcp-id') || `${el.tagName}-${Object.keys(elements).length}`;
        elements[id] = {
          tag: el.tagName,
          visible: el.offsetParent !== null,
          text: el.textContent?.trim().substring(0, 100),
          value: el.value,
          disabled: el.disabled,
          href: el.href
        };
      });
      
      return {
        url: window.location.href,
        title: document.title,
        elements,
        forms,
        console: [],
        errors: [],
        dialogs: [],
        timestamp: Date.now()
      };
    });
    
    return state;
  }
  
  // Execute action and monitor for changes
  static async executeAndMonitor(
    page: any,
    action: () => Promise<any>,
    description: string,
    timeout: number = 5000
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const changes: Change[] = [];
    const events: any[] = [];
    
    // Capture initial state
    const startState = await this.captureState(page);
    
    // Set up listeners
    const listeners = this.setupListeners(page, changes, events);
    
    // Execute the action
    try {
      await action();
    } catch (error) {
      changes.push({
        type: 'error',
        description: 'Action execution failed',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      });
    }
    
    // Wait and collect changes
    await new Promise(resolve => setTimeout(resolve, timeout));
    
    // Capture end state
    const endState = await this.captureState(page);
    
    // Clean up listeners
    this.cleanupListeners(page, listeners);
    
    // Analyze what changed
    this.analyzeChanges(startState, endState, changes);
    
    return {
      action: description,
      target: '',
      startState,
      endState,
      changes,
      events,
      duration: Date.now() - startTime
    };
  }
  
  private static setupListeners(page: any, changes: Change[], events: any[]) {
    const listeners: any = {};
    
    // Console listener
    listeners.console = (msg: any) => {
      const log = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };
      events.push(log);
      
      if (msg.text().includes('[BRIDGE_EVENT]') || msg.text().includes('[ALERT')) {
        changes.push({
          type: 'console',
          description: `Console ${msg.type()}: ${msg.text().substring(0, 100)}`,
          data: log,
          timestamp: Date.now()
        });
      }
    };
    page.on('console', listeners.console);
    
    // Dialog listener
    listeners.dialog = async (dialog: any) => {
      const dialogInfo = {
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue()
      };
      
      changes.push({
        type: 'dialog',
        description: `${dialog.type()} dialog: ${dialog.message()}`,
        data: dialogInfo,
        timestamp: Date.now()
      });
      
      // Auto-accept dialogs
      await dialog.accept();
    };
    page.on('dialog', listeners.dialog);
    
    // Navigation listener
    listeners.navigation = (frame: any) => {
      if (frame === page.mainFrame()) {
        changes.push({
          type: 'navigation',
          description: `Navigated to ${frame.url()}`,
          data: { url: frame.url() },
          timestamp: Date.now()
        });
      }
    };
    page.on('framenavigated', listeners.navigation);
    
    // Error listener
    listeners.error = (error: any) => {
      changes.push({
        type: 'error',
        description: `Page error: ${error.message}`,
        data: { error: error.message },
        timestamp: Date.now()
      });
    };
    page.on('pageerror', listeners.error);
    
    // Network listener for AJAX
    listeners.response = (response: any) => {
      if (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
        changes.push({
          type: 'network',
          description: `AJAX ${response.request().method()} ${response.url()} (${response.status()})`,
          data: {
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          },
          timestamp: Date.now()
        });
      }
    };
    page.on('response', listeners.response);
    
    return listeners;
  }
  
  private static cleanupListeners(page: any, listeners: any) {
    if (listeners.console) page.off('console', listeners.console);
    if (listeners.dialog) page.off('dialog', listeners.dialog);
    if (listeners.navigation) page.off('framenavigated', listeners.navigation);
    if (listeners.error) page.off('pageerror', listeners.error);
    if (listeners.response) page.off('response', listeners.response);
  }
  
  private static analyzeChanges(
    startState: PageState,
    endState: PageState,
    changes: Change[]
  ) {
    // Check URL change
    if (startState.url !== endState.url) {
      changes.push({
        type: 'navigation',
        description: `URL changed from ${startState.url} to ${endState.url}`,
        data: { from: startState.url, to: endState.url },
        timestamp: endState.timestamp
      });
    }
    
    // Check form changes
    Object.keys(endState.forms).forEach(formId => {
      const startForm = startState.forms[formId];
      const endForm = endState.forms[formId];
      
      if (startForm && endForm) {
        Object.keys(endForm.fields).forEach(fieldName => {
          const startField = startForm.fields[fieldName];
          const endField = endForm.fields[fieldName];
          
          if (startField && endField && startField.value !== endField.value) {
            changes.push({
              type: 'form',
              description: `Form field ${fieldName} changed from "${startField.value}" to "${endField.value}"`,
              data: {
                form: formId,
                field: fieldName,
                from: startField.value,
                to: endField.value
              },
              timestamp: endState.timestamp
            });
          }
        });
      }
    });
    
    // Check element visibility changes
    Object.keys(endState.elements).forEach(elementId => {
      const startEl = startState.elements[elementId];
      const endEl = endState.elements[elementId];
      
      if (startEl && endEl) {
        if (startEl.visible !== endEl.visible) {
          changes.push({
            type: 'dom',
            description: `Element ${elementId} became ${endEl.visible ? 'visible' : 'hidden'}`,
            data: {
              element: elementId,
              visible: endEl.visible
            },
            timestamp: endState.timestamp
          });
        }
        
        if (startEl.text !== endEl.text && endEl.text) {
          changes.push({
            type: 'dom',
            description: `Element ${elementId} text changed to "${endEl.text.substring(0, 50)}..."`,
            data: {
              element: elementId,
              text: endEl.text
            },
            timestamp: endState.timestamp
          });
        }
      }
    });
    
    // Check for new elements
    Object.keys(endState.elements).forEach(elementId => {
      if (!startState.elements[elementId]) {
        const el = endState.elements[elementId];
        if (el.visible) {
          changes.push({
            type: 'dom',
            description: `New element appeared: ${elementId} (${el.tag})`,
            data: {
              element: elementId,
              tag: el.tag,
              text: el.text
            },
            timestamp: endState.timestamp
          });
        }
      }
    });
  }
  
  // Generate summary of what happened
  static summarizeResult(result: ActionResult): string {
    const lines = [
      `Action: ${result.action}`,
      `Duration: ${result.duration}ms`,
      `Changes detected: ${result.changes.length}`
    ];
    
    if (result.changes.length > 0) {
      lines.push('\nWhat happened:');
      
      // Group changes by type
      const grouped = result.changes.reduce((acc, change) => {
        if (!acc[change.type]) acc[change.type] = [];
        acc[change.type].push(change);
        return acc;
      }, {} as Record<string, Change[]>);
      
      Object.entries(grouped).forEach(([type, changes]) => {
        lines.push(`\n${type.toUpperCase()}:`);
        changes.forEach(change => {
          lines.push(`  • ${change.description}`);
        });
      });
    } else {
      lines.push('\nNo changes detected');
    }
    
    return lines.join('\n');
  }
}