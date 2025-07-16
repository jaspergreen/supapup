async function testNavigation() {
  const { SupapupServer } = await import('./dist/index.js');
  console.log('🧪 Testing agent page generator fix...');
  
  const server = new SupapupServer();
  
  // Mock a navigation request
  const mockRequest = {
    params: {
      name: 'browser_navigate',
      arguments: { url: 'https://www.example.com' }
    }
  };
  
  try {
    // This should test the navigation and agent page generation
    const result = await server.handleToolRequest(mockRequest);
    
    if (result.content[0].text.includes('❌ Navigation failed: Agent page generator not available')) {
      console.log('❌ FAILED: Agent page generator still not available');
    } else if (result.content[0].text.includes('✅ Navigation successful')) {
      console.log('✅ SUCCESS: Navigation worked!');
    } else {
      console.log('🤔 UNKNOWN RESULT:', result.content[0].text.substring(0, 100) + '...');
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  
  process.exit(0);
}

testNavigation();