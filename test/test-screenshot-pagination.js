#!/usr/bin/env node

// Test script for screenshot pagination feature

console.log(`
Screenshot Pagination Test Instructions
======================================

This feature addresses the token limit issue when taking full-page screenshots of large pages.

WHAT'S NEW:
-----------
1. Enhanced screenshot tool with new parameters:
   - selector: Capture specific element
   - scrollTo: Scroll to Y position before screenshot
   - viewport: Resize viewport before screenshot
   - quality: JPEG quality (0-100)

2. New screenshot_paginated tool:
   - Automatically calculates optimal page segments
   - Returns instructions for capturing each segment
   - Configurable overlap between segments
   - Quality control for file size

HOW TO USE:
-----------
1. For large pages like Wikipedia, first check if full-page screenshot will exceed limits:
   mcp__supapup__screenshot(fullPage: true)
   
   If it returns a warning about size, use the paginated approach.

2. Use screenshot_paginated to get segmentation plan:
   mcp__supapup__screenshot_paginated(quality: 50)
   
   This returns instructions for capturing the page in segments.

3. Follow the instructions to capture each segment:
   mcp__supapup__screenshot(scrollTo: 0, quality: 50)
   mcp__supapup__screenshot(scrollTo: 700, quality: 50)
   ... etc

4. Process each screenshot individually to avoid token limits.

EXAMPLE WORKFLOW:
----------------
1. Navigate to page:
   mcp__supapup__navigate(url: "https://en.wikipedia.org/wiki/Artificial_intelligence")

2. Get segmentation plan:
   mcp__supapup__screenshot_paginated(quality: 40, overlap: 50)

3. Capture segments as instructed, processing each one separately.

ADVANCED OPTIONS:
----------------
- Capture specific element: screenshot(selector: "#main-content")
- Custom viewport: screenshot(viewport: {width: 1200, height: 800})
- Manual segments: screenshot_paginated(segments: 5)
`);