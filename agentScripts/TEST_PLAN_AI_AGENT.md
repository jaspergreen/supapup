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

### Phase 1: Browser Management (5 tools)

#### 1.1 browser_navigate
```
Test: Navigate to https://example.com
Expected: Agent page view with structured elements
Cognitive Check: Is the output format immediately understandable?
```

#### 1.2 browser_list_tabs
```
Prerequisite: Have browser open from 1.1
Test: List all open tabs
Expected: Clear list with indices and URLs
```

#### 1.3 browser_open_in_tab
```
Test: Open HTML content "<h1>Test Page</h1>" in new tab
Expected: Confirmation of tab opened
```

#### 1.4 browser_switch_tab
```
Prerequisite: Multiple tabs from previous tests
Test: Switch to tab index 0
Expected: Confirmation with tab details
```

#### 1.5 browser_close
```
Test: Close browser
Expected: Clean shutdown confirmation
Note: Re-launch for next phase
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
- [ ] All 52 tools tested without critical errors
- [ ] Cognitive load issues documented
- [ ] Parameter naming is consistent and intuitive
- [ ] Error messages are helpful for AI agents
- [ ] Tool outputs are structured and parseable
- [ ] Google search workflow completes successfully

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