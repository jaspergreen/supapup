// This file demonstrates the selector generation bug and a potential fix

import puppeteer from 'puppeteer';

async function demonstrateBug() {
  console.log('=== DEMONSTRATING SELECTOR GENERATION BUG ===\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get the actual DOM structure
  const domAnalysis = await page.evaluate(() => {
    const results = {
      totalInputs: document.querySelectorAll('input').length,
      submitButtons: document.querySelectorAll('input[type="submit"]').length,
      textareas: document.querySelectorAll('textarea').length,
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a').length
    };
    
    // Find the search box
    const searchBox = document.querySelector('textarea[name="q"]');
    const searchButton = document.querySelector('input[name="btnK"]');
    
    results.searchBox = {
      found: !!searchBox,
      tagName: searchBox?.tagName,
      name: searchBox?.getAttribute('name'),
      actualSelector: 'textarea[name="q"]'
    };
    
    results.searchButton = {
      found: !!searchButton,
      tagName: searchButton?.tagName,
      name: searchButton?.getAttribute('name'),
      type: searchButton?.getAttribute('type'),
      actualSelector: 'input[name="btnK"]'
    };
    
    return results;
  });
  
  console.log('Actual DOM Analysis:', JSON.stringify(domAnalysis, null, 2));
  
  // Test current selector generation
  const pageContent = await page.content();
  const { HTMLParser } = await import('./dist/html-parser.js');
  const manifest = await HTMLParser.generateManifestFromHTML(pageContent, 'https://www.google.com');
  
  console.log('\nFirst 5 manifest elements:');
  manifest.elements.slice(0, 5).forEach((el, i) => {
    console.log(`${i}: type="${el.type}", id="${el.id}"`);
  });
  
  // Extract selectors from generated script
  const attributeScript = HTMLParser.generateAttributeScript(manifest);
  const selectors = attributeScript.match(/querySelector\('([^']+)'\)/g)
    ?.map(s => s.match(/querySelector\('([^']+)'\)/)[1])
    .slice(0, 5);
    
  console.log('\nGenerated selectors:');
  selectors?.forEach((sel, i) => console.log(`${i}: ${sel}`));
  
  // Test if selectors actually work
  console.log('\nTesting selectors in browser:');
  for (let i = 0; i < Math.min(5, selectors?.length || 0); i++) {
    const selector = selectors[i];
    const result = await page.evaluate((sel) => {
      try {
        const el = document.querySelector(sel);
        return {
          selector: sel,
          found: !!el,
          tagName: el?.tagName,
          type: el?.getAttribute('type'),
          name: el?.getAttribute('name')
        };
      } catch (e) {
        return { selector: sel, error: e.message };
      }
    }, selector);
    console.log(`  ${i}: ${JSON.stringify(result)}`);
  }
  
  await browser.close();
  
  console.log('\n=== PROPOSED FIX ===\n');
  console.log('The issue is that nth-of-type selectors are using wrong indices.');
  console.log('Instead of div:nth-of-type(1) for a submit button, we need:');
  console.log('1. Better type mapping (submit → input[type="submit"])');
  console.log('2. Use unique attributes when available (name, id, etc.)');
  console.log('3. Track actual nth-of-type counts per element type');
}

demonstrateBug().catch(console.error);