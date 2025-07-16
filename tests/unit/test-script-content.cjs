async function testScriptContent() {
  console.log('🧪 Testing Agent Page Script Content');
  
  const { AgentPageScript } = await import('./dist/agent-page-script.js');
  
  const script = AgentPageScript.generate();
  
  console.log('Script length:', script.length);
  console.log('Contains AgentPageGenerator class:', script.includes('class AgentPageGenerator'));
  console.log('Contains window.AgentPageGenerator:', script.includes('window.AgentPageGenerator'));
  console.log('Contains generate method:', script.includes('static generate()'));
  console.log('Contains window.__AGENT_PAGE__:', script.includes('window.__AGENT_PAGE__'));
  
  // Extract the first 500 chars to see structure
  console.log('\nFirst 500 chars:');
  console.log(script.substring(0, 500));
  
  // Look for the class definition
  const classMatch = script.match(/class AgentPageGenerator \{[\s\S]*?\}/);
  if (classMatch) {
    console.log('\nFound class definition (first 300 chars):');
    console.log(classMatch[0].substring(0, 300));
  } else {
    console.log('\n❌ No class definition found!');
  }
}

testScriptContent().catch(console.error);