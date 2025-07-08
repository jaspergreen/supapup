// MCP Bridge Implementation for E-commerce Challenge
// This file implements bridges for all pages in the e-commerce flow

class BaseBridge {
    constructor(pageName) {
        this.pageName = pageName;
        this.version = '1.0.0';
    }

    getManifest() {
        return {
            page: this.pageName,
            version: this.version,
            actions: this.getActions(),
            state: this.getState()
        };
    }

    getState() {
        return {
            page: this.pageName,
            timestamp: new Date().toISOString(),
            user: this.getCurrentUser(),
            cart: this.getCart()
        };
    }

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    getCart() {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    }

    async execute(actionId, params = {}) {
        if (!this[actionId]) {
            throw new Error(`Unknown action: ${actionId}`);
        }
        return await this[actionId](params);
    }
}

// Home Page Bridge
class HomeBridge extends BaseBridge {
    constructor() {
        super('home');
    }

    getActions() {
        return [
            {
                id: 'check_login_status',
                type: 'custom',
                description: 'Check if user is logged in',
                outputs: ['isLoggedIn', 'user']
            },
            {
                id: 'show_login_form',
                type: 'custom',
                description: 'Reveal the login form',
                outputs: ['success']
            },
            {
                id: 'login',
                type: 'custom',
                description: 'Login with credentials',
                inputs: { email: 'string', password: 'string' },
                outputs: ['success', 'user', 'error']
            },
            {
                id: 'navigate_to_products',
                type: 'custom',
                description: 'Navigate to products page',
                outputs: ['success', 'url']
            }
        ];
    }

    async check_login_status() {
        const user = this.getCurrentUser();
        return {
            isLoggedIn: !!user,
            user: user
        };
    }

    async show_login_form() {
        const btn = document.getElementById('showLoginBtn');
        const section = document.getElementById('loginSection');
        
        if (btn && section) {
            btn.style.display = 'none';
            section.style.display = 'block';
            return { success: true };
        }
        return { success: false, error: 'Elements not found' };
    }

    async login(params) {
        const { email, password } = params;
        
        if (!email || !password) {
            return { success: false, error: 'Email and password required' };
        }

        // Fill form
        document.getElementById('email').value = email;
        document.getElementById('password').value = password;

        // Submit form
        const form = document.getElementById('loginForm');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Wait for result
        await new Promise(resolve => setTimeout(resolve, 100));

        const user = this.getCurrentUser();
        if (user) {
            return { success: true, user };
        } else {
            return { success: false, error: 'Invalid credentials' };
        }
    }

    async navigate_to_products() {
        if (!this.getCurrentUser()) {
            return { success: false, error: 'Not logged in' };
        }
        
        window.location.href = 'products.html';
        return { success: true, url: 'products.html' };
    }
}

// Products Page Bridge
class ProductsBridge extends BaseBridge {
    constructor() {
        super('products');
    }

    getActions() {
        return [
            {
                id: 'get_products',
                type: 'custom',
                description: 'Get all available products',
                outputs: ['products']
            },
            {
                id: 'add_to_cart',
                type: 'custom',
                description: 'Add a product to cart',
                inputs: { productId: 'number', quantity: 'number' },
                outputs: ['success', 'cart', 'message']
            },
            {
                id: 'navigate_to_cart',
                type: 'custom',
                description: 'Navigate to cart page',
                outputs: ['success', 'url']
            }
        ];
    }

    async get_products() {
        return {
            products: [
                { id: 1, name: 'Laptop Pro X1', price: 1299.99, description: 'High-performance laptop' },
                { id: 2, name: 'Wireless Mouse', price: 29.99, description: 'Ergonomic wireless mouse' },
                { id: 3, name: '4K Monitor', price: 499.99, description: '27-inch 4K display' },
                { id: 4, name: 'Mechanical Keyboard', price: 89.99, description: 'RGB mechanical keyboard' }
            ]
        };
    }

    async add_to_cart(params) {
        const { productId, quantity = 1 } = params;
        
        const products = await this.get_products();
        const product = products.products.find(p => p.id === productId);
        
        if (!product) {
            return { success: false, error: 'Product not found' };
        }

        // Use the global addToCart function
        window.addToCart(product.id, product.name, product.price);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            success: true,
            cart: this.getCart(),
            message: `Added ${product.name} to cart`
        };
    }

    async navigate_to_cart() {
        window.location.href = 'cart.html';
        return { success: true, url: 'cart.html' };
    }
}

// Cart Page Bridge
class CartBridge extends BaseBridge {
    constructor() {
        super('cart');
    }

    getActions() {
        return [
            {
                id: 'get_cart_contents',
                type: 'custom',
                description: 'Get current cart contents',
                outputs: ['cart', 'total']
            },
            {
                id: 'remove_from_cart',
                type: 'custom',
                description: 'Remove item from cart',
                inputs: { index: 'number' },
                outputs: ['success', 'cart']
            },
            {
                id: 'start_checkout',
                type: 'custom',
                description: 'Show checkout form',
                outputs: ['success']
            },
            {
                id: 'complete_checkout',
                type: 'custom',
                description: 'Complete the checkout process',
                inputs: {
                    fullName: 'string',
                    address: 'string',
                    city: 'string',
                    zip: 'string',
                    cardNumber: 'string',
                    expiry: 'string',
                    cvv: 'string'
                },
                outputs: ['success', 'orderId', 'total']
            }
        ];
    }

    async get_cart_contents() {
        const cart = this.getCart();
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return { cart, total };
    }

    async remove_from_cart(params) {
        window.removeFromCart(params.index);
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, cart: this.getCart() };
    }

    async start_checkout() {
        window.startCheckout();
        return { success: true };
    }

    async complete_checkout(params) {
        // Fill the form
        document.getElementById('fullName').value = params.fullName;
        document.getElementById('address').value = params.address;
        document.getElementById('city').value = params.city;
        document.getElementById('zip').value = params.zip;
        document.getElementById('cardNumber').value = params.cardNumber;
        document.getElementById('expiry').value = params.expiry;
        document.getElementById('cvv').value = params.cvv;

        // Submit form
        const form = document.getElementById('checkoutFormElement');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        await new Promise(resolve => setTimeout(resolve, 500));

        const orderId = localStorage.getItem('lastOrder');
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const order = orders.find(o => o.id === orderId);

        if (order) {
            return {
                success: true,
                orderId: order.id,
                total: order.total
            };
        }

        return { success: false, error: 'Checkout failed' };
    }
}

// Tracking Page Bridge
class TrackingBridge extends BaseBridge {
    constructor() {
        super('tracking');
    }

    getActions() {
        return [
            {
                id: 'get_orders',
                type: 'custom',
                description: 'Get all orders for current user',
                outputs: ['orders']
            },
            {
                id: 'get_order_details',
                type: 'custom',
                description: 'Get details of a specific order',
                inputs: { orderId: 'string' },
                outputs: ['order']
            },
            {
                id: 'reset_demo',
                type: 'custom',
                description: 'Clear all data and reset demo',
                outputs: ['success']
            }
        ];
    }

    async get_orders() {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        return { orders };
    }

    async get_order_details(params) {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const order = orders.find(o => o.id === params.orderId);
        
        if (order) {
            return { order };
        }
        return { error: 'Order not found' };
    }

    async reset_demo() {
        localStorage.clear();
        window.location.href = 'index.html';
        return { success: true };
    }
}