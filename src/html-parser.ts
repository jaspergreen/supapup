import { JSDOM } from 'jsdom';
import { AgentPageGenerator } from './agent-page-generator.js';

export class HTMLParser {
  /**
   * Parse HTML content and generate agent page manifest
   */
  static async generateManifestFromHTML(htmlContent: string, url: string = 'about:blank') {
    const dom = new JSDOM(htmlContent, { 
      url,
      resources: 'usable',
      runScripts: 'outside-only'
    });

    const { window } = dom;
    global.window = window as any;
    global.document = window.document as any;

    try {
      // Debug: Check if JSDOM document works
      // console.error(`[HTMLParser] Document ready, body children: ${window.document.body?.children?.length || 0}`);
      // console.error(`[HTMLParser] Total elements: ${window.document.querySelectorAll('*').length}`);
      // console.error(`[HTMLParser] Buttons: ${window.document.querySelectorAll('button').length}`);
      // console.error(`[HTMLParser] Inputs: ${window.document.querySelectorAll('input').length}`);
      
      // Use the existing AgentPageGenerator logic but in Node.js context
      const manifest = AgentPageGenerator.generate();
      
      // Clean up global references
      delete (global as any).window;
      delete (global as any).document;
      
      return manifest;
    } catch (error) {
      // Clean up global references on error
      delete (global as any).window;
      delete (global as any).document;
      
      // console.error('Failed to generate manifest from HTML:', error);
      return {
        elements: [],
        summary: 'Failed to parse HTML content',
        forms: [],
        navigation: []
      };
    }
  }

  /**
   * Generate element selectors for injecting data-mcp attributes
   */
  static generateAttributeScript(manifest: any): string {
    const commands: string[] = [];
    
    manifest.elements.forEach((element: any, index: number) => {
      // Create a unique selector for this element
      const selector = this.generateElementSelector(element, index);
      
      commands.push(`
        try {
          const el = document.querySelector('${selector}');
          if (el) {
            el.setAttribute('data-mcp-id', '${element.id}');
            el.setAttribute('data-mcp-type', '${element.type}');
            el.setAttribute('data-mcp-action', '${element.action}');
          }
        } catch (e) { /* console.warn('Failed to tag element ${element.id}'); */ }
      `);
    });

    return commands.join('\n');
  }

  /**
   * Generate a CSS selector for an element based on its properties
   */
  private static generateElementSelector(element: any, index: number): string {
    // Try to create a specific selector based on element properties
    const selectors: string[] = [];
    
    // Try id first
    if (element.context && element.context.includes('id=')) {
      const id = element.context.match(/id="([^"]+)"/)?.[1];
      if (id) selectors.push(`#${id}`);
    }
    
    // Try name attribute
    if (element.context && element.context.includes('name=')) {
      const name = element.context.match(/name="([^"]+)"/)?.[1];
      if (name) selectors.push(`[name="${name}"]`);
    }
    
    // Try class if it looks unique
    if (element.context && element.context.includes('class=')) {
      const classes = element.context.match(/class="([^"]+)"/)?.[1];
      if (classes && classes.split(' ').length <= 3) {
        selectors.push(`.${classes.split(' ').join('.')}`);
      }
    }
    
    // Fallback to tag-based selector with nth-child
    const tag = element.type === 'link' ? 'a' : 
                element.type === 'submit' ? 'input[type="submit"]' :
                element.type === 'button' ? 'button' :
                element.type === 'email' ? 'input[type="email"]' :
                element.type === 'password' ? 'input[type="password"]' :
                element.type === 'text' ? 'input[type="text"]' :
                element.type === 'number' ? 'input[type="number"]' :
                element.type === 'checkbox' ? 'input[type="checkbox"]' :
                element.type === 'radio' ? 'input[type="radio"]' :
                element.type.includes('input') ? 'input' : 
                element.type === 'select' ? 'select' :
                element.type === 'textarea' ? 'textarea' : 
                element.type === 'element' ? '*' : 'div';
    
    selectors.push(`${tag}:nth-of-type(${index + 1})`);
    
    // Return the first selector that should work
    return selectors[0] || `*:nth-child(${index + 1})`;
  }
}