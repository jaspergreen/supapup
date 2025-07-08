/**
 * Basic Supapup Usage Example
 * 
 * This example demonstrates:
 * - Navigating to a page
 * - Using the agent page representation
 * - Executing actions on elements
 * - Taking screenshots
 * - Using the visual element mapper
 */

// This example assumes Supapup is running as an MCP server
// and you're using it through an MCP client like Claude Desktop

// Example 1: Basic Navigation and Interaction
async function basicWebAutomation() {
  // Navigate to a website
  await navigate({ url: 'https://example.com' });

  // The agent page will show semantic IDs for all interactive elements
  // For example: search-input, login-button, etc.

  // Fill in a form field using its semantic ID
  await execute_action({
    actionId: 'search-input',
    params: { value: 'artificial intelligence' }
  });

  // Click a button
  await execute_action({
    actionId: 'search-button'
  });

  // Take a screenshot
  await screenshot({ name: 'search-results' });
}

// Example 2: Visual Element Mapping
async function visualElementInteraction() {
  // Navigate to a complex page
  await navigate({ url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' });

  // Create a visual map with numbered elements
  await devtools_visual_element_map();

  // Now you can interact with elements by number
  await evaluate_script({
    script: `
      // Click element number 5
      window.__AGENT_PAGE__.clickElement(5);
      
      // Fill element 10 with text
      window.__AGENT_PAGE__.fillElement(10, "test input");
      
      // Highlight element 20 for 3 seconds
      window.__AGENT_PAGE__.highlightElement(20, 3000);
    `
  });
}

// Example 3: Network Monitoring
async function monitorNetworkRequests() {
  // Start monitoring
  await navigate({ url: 'https://api.example.com/app' });

  // Perform some actions that trigger API calls
  await execute_action({ actionId: 'load-data-button' });

  // Get API logs
  const apiLogs = await get_api_logs({
    urlPattern: 'api.example.com',
    method: 'POST'
  });

  // Replay a request with modifications
  if (apiLogs.logs.length > 0) {
    const firstRequest = apiLogs.logs[0];
    await replay_api_request({
      url: firstRequest.url,
      headers: {
        ...firstRequest.request.headers,
        'X-Custom-Header': 'Modified'
      },
      payload: {
        ...firstRequest.request.payload,
        modified: true
      }
    });
  }
}

// Example 4: Debugging JavaScript
async function debugJavaScript() {
  await navigate({ url: 'https://example.com' });

  // Set a breakpoint in JavaScript
  await set_breakpoint({
    lineNumber: 42,
    url: 'https://example.com/app.js',
    condition: 'userId === 123'
  });

  // Trigger the function that hits the breakpoint
  await execute_action({ actionId: 'trigger-function-button' });

  // Get variables at breakpoint
  const variables = await debug_get_variables();
  console.log('Local variables:', variables);

  // Evaluate expression in debug context
  const result = await debug_evaluate({
    expression: 'userData.permissions'
  });

  // Continue execution
  await debug_continue();
}

// Example 5: Performance Analysis
async function analyzePerformance() {
  await navigate({ url: 'https://heavy-website.com' });

  // Get performance metrics
  const metrics = await get_performance_metrics();
  console.log('Load time:', metrics.timing.totalLoadTime);
  console.log('DOM nodes:', metrics.puppeteer.DOMNodes);

  // Get accessibility tree
  const a11y = await get_accessibility_tree();
  console.log('Accessibility issues:', a11y.issues);
}

// Example 6: Handling Dynamic Content
async function handleDynamicContent() {
  await navigate({ url: 'https://spa-website.com' });

  // Execute action and wait for changes
  await execute_action({
    actionId: 'load-more-button',
    waitForChanges: true
  });

  // Or explicitly wait for specific changes
  await execute_action({ actionId: 'filter-button' });
  await wait_for_changes({
    waitForSelector: '.results-loaded',
    timeout: 5000
  });

  // The updated agent page is automatically returned
}

// Example 7: Working with Large Pages
async function handleLargePages() {
  await navigate({ url: 'https://very-long-page.com' });

  // If page has too many elements, they're automatically paginated
  // Get the next batch of elements
  const batch2 = await get_agent_page_chunk({ page: 2 });

  // Take a full page screenshot (automatically chunked if too large)
  const screenshot = await screenshot({
    fullPage: true,
    quality: 50
  });

  // If screenshot was chunked, get specific chunks
  if (screenshot.chunked) {
    const chunk1 = await screenshot_chunk({
      id: screenshot.id,
      chunk: 1
    });
  }
}

// Example 8: Opening Content in Browser Tabs
async function openInNewTab() {
  // Generate a report and open it in a new tab
  const htmlReport = `
    <html>
      <head><title>Automation Report</title></head>
      <body>
        <h1>Test Results</h1>
        <p>All tests passed!</p>
      </body>
    </html>
  `;

  await open_in_tab({
    content: htmlReport,
    contentType: 'text/html',
    title: 'Test Report'
  });

  // Open JSON data in a tab
  const jsonData = { results: [1, 2, 3], status: 'success' };
  await open_in_tab({
    content: JSON.stringify(jsonData, null, 2),
    contentType: 'application/json',
    title: 'API Response'
  });
}