#!/usr/bin/env node

// Debug the specific Wikipedia DOM structure issue
import { ContentExtractor } from './dist/content-extractor.js';
import puppeteer from 'puppeteer';

async function debugContentExtraction() {
  console.log('🔍 Debugging Wikipedia content extraction bug...\n');
  
  // Launch browser and get real Wikipedia HTML
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('📥 Fetching Wikipedia AI page...');
    await page.goto('https://en.wikipedia.org/wiki/Artificial_intelligence', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    console.log(`✅ Got HTML (${html.length} chars)`);
    
    // Test 1: Check if we can find the main content selector
    console.log('\n🔍 Test 1: Testing content selectors manually...');
    const contentSelectors = [
      '#mw-content-text',
      '.mw-parser-output', 
      '#content',
      'main',
      '[role="main"]',
      'body'
    ];
    
    for (const selector of contentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const textLength = await page.evaluate(el => el.textContent?.length || 0, element);
          console.log(`✅ ${selector}: Found (${textLength} chars)`);
        } else {
          console.log(`❌ ${selector}: Not found`);
        }
      } catch (error) {
        console.log(`❌ ${selector}: Error - ${error.message}`);
      }
    }
    
    // Test 2: Try content extraction with error handling
    console.log('\n🔍 Test 2: Testing ContentExtractor...');
    try {
      const result = ContentExtractor.extractReadableContent(html, 'https://test.com');
      console.log('✅ Basic extraction succeeded');
      console.log(`Content length: ${result.content.length}`);
      console.log(`First 200 chars: ${result.content.substring(0, 200)}`);
    } catch (error) {
      console.error('❌ Basic extraction failed:', error.message);
      console.error('Stack:', error.stack);
    }
    
    // Test 3: Try chunked extraction
    console.log('\n🔍 Test 3: Testing chunked extraction...');
    try {
      const result = ContentExtractor.extractReadableContent(html, 'https://test.com', {
        page: 1,
        maxElements: 50
      });
      console.log('✅ Chunked extraction succeeded');
      console.log(`Content length: ${result.content.length}`);
      console.log(`Pagination:`, result.pagination);
    } catch (error) {
      console.error('❌ Chunked extraction failed:', error.message);
      console.error('Stack:', error.stack);
    }
    
    // Test 4: Manually debug the extractMainContent method
    console.log('\n🔍 Test 4: Debugging extractMainContent step by step...');
    try {
      const { JSDOM } = await import('jsdom');
      
      console.log('  Creating JSDOM...');
      const dom = new JSDOM(html);
      const document = dom.window.document;
      console.log('  ✅ JSDOM created');
      
      console.log('  Testing selectors on JSDOM...');
      for (const selector of contentSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const textLength = element.textContent?.length || 0;
            console.log(`  ✅ ${selector}: Found (${textLength} chars)`);
            
            // Test querySelectorAll on this element
            const contentElements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, article, section, div[class*="content"], div[class*="text"]');
            console.log(`    📊 Content elements found: ${contentElements.length}`);
            
            if (contentElements.length > 0) {
              console.log(`    ✅ querySelectorAll works on ${selector}`);
              break;
            }
          } else {
            console.log(`  ❌ ${selector}: Not found in JSDOM`);
          }
        } catch (error) {
          console.log(`  ❌ ${selector}: JSDOM Error - ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Manual debug failed:', error.message);
      console.error('Stack:', error.stack);
    }
    
  } finally {
    await browser.close();
  }
}

debugContentExtraction().catch(console.error);