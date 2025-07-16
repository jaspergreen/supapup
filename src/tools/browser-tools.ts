import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BrowserRecovery } from './../core/browser-recovery.js';
// AgentPageScript removed - DevToolsAgentPageGenerator handles its own injection
import { ContentExtractor } from './../generators/content-extractor.js';
import { DevToolsAgentPageGenerator } from './../generators/devtools-agent-page-generator.js';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

export class BrowserTools {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private browserRecovery: BrowserRecovery;
  private currentManifest: any = null;

  constructor(browserRecovery: BrowserRecovery) {
    this.browserRecovery = browserRecovery;
  }

  // Getters for external access
  getBrowser(): Browser | null {
    return this.browser;
  }

  getPage(): Page | null {
    return this.page;
  }

  getCurrentManifest(): any {
    return this.currentManifest;
  }

  setCurrentManifest(manifest: any): void {
    this.currentManifest = manifest;
  }

  // Called by main server after browser crash
  clearBrowserReferences(): void {
    this.browser = null;
    this.page = null;
    this.currentManifest = null;
  }

  async navigate(url: string): Promise<any> {
    try {
      // Launch browser if needed
      if (!this.browser) {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--remote-debugging-port=9222',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--start-maximized'
          ]
        });
      }

      // Create page if needed
      if (!this.page) {
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        
        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Inject dialog handling script on every new document
        await this.page.evaluateOnNewDocument(() => {
          // Only inject if not already present
          if (typeof (window as any).__MCP_DIALOGS_INSTALLED__ === 'undefined') {
            (window as any).__MCP_DIALOGS_INSTALLED__ = true;
            
            // Helper functions for agents
            (window as any).click_alert = function(index: number) {
              const alerts = document.querySelectorAll('[data-mcp-type="alert"]');
              if (alerts[index - 1]) {
                const okBtn = alerts[index - 1].querySelector('[data-mcp-id="alert-ok"]') as HTMLElement;
                if (okBtn) { okBtn.click(); return true; }
              }
              return false;
            };
            
            (window as any).fill_prompt = function(index: number, value: string) {
              const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
              if (prompts[index - 1]) {
                const input = prompts[index - 1].querySelector('[data-mcp-id="prompt-input"]') as HTMLInputElement;
                if (input) {
                  input.value = value;
                  input.style.background = '#ffffaa';
                  return true;
                }
              }
              return false;
            };
            
            (window as any).click_prompt = function(index: number, accept: boolean) {
              const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
              if (prompts[index - 1]) {
                const btn = accept ? 
                  prompts[index - 1].querySelector('[data-mcp-id="prompt-ok"]') :
                  prompts[index - 1].querySelector('[data-mcp-id="prompt-cancel"]');
                if (btn) { (btn as HTMLElement).click(); return true; }
              }
              return false;
            };
            
            (window as any).click_confirm = function(index: number, accept: boolean) {
              const confirms = document.querySelectorAll('[data-mcp-type="confirm"]');
              if (confirms[index - 1]) {
                const btn = accept ? 
                  confirms[index - 1].querySelector('[data-mcp-id="confirm-ok"]') :
                  confirms[index - 1].querySelector('[data-mcp-id="confirm-cancel"]');
                if (btn) { (btn as HTMLElement).click(); return true; }
              }
              return false;
            };
            
            (window as any).list_dialogs = function() {
              const alerts = document.querySelectorAll('[data-mcp-type="alert"]');
              const prompts = document.querySelectorAll('[data-mcp-type="prompt"]');
              const confirms = document.querySelectorAll('[data-mcp-type="confirm"]');
              return { alerts: alerts.length, prompts: prompts.length, confirms: confirms.length };
            };
            
            // Enhanced dialog overrides
            const originalAlert = window.alert;
            const originalConfirm = window.confirm;
            const originalPrompt = window.prompt;
            
            window.alert = function(message) {
              console.log('[MCP] Alert intercepted:', message);
              const alertNum = document.querySelectorAll('[data-mcp-type="alert"]').length + 1;
              const alertDiv = document.createElement('div');
              alertDiv.id = 'mcp-alert-' + Date.now();
              alertDiv.setAttribute('data-mcp-id', 'alert-dialog-' + alertNum);
              alertDiv.setAttribute('data-mcp-type', 'alert');
              alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#ff4444;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:300px;font-family:monospace;';
              alertDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;">🚨 Alert #' + alertNum + '</div><div style="margin-bottom:10px;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.8;">Agent: Use click_alert(' + alertNum + ') to dismiss</div><button data-mcp-id="alert-ok" onclick="this.parentElement.remove();" style="background:white;color:#ff4444;border:none;padding:5px 10px;border-radius:3px;">OK</button>';
              document.body.appendChild(alertDiv);
              console.log('[MCP] Alert helper: click_alert(' + alertNum + ')');
              return undefined;
            };
            
            window.prompt = function(message, defaultValue) {
              console.log('[MCP] Prompt intercepted:', message);
              const promptNum = document.querySelectorAll('[data-mcp-type="prompt"]').length + 1;
              const promptDiv = document.createElement('div');
              promptDiv.id = 'mcp-prompt-' + Date.now();
              promptDiv.setAttribute('data-mcp-id', 'prompt-dialog-' + promptNum);
              promptDiv.setAttribute('data-mcp-type', 'prompt');
              promptDiv.style.cssText = 'position:fixed;top:20px;left:20px;background:#44ff44;color:black;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:350px;font-family:monospace;';
              promptDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;color:black;">📝 Prompt #' + promptNum + '</div><div style="margin-bottom:10px;color:black;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.7;color:black;">Agent: fill_prompt(' + promptNum + ', "text") then click_prompt(' + promptNum + ', true)</div><input type="text" data-mcp-id="prompt-input" value="' + (defaultValue || '') + '" style="width:250px;padding:5px;margin-bottom:10px;border:1px solid #ccc;border-radius:3px;"><br><button data-mcp-id="prompt-ok" onclick="this.parentElement.remove();" style="background:#44ff44;color:white;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="prompt-cancel" onclick="this.parentElement.remove();" style="background:#ff4444;color:white;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
              document.body.appendChild(promptDiv);
              console.log('[MCP] Prompt helpers: fill_prompt(' + promptNum + ', "text"), click_prompt(' + promptNum + ', true/false)');
              return null;
            };
            
            window.confirm = function(message) {
              console.log('[MCP] Confirm intercepted:', message);
              const confirmNum = document.querySelectorAll('[data-mcp-type="confirm"]').length + 1;
              const confirmDiv = document.createElement('div');
              confirmDiv.id = 'mcp-confirm-' + Date.now();
              confirmDiv.setAttribute('data-mcp-id', 'confirm-dialog-' + confirmNum);
              confirmDiv.setAttribute('data-mcp-type', 'confirm');
              confirmDiv.style.cssText = 'position:fixed;top:80px;right:20px;background:#4444ff;color:white;padding:15px;border-radius:5px;z-index:999999;box-shadow:0 4px 8px rgba(0,0,0,0.3);min-width:300px;font-family:monospace;';
              confirmDiv.innerHTML = '<div style="margin-bottom:10px;font-weight:bold;">❓ Confirm #' + confirmNum + '</div><div style="margin-bottom:10px;">' + message + '</div><div style="margin-bottom:10px;font-size:12px;opacity:0.8;">Agent: click_confirm(' + confirmNum + ', true) or click_confirm(' + confirmNum + ', false)</div><button data-mcp-id="confirm-ok" onclick="this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;margin-right:5px;">OK</button><button data-mcp-id="confirm-cancel" onclick="this.parentElement.remove();" style="background:white;color:#4444ff;border:none;padding:5px 10px;border-radius:3px;">Cancel</button>';
              document.body.appendChild(confirmDiv);
              console.log('[MCP] Confirm helper: click_confirm(' + confirmNum + ', true/false)');
              return false;
            };
            
            console.log('[MCP] Enhanced dialog overrides with helper functions installed');
          }
        });
      }

      console.log(`📍 Navigating to: ${url}`);
      
      // Determine redirect limit based on URL
      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
      const maxRedirects = isLocalhost ? 30 : 15;
      
      // Navigate with redirect tracking
      let redirectCount = 0;
      let currentUrl = url;
      const startTime = Date.now();
      
      try {
        const response = await this.page.goto(currentUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        // Track redirects
        while (this.page.url() !== currentUrl && redirectCount < maxRedirects) {
          redirectCount++;
          currentUrl = this.page.url();
          console.log(`↪️ Redirect ${redirectCount}: ${currentUrl}`);
          
          if (redirectCount >= maxRedirects) {
            throw new Error(`Too many redirects (${redirectCount}). Possible infinite redirect attack or complex SPA flow. URL: ${currentUrl}`);
          }
        }

        const finalUrl = this.page.url();
        console.log(`✅ Navigation completed. Final URL: ${finalUrl}`);
        console.log(`🔄 Redirects: ${redirectCount}`);
        console.log(`⏱️ Time: ${Date.now() - startTime}ms`);

        // Wait for JavaScript to complete and page to settle
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Additional check for common dynamic content patterns
        try {
          // Wait for common loading indicators to disappear
          await this.page.waitForFunction(() => {
            const loadingIndicators = document.querySelectorAll('.loading, .spinner, [data-loading="true"]');
            return loadingIndicators.length === 0;
          }, { timeout: 5000 });
        } catch (e) {
          // If loading indicators don't disappear in 5 seconds, continue anyway
          console.log('⚠️ Some loading indicators may still be present, continuing...');
        }

        // Check for bot detection and CAPTCHAs
        const botCheckResult = await this.checkForBotDetection();
        if (botCheckResult.hasIssues) {
          return this.generateCaptchaResponse(finalUrl, botCheckResult);
        }

        // Use DevToolsAgentPageGenerator directly
        const agentPage = await this.generateAgentPage();
        
        return {
          content: [{ type: 'text', text: agentPage }]
        };

      } catch (error: any) {
        console.error('❌ Navigation error:', error.message);
        
        if (error.message.includes('Too many redirects')) {
          throw error; // Re-throw redirect errors
        }
        
        // Handle other navigation errors
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Navigation failed: ${error.message}\n📍 URL: ${url}` 
          }]
        };
      }

    } catch (error: any) {
      console.error('❌ Browser navigation error:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Navigation failed: ${error.message}\n📍 URL: ${url}` 
        }]
      };
    }
  }

  async closeBrowser(): Promise<any> {
    try {
      if (this.browser) {
        console.log('🔚 Closing browser...');
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.currentManifest = null;
        console.log('✅ Browser closed successfully');
        return {
          content: [{ type: 'text', text: '✅ Browser closed successfully' }]
        };
      } else {
        return {
          content: [{ type: 'text', text: '⚠️ No browser instance to close' }]
        };
      }
    } catch (error: any) {
      console.error('❌ Error closing browser:', error);
      return {
        content: [{ type: 'text', text: `❌ Error closing browser: ${error.message}` }]
      };
    }
  }

  async openInTab(content: string, contentType: string = 'text/html', title?: string): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Use browser_navigate tool to open a webpage first, then try this operation again.');
      }

      // Create a new page
      const newPage = await this.browser.newPage();
      
      // Set title if provided
      if (title) {
        await newPage.evaluateOnNewDocument((title) => {
          document.title = title;
        }, title);
      }

      // Handle different content types
      if (contentType.startsWith('text/html')) {
        await newPage.setContent(content, { waitUntil: 'domcontentloaded' });
      } else if (contentType.startsWith('text/')) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title || 'Content'}</title>
            <style>
              body { font-family: monospace; white-space: pre-wrap; padding: 20px; }
            </style>
          </head>
          <body>${content}</body>
          </html>
        `;
        await newPage.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
      } else {
        // For other content types, create a data URL
        const dataUrl = `data:${contentType};base64,${Buffer.from(content).toString('base64')}`;
        await newPage.goto(dataUrl);
      }

      const url = newPage.url();
      console.log(`✅ Opened content in new tab: ${url}`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Opened content in new tab\n📍 URL: ${url}\n📋 Content type: ${contentType}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error opening content in tab:', error);
      return {
        content: [{ type: 'text', text: `❌ Error opening content in tab: ${error.message}` }]
      };
    }
  }

  async listTabs(): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Use browser_navigate tool to open a webpage first, then try this operation again.');
      }

      const pages = await this.browser.pages();
      const tabList = await Promise.all(
        pages.map(async (page, index) => {
          try {
            const title = await page.title();
            const url = page.url();
            return `${index}: "${title}" - ${url}`;
          } catch (error) {
            return `${index}: [Error getting tab info] - ${error}`;
          }
        })
      );

      const response = `📑 Open browser tabs (${tabList.length}):\n${tabList.join('\n')}`;
      
      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error listing tabs:', error);
      return {
        content: [{ type: 'text', text: `❌ Error listing tabs: ${error.message}` }]
      };
    }
  }

  async switchTab(index: number): Promise<any> {
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Use browser_navigate tool to open a webpage first, then try this operation again.');
      }

      const pages = await this.browser.pages();
      
      if (index < 0 || index >= pages.length) {
        throw new Error(`Invalid tab index: ${index}. Available tabs: 0-${pages.length - 1}. Use browser_list_tabs to see all open tabs and their indices.`);
      }

      const targetPage = pages[index];
      await targetPage.bringToFront();
      
      // Update current page reference
      this.page = targetPage;
      
      // Get tab info
      const title = await targetPage.title();
      const url = targetPage.url();
      
      console.log(`✅ Switched to tab ${index}: "${title}"`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Switched to tab ${index}\n📋 "${title}"\n📍 ${url}` 
        }]
      };

    } catch (error: any) {
      console.error('❌ Error switching tabs:', error);
      return {
        content: [{ type: 'text', text: `❌ Error switching tabs: ${error.message}` }]
      };
    }
  }

  // Private helper methods
  private async checkForBotDetection(): Promise<any> {
    if (!this.page) return { hasIssues: false };

    try {
      const result = await this.page.evaluate(() => {
        // Check for visible CAPTCHAs only (not just presence of scripts)
        const captchaSelectors = [
          '.g-recaptcha:not([style*="display: none"]):not([style*="display:none"])',
          '.h-captcha:not([style*="display: none"]):not([style*="display:none"])',
          '.cf-turnstile:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="recaptcha"]:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="hcaptcha"]:not([style*="display: none"]):not([style*="display:none"])',
          'iframe[src*="turnstile"]:not([style*="display: none"]):not([style*="display:none"])'
        ];
        
        let visibleCaptchas = 0;
        captchaSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && 
                style.visibility !== 'hidden' && 
                style.opacity !== '0') {
              visibleCaptchas++;
            }
          });
        });

        // Check for blocking text patterns
        const bodyText = document.body.textContent || '';
        const blockingPatterns = [
          /please complete.*captcha/i,
          /verify.*you.*human/i,
          /prove.*you.*human/i,
          /security check/i,
          /access denied/i,
          /blocked.*suspicious/i
        ];
        
        const hasBlockingText = blockingPatterns.some(pattern => pattern.test(bodyText));
        
        return {
          visibleCaptchas,
          hasBlockingText,
          hasIssues: visibleCaptchas > 0 || hasBlockingText
        };
      });

      return result;
    } catch (error) {
      console.error('❌ Bot detection check failed:', error);
      return { hasIssues: false };
    }
  }

  private generateCaptchaResponse(url: string, botCheckResult: any): any {
    const text = `🤖 Whoops! Seems like I am a robot... Any humans around?\n` +
                `⚠️ CAPTCHA/verification detected - need human help!\n\n` +
                `📍 Current URL: ${url}\n\n` +
                `🔒 Detection details:\n` +
                `   • Visible CAPTCHAs: ${botCheckResult.visibleCaptchas || 0}\n` +
                `   • Blocking text: ${botCheckResult.hasBlockingText ? 'Yes' : 'No'}\n\n` +
                `👤 Hey human! Could you please:\n` +
                `   1. Go to the browser window\n` +
                `   2. Complete the CAPTCHA/verification challenge\n` +
                `   3. I'll detect when you're done and continue automatically\n\n` +
                `⏳ WAITING: This tool is now polling for CAPTCHA completion.\n` +
                `🛑 AGENT: DO NOTHING. DO NOT CALL ANY TOOLS.\n` +
                `The tool will automatically return when the user completes the CAPTCHA.`;

    return {
      content: [{ type: 'text', text }]
    };
  }

  // Removed - DevToolsAgentPageGenerator is now the single source of truth

  private async generateAgentPage(): Promise<string> {
    try {
      if (!this.page) throw new Error('Page not initialized');

      // Single source of truth - DevToolsAgentPageGenerator
      const generator = new DevToolsAgentPageGenerator(this.page);
      const result = await generator.generateAgentPage();
      
      // Store current manifest for later use
      this.currentManifest = result;
      
      // Return the complete agent page with navigation header
      const url = await this.page.url();
      return `✅ Navigation successful\n📍 URL: ${url}\n\n${result.content}`;
      
    } catch (error: any) {
      console.error('❌ Agent page generation failed:', error.message);
      throw new Error(`Agent page generation failed: ${error.message}`);
    }
  }

  async navigateAndCaptureLoadingSequence(url: string, params: any = {}, screenshotTools?: any): Promise<any> {
    try {
      // Launch browser if needed
      if (!this.browser) {
        console.log('🚀 Launching browser for loading sequence capture...');
        this.browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--remote-debugging-port=9222',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--start-maximized'
          ]
        });
      }

      const {
        captureInterval = 500, // ms between captures (agent configurable)
        maxDuration = 10000, // max capture time
        quality = 30, // Lower quality for faster processing 
        stopOnNetworkIdle = true, // stop when network settles
        viewport = { width: 1200, height: 800 } // Smaller viewport for faster screenshots
      } = params;

      // Create page if needed
      if (!this.page) {
        this.page = await this.browser.newPage();
        await this.page.setViewport(viewport); // Use configurable viewport
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      } else {
        // Update viewport for loading sequence capture
        await this.page.setViewport(viewport);
      }

      console.log(`🎬 Starting loading sequence capture for: ${url}`);
      console.log(`📸 Capturing every ${captureInterval}ms for up to ${maxDuration}ms`);

      const frames: string[] = [];
      const frameMetadata: Array<{
        index: number;
        timestamp: number;
        description: string;
      }> = [];
      
      const startTime = Date.now();
      let captureActive = true;
      let lastNetworkActivity = Date.now();
      let frameIndex = 0;

      // Track network activity
      const requestHandler = () => { lastNetworkActivity = Date.now(); };
      const responseHandler = () => { lastNetworkActivity = Date.now(); };
      
      if (stopOnNetworkIdle) {
        this.page.on('request', requestHandler);
        this.page.on('response', responseHandler);
      }

      // Start navigation
      const navigationPromise = this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Capture initial state
      try {
        const initialShot = await this.page.screenshot({
          type: 'jpeg',
          quality,
          encoding: 'base64'
        }) as string;
        frames.push(initialShot);
        frameMetadata.push({
          index: frameIndex++,
          timestamp: 0,
          description: 'Initial navigation state'
        });
        console.log('📸 Captured initial frame');
      } catch (e) {
        console.log('⚠️ Could not capture initial frame');
      }

      // Capture frames at intervals
      const captureIntervalId = setInterval(async () => {
        if (!captureActive || !this.page) {
          clearInterval(captureIntervalId);
          return;
        }

        const elapsed = Date.now() - startTime;

        // Check stop conditions
        if (elapsed > maxDuration) {
          console.log('⏱️ Max duration reached');
          captureActive = false;
          return;
        }

        if (stopOnNetworkIdle && elapsed > 3000 && Date.now() - lastNetworkActivity > 2000) {
          console.log('🔄 Network idle detected');
          captureActive = false;
          return;
        }

        try {
          // Capture frame
          const screenshot = await this.page.screenshot({
            type: 'jpeg',
            quality,
            encoding: 'base64'
          }) as string;

          // Get page state info
          const stateInfo = await this.page.evaluate(() => {
            const indicators = [];
            
            // Check for loading indicators
            const loadingElements = document.querySelectorAll('.loading, .spinner, [class*="load"], [class*="spin"], .skeleton');
            if (loadingElements.length > 0) {
              indicators.push(`${loadingElements.length} loading indicators`);
            }
            
            // Check video states
            const videos = document.querySelectorAll('video');
            const loadingVideos = Array.from(videos).filter(v => v.readyState < 4);
            if (loadingVideos.length > 0) {
              indicators.push(`${loadingVideos.length}/${videos.length} videos loading`);
            }
            
            // Check images
            const images = document.querySelectorAll('img');
            const loadingImages = Array.from(images).filter(img => !img.complete);
            if (loadingImages.length > 0) {
              indicators.push(`${loadingImages.length}/${images.length} images loading`);
            }

            // Check if document is still parsing
            if (document.readyState !== 'complete') {
              indicators.push(`document ${document.readyState}`);
            }

            return indicators.length > 0 ? indicators.join(', ') : 'content visible';
          });

          frames.push(screenshot);
          frameMetadata.push({
            index: frameIndex++,
            timestamp: elapsed,
            description: stateInfo
          });

          console.log(`📸 Frame ${frameIndex} at ${elapsed}ms: ${stateInfo}`);
        } catch (error) {
          console.error('Failed to capture frame:', error);
        }
      }, captureInterval);

      // Wait for navigation
      try {
        await navigationPromise;
        console.log('✅ Navigation completed');
      } catch (error) {
        console.log('⚠️ Navigation timeout/error:', error);
      }

      // Wait for capture to finish
      while (captureActive) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      clearInterval(captureIntervalId);

      // Clean up event listeners
      if (stopOnNetworkIdle) {
        this.page.off('request', requestHandler);
        this.page.off('response', responseHandler);
      }

      // Capture final state
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const finalShot = await this.page.screenshot({
          type: 'jpeg',
          quality,
          encoding: 'base64'
        }) as string;
        frames.push(finalShot);
        frameMetadata.push({
          index: frameIndex++,
          timestamp: Date.now() - startTime,
          description: 'Final loaded state'
        });
        console.log('📸 Captured final frame');
      } catch (e) {
        console.log('⚠️ Could not capture final frame');
      }

      // Store as chunk data for retrieval
      const sequenceId = `loading-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Use provided screenshot tools or create new one
      let screenshotToolsInstance = screenshotTools;
      if (!screenshotToolsInstance) {
        const { ScreenshotTools } = await import('./screenshot-tools.js');
        screenshotToolsInstance = new ScreenshotTools();
        screenshotToolsInstance.initialize(this.page);
      }
      
      // Store in chunk format
      const chunkData = screenshotToolsInstance.getChunkData();
      console.log(`💾 Storing loading sequence with ID: ${sequenceId}`);
      console.log(`📊 ChunkData size before: ${chunkData.size}`);
      chunkData.set(sequenceId, {
        id: sequenceId,
        totalChunks: frames.length,
        chunks: frames,
        metadata: {
          fullPage: false,
          quality,
          timestamp: new Date(),
          frameMetadata // Store frame descriptions
        } as any
      });
      console.log(`📊 ChunkData size after: ${chunkData.size}`);

      // Generate loading sequence analysis
      const analysis = frameMetadata.map((meta, idx) => 
        `   Frame ${idx + 1}: ${meta.timestamp}ms - ${meta.description}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `🎬 Loading sequence captured successfully!\n\n` +
                `📍 URL: ${url}\n` +
                `🎞️ Captured ${frames.length} frames over ${frameMetadata[frameMetadata.length - 1].timestamp}ms\n` +
                `🆔 Sequence ID: ${sequenceId}\n\n` +
                `📊 Loading Timeline:\n${analysis}\n\n` +
                `🔍 View frames with:\n` +
                `   • get_loading_sequence_frame({id: "${sequenceId}", frame: 1}) - Initial state\n` +
                `   • get_loading_sequence_frame({id: "${sequenceId}", frame: ${Math.ceil(frames.length/2)}}) - Mid-load\n` +
                `   • get_loading_sequence_frame({id: "${sequenceId}", frame: ${frames.length}}) - Final state\n\n` +
                `💡 Navigate between frames to see how the page loaded!`
        }]
      };

    } catch (error: any) {
      console.error('❌ Loading sequence capture failed:', error);
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Loading sequence capture failed: ${error.message}\n📍 URL: ${url}` 
        }]
      };
    }
  }

}