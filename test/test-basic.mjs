import puppeteer from 'puppeteer';

(async () => {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    console.log('Browser launched!');
    
    const page = await browser.newPage();
    console.log('Page created!');
    
    await page.setContent('<h1>Hello World</h1>');
    console.log('Content set!');
    
    const title = await page.evaluate(() => document.querySelector('h1').textContent);
    console.log('Page title:', title);
    
  } catch (error) {
    console.error('Full error:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
})();