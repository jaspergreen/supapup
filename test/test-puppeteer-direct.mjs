// Test if puppeteer works directly
import puppeteer from 'puppeteer';

async function test() {
  try {
    console.log('Testing Puppeteer directly...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('Browser launched successfully!');
    
    const page = await browser.newPage();
    await page.goto('https://example.com');
    
    console.log('Navigated to example.com');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await browser.close();
    console.log('Browser closed');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();