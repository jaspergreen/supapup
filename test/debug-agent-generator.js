import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function debugAgentGenerator() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Load the agent page generator script
  const scriptPath = path.join(__dirname, 'src/agent-page-generator.js');
  const agentScript = fs.readFileSync(scriptPath, 'utf8');
  
  try {
    // Navigate to a simple test page
    await page.goto('https://example.com');
    
    // Inject the script
    console.log('Injecting AgentPageGenerator script...');
    await page.addScriptTag({ content: agentScript });
    
    // Test the generator
    console.log('Testing AgentPageGenerator...');
    const result = await page.evaluate(() => {
      try {
        console.log('Window keys containing Agent:', Object.keys(window).filter(k => k.includes('Agent')));
        console.log('AgentPageGenerator exists:', !!window.AgentPageGenerator);
        
        if (!window.AgentPageGenerator) {
          return { error: 'AgentPageGenerator not found' };
        }
        
        console.log('AgentPageGenerator methods:', Object.keys(window.AgentPageGenerator));
        
        if (typeof window.AgentPageGenerator.generate !== 'function') {
          return { error: 'generate method not found', type: typeof window.AgentPageGenerator.generate };
        }
        
        console.log('About to call generate()...');
        const manifest = window.AgentPageGenerator.generate();
        console.log('Generated manifest:', !!manifest);
        
        if (!manifest) {
          return { error: 'generate() returned falsy value' };
        }
        
        console.log('Manifest elements:', manifest.elements?.length);
        
        return { 
          success: true, 
          elementCount: manifest.elements?.length || 0,
          manifestKeys: Object.keys(manifest)
        };
      } catch (error) {
        console.error('Error in page evaluation:', error);
        return { 
          error: error.message, 
          stack: error.stack,
          name: error.name
        };
      }
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

debugAgentGenerator().catch(console.error);