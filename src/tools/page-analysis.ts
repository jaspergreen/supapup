import { Page } from 'puppeteer';

export class PageAnalysis {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async getPageState() {
    try {
      const state = await this.page.evaluate(() => {
        const agentPage = (window as any).__AGENT_PAGE__;
        return {
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          elementsCount: agentPage?.manifest?.elements?.length || 0,
          hasAgentInterface: !!agentPage
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(state, null, 2)
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get page state: ${error.message}`
          },
        ],
      };
    }
  }

  async discoverActions() {
    try {
      const actions = await this.page.evaluate(() => {
        const agentPage = (window as any).__AGENT_PAGE__;
        if (agentPage?.manifest?.elements) {
          return agentPage.manifest.elements.map((el: any) => ({
            id: el.id,
            type: el.type,
            action: el.action,
            description: el.description
          }));
        }
        return [];
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ actions }, null, 2)
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to discover actions: ${error.message}`
          },
        ],
      };
    }
  }

  async getPageResources() {
    try {
      const resources = await this.page.evaluate(() => {
        const scripts = Array.from(document.scripts).map(script => ({
          src: script.src,
          type: script.type || 'text/javascript',
          async: script.async,
          defer: script.defer
        }));

        const links = Array.from(document.links).map(link => ({
          href: link.href,
          rel: link.rel,
          type: (link as any).type
        }));

        const stylesheets = Array.from(document.styleSheets).map(sheet => ({
          href: sheet.href,
          media: Array.from(sheet.media).join(', ')
        }));

        const images = Array.from(document.images).map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.width,
          height: img.height
        }));

        return {
          scripts: scripts.length,
          links: links.length,
          stylesheets: stylesheets.length,
          images: images.length,
          details: { scripts, links, stylesheets, images }
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: `📦 Page Resources Summary:\n\n` +
                  `📜 Scripts: ${resources.scripts}\n` +
                  `🔗 Links: ${resources.links}\n` +
                  `🎨 Stylesheets: ${resources.stylesheets}\n` +
                  `🖼️ Images: ${resources.images}\n\n` +
                  `Use detailed view for full resource list.`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get page resources: ${error.message}`
          },
        ],
      };
    }
  }

  async getPerformanceMetrics() {
    try {
      const metrics = await this.page.metrics();
      const performanceEntries = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          navigation: {
            totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
            ttfb: Math.round(navigation.responseStart - navigation.fetchStart),
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
            domProcessing: Math.round(navigation.domComplete - navigation.domInteractive)
          },
          paint: paint.reduce((acc: any, entry) => {
            acc[entry.name] = Math.round(entry.startTime);
            return acc;
          }, {})
        };
      });

      const summary = `📊 PERFORMANCE METRICS\n\n` +
        `⏱️ TIMING:\n` +
        `  • Total Load Time: ${performanceEntries.navigation.totalLoadTime}ms\n` +
        `  • Time to First Byte: ${performanceEntries.navigation.ttfb}ms\n` +
        `  • DOM Content Loaded: ${performanceEntries.navigation.domContentLoaded}ms\n` +
        `  • DOM Processing: ${performanceEntries.navigation.domProcessing}ms\n` +
        (performanceEntries.paint['first-paint'] ? `  • First Paint: ${performanceEntries.paint['first-paint']}ms\n` : '') +
        (performanceEntries.paint['first-contentful-paint'] ? `  • First Contentful Paint: ${performanceEntries.paint['first-contentful-paint']}ms\n` : '') +
        `\n📈 PUPPETEER METRICS:\n` +
        `  • Documents: ${metrics.Documents}\n` +
        `  • Frames: ${metrics.Frames}\n` +
        `  • JS Event Listeners: ${metrics.JSEventListeners}\n` +
        `  • DOM Nodes: ${metrics.Nodes}`;

      return {
        content: [
          {
            type: 'text',
            text: summary
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get performance metrics: ${error.message}`
          },
        ],
      };
    }
  }

  async getAccessibilityTree() {
    try {
      const snapshot = await this.page.accessibility.snapshot();
      
      return {
        content: [
          {
            type: 'text',
            text: `♿ Accessibility Tree:\n\n${JSON.stringify(snapshot, null, 2)}`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get accessibility tree: ${error.message}`
          },
        ],
      };
    }
  }

  async inspectElement(args: any) {
    try {
      const { selector } = args;
      
      const elementInfo = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        const styles = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
          tagName: element.tagName,
          attributes: Array.from(element.attributes).reduce((acc: any, attr: any) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as any),
          textContent: element.textContent?.trim(),
          styles: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            zIndex: styles.zIndex,
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily
          },
          geometry: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible: rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden',
          parent: element.parentElement?.tagName,
          children: element.children.length
        };
      }, selector);

      if (!elementInfo) {
        return {
          content: [
            {
              type: 'text',
              text: `Element not found: ${selector}`
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `🔍 Element Inspection: ${selector}\n\n` +
                  `📝 Tag: ${elementInfo.tagName}\n` +
                  `📏 Geometry: ${elementInfo.geometry.width}×${elementInfo.geometry.height} at (${elementInfo.geometry.x}, ${elementInfo.geometry.y})\n` +
                  `👁️ Visible: ${elementInfo.isVisible}\n` +
                  `📜 Text: ${elementInfo.textContent || 'None'}\n` +
                  `🏗️ Parent: ${elementInfo.parent}, Children: ${elementInfo.children}\n\n` +
                  `🎨 Key Styles:\n${JSON.stringify(elementInfo.styles, null, 2)}\n\n` +
                  `📋 Attributes:\n${JSON.stringify(elementInfo.attributes, null, 2)}`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to inspect element: ${error.message}`
          },
        ],
      };
    }
  }

  async evaluateScript(args: any) {
    try {
      const { script } = args;
      const result = await this.page.evaluate(script);
      
      return {
        content: [
          {
            type: 'text',
            text: `📜 Script Result:\n\n${JSON.stringify(result, null, 2)}`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Script execution failed: ${error.message}`
          },
        ],
      };
    }
  }

  async executeAndWait(args: any) {
    try {
      const { action, selector, value, code, waitTime = 3000 } = args;
      
      let result;
      if (action === 'evaluate') {
        result = await this.page.evaluate(code);
      } else if (action === 'click' && selector) {
        await this.page.click(selector);
        result = { clicked: selector };
      } else if (action === 'fill' && selector && value) {
        await this.page.type(selector, value);
        result = { filled: selector, value };
      } else if (action === 'submit' && selector) {
        await this.page.click(selector);
        result = { submitted: selector };
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      // Wait for changes
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check for navigation
      const url = this.page.url();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Action completed: ${JSON.stringify(result)}\n` +
                  `🌐 Current URL: ${url}\n` +
                  `⏱️ Waited: ${waitTime}ms for changes`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Execute and wait failed: ${error.message}`
          },
        ],
      };
    }
  }

  async generateAgentPage(args: any) {
    try {
      const { enhanced = true, mode = 'auto' } = args;
      
      // This would trigger a re-generation of the agent page
      const pageContent = await this.page.content();
      const manifest = { elements: [], summary: 'Re-generated agent page', forms: [], navigation: [] };
      
      return {
        content: [
          {
            type: 'text',
            text: `Agent page generated: ${manifest.summary}\n\n` +
                  `Mode: ${mode}, Enhanced: ${enhanced}\n\n` +
                  `Use navigate command for full agent page generation.`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to generate agent page: ${error.message}`
          },
        ],
      };
    }
  }
}