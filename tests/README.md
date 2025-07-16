# Supapup Tests

## Directory Structure

- **integration/** - End-to-end integration tests
  - `test-devtools-agent-page.cjs` - Tests for DevToolsAgentPageGenerator
  - `test-interaction.cjs` - Tests for element interaction
  - `test-navigation.cjs` - Navigation and page loading tests
  - `test-supapup-flow.cjs` - Complete workflow tests

- **unit/** - Unit tests for individual components
  - `test-dom-change-detection.cjs` - DOM mutation observer tests
  - `test-script-execution.cjs` - JavaScript execution tests

- **manual/** - Manual testing scripts
  - `test-mcp-handshake.js` - MCP protocol testing
  - `test-network-debug.js` - Network debugging utilities

- **fixtures/** - Test HTML pages
  - Various HTML files for testing edge cases

- **debug/** - Debugging utilities
  - `debug-injection.cjs` - Script injection debugging
  - `debug-manifest.cjs` - Manifest generation debugging

## Running Tests

### Integration Tests
```bash
node tests/integration/test-supapup-flow.cjs
```

### Unit Tests
```bash
node tests/unit/test-dom-change-detection.cjs
```

### Manual Testing
```bash
# Test MCP handshake
node tests/manual/test-mcp-handshake.js

# Run network debugging
node tests/manual/test-network-debug.js
```