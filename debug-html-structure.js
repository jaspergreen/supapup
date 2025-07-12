#!/usr/bin/env node

// Debug the actual HTML structure without modifying it
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

async function debugHtmlStructure() {
  console.log('🔍 Analyzing Wikipedia HTML structure...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://en.wikipedia.org/wiki/Artificial_intelligence', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    console.log(`📄 HTML length: ${html.length} chars\n`);
    
    // Test 1: Check raw HTML structure
    console.log('🔍 Test 1: Checking main content containers in raw HTML...');
    const mainContentSelectors = ['#mw-content-text', '.mw-parser-output', '#content', 'main', 'body'];
    
    for (const selector of mainContentSelectors) {
      const regex = new RegExp(`<[^>]*id=["']?${selector.replace('#', '')}`, 'i');
      const classRegex = new RegExp(`<[^>]*class=["'][^"']*${selector.replace('.', '')}`, 'i');
      const found = regex.test(html) || classRegex.test(html);
      console.log(`  ${selector}: ${found ? '✅ Found in HTML' : '❌ Not found'}`);
    }
    
    // Test 2: Create JSDOM and check what happens
    console.log('\n🔍 Test 2: Testing JSDOM parsing...');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    console.log('  JSDOM created successfully');
    console.log(`  Document has ${document.children.length} root children`);
    console.log(`  Document.documentElement: ${document.documentElement ? 'EXISTS' : 'NULL'}`);
    console.log(`  Document.body: ${document.body ? 'EXISTS' : 'NULL'}`);
    
    if (document.body) {
      console.log(`  Body children: ${document.body.children.length}`);
      console.log(`  Body text length: ${document.body.textContent?.length || 0}`);
    }
    
    // Test 3: Check each selector in JSDOM
    console.log('\n🔍 Test 3: Testing selectors in JSDOM...');
    for (const selector of mainContentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const textLength = element.textContent?.length || 0;
          const childCount = element.children.length;
          console.log(`  ✅ ${selector}: Found (${textLength} chars, ${childCount} children)`);
          
          // Show some sample content
          const sampleText = element.textContent?.trim().substring(0, 100) || '';
          console.log(`    Sample: "${sampleText}..."`);
        } else {
          console.log(`  ❌ ${selector}: Not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${selector}: Error - ${error.message}`);
      }
    }
    
    // Test 4: Check specific Wikipedia elements
    console.log('\n🔍 Test 4: Checking Wikipedia-specific elements...');
    const wikiSelectors = ['#mw-content-text .mw-parser-output', '#bodyContent', '.mw-body-content'];
    
    for (const selector of wikiSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const textLength = element.textContent?.length || 0;
          console.log(`  ✅ ${selector}: Found (${textLength} chars)`);
        } else {
          console.log(`  ❌ ${selector}: Not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${selector}: Error - ${error.message}`);
      }
    }
    
    // Test 5: Look for the actual content paragraphs
    console.log('\n🔍 Test 5: Looking for content paragraphs...');
    const paragraphs = document.querySelectorAll('p');
    console.log(`  Found ${paragraphs.length} paragraph elements`);
    
    if (paragraphs.length > 0) {
      for (let i = 0; i < Math.min(5, paragraphs.length); i++) {
        const p = paragraphs[i];
        const text = p.textContent?.trim() || '';
        if (text.length > 50) {
          console.log(`  P${i+1}: "${text.substring(0, 80)}..."`);
        }
      }
    }
    
    // Test 6: Check if we can extract text without removing elements
    console.log('\n🔍 Test 6: Testing content extraction without DOM modification...');
    try {
      const contentElement = document.querySelector('#mw-content-text') || document.body;
      if (contentElement) {
        // Get all text content without modifying DOM
        const allText = contentElement.textContent || '';
        console.log(`  ✅ Raw text extraction: ${allText.length} chars`);
        
        // Get paragraph text specifically
        const paragraphTexts = Array.from(contentElement.querySelectorAll('p'))
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 20);
        
        console.log(`  ✅ Found ${paragraphTexts.length} substantial paragraphs`);
        if (paragraphTexts.length > 0) {
          console.log(`  First paragraph: "${paragraphTexts[0]?.substring(0, 100)}..."`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Content extraction failed: ${error.message}`);
    }
    
  } finally {
    await browser.close();
  }
}

debugHtmlStructure().catch(console.error);