const puppeteer = require('puppeteer');
const path = require('path');

async function testDOMMutationDetection() {
  console.log('🧪 Testing DOM Mutation Detection...');
  
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
    
    // Inject our DOM mutation detector
    await page.evaluate(() => {
      window.mutationDetected = false;
      window.mutationDetails = [];
      
      // Create MutationObserver to detect changes
      const observer = new MutationObserver((mutations) => {
        console.log(`🔄 MutationObserver triggered with ${mutations.length} mutations`);
        
        for (const mutation of mutations) {
          const detail = {
            type: mutation.type,
            target: mutation.target.tagName || 'unknown',
            addedNodes: mutation.addedNodes.length,
            removedNodes: mutation.removedNodes.length,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue
          };
          
          console.log('Mutation detail:', detail);
          window.mutationDetails.push(detail);
          
          // Check for significant changes
          if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
            console.log('✅ Significant childList change detected');
            window.mutationDetected = true;
          }
          
          if (mutation.type === 'attributes' && (
            mutation.attributeName === 'style' || 
            mutation.attributeName === 'class' ||
            mutation.attributeName === 'hidden' ||
            mutation.attributeName === 'disabled'
          )) {
            console.log('✅ Significant attribute change detected:', mutation.attributeName);
            window.mutationDetected = true;
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['style', 'class', 'hidden', 'disabled']
      });
      
      console.log('🔍 MutationObserver attached and monitoring...');
      return 'Observer ready';
    });
    
    // Check initial form visibility
    const initialFormVisible = await page.evaluate(() => {
      const loginSection = document.getElementById('loginSection');
      const isVisible = loginSection && window.getComputedStyle(loginSection).display !== 'none';
      console.log(`📋 Initial form visibility: ${isVisible}`);
      return isVisible;
    });
    
    console.log(`📋 Form initially visible: ${initialFormVisible}`);
    
    // Reset mutation detection
    await page.evaluate(() => {
      window.mutationDetected = false;
      window.mutationDetails = [];
    });
    
    console.log('🖱️ Clicking "Login to Shop" button...');
    
    // Click the button and wait for mutations
    const clickResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const button = document.getElementById('showLoginBtn');
        if (!button) {
          resolve({ error: 'Button not found' });
          return;
        }
        
        // Set up timeout to check for mutations
        setTimeout(() => {
          resolve({
            mutationDetected: window.mutationDetected,
            mutationCount: window.mutationDetails.length,
            mutations: window.mutationDetails
          });
        }, 1000); // Wait 1 second for mutations
        
        // Click the button
        console.log('Clicking button...');
        button.click();
      });
    });
    
    console.log('📊 Click result:', JSON.stringify(clickResult, null, 2));
    
    // Check final form visibility
    const finalFormVisible = await page.evaluate(() => {
      const loginSection = document.getElementById('loginSection');
      const isVisible = loginSection && window.getComputedStyle(loginSection).display !== 'none';
      console.log(`📋 Final form visibility: ${isVisible}`);
      return isVisible;
    });
    
    console.log(`📋 Form finally visible: ${finalFormVisible}`);
    
    // Count interactive elements before and after
    const elementCount = await page.evaluate(() => {
      const selectors = [
        'input:not([type="hidden"])', 
        'textarea', 
        'select', 
        'button', 
        'a[href]', 
        '[role="button"]', 
        '[onclick]'
      ];
      
      let count = 0;
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        const visibleElements = Array.from(elements).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        });
        count += visibleElements.length;
      }
      return count;
    });
    
    console.log(`🎯 Total interactive elements now visible: ${elementCount}`);
    
    // Test our enhanced mutation detection from agent-tools
    console.log('🔬 Testing enhanced mutation detection...');
    
    // Reset the page state
    await page.reload({ waitUntil: 'networkidle0' });
    
    const enhancedTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        let hasChanges = false;
        let debounceTimer;
        
        // Enhanced MutationObserver
        const observer = new MutationObserver((mutations) => {
          let significantChange = false;
          
          for (const mutation of mutations) {
            console.log('Enhanced observer - mutation:', mutation.type, mutation.target.tagName);
            
            // Detect significant changes
            if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
              significantChange = true;
              console.log('Enhanced: Significant childList change');
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
              console.log('Enhanced: Significant attribute change');
              break;
            }
          }
          
          if (significantChange) {
            hasChanges = true;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              observer.disconnect();
              resolve({ success: true, hasChanges: true });
            }, 500); // 500ms debounce
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'hidden', 'disabled']
        });
        
        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve({ success: true, hasChanges });
        }, 2000);
        
        // Click the button
        setTimeout(() => {
          const button = document.getElementById('showLoginBtn');
          if (button) {
            console.log('Enhanced test: Clicking button...');
            button.click();
          }
        }, 100);
      });
    });
    
    console.log('🔬 Enhanced test result:', JSON.stringify(enhancedTest, null, 2));
    
    // Final summary
    console.log('\n📋 TEST SUMMARY:');
    console.log(`• Form visibility change: ${!initialFormVisible} → ${finalFormVisible}`);
    console.log(`• Mutation detection: ${clickResult.mutationDetected ? '✅' : '❌'}`);
    console.log(`• Mutation count: ${clickResult.mutationCount}`);
    console.log(`• Enhanced detection: ${enhancedTest.hasChanges ? '✅' : '❌'}`);
    console.log(`• Interactive elements: ${elementCount}`);
    
    if (clickResult.mutationDetected && enhancedTest.hasChanges) {
      console.log('\n✅ DOM MUTATION DETECTION IS WORKING CORRECTLY');
    } else {
      console.log('\n❌ DOM MUTATION DETECTION NEEDS DEBUGGING');
      console.log('Mutation details:', clickResult.mutations);
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
testDOMMutationDetection();