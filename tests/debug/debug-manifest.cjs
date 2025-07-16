const puppeteer = require('puppeteer');

async function debugManifest() {
  console.log('🚀 Starting debug manifest test...');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('📍 Navigating to W3Schools forms page...');
    await page.goto('https://www.w3schools.com/html/html_forms.asp');
    
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simple wait
    
    console.log('💉 Injecting agent page script...');
    // This is similar to what the agent page generator does
    await page.evaluate(() => {
      // Simple element detector
      const elements = [];
      const interactiveSelectors = [
        'input',
        'button',
        'select',
        'textarea',
        'a[href]',
        '[role="button"]',
        '[onclick]',
        '[onsubmit]'
      ];
      
      interactiveSelectors.forEach(selector => {
        const foundElements = document.querySelectorAll(selector);
        foundElements.forEach((element, index) => {
          if (element.offsetParent !== null) { // Check if visible
            const id = `${selector.replace(/[\[\]]/g, '').replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
            elements.push({
              id,
              tagName: element.tagName,
              type: element.type || 'unknown',
              text: element.textContent?.trim() || element.value || '',
              selector,
              visible: true
            });
          }
        });
      });
      
      window.debugManifest = {
        elements,
        count: elements.length
      };
    });
    
    const result = await page.evaluate(() => window.debugManifest);
    
    console.log('🔍 Manifest debug results:');
    console.log('- Total elements found:', result.count);
    console.log('- Elements breakdown:');
    
    const breakdown = {};
    result.elements.forEach(el => {
      const key = `${el.tagName}[${el.type}]`;
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    
    Object.entries(breakdown).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
    
    console.log('\n📋 First 10 elements:');
    result.elements.slice(0, 10).forEach(el => {
      console.log(`  ${el.id}: ${el.tagName}[${el.type}] - "${el.text.slice(0, 30)}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugManifest().catch(console.error);