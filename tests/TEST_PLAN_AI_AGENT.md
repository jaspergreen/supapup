papup AI Agent Test Plan

## Overview
This test plan is designed for AI agents to systematically test all 52 Supapup tools. The goal is to identify bugs, unclear interfaces, high cognitive load areas, and ensure the tool empowers AI coding assistants to perform web-based browser testing and debugging effectively.

## Test Environment Setup

### Pre-test Requirements
1. Uninstall any existing Supapup version: `npm uninstall -g supapup`
2. Build the latest version: `npm run build`
3. Create package: `npm pack`
4. Install fresh: `npm install -g ./supapup-[version].tgz`
5. Verify MCP connection: Check `/mcp` shows Supapup as connected

### Success Criteria
- Tool executes without errors
- Output is clear and actionable for AI agents
- Cognitive load is reasonable (no excessive parameters or complex sequences)
- Results are predictable and consistent

## Test Execution Plan

**Note**: For optimal performance and minimal distraction, all tests after Phase 1 should be run in headless mode using:
```
browser_set_visibility({visible: false, restart: true})
```
Only Phase 1 and Phase 15 (Browser Visibility Control) require visible browser testing.

### Phase 1: Browser Management (7 tools)

#### 1.1 browser_navigate
```
Test: Navigate to https://example.com
Expected: Agent page view with structured elements
Cognitive Check: Is the output format immediately understandable?
```

#### 1.2 browser_navigate with visibility control
```
Test: Navigate with explicit visibility setting
Input: {url: "https://example.com", visible: false}
Expected: Navigation successful, browser runs in headless mode
Cognitive Check: Does the visible parameter work intuitively?
```

#### 1.3 browser_set_visibility
```
Test A: Switch to headless mode
Input: {visible: false, restart: true}
Expected: Clear confirmation of mode change and browser restart

Test B: Switch to visible mode
Input: {visible: true, restart: true}
Expected: Clear confirmation of mode change and browser restart

Test C: Change without restart
Input: {visible: false, restart: false}
Expected: Warning that restart is needed to apply changes

Cognitive Check: Are the visibility changes clear and predictable?
```

#### 1.4 browser_list_tabs
```
Prerequisite: Have browser open from previous tests
Test: List all open tabs
Expected: Clear list with indices and URLs
```

#### 1.5 browser_open_in_tab
```
Test: Open HTML content "<h1>Test Page</h1>" in new tab
Expected: Confirmation of tab opened
```

#### 1.6 browser_switch_tab
```
Prerequisite: Multiple tabs from previous tests
Test: Switch to tab index 0
Expected: Confirmation with tab details
```

#### 1.7 browser_close
```
Test: Close browser
Expected: Clean shutdown confirmation
Note: Re-launch for next phase
```

**Switch to Headless Mode for Remaining Tests:**
```
Before starting Phase 2, run:
browser_set_visibility({visible: false, restart: true})

This will:
- Speed up test execution significantly
- Reduce visual distractions
- Allow tests to run in CI/automation environments
- Demonstrate headless mode reliability
```

### Phase 2: Element Interaction (4 tools)

#### 2.1 agent_execute_action
```
Setup: Navigate to https://www.google.com
Test: Execute action on search textarea (use actionId from agent page)
Input: {actionId: "[search_field_id]", params: {value: "test search"}}
Expected: Confirmation and updated agent page
Cognitive Check: Is finding the right actionId intuitive?
```

#### 2.2 agent_discover_actions
```
Test: Discover all available actions
Expected: Categorized list of actionable elements
```

#### 2.3 agent_get_page_state
```
Test: Get current page state
Expected: URL, title, ready state, element count
```

#### 2.4 page_execute_and_wait
```
Test: Click search button and wait for results
Expected: Action executed, changes detected, new page state
```

### Phase 3: Form Handling (2 tools)

#### 3.1 form_detect
```
Setup: Navigate to a form page (e.g., https://www.w3schools.com/html/html_forms.asp)
Test: Detect all forms
Expected: JSON templates with field mappings
Cognitive Check: Is the JSON structure clear for filling?
```

#### 3.2 form_fill
```
Test: Fill detected form with sample data
Input: Use JSON from 3.1 with test values
Expected: Form filled confirmation
```

### Phase 4: Human Interaction (1 tool)

#### 4.1 form_ask_human
```
Test: Ask human to identify a specific element
Input: {prompt: "Click on the main logo"}
Expected: Element marked and selector returned
Note: This requires manual intervention - document the experience
```

### Phase 5: Screenshots (3 tools)

#### 5.1 screenshot_capture
```
Test: Capture current page screenshot
Expected: Base64 image data with metadata
```

#### 5.2 screenshot_paginated
```
Setup: Navigate to long page (e.g., Wikipedia article)
Test: Create paginated screenshots
Expected: Multiple chunks info with overlap details
```

#### 5.3 screenshot_get_chunk
```
Test: Retrieve specific chunk from 5.2
Input: {id: "[from_5.2]", chunk: 1}
Expected: Chunk image with navigation info
```

### Phase 6: Debugging (8 tools)

#### 6.1 debug_set_breakpoint
```
Setup: Navigate to page with JavaScript
Test: Set breakpoint at line 10
Expected: Breakpoint ID returned
```

#### 6.2 debug_evaluate
```
Test: Evaluate "window.location.href"
Expected: Current URL value
```

#### 6.3 debug_get_variables
```
Test: Get local variables in current scope
Expected: Variable list with values
```

#### 6.4-6.8 debug_continue, debug_step_over, debug_step_into, debug_remove_breakpoint, debug_function
```
Test each in sequence with a simple JavaScript function
Document any confusion or high cognitive load
```

### Phase 7: Network Analysis (5 tools)

#### 7.1 network_get_logs
```
Test: Get all network logs
Expected: Request list with methods and statuses
```

#### 7.2 network_get_api_logs
```
Test: Filter for API calls only
Expected: Detailed API requests with payloads
```

#### 7.3 network_replay_request
```
Test: Replay an API request from 7.2
Expected: New response with modifications applied
```

#### 7.4 network_intercept_requests
```
Test: Set up interception rule
Input: Block requests to tracking domains
Expected: Rule confirmation
```

#### 7.5 network_clear_logs
```
Test: Clear all network logs
Expected: Confirmation of cleared logs
```

### Phase 8: Console Monitoring (1 tool)

#### 8.1 network_get_console_logs
```
Test: Get console output
Expected: Log entries with types and messages
```

### Phase 9: Page Analysis (3 tools)

#### 9.1 page_get_accessibility
```
Test: Get accessibility tree
Expected: Structured accessibility information
```

#### 9.2 page_get_resources
```
Test: List all page resources
Expected: Scripts, stylesheets, images categorized
```

#### 9.3 page_get_performance
```
Test: Get performance metrics
Expected: Load times, resource timings
```

### Phase 10: DevTools Elements (6 tools)

#### 10.1 devtools_inspect_element
```
Test: Inspect specific element by selector
Input: {selector: "h1"}
Expected: Element properties, styles, attributes
```

#### 10.2 devtools_modify_css
```
Test: Change h1 color to red
Input: {selector: "h1", property: "color", value: "red"}
Expected: Confirmation of style applied
Cognitive Check: Are parameter names intuitive?
```

#### 10.3 devtools_highlight_element
```
Test: Highlight an element for 3 seconds
Expected: Visual feedback confirmation
```

#### 10.4 devtools_modify_html
```
Test: Change h1 text content
Input: {selector: "h1", value: "Modified Text", type: "innerHTML"}
Expected: HTML updated confirmation
```

#### 10.5 devtools_get_computed_styles
```
Test: Get all computed styles for element
Expected: Complete style listing
```

#### 10.6 devtools_visual_element_map
```
Test: Create visual map of page elements
Expected: Screenshot with numbered elements
Cognitive Check: Is this helpful when semantic IDs fail?
```

### Phase 11: Storage Management (7 tools)

#### 11.1 storage_get
```
Test: Get all storage data
Expected: localStorage, sessionStorage, cookies
```

#### 11.2 storage_set
```
Test: Set localStorage item
Input: {type: "localStorage", key: "test", value: "value"}
Expected: Confirmation
```

#### 11.3 storage_remove
```
Test: Remove the item from 11.2
Expected: Removal confirmation
```

#### 11.4 storage_clear
```
Test: Clear all storage
Expected: Confirmation of cleared storage
```

#### 11.5 storage_export_state
```
Test: Export current storage state
Expected: JSON object for persistence
```

#### 11.6 storage_import_state
```
Test: Import state from 11.5
Expected: State restored confirmation
```

#### 11.7 storage_get_info
```
Test: Get storage quota info
Expected: Usage statistics
```

### Phase 12: Agent Page Management (4 tools)

#### 12.1 agent_generate_page
```
Test: Generate fresh agent page
Expected: Structured element view
```

#### 12.2 agent_remap_page
```
Test: Remap after DOM changes
Expected: Updated element mappings
```

#### 12.3 agent_wait_for_changes
```
Test: Wait for page changes after action
Expected: Change detection or timeout
```

#### 12.4 agent_get_page_chunk
```
Test: Get additional elements when page has many
Input: {page: 2}
Expected: Next batch of elements
```

### Phase 13: Script Execution (1 tool)

#### 13.1 page_evaluate_script
```
Test: Execute JavaScript to get page title
Input: {script: "document.title"}
Expected: Page title returned
```

### Phase 14: Browser Crash Recovery (5 tests)

#### 14.1 Memory Exhaustion Test
```
Setup: Navigate to any page
Test: Execute memory exhaustion script
Input: {script: "let arr = []; while(true) { arr.push(new Array(1000000).fill('x'.repeat(100))); }"}
Expected: 
  - Browser crashes
  - MCP server remains responsive
  - Error message indicates browser crash
  - Can navigate to new page after crash
Cognitive Check: Is the crash recovery message clear about what happened?
```

#### 14.2 Infinite Redirect Test
```
Setup: Create local HTML with aggressive redirects
Test: Navigate to page with instant redirects
HTML: <script>window.location.href = window.location.href + '#' + Date.now();</script>
Expected:
  - Browser handles or crashes after redirect limit
  - MCP server stays alive
  - Clear error about too many redirects
  - Suggestion to use agent_wait_for_changes for auth flows
```

#### 14.3 Stack Overflow Test
```
Test: Execute recursive function causing stack overflow
Input: {script: "function recurse() { recurse(); } recurse();"}
Expected:
  - JavaScript error or browser crash
  - MCP server continues functioning
  - Can close and restart browser
```

#### 14.4 Force Close Test
```
Setup: Navigate to any page
Test: Forcefully terminate browser process (kill -9)
Expected:
  - Browser disconnect detected
  - MCP server remains operational
  - Next navigation launches fresh browser
  - Crash count available in error message
```

#### 14.5 Anti-Bot Detection Crash Test
```
Test: Navigate to site with aggressive bot detection (e.g., claude.ai)
Expected:
  - If browser becomes unresponsive/crashes
  - MCP server survives
  - Can browser_close and restart
  - Clear messaging about bot detection
Note: This test may vary based on site's current anti-bot measures
```

### Crash Recovery Validation
```
After any crash test:
1. Verify MCP connection still active: /mcp should show Supapup connected
2. Test basic navigation: browser_navigate to example.com
3. Check crash info available
4. Confirm no need to restart Claude

Success Criteria:
- [ ] MCP server never crashes when browser crashes
- [ ] Error messages clearly indicate browser crash (not generic errors)
- [ ] Recovery is automatic or requires only browser_close + navigate
- [ ] Crash tracking provides useful diagnostics
- [ ] No session state corruption after recovery
```

### Phase 15: Browser Visibility Control Comprehensive Test

This phase specifically tests the new dynamic browser visibility features to ensure they work reliably across different scenarios.

#### 15.1 Default Behavior Test
```
Test: Verify new default visible browser behavior
Steps:
1. Fresh start (close any existing browser)
2. Navigate to https://example.com
Expected: Browser window should be visible by default
Cognitive Check: Is the visible browser the expected default behavior?
```

#### 15.2 Visibility Toggle Test
```
Test: Dynamic visibility switching during session
Steps:
1. Start with visible browser (navigate to any page)
2. Switch to headless: browser_set_visibility({visible: false, restart: true})
3. Navigate to new page to confirm headless mode
4. Switch back to visible: browser_set_visibility({visible: true, restart: true})
5. Navigate to confirm visible mode
Expected: Each switch should work cleanly with clear feedback
Cognitive Check: Is the switching process intuitive and reliable?
```

#### 15.3 Navigation with Visibility Override
```
Test: Using visible parameter in browser_navigate
Steps:
1. Navigate with explicit headless: browser_navigate({url: "https://google.com", visible: false})
2. Verify headless operation
3. Navigate with explicit visible: browser_navigate({url: "https://example.com", visible: true})
4. Verify visible operation
Expected: Each navigation should override current settings
Cognitive Check: Does the visible parameter provide clear control?
```

#### 15.4 Performance Comparison Test
```
Test: Measure performance difference between modes
Steps:
1. Time navigation in visible mode: browser_navigate({url: "https://wikipedia.org", visible: true})
2. Time navigation in headless mode: browser_navigate({url: "https://wikipedia.org", visible: false})
3. Compare load times and responsiveness
Expected: Headless should be noticeably faster
Cognitive Check: Is the performance benefit clear and significant?
```

#### 15.5 Restart Control Test
```
Test: restart parameter behavior
Steps:
1. Navigate to any page (visible mode)
2. Set headless without restart: browser_set_visibility({visible: false, restart: false})
3. Verify warning message about restart needed
4. Navigate to new page and confirm headless mode applied
5. Set visible with restart: browser_set_visibility({visible: true, restart: true})
6. Verify immediate restart and visible mode
Expected: restart=false should defer changes, restart=true should apply immediately
Cognitive Check: Is the restart control behavior clear and useful?
```

#### 15.6 State Persistence Test
```
Test: Visibility settings persistence across operations
Steps:
1. Set headless mode: browser_set_visibility({visible: false, restart: true})
2. Navigate to multiple pages
3. Perform various actions (form fills, clicks, etc.)
4. Verify browser stays in headless mode throughout
5. Switch to visible and repeat
Expected: Settings should persist until explicitly changed
Cognitive Check: Does the state tracking work reliably?
```

#### 15.7 Error Handling Test
```
Test: Edge cases and error conditions
Steps:
1. Try setting visibility while no browser is running
2. Try invalid parameters
3. Test with browser crashes during visibility changes
Expected: Graceful error handling with helpful messages
Cognitive Check: Are error messages helpful for troubleshooting?
```

### Browser Visibility Success Criteria
- [ ] Default visible browser behavior works correctly
- [ ] Dynamic visibility switching is reliable and fast
- [ ] Navigation visibility override functions as expected
- [ ] Performance improvement in headless mode is measurable
- [ ] Restart control provides appropriate flexibility
- [ ] Settings persist correctly across operations
- [ ] Error handling is robust and informative
- [ ] All visibility features integrate smoothly with existing tools
- [ ] Agents can make intelligent visibility decisions based on context

## Final Integration Test

### Complete Workflow Test
1. Uninstall current Supapup: `npm uninstall -g supapup`
2. Rebuild: `npm run build`
3. Pack: `npm pack`
4. Install fresh: `npm install -g ./supapup-[version].tgz`
5. Verify MCP connection in Claude
6. Perform Google search workflow:
   - Navigate to google.com
   - Fill search field
   - Submit form
   - Verify results load
   - Extract first result link

### Success Metrics
- [ ] All 54 tools tested without critical errors (including 2 new browser visibility tools)
- [ ] Cognitive load issues documented
- [ ] Parameter naming is consistent and intuitive
- [ ] Error messages are helpful for AI agents
- [ ] Tool outputs are structured and parseable
- [ ] Google search workflow completes successfully
- [ ] Browser crash recovery works in all test scenarios
- [ ] MCP server never requires restart after browser crashes
- [ ] Crash error messages provide clear next steps

## Bug Report Template

```
Tool: [tool_name]
Issue Type: [Bug/Cognitive Load/Unclear Output/Parameter Confusion]
Description: [What happened]
Expected: [What should happen]
Suggestion: [How to improve]
Severity: [Critical/High/Medium/Low]
```

## Notes for AI Agent Testers

1. **Cognitive Load**: Flag any tool that requires checking multiple sources or complex parameter construction
2. **Error Clarity**: Note if errors don't provide clear next steps
3. **Output Format**: Check if outputs are immediately usable or require parsing
4. **Parameter Names**: Flag any confusing or inconsistent parameter names
5. **Tool Sequencing**: Note if tool order matters but isn't documented
6. **State Management**: Check if tools handle state changes gracefully

Remember: This tool should empower AI coding assistants. If you struggle with a tool, human developers will too.