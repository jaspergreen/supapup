# Test Plan: Handling Same-Name Elements

## Overview
This test plan ensures that Supapup correctly generates unique IDs for elements with identical text/attributes, making them distinguishable for AI agents.

## Test Scenarios

### 1. Multiple Buttons with Same Text
**Setup**: Create a page with multiple "Add to Cart" buttons for different products
**Expected**: Each button gets a unique ID incorporating product context

```html
<div>
  <h3>Product A</h3>
  <button>Add to Cart</button>
</div>
<div>
  <h3>Product B</h3>
  <button>Add to Cart</button>
</div>
```

**Expected IDs**:
- `product-a-add-to-cart-button-0`
- `product-b-add-to-cart-button-1`

### 2. Form Fields with Same Labels
**Setup**: Multiple forms with fields having identical labels

```html
<form id="billing">
  <input placeholder="Email">
</form>
<form id="shipping">
  <input placeholder="Email">
</form>
```

**Expected IDs**:
- `billing-email-email-2`
- `shipping-email-email-3`

### 3. Navigation Links with Same Text
**Setup**: Multiple "Home" or "About" links in different contexts

```html
<nav>
  <a href="/home">Home</a>
</nav>
<footer>
  <a href="/home">Home</a>
</footer>
```

**Expected IDs**:
- `home-link-0`
- `home-link-1`

### 4. Checkboxes with Same Labels
**Setup**: Multiple checkboxes with identical text

```html
<label><input type="checkbox"> Subscribe</label>
<label><input type="checkbox"> Subscribe</label>
```

**Expected IDs**: Should include index to ensure uniqueness

### 5. Dynamic Content
**Setup**: Elements added dynamically via JavaScript
**Test**: Ensure IDs remain unique after DOM updates

## Implementation Strategy

### ID Generation Rules:
1. **Context Extraction**: Extract parent container info (form ID, product name, section)
2. **Semantic Parts**: Include element's semantic meaning (label, placeholder, text)
3. **Type Suffix**: Add element type (button, link, input, etc.)
4. **Unique Index**: Always append index for guaranteed uniqueness
5. **Product Context**: For e-commerce, extract product names from nearby headings

### Context Sources (in priority order):
1. Parent form's name/id
2. Closest heading (h1-h6) text
3. Aria-label or title attributes
4. Button/link text content
5. Input placeholder or associated label
6. Price or other unique identifiers in container

## Test Execution

### Manual Tests:
1. Navigate to products.html
2. Verify each "Add to Cart" button has unique ID
3. Click specific product buttons
4. Verify correct product is added to cart

### Automated Tests:
```javascript
// Test unique ID generation
const buttons = document.querySelectorAll('button');
const ids = Array.from(buttons).map(b => b.getAttribute('data-mcp-id'));
const uniqueIds = new Set(ids);
console.assert(ids.length === uniqueIds.size, 'All IDs should be unique');
```

## Success Criteria
- [ ] No duplicate IDs on any page
- [ ] IDs are semantic and meaningful
- [ ] AI agents can distinguish between similar elements
- [ ] IDs remain stable across page refreshes
- [ ] Dynamic elements get unique IDs