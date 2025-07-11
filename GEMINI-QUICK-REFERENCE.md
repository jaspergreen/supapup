# Supapup + Gemini CLI Quick Reference

## Common Issues & Solutions

### 1. CSS Modification Loop Issue

**Problem**: Gemini gets stuck in navigation loops when CSS modifications fail.

**Root Cause**: Wrong parameter names for `devtools_modify_css` tool.

**❌ WRONG**:
```javascript
devtools_modify_css({
  "element_selector": "h1",           // Wrong parameter name
  "property_name": "background",      // Wrong parameter name  
  "property_value": "red"             // Wrong parameter name
})
```

**✅ CORRECT**:
```javascript
devtools_modify_css({
  "selector": "h1",                   // Correct parameter name
  "property": "background",           // Correct parameter name
  "value": "red"                      // Correct parameter name
})
```

### 2. Alert Handling

**Problem**: `ok-button` element not found for alert dismissal.

**Solutions**:
- Use `click_alert(1)` via `page_evaluate_script` tool
- OR use `window.__AGENT_PAGE__.clickAlert(1)` if available
- OR look for actual alert button IDs in the agent page view

### 3. Form Handling Best Practice

**✅ Recommended Pattern**:
1. Navigate to page
2. Click button to reveal form (if needed)
3. Use `detect_forms()` to understand form structure
4. Use `fill_form()` with correct data and `submitAfter: true`
5. Handle any alerts/errors that appear
6. Continue with next actions

### 4. Parameter Reference

| Tool | Required Parameters | Example |
|------|-------------------|---------|
| `devtools_modify_css` | `selector`, `property`, `value` | `{"selector": "h1", "property": "color", "value": "red"}` |
| `agent_execute_action` | `actionId`, optional `params` | `{"actionId": "button-id", "params": {"value": "text"}}` |
| `fill_form` | `formData`, optional `formId`, `submitAfter` | `{"formData": {"field-id": "value"}, "submitAfter": true}` |

### 5. Avoiding Loops

**Prevention**:
- Don't re-navigate after successful actions unless necessary
- Check if elements exist before trying to modify them
- Use the agent page view to understand current page state
- Limit CSS modifications to avoid MaxListenersExceededWarning

**Recovery**:
- If stuck in a loop, break out and assess current page state
- Use `agent_generate_page` to refresh understanding
- Focus on the current page elements rather than restarting

## Tool Chain Examples

### CSS Styling Demo
```javascript
// 1. Navigate once
browser_navigate({"url": "file:///.../index.html"})

// 2. Modify CSS (use correct parameter names!)
devtools_modify_css({"selector": "h1", "property": "background", "value": "linear-gradient(45deg, #ff6b6b, #4ecdc4)"})
devtools_modify_css({"selector": "button", "property": "transform", "value": "scale(1.2)"})

// 3. Stop - don't navigate again!
```

### Form Interaction Demo
```javascript
// 1. Navigate and reveal form
browser_navigate({"url": "file:///.../index.html"})
agent_execute_action({"actionId": "showlogin-button"})

// 2. Understand form structure
detect_forms()

// 3. Fill and submit
fill_form({
  "formData": {"email-field": "test@example.com", "password-field": "wrongpassword"},
  "submitAfter": true
})

// 4. Handle any alerts
page_evaluate_script({"script": "click_alert(1)"})

// 5. Fix and resubmit
agent_execute_action({"actionId": "password-field", "params": {"value": "correctpassword"}})
agent_execute_action({"actionId": "submit-button"})
```

## Error Messages to Watch For

- `❌ Element not found` → Check parameter names and current page state
- `❌ Missing required parameters` → Use correct parameter names (new error message added)
- `MaxListenersExceededWarning` → Stop making more tool calls, restart if needed
- `Form submitted (no navigation detected - may be AJAX)` → Form worked, check for alerts or page updates

## Updated Error Handling (v0.1.2+)

Supapup now provides helpful error messages for common parameter mistakes:

```
❌ Missing required parameters: selector, property, value

Required format: {"selector": "h1", "property": "background", "value": "red"}

💡 Parameter naming issues detected:
Use "selector" instead of "element_selector"
Use "property" instead of "property_name"  
Use "value" instead of "property_value"
```