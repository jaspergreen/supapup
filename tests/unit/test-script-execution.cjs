async function testScriptExecution() {
  console.log('🧪 Testing Script Execution in Browser');
  
  const { BrowserTools } = await import('./dist/browser-tools.js');
  const { AgentPageScript } = await import('./dist/agent-page-script.js');
  const { BrowserRecovery } = await import('./dist/browser-recovery.js');
  
  const browserRecovery = new BrowserRecovery();
  const browserTools = new BrowserTools(browserRecovery);
  
  try {
    // Navigate to a simple page
    console.log('📍 Navigating to example.com...');
    await browserTools.navigate('https://example.com');
    
    const page = browserTools.getPage();
    
    // Execute the script manually
    console.log('💉 Injecting script manually...');
    const script = AgentPageScript.generate();
    await page.evaluate(script);
    
    // Check what was created
    console.log('🔍 Checking what was created...');
    const result = await page.evaluate(() => {
      const results = {
        hasAgentPageGenerator: typeof window.AgentPageGenerator !== 'undefined',
        agentPageGeneratorType: typeof window.AgentPageGenerator,
        agentPageGeneratorKeys: window.AgentPageGenerator ? Object.getOwnPropertyNames(window.AgentPageGenerator) : [],
        hasGenerateMethod: window.AgentPageGenerator && typeof window.AgentPageGenerator.generate === 'function',
        hasAgentPage: typeof window.__AGENT_PAGE__ !== 'undefined'
      };
      
      // Try to call generate
      if (results.hasGenerateMethod) {
        try {
          const manifest = window.AgentPageGenerator.generate();
          results.generateResult = {
            success: true,
            elementsCount: manifest.elements?.length || 0,
            url: manifest.url,
            summary: manifest.summary
          };
        } catch (error) {
          results.generateResult = {
            success: false,
            error: error.message
          };
        }
      }
      
      return results;
    });
    
    console.log('Results:');
    console.log('- AgentPageGenerator exists:', result.hasAgentPageGenerator);
    console.log('- AgentPageGenerator type:', result.agentPageGeneratorType);
    console.log('- AgentPageGenerator keys:', result.agentPageGeneratorKeys);
    console.log('- Has generate method:', result.hasGenerateMethod);
    console.log('- Has __AGENT_PAGE__:', result.hasAgentPage);
    
    if (result.generateResult) {
      console.log('- Generate call result:');
      if (result.generateResult.success) {
        console.log('  ✅ Success! Elements found:', result.generateResult.elementsCount);
        console.log('  📍 URL:', result.generateResult.url);
        console.log('  📄 Summary:', result.generateResult.summary);
      } else {
        console.log('  ❌ Error:', result.generateResult.error);
      }
    }
    
    // Check if elements are tagged
    const taggedElements = await page.evaluate(() => {
      return document.querySelectorAll('[data-mcp-id]').length;
    });
    console.log('- Elements with data-mcp-id:', taggedElements);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await browserTools.closeBrowser();
  }
}

testScriptExecution().catch(console.error);