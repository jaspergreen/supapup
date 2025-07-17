// Use dynamic import for ES modules

async function testVisualElementMap() {
  console.log('🧪 Testing devtools_visual_element_map functionality...');
  
  const { SupapupServer } = await import('./dist/core/index.js');
  const server = new SupapupServer();
  
  try {
    // Navigate to a test page
    console.log('📍 Navigating to example.com...');
    const navResult = await server.callTool('browser_navigate', { url: 'https://example.com' });
    console.log('✅ Navigation result:', navResult.content[0].text.substring(0, 100) + '...');
    
    // Test the visual element map
    console.log('🗺️ Creating visual element map...');
    const mapResult = await server.callTool('devtools_visual_element_map', {});
    
    console.log('📊 Visual element map results:');
    console.log('- Content items:', mapResult.content.length);
    
    mapResult.content.forEach((item, index) => {
      if (item.type === 'image') {
        console.log(`- Item ${index}: Image (${item.data.length} chars)`);
      } else if (item.type === 'text') {
        console.log(`- Item ${index}: Text`);
        console.log(item.text);
      }
    });
    
    // Test if the functions mentioned in the output actually work
    console.log('\n🔍 Testing interaction methods...');
    
    // Check if the response mentions execute_action (should)
    const textContent = mapResult.content.find(item => item.type === 'text')?.text || '';
    const hasExecuteAction = textContent.includes('execute_action');
    const hasOldHelpers = textContent.includes('window.__AGENT_PAGE__.clickElement');
    
    console.log('✅ Response mentions execute_action:', hasExecuteAction);
    console.log('❌ Response mentions old helper functions:', hasOldHelpers);
    
    if (hasExecuteAction && !hasOldHelpers) {
      console.log('🎉 SUCCESS: Visual element map now uses correct MCP tools!');
    } else {
      console.log('⚠️ ISSUE: Visual element map still has problems');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up
    try {
      await server.callTool('browser_close', {});
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testVisualElementMap().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});