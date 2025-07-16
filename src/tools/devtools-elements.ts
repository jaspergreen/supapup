import { Page, CDPSession } from 'puppeteer';

export class DevToolsElements {
  private page: Page | null = null;
  private client: CDPSession | null = null;

  constructor() {}

  async initialize(page: Page, client: CDPSession) {
    this.page = page;
    this.client = client;
    // console.log('[DevToolsElements] Initialized');
  }

  isInitialized(): boolean {
    return this.page !== null && this.client !== null;
  }

  async inspectElement(args: { selector: string }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools not initialized. Please navigate to a page first.' 
        }],
      };
    }

    try {
      // Get element handle
      const element = await this.page.$(args.selector);
      if (!element) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Element not found: ${args.selector}` 
          }],
        };
      }

      // Get all element information directly from the page context
      const elementInfo = await element.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        // Get all attributes
        const attributes: Record<string, string> = {};
        Array.from(el.attributes).forEach(attr => {
          attributes[attr.name] = attr.value;
        });

        // Get inline styles
        const inlineStyles: Record<string, string> = {};
        const styleAttr = el.getAttribute('style');
        if (styleAttr) {
          styleAttr.split(';').forEach(style => {
            const [key, value] = style.split(':').map(s => s.trim());
            if (key && value) {
              inlineStyles[key] = value;
            }
          });
        }

        // Calculate box model
        const paddingTop = parseFloat(styles.paddingTop);
        const paddingRight = parseFloat(styles.paddingRight);
        const paddingBottom = parseFloat(styles.paddingBottom);
        const paddingLeft = parseFloat(styles.paddingLeft);
        
        const borderTop = parseFloat(styles.borderTopWidth);
        const borderRight = parseFloat(styles.borderRightWidth);
        const borderBottom = parseFloat(styles.borderBottomWidth);
        const borderLeft = parseFloat(styles.borderLeftWidth);
        
        const marginTop = parseFloat(styles.marginTop);
        const marginRight = parseFloat(styles.marginRight);
        const marginBottom = parseFloat(styles.marginBottom);
        const marginLeft = parseFloat(styles.marginLeft);

        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          textContent: el.textContent?.substring(0, 100),
          innerHTML: el.innerHTML.substring(0, 200),
          isVisible: rect.width > 0 && rect.height > 0,
          dimensions: {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
          },
          // Key computed styles
          display: styles.display,
          position: styles.position,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          font: styles.font,
          margin: styles.margin,
          padding: styles.padding,
          border: styles.border,
          attributes,
          inlineStyles,
          boxModel: {
            content: { width: rect.width - paddingLeft - paddingRight - borderLeft - borderRight, height: rect.height - paddingTop - paddingBottom - borderTop - borderBottom },
            padding: { top: paddingTop, right: paddingRight, bottom: paddingBottom, left: paddingLeft },
            border: { top: borderTop, right: borderRight, bottom: borderBottom, left: borderLeft },
            margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
          }
        };
      });

      return {
        content: [{ 
          type: 'text', 
          text: `📋 Element Inspection Results for: ${args.selector}

🏷️ Basic Info:
  • Tag: <${elementInfo.tagName}>
  • ID: ${elementInfo.id || '(none)'}
  • Class: ${elementInfo.className || '(none)'}
  • Visible: ${elementInfo.isVisible ? 'Yes' : 'No'}

📐 Dimensions:
  • Width: ${elementInfo.dimensions.width}px
  • Height: ${elementInfo.dimensions.height}px
  • Position: ${elementInfo.dimensions.top}px from top, ${elementInfo.dimensions.left}px from left

🎨 Key Styles:
  • Display: ${elementInfo.display}
  • Position: ${elementInfo.position}
  • Color: ${elementInfo.color}
  • Background: ${elementInfo.backgroundColor}
  • Font: ${elementInfo.font}
  • Margin: ${elementInfo.margin}
  • Padding: ${elementInfo.padding}
  • Border: ${elementInfo.border}

📄 Attributes: ${JSON.stringify(elementInfo.attributes, null, 2)}

💬 Text Content: ${elementInfo.textContent || '(empty)'}

🔧 Inline Styles: ${Object.keys(elementInfo.inlineStyles).length > 0 ? JSON.stringify(elementInfo.inlineStyles, null, 2) : '(none)'}

📦 Box Model: 
  • Content: ${elementInfo.boxModel.content.width.toFixed(1)} × ${elementInfo.boxModel.content.height.toFixed(1)}
  • Padding: T:${elementInfo.boxModel.padding.top} R:${elementInfo.boxModel.padding.right} B:${elementInfo.boxModel.padding.bottom} L:${elementInfo.boxModel.padding.left}
  • Border: T:${elementInfo.boxModel.border.top} R:${elementInfo.boxModel.border.right} B:${elementInfo.boxModel.border.bottom} L:${elementInfo.boxModel.border.left}
  • Margin: T:${elementInfo.boxModel.margin.top} R:${elementInfo.boxModel.margin.right} B:${elementInfo.boxModel.margin.bottom} L:${elementInfo.boxModel.margin.left}`
        }],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Inspect error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to inspect element: ${error.message}` 
        }],
      };
    }
  }

  async modifyCSS(args: { selector: string; property: string; value: string }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools Elements not initialized. Please wait a few seconds after navigation.' 
        }],
      };
    }

    try {
      // Use page.evaluate to modify CSS directly
      const result = await this.page.evaluate(({ selector, property, value }) => {
        const element = document.querySelector(selector);
        if (!element) {
          // Get available elements for better error message
          const availableElements = Array.from(document.querySelectorAll('*'))
            .filter(el => el.tagName && !['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'HTML'].includes(el.tagName))
            .map(el => {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : '';
              const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
              const text = el.textContent?.trim().substring(0, 30) || '';
              return `${tag}${id}${classes} ${text ? `"${text}..."` : ''}`.trim();
            })
            .slice(0, 10); // Limit to first 10 for readability
            
          return { 
            success: false, 
            error: 'Element not found',
            selector: selector,
            availableElements: availableElements
          };
        }

        // Store original value
        const originalValue = (element as HTMLElement).style.getPropertyValue(property);
        
        // Apply new style
        (element as HTMLElement).style.setProperty(property, value, 'important');
        
        // Verify change
        const computedStyle = window.getComputedStyle(element);
        const newValue = computedStyle.getPropertyValue(property);
        
        return {
          success: true,
          selector,
          property,
          originalValue: originalValue || computedStyle.getPropertyValue(property),
          newValue,
          applied: (element as HTMLElement).style.getPropertyValue(property),
        };
      }, { selector: args.selector, property: args.property, value: args.value });

      if (!result.success) {
        let errorMessage = `❌ Element not found: "${args.selector}"\n\n`;
        
        if (result.availableElements && result.availableElements.length > 0) {
          errorMessage += `📋 Available elements on this page:\n`;
          result.availableElements.forEach((el: string) => {
            errorMessage += `  • ${el}\n`;
          });
          errorMessage += `\n💡 Try using one of these selectors instead, or use devtools_visual_element_map to see all elements visually.`;
        } else {
          errorMessage += `💡 No suitable elements found. Try:\n`;
          errorMessage += `  1. Use devtools_visual_element_map to see all page elements\n`;
          errorMessage += `  2. Check if you're on the right page\n`;
          errorMessage += `  3. Use more specific selectors like #id or .class`;
        }
        
        return {
          content: [{ 
            type: 'text', 
            text: errorMessage
          }],
        };
      }

      return {
        content: [{ 
          type: 'text', 
          text: `✅ CSS Modified Successfully!

🎯 Selector: ${args.selector}
🎨 Property: ${args.property}
📝 Original Value: ${result.originalValue}
✨ New Value: ${result.newValue}
🔧 Applied Style: ${result.applied}`
        }],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Modify CSS error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to modify CSS: ${error.message}` 
        }],
      };
    }
  }

  async highlightElement(args: { selector: string; duration?: number }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools not initialized. Please navigate to a page first.' 
        }],
      };
    }

    try {
      const duration = args.duration || 3000;
      
      // Apply highlight styles and get element info
      const elementInfo = await this.page.evaluate(({ selector, duration }) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }

        // Store original styles
        const originalStyles = {
          border: (element as HTMLElement).style.border,
          outline: (element as HTMLElement).style.outline,
          boxShadow: (element as HTMLElement).style.boxShadow,
          backgroundColor: (element as HTMLElement).style.backgroundColor,
          opacity: (element as HTMLElement).style.opacity,
        };

        // Apply highlight styles
        (element as HTMLElement).style.setProperty('border', '3px solid #ff0000', 'important');
        (element as HTMLElement).style.setProperty('outline', '3px solid #00ff00', 'important');
        (element as HTMLElement).style.setProperty('outline-offset', '3px', 'important');
        (element as HTMLElement).style.setProperty('box-shadow', '0 0 20px rgba(255, 0, 0, 0.8)', 'important');
        (element as HTMLElement).style.setProperty('background-color', 'rgba(255, 255, 0, 0.2)', 'important');
        
        // Add tracking attribute
        element.setAttribute('data-mcp-highlighted', 'true');
        element.setAttribute('data-mcp-highlight-id', Date.now().toString());

        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Get element information
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        
        // Auto-remove highlight after duration
        setTimeout(() => {
          (element as HTMLElement).style.border = originalStyles.border;
          (element as HTMLElement).style.outline = originalStyles.outline;
          (element as HTMLElement).style.boxShadow = originalStyles.boxShadow;
          (element as HTMLElement).style.backgroundColor = originalStyles.backgroundColor;
          (element as HTMLElement).style.opacity = originalStyles.opacity;
          element.removeAttribute('data-mcp-highlighted');
          element.removeAttribute('data-mcp-highlight-id');
        }, duration);

        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id,
          className: element.className,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
          styles: {
            display: computed.display,
            position: computed.position,
            zIndex: computed.zIndex,
          },
          attributes: Array.from(element.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as Record<string, string>),
        };
      }, { selector: args.selector, duration });

      if (!elementInfo) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Element not found: ${args.selector}` 
          }],
        };
      }

      // Take a screenshot of the highlighted element
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for styles to apply
      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        type: 'png',
        clip: {
          x: Math.max(0, elementInfo.rect.left - 10),
          y: Math.max(0, elementInfo.rect.top - 10),
          width: elementInfo.rect.width + 20,
          height: elementInfo.rect.height + 20,
        }
      });

      // Validate element highlight screenshot
      if (!screenshot || screenshot.length === 0) {
        throw new Error(`Element highlight screenshot failed: Empty or invalid screenshot buffer for selector ${args.selector}`);
      }

      return {
        content: [{ 
          type: 'text', 
          text: `🔦 Element Highlighted: ${args.selector}

📌 Element Info:
  • Tag: <${elementInfo.tagName}>
  • ID: ${elementInfo.id || '(none)'}
  • Class: ${elementInfo.className || '(none)'}
  • Position: ${elementInfo.rect.left}px × ${elementInfo.rect.top}px
  • Size: ${elementInfo.rect.width}px × ${elementInfo.rect.height}px
  • Display: ${elementInfo.styles.display}
  • Z-Index: ${elementInfo.styles.zIndex}

🎨 Highlight Applied:
  • Red border (3px solid)
  • Green outline (3px with offset)
  • Red shadow glow
  • Yellow background tint

🏷️ Tracking Attributes Added:
  • data-mcp-highlighted="true"
  • data-mcp-highlight-id="${elementInfo.attributes['data-mcp-highlight-id']}"

⏱️ Auto-remove in ${duration / 1000} seconds

📸 Screenshot captured (base64 encoded, ${screenshot.length} chars)`
        }],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Highlight error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to highlight element: ${error.message}` 
        }],
      };
    }
  }

  async modifyHTML(args: { selector: string; value: string; type: 'innerHTML' | 'outerHTML' | 'attribute'; attribute?: string }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools not initialized. Please navigate to a page first.' 
        }],
      };
    }

    try {
      const result = await this.page.evaluate(({ selector, value, type, attribute }) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { success: false, error: 'Element not found' };
        }

        let originalValue: string;
        let newValue: string;

        switch (type) {
          case 'innerHTML':
            originalValue = element.innerHTML;
            element.innerHTML = value;
            newValue = element.innerHTML;
            break;
          case 'outerHTML':
            originalValue = element.outerHTML;
            element.outerHTML = value;
            // Can't get new value as element is replaced
            newValue = value;
            break;
          case 'attribute':
            if (!attribute) {
              return { success: false, error: 'Attribute name required for attribute modification' };
            }
            originalValue = element.getAttribute(attribute) || '(null)';
            element.setAttribute(attribute, value);
            newValue = element.getAttribute(attribute) || '(null)';
            break;
          default:
            return { success: false, error: 'Invalid modification type' };
        }

        return {
          success: true,
          selector,
          type,
          attribute,
          originalValue: originalValue.substring(0, 200),
          newValue: newValue.substring(0, 200),
        };
      }, { selector: args.selector, value: args.value, type: args.type, attribute: args.attribute });

      if (!result.success) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ ${result.error}` 
          }],
        };
      }

      return {
        content: [{ 
          type: 'text', 
          text: `✅ HTML Modified Successfully!

🎯 Selector: ${args.selector}
📝 Type: ${args.type}${result.attribute ? ` (attribute: ${result.attribute})` : ''}
📄 Original: ${result.originalValue}${result.originalValue && result.originalValue.length >= 200 ? '...' : ''}
✨ New: ${result.newValue}${result.newValue && result.newValue.length >= 200 ? '...' : ''}`
        }],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Modify HTML error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to modify HTML: ${error.message}` 
        }],
      };
    }
  }

  async createVisualElementMap(args: { includeAll?: boolean }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools not initialized. Please navigate to a page first.' 
        }],
      };
    }

    try {
      // Apply visual labels and collect element data
      const elementMap = await this.page.evaluate((includeAll) => {
        // Color palette for highlighting
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
          '#F8B500', '#6C5CE7', '#A29BFE', '#FD79A8', '#FDCB6E',
          '#6C5CE7', '#74B9FF', '#A29BFE', '#55A3FF', '#FD79A8'
        ];
        
        // Get all interactive elements
        const selectors = includeAll ? '*' : 'a, button, input, textarea, select, [role="button"], [role="link"], [onclick], [data-mcp-id], img, video, iframe';
        const elements = document.querySelectorAll(selectors);
        const elementData: any[] = [];
        
        let colorIndex = 0;
        let labelIndex = 1;
        
        elements.forEach((element) => {
          const el = element as HTMLElement;
          const rect = el.getBoundingClientRect();
          
          // Skip invisible or tiny elements
          if (rect.width < 5 || rect.height < 5 || 
              window.getComputedStyle(el).display === 'none' ||
              window.getComputedStyle(el).visibility === 'hidden') {
            return;
          }
          
          // Skip if already has a label
          if (el.getAttribute('data-mcp-visual-map-id')) {
            return;
          }
          
          const color = colors[colorIndex % colors.length];
          const mapId = `element-${labelIndex}`;
          
          // Store original styles
          el.setAttribute('data-mcp-original-border', el.style.border || '');
          el.setAttribute('data-mcp-original-position', el.style.position || '');
          
          // Apply highlight border
          el.style.setProperty('border', `3px solid ${color}`, 'important');
          el.style.setProperty('box-sizing', 'border-box', 'important');
          
          // Create label
          const label = document.createElement('div');
          label.className = 'mcp-visual-map-label';
          label.textContent = labelIndex.toString();
          label.style.cssText = `
            position: absolute;
            background: ${color};
            color: white;
            font-weight: bold;
            font-size: 14px;
            padding: 2px 6px;
            border-radius: 3px;
            z-index: 999999;
            pointer-events: none;
            font-family: monospace;
            top: ${rect.top + window.scrollY}px;
            left: ${rect.left + window.scrollX}px;
            transform: translate(-50%, -50%);
          `;
          document.body.appendChild(label);
          
          // Set tracking attributes
          el.setAttribute('data-mcp-visual-map-id', mapId);
          el.setAttribute('data-mcp-visual-map-color', color);
          // Add persistent data attribute that matches the visual number
          el.setAttribute(`data-mcp-agent-page-element-${labelIndex}`, 'true');
          
          // Build CSS selector for element
          let selector = el.tagName.toLowerCase();
          if (el.id) {
            selector = `#${el.id}`;
          } else if (el.className && typeof el.className === 'string') {
            selector += `.${el.className.split(' ').filter(c => c).join('.')}`;
          }
          
          // Collect element data
          elementData.push({
            mapId: mapId,
            label: labelIndex.toString(),
            selector: selector,
            dataSelector: `[data-mcp-visual-map-id="${mapId}"]`,
            borderColor: color,
            tagName: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().substring(0, 50),
            type: el.getAttribute('type') || el.getAttribute('role') || el.tagName.toLowerCase(),
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            attributes: {
              id: el.id,
              className: el.className,
              name: el.getAttribute('name'),
              href: el.getAttribute('href'),
              'data-mcp-id': el.getAttribute('data-mcp-id')
            }
          });
          
          colorIndex++;
          labelIndex++;
        });
        
        // Add styles for labels
        const style = document.createElement('style');
        style.id = 'mcp-visual-map-styles';
        style.textContent = `
          .mcp-visual-map-label {
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
        `;
        document.head.appendChild(style);
        
        return {
          elementCount: elementData.length,
          elements: elementData
        };
      }, args.includeAll || false);
      
      // Take screenshot
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer for all labels to render
      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        fullPage: false, // Only visible viewport
        type: 'png'
      });

      // Validate visual element map screenshot
      if (!screenshot || screenshot.length === 0) {
        throw new Error('Visual element map screenshot failed: Empty or invalid screenshot buffer');
      }

      // Automatically open screenshot in new browser tab
      try {
        const browser = this.page.browser();
        const newPage = await browser.newPage();
        await newPage.goto(`data:image/png;base64,${screenshot}`);
        // console.log('[Visual Element Map] Opened screenshot in new tab');
        
        // Wait 2 seconds to show screenshot, then switch back to original tab
        setTimeout(async () => {
          try {
            if (this.page) {
              await this.page.bringToFront();
              // console.log('[Visual Element Map] Switched back to original tab');
            }
          } catch (error) {
            // console.error('[Visual Element Map] Failed to switch back to original tab:', error);
          }
        }, 2000);
      } catch (error) {
        // console.error('[Visual Element Map] Failed to open screenshot in tab:', error);
      }
      
      // Clean up after screenshot
      await this.page.evaluate(() => {
        // Remove labels
        document.querySelectorAll('.mcp-visual-map-label').forEach(label => label.remove());
        
        // Remove style
        document.getElementById('mcp-visual-map-styles')?.remove();
        
        // Restore original styles
        document.querySelectorAll('[data-mcp-visual-map-id]').forEach(el => {
          const element = el as HTMLElement;
          const originalBorder = element.getAttribute('data-mcp-original-border') || '';
          element.style.border = originalBorder;
          
          // Clean up temporary attributes (but keep the persistent data-mcp-agent-page-element-X)
          element.removeAttribute('data-mcp-visual-map-id');
          element.removeAttribute('data-mcp-visual-map-color');
          element.removeAttribute('data-mcp-original-border');
          element.removeAttribute('data-mcp-original-position');
          // NOTE: data-mcp-agent-page-element-X attributes are kept for later use
        });
      });
      
      // Apply same size limits as regular screenshots
      const MAX_BASE64_LENGTH = 11000;
      const TOKEN_BUFFER = 0.8;
      const SAFE_BASE64_LENGTH = Math.floor(MAX_BASE64_LENGTH * TOKEN_BUFFER);
      const MAX_ELEMENTS_IN_RESPONSE = 10;
      
      // Check if screenshot needs chunking (same logic as regular screenshots)
      const screenshotTooBig = (screenshot as string).length > SAFE_BASE64_LENGTH;
      
      // Check if element list needs chunking
      const elementsToShow = elementMap.elements.slice(0, MAX_ELEMENTS_IN_RESPONSE);
      const hasMoreElements = elementMap.elements.length > MAX_ELEMENTS_IN_RESPONSE;
      
      // For large pages (500+ elements), always use chunking mode to avoid token limits
      const tooManyElements = elementMap.elementCount > 500;
      
      if (screenshotTooBig || tooManyElements) {
        // Include the image but with very limited element details to stay under token limits
        return {
          content: [
            {
              type: 'image',
              data: screenshot as string,
              mimeType: 'image/png',
            },
            {
              type: 'text', 
              text: `🗺️ Visual Element Map Created

📊 Found ${elementMap.elementCount} interactive elements numbered and highlighted in the image

🎯 To interact with any numbered element, use the JavaScript helper functions:
   • window.__AGENT_PAGE__.clickElement(1) - Click element 1
   • window.__AGENT_PAGE__.fillElement(25, "text") - Fill element 25 with "text"  
   • window.__AGENT_PAGE__.highlightElement(100) - Highlight element 100
   • window.__AGENT_PAGE__.getElementByNumber(1) - Get element 1 DOM object

💡 Alternative: Use CSS selector [data-mcp-agent-page-element-{number}]

📸 Current view shows elements in the visible area
🔄 For full page coverage: Use screenshot(fullPage: true, quality: 50) with automatic chunking

📱 Screenshot automatically opened in new browser tab for better viewing`
            }
          ],
        };
      }

      return {
        content: [
          {
            type: 'image',
            data: screenshot as string,
            mimeType: 'image/png',
          },
          { 
            type: 'text', 
            text: `🗺️ Visual Element Map Created

📊 Found ${elementMap.elementCount} interactive elements

📸 Screenshot: Full page captured with all elements highlighted and labeled

🎯 Element Map${hasMoreElements ? ` (showing first ${MAX_ELEMENTS_IN_RESPONSE} of ${elementMap.elementCount})` : ''}:
${elementsToShow.map(el => 
  `[${el.label}] ${el.tagName}${el.attributes.id ? '#' + el.attributes.id : ''} → data-mcp-agent-page-element-${el.label} - "${el.text.substring(0, 30)}${el.text.length > 30 ? '...' : ''}" (${el.borderColor})`
).join('\n')}

${hasMoreElements ? `\n⚠️ ${elementMap.elementCount - MAX_ELEMENTS_IN_RESPONSE} more elements not shown (response size limit)\n` : ''}
🎯 To interact with any numbered element, use the JavaScript helper functions:
   • window.__AGENT_PAGE__.clickElement(1) - Click element 1
   • window.__AGENT_PAGE__.fillElement(25, "text") - Fill element 25 with "text"
   • window.__AGENT_PAGE__.highlightElement(100) - Highlight element 100
   • window.__AGENT_PAGE__.getElementByNumber(1) - Get element 1 DOM object

💡 Alternative: Use CSS selector [data-mcp-agent-page-element-{number}]

📷 Screenshot Length: ${(screenshot as string).length} characters (base64)
📱 Screenshot automatically opened in new browser tab for better viewing`
          }
        ],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Visual element map error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to create visual element map: ${error.message}` 
        }],
      };
    }
  }

  async getComputedStyles(args: { selector: string }) {
    if (!this.page || !this.client) {
      return {
        content: [{ 
          type: 'text', 
          text: '❌ DevTools not initialized. Please navigate to a page first.' 
        }],
      };
    }

    try {
      const styles = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }

        const computed = window.getComputedStyle(element);
        const allStyles: Record<string, string> = {};
        
        // Get all computed style properties
        for (let i = 0; i < computed.length; i++) {
          const propName = computed[i];
          allStyles[propName] = computed.getPropertyValue(propName);
        }

        // Also get CSS variables
        const cssVars: Record<string, string> = {};
        for (const prop in allStyles) {
          if (prop.startsWith('--')) {
            cssVars[prop] = allStyles[prop];
          }
        }

        return {
          allStyles,
          cssVars,
          important: {
            display: computed.display,
            position: computed.position,
            width: computed.width,
            height: computed.height,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize,
            fontFamily: computed.fontFamily,
            margin: computed.margin,
            padding: computed.padding,
            border: computed.border,
            zIndex: computed.zIndex,
            opacity: computed.opacity,
            visibility: computed.visibility,
          }
        };
      }, args.selector);

      if (!styles) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Element not found: ${args.selector}` 
          }],
        };
      }

      return {
        content: [{ 
          type: 'text', 
          text: `🎨 Computed Styles for: ${args.selector}

📊 Key Properties:
${Object.entries(styles.important).map(([key, value]) => `  • ${key}: ${value}`).join('\n')}

🔧 CSS Variables:
${Object.keys(styles.cssVars).length > 0 ? 
  Object.entries(styles.cssVars).map(([key, value]) => `  • ${key}: ${value}`).join('\n') : 
  '  (none)'}

💡 Total Properties: ${Object.keys(styles.allStyles).length}

Use devtools_modify_css to change any of these properties.`
        }],
      };
    } catch (error: any) {
      // console.error('[DevToolsElements] Get computed styles error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to get computed styles: ${error.message}` 
        }],
      };
    }
  }

  // Cleanup method
  async cleanup() {
    // Note: We don't detach the CDP session here because it's managed externally
    // The CDP session is passed in from index.ts and should be cleaned up there
    this.page = null;
    this.client = null;
  }
}