/**
 * Human interaction tools for Supapup
 * Allows agents to ask humans to visually identify elements
 */

import { Page } from 'puppeteer';

export interface HumanSelectionResult {
  success: boolean;
  element?: {
    selector: string;
    id: string;
    tagName: string;
    className: string;
    text: string;
    attributes: Record<string, string>;
    position: { x: number; y: number; width: number; height: number };
  };
  cancelled?: boolean;
  error?: string;
}

export class HumanInteraction {
  constructor(private page: Page) {}

  /**
   * Ask human to click on an element
   */
  async askHumanToIdentifyElement(prompt: string, timeout: number = 30000): Promise<HumanSelectionResult> {
    try {
      // Inject the interactive overlay
      const result = await this.page.evaluate((userPrompt, timeoutMs) => {
        return new Promise<any>((resolve) => {
          // Create instruction banner at top of page (in document flow, not fixed)
          const banner = document.createElement('div');
          banner.id = 'supapup-human-interaction-banner';
          banner.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            box-sizing: border-box;
          `;
          
          banner.innerHTML = `
            <div style="max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
              <div style="flex: 1; text-align: left;">
                <h3 style="margin: 0 0 5px 0; font-size: 18px;">🤖 Visual Identification Request</h3>
                <p style="margin: 0; font-size: 14px;">${userPrompt}</p>
              </div>
              <button id="supapup-cancel-selection" style="
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                color: white;
                padding: 6px 16px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                white-space: nowrap;
                margin-left: 20px;
              ">Cancel</button>
            </div>
          `;

          // Add banner to top of body (in normal document flow)
          document.body.insertBefore(banner, document.body.firstChild);

          // Highlight effect on hover
          let hoveredElement: HTMLElement | null = null;
          let originalOutline: string = '';

          const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Skip our own banner elements
            if (target.closest('#supapup-human-interaction-banner')) return;

            // Remove previous highlight
            if (hoveredElement && hoveredElement !== target) {
              hoveredElement.style.outline = originalOutline;
            }

            // Add new highlight
            if (target !== hoveredElement) {
              hoveredElement = target;
              originalOutline = target.style.outline || '';
              target.style.outline = '3px solid #667eea';
              target.style.outlineOffset = '2px';
            }
          };

          const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Skip our own banner elements
            if (target.closest('#supapup-human-interaction-banner')) return;

            e.preventDefault();
            e.stopPropagation();

            // Mark the element with a special attribute (only one at a time)
            // Remove any previously marked element
            const previouslyMarked = document.querySelector('[data-mcp-human-clicked]');
            if (previouslyMarked) {
              previouslyMarked.removeAttribute('data-mcp-human-clicked');
            }
            
            // Mark this element
            target.setAttribute('data-mcp-human-clicked', 'true');
            const uniqueId = 'human-clicked';
            
            // Flash effect
            const originalBg = target.style.backgroundColor;
            target.style.backgroundColor = 'rgba(102, 126, 234, 0.3)';
            setTimeout(() => {
              target.style.backgroundColor = originalBg;
            }, 300);

            // Get element info
            const rect = target.getBoundingClientRect();
            const elementInfo = {
              selector: '[data-mcp-human-clicked]',
              id: uniqueId,
              tagName: target.tagName.toLowerCase(),
              className: target.className || '',
              text: target.textContent?.trim().substring(0, 100) || '',
              attributes: {} as Record<string, string>,
              position: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              }
            };

            // Collect attributes
            for (const attr of target.attributes) {
              elementInfo.attributes[attr.name] = attr.value;
            }

            cleanup();
            resolve({
              success: true,
              element: elementInfo
            });
          };

          const handleCancel = () => {
            cleanup();
            resolve({
              success: false,
              cancelled: true
            });
          };

          const cleanup = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('click', handleClick, true);
            if (hoveredElement) {
              hoveredElement.style.outline = originalOutline;
            }
            banner.remove();
            clearTimeout(timeoutId);
          };

          // Set up event listeners
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('click', handleClick, true);
          document.getElementById('supapup-cancel-selection')?.addEventListener('click', handleCancel);

          // Set timeout
          const timeoutId = setTimeout(() => {
            cleanup();
            resolve({
              success: false,
              error: 'Selection timed out'
            });
          }, timeoutMs);

          // Enable interaction on body
          document.body.style.pointerEvents = 'auto';
        });
      }, prompt, timeout);

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to start human interaction: ${error}`
      };
    }
  }

  /**
   * Ask human to select multiple elements
   */
  async askHumanToIdentifyMultipleElements(
    prompt: string, 
    maxElements: number = 5,
    timeout: number = 60000
  ): Promise<{
    success: boolean;
    elements?: HumanSelectionResult['element'][];
    cancelled?: boolean;
    error?: string;
  }> {
    try {
      const elements: HumanSelectionResult['element'][] = [];
      
      for (let i = 0; i < maxElements; i++) {
        const currentPrompt = `${prompt} (${i + 1}/${maxElements} - Click element or Cancel to finish)`;
        const result = await this.askHumanToIdentifyElement(currentPrompt, timeout);
        
        if (!result.success || result.cancelled) {
          break;
        }
        
        if (result.element) {
          elements.push(result.element);
        }
      }

      return {
        success: elements.length > 0,
        elements: elements.length > 0 ? elements : undefined,
        cancelled: elements.length === 0
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to identify multiple elements: ${error}`
      };
    }
  }

  /**
   * Ask human to draw a bounding box around an area
   */
  async askHumanToSelectArea(prompt: string, timeout: number = 30000): Promise<{
    success: boolean;
    area?: { x: number; y: number; width: number; height: number };
    cancelled?: boolean;
    error?: string;
  }> {
    try {
      const result = await this.page.evaluate((userPrompt, timeoutMs) => {
        return new Promise<any>((resolve) => {
          // Create overlay
          const overlay = document.createElement('div');
          overlay.id = 'supapup-area-selection-overlay';
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999999;
            cursor: crosshair;
          `;

          // Create instruction banner
          const banner = document.createElement('div');
          banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000000;
            pointer-events: all;
          `;
          
          banner.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">🤖 Agent Request: Area Selection</h2>
              <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 500;">${userPrompt}</p>
              <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.9;">
                Click and drag to draw a box around the area in question.
              </p>
              <button id="supapup-cancel-area" style="
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                color: white;
                padding: 8px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
              ">Cancel</button>
            </div>
          `;

          overlay.appendChild(banner);
          document.body.appendChild(overlay);

          // Selection box
          let isDrawing = false;
          let startX = 0, startY = 0;
          let selectionBox: HTMLDivElement | null = null;

          const handleMouseDown = (e: MouseEvent) => {
            if (e.target === document.getElementById('supapup-cancel-area')) return;
            
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;

            selectionBox = document.createElement('div');
            selectionBox.style.cssText = `
              position: fixed;
              border: 2px dashed #667eea;
              background: rgba(102, 126, 234, 0.1);
              pointer-events: none;
              z-index: 1000001;
            `;
            overlay.appendChild(selectionBox);
          };

          const handleMouseMove = (e: MouseEvent) => {
            if (!isDrawing || !selectionBox) return;

            const currentX = e.clientX;
            const currentY = e.clientY;

            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            selectionBox.style.left = `${left}px`;
            selectionBox.style.top = `${top}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;
          };

          const handleMouseUp = (e: MouseEvent) => {
            if (!isDrawing || !selectionBox) return;

            isDrawing = false;
            
            const rect = selectionBox.getBoundingClientRect();
            
            cleanup();
            
            if (rect.width > 10 && rect.height > 10) {
              resolve({
                success: true,
                area: {
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height
                }
              });
            } else {
              resolve({
                success: false,
                error: 'Selection too small'
              });
            }
          };

          const handleCancel = () => {
            cleanup();
            resolve({
              success: false,
              cancelled: true
            });
          };

          const cleanup = () => {
            overlay.removeEventListener('mousedown', handleMouseDown);
            overlay.removeEventListener('mousemove', handleMouseMove);
            overlay.removeEventListener('mouseup', handleMouseUp);
            overlay.remove();
            clearTimeout(timeoutId);
          };

          // Set up event listeners
          overlay.addEventListener('mousedown', handleMouseDown);
          overlay.addEventListener('mousemove', handleMouseMove);
          overlay.addEventListener('mouseup', handleMouseUp);
          document.getElementById('supapup-cancel-area')?.addEventListener('click', handleCancel);

          // Set timeout
          const timeoutId = setTimeout(() => {
            cleanup();
            resolve({
              success: false,
              error: 'Selection timed out'
            });
          }, timeoutMs);
        });
      }, prompt, timeout);

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to select area: ${error}`
      };
    }
  }
}