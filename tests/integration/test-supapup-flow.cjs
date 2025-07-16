const puppeteer = require('puppeteer');
const path = require('path');

async function testSupapupFlow() {
  console.log('🧪 Testing Complete Supapup Agent Flow...');
  
  let browser, page;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Navigate to ecommerce page
    const filePath = `file://${path.resolve('./examples/ecommerce/index.html')}`;
    console.log(`📍 Navigating to: ${filePath}`);
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    
    // Step 1: Inject agent page script (like Supapup does)
    console.log('💉 Injecting agent page script...');
    
    const agentScript = `
      // Simplified agent page generator
      class AgentPageGenerator {
        static generate() {
          const usedIds = new Set();
          const elements = this.findInteractiveElements();
          const agentElements = elements.map(element => {
            const context = this.getElementContext(element);
            const id = this.generateId(element, context, usedIds);
            const { type, action } = this.getElementTypeAndAction(element);
            
            return { element, id, type, action, description: this.generateDescription(element, context, type), context };
          });

          return {
            elements: agentElements,
            summary: 'Found ' + agentElements.length + ' interactive elements',
            url: window.location.href,
            title: document.title
          };
        }

        static findInteractiveElements() {
          const selectors = ['input:not([type="hidden"])', 'textarea', 'select', 'button', 'a[href]', '[role="button"]', '[onclick]'];
          const elements = [];
          const MAX_ELEMENTS = 50;
          
          for (const selector of selectors) {
            if (elements.length >= MAX_ELEMENTS) break;
            try {
              const found = document.querySelectorAll(selector);
              elements.push(...Array.from(found).slice(0, MAX_ELEMENTS - elements.length));
            } catch (e) { }
          }

          return Array.from(new Set(elements)).filter(el => this.isElementVisible(el)).slice(0, MAX_ELEMENTS);
        }

        static isElementVisible(element) {
          if (!element || !element.offsetParent) return false;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }

        static getElementContext(element) {
          const text = element.textContent && element.textContent.trim();
          if (text && text.length < 30) return text;
          const placeholder = element.getAttribute('placeholder');
          if (placeholder) return placeholder;
          return element.tagName.toLowerCase();
        }

        static generateId(element, context, usedIds) {
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          
          let base = tag;
          if (tag === 'input' && type) base = type + '-input';
          if (tag === 'button') {
            const text = element.textContent && element.textContent.trim().toLowerCase();
            if (text && text.length < 15) {
              base = text.replace(/[^a-z0-9\\s-_]/g, '').replace(/\\s+/g, '-');
            }
          }
          
          let id = base;
          let counter = 1;
          while (usedIds.has(id)) {
            id = base + '-' + counter;
            counter++;
          }
          usedIds.add(id);
          return id;
        }

        static getElementTypeAndAction(element) {
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          
          if (tag === 'input') {
            if (type === 'submit') return { type: 'submit', action: 'click' };
            if (type === 'checkbox') return { type: 'checkbox', action: 'toggle' };
            if (type === 'radio') return { type: 'radio', action: 'toggle' };
            return { type: type || 'text', action: 'fill' };
          }
          if (tag === 'button') return { type: 'button', action: 'click' };
          if (tag === 'select') return { type: 'select', action: 'choose' };
          if (tag === 'textarea') return { type: 'textarea', action: 'fill' };
          if (tag === 'a') return { type: 'link', action: 'click' };
          
          return { type: 'element', action: 'click' };
        }

        static generateDescription(element, context, type) {
          if (context && context.length > 2 && context.length < 30) {
            return context + ' (' + type + ')';
          }
          return type;
        }
      }

      window.AgentPageGenerator = AgentPageGenerator;
      
      // Agent page execution (simplified)
      window.__AGENT_PAGE__ = {
        manifest: null,
        
        execute: function(actionId, params) {
          const manifest = AgentPageGenerator.generate();
          this.manifest = manifest;
          
          // Find element by ID
          const elementData = manifest.elements.find(el => el.id === actionId);
          if (!elementData) {
            throw new Error('Element not found: ' + actionId);
          }
          
          // Execute action
          if (elementData.action === 'click') {
            elementData.element.click();
          }
          
          return { success: true, element: actionId };
        }
      };
      
      console.log('Agent page script injected');
    `;
    
    await page.evaluate(agentScript);
    
    // Step 2: Generate initial agent page
    console.log('📄 Generating initial agent page...');
    const initialManifest = await page.evaluate(() => {
      return window.AgentPageGenerator.generate();
    });
    
    console.log(`📊 Initial elements found: ${initialManifest.elements.length}`);
    console.log('Elements:', initialManifest.elements.map(el => `${el.id} (${el.action})`));
    
    // Step 3: Execute action with DOM change detection
    console.log('🎯 Executing action with DOM change detection...');
    
    const actionResult = await page.evaluate((timeoutMs, initialElementCount) => {
      return new Promise((resolve) => {
        console.log('Starting action execution...');
        
        // First, execute the action
        let actionSuccess = false;
        try {
          const result = window.__AGENT_PAGE__.execute('button', {});
          actionSuccess = true;
          console.log('Action executed successfully:', result);
        } catch (error) {
          console.error('Action failed:', error);
          resolve({ actionSuccess: false, error: error.message });
          return;
        }
        
        // Now start DOM change detection
        let hasChanges = false;
        let debounceTimer;
        
        const observer = new MutationObserver((mutations) => {
          let significantChange = false;
          
          console.log('MutationObserver triggered with', mutations.length, 'mutations');
          
          for (const mutation of mutations) {
            console.log('Mutation:', mutation.type, mutation.target.tagName, mutation.attributeName);
            
            // Detect significant changes
            if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
              significantChange = true;
              console.log('Significant childList change detected');
              break;
            }
            // Detect style/attribute changes
            if (mutation.type === 'attributes' && (
              mutation.attributeName === 'style' || 
              mutation.attributeName === 'class' ||
              mutation.attributeName === 'hidden' ||
              mutation.attributeName === 'disabled'
            )) {
              significantChange = true;
              console.log('Significant attribute change detected:', mutation.attributeName);
              break;
            }
          }
          
          if (significantChange) {
            hasChanges = true;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              observer.disconnect();
              console.log('DOM changes detected, regenerating...');
              
              // Regenerate agent page
              const newManifest = window.AgentPageGenerator.generate();
              console.log('New manifest generated with', newManifest.elements.length, 'elements');
              
              resolve({
                actionSuccess: true,
                changeDetected: true,
                initialElements: initialElementCount,
                newElements: newManifest.elements.length,
                newManifest: newManifest
              });
            }, 500); // 500ms debounce
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'hidden', 'disabled']
        });
        
        console.log('MutationObserver attached, waiting for changes...');
        
        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          console.log('Timeout reached, no changes detected');
          resolve({
            actionSuccess: true,
            changeDetected: hasChanges,
            initialElements: initialElementCount,
            newElements: hasChanges ? window.AgentPageGenerator.generate().elements.length : initialElementCount
          });
        }, timeoutMs);
      });
    }, 2000, initialManifest.elements.length);
    
    console.log('🔬 Action result:', JSON.stringify(actionResult, null, 2));
    
    // Step 4: Manual verification
    console.log('🔍 Manual verification...');
    const finalManifest = await page.evaluate(() => {
      return window.AgentPageGenerator.generate();
    });
    
    console.log(`📊 Final elements found: ${finalManifest.elements.length}`);
    console.log('Final elements:', finalManifest.elements.map(el => `${el.id} (${el.action})`));
    
    // Summary
    console.log('\n📋 SUPAPUP FLOW TEST SUMMARY:');
    console.log(`• Initial elements: ${initialManifest.elements.length}`);
    console.log(`• Action success: ${actionResult.actionSuccess ? '✅' : '❌'}`);
    console.log(`• Change detected: ${actionResult.changeDetected ? '✅' : '❌'}`);
    console.log(`• Final elements: ${finalManifest.elements.length}`);
    console.log(`• Elements increased: ${finalManifest.elements.length > initialManifest.elements.length ? '✅' : '❌'}`);
    
    if (actionResult.changeDetected && finalManifest.elements.length > initialManifest.elements.length) {
      console.log('\n✅ SUPAPUP FLOW IS WORKING CORRECTLY');
      console.log('The issue must be elsewhere in the integration');
    } else {
      console.log('\n❌ SUPAPUP FLOW HAS ISSUES');
      if (!actionResult.changeDetected) {
        console.log('• DOM change detection failed');
      }
      if (finalManifest.elements.length <= initialManifest.elements.length) {
        console.log('• Element count did not increase');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSupapupFlow();