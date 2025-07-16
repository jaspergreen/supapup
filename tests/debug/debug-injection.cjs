// Debug script injection step by step
async function debugInjection() {
  console.log('🔍 Debugging Agent Page Script Injection');
  console.log('=' .repeat(50));
  
  const { BrowserTools } = await import('./dist/browser-tools.js');
  const { AgentPageScript } = await import('./dist/agent-page-script.js');
  const { BrowserRecovery } = await import('./dist/browser-recovery.js');
  
  const browserRecovery = new BrowserRecovery();
  const browserTools = new BrowserTools(browserRecovery);
  
  try {
    console.log('Step 1: Launch browser and navigate');
    
    // Get reference to browser and page before navigation
    const navResult = await browserTools.navigate('https://example.com');
    console.log('Navigation result type:', typeof navResult);
    console.log('Navigation success:', navResult.content[0].text.includes('✅'));
    
    const page = browserTools.getPage();
    if (!page) {
      console.log('❌ No page available after navigation');
      return;
    }
    
    console.log('✅ Page is available');
    
    console.log('\nStep 2: Check what exists in browser after navigation');
    const afterNav = await page.evaluate(() => {
      return {
        hasAgentPageGenerator: typeof window.AgentPageGenerator !== 'undefined',
        hasAgentPage: typeof window.__AGENT_PAGE__ !== 'undefined',
        agentPageGeneratorType: typeof window.AgentPageGenerator,
        windowKeys: Object.keys(window).filter(k => k.includes('Agent')),
        documentReady: document.readyState,
        url: window.location.href
      };
    });
    
    console.log('After navigation state:');
    console.log('  - AgentPageGenerator exists:', afterNav.hasAgentPageGenerator);
    console.log('  - __AGENT_PAGE__ exists:', afterNav.hasAgentPage);
    console.log('  - AgentPageGenerator type:', afterNav.agentPageGeneratorType);
    console.log('  - Window keys with "Agent":', afterNav.windowKeys);
    console.log('  - Document ready state:', afterNav.documentReady);
    console.log('  - URL:', afterNav.url);
    
    console.log('\nStep 3: Try manual script injection');
    const script = AgentPageScript.generate();
    console.log('Script length:', script.length);
    console.log('Script includes class definition:', script.includes('class AgentPageGenerator'));
    
    try {
      await page.evaluate(script);
      console.log('✅ Manual script injection succeeded');
    } catch (scriptError) {
      console.log('❌ Manual script injection failed:', scriptError.message);
    }
    
    console.log('\nStep 4: Check what exists after manual injection');
    const afterManual = await page.evaluate(() => {
      return {
        hasAgentPageGenerator: typeof window.AgentPageGenerator !== 'undefined',
        agentPageGeneratorKeys: window.AgentPageGenerator ? Object.keys(window.AgentPageGenerator) : [],
        hasGenerateMethod: window.AgentPageGenerator && typeof window.AgentPageGenerator.generate === 'function'
      };
    });
    
    console.log('After manual injection:');
    console.log('  - AgentPageGenerator exists:', afterManual.hasAgentPageGenerator);
    console.log('  - AgentPageGenerator keys:', afterManual.agentPageGeneratorKeys);
    console.log('  - Has generate method:', afterManual.hasGenerateMethod);
    
    console.log('\nStep 5: Try calling generate method');
    if (afterManual.hasGenerateMethod) {
      try {
        const manifest = await page.evaluate(() => {
          return window.AgentPageGenerator.generate();
        });
        console.log('✅ Generate method works! Elements found:', manifest.elements?.length || 0);
      } catch (genError) {
        console.log('❌ Generate method failed:', genError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Debug error:', error.message);
    console.log('Stack:', error.stack);
  } finally {
    await browserTools.closeBrowser();
  }
}

debugInjection().catch(console.error);