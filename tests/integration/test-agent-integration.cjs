// Test agent tools integration after navigation
async function testAgentIntegration() {
  console.log('🧪 Testing Agent Tools Integration After Navigation');
  console.log('=' .repeat(50));
  
  const { BrowserTools } = await import('./dist/browser-tools.js');
  const { AgentTools } = await import('./dist/agent-tools.js');
  const { BrowserRecovery } = await import('./dist/browser-recovery.js');
  
  const browserRecovery = new BrowserRecovery();
  const browserTools = new BrowserTools(browserRecovery);
  const agentTools = new AgentTools();
  
  try {
    // Step 1: Navigate to Google
    console.log('📍 Step 1: Navigating to Google...');
    const navResult = await browserTools.navigate('https://www.google.com');
    console.log('Navigation result:', navResult.content[0].text.substring(0, 100) + '...');
    
    // Step 2: Check if manifest is available in browser tools
    const manifest = browserTools.getCurrentManifest();
    console.log('📋 Step 2: Manifest available in BrowserTools:', !!manifest);
    if (manifest) {
      console.log('   - Actions count:', manifest.actions?.length || 0);
      console.log('   - Elements count:', manifest.elements?.length || 0);
    }
    
    // Step 3: Initialize agent tools with the manifest
    console.log('🔧 Step 3: Initializing AgentTools...');
    agentTools.initialize(browserTools.getPage(), manifest);
    
    // Step 4: Test agent tools functions
    console.log('🎯 Step 4: Testing agent tools functions...');
    
    // Test page state
    try {
      const stateResult = await agentTools.getPageState();
      console.log('✅ Page state works:', stateResult.content[0].text.includes('google.com'));
    } catch (error) {
      console.log('❌ Page state error:', error.message);
    }
    
    // Test discover actions
    try {
      const actionsResult = await agentTools.discoverActions();
      console.log('✅ Discover actions works:', actionsResult.content[0].text.includes('actions'));
    } catch (error) {
      console.log('❌ Discover actions error:', error.message);
    }
    
    // Test generate page (this should work independently)
    try {
      const genResult = await agentTools.generatePage(true, 'auto');
      console.log('✅ Generate page works:', genResult.content[0].text.includes('ENHANCED AGENT PAGE'));
    } catch (error) {
      console.log('❌ Generate page error:', error.message);
    }
    
    // Step 5: Check what the browser script actually creates
    console.log('🔍 Step 5: Checking browser script injection...');
    const scriptCheck = await browserTools.getPage().evaluate(() => {
      return {
        hasAgentPageGenerator: typeof window.AgentPageGenerator !== 'undefined',
        hasAgentPage: typeof window.__AGENT_PAGE__ !== 'undefined',
        agentPageGeneratorMethods: window.AgentPageGenerator ? Object.keys(window.AgentPageGenerator) : [],
        elements: document.querySelectorAll('[data-mcp-id]').length
      };
    });
    
    console.log('Script check results:');
    console.log('   - AgentPageGenerator available:', scriptCheck.hasAgentPageGenerator);
    console.log('   - __AGENT_PAGE__ available:', scriptCheck.hasAgentPage);
    console.log('   - AgentPageGenerator methods:', scriptCheck.agentPageGeneratorMethods);
    console.log('   - Elements with data-mcp-id:', scriptCheck.elements);
    
    // Step 6: Try to generate fresh manifest
    if (scriptCheck.hasAgentPageGenerator) {
      console.log('🔄 Step 6: Generating fresh manifest in browser...');
      const freshManifest = await browserTools.getPage().evaluate(() => {
        try {
          return window.AgentPageGenerator.generate();
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('Fresh manifest result:');
      if (freshManifest.error) {
        console.log('   ❌ Error:', freshManifest.error);
      } else {
        console.log('   ✅ Elements found:', freshManifest.elements?.length || 0);
        console.log('   ✅ URL:', freshManifest.url);
      }
    }
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
  } finally {
    await browserTools.closeBrowser();
  }
}

testAgentIntegration().catch(console.error);