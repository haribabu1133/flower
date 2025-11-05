// Hamburger menu toggle
function toggleMenu() {
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (hamburger && mobileMenu) {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    }
}

// Update mobile cart count
function updateMobileCartCount() {
    const cartCountMobile = document.getElementById('cart-count-mobile');
    if (cartCountMobile) {
        cartCountMobile.textContent = cartState.items.length.toString();
    }
}

// Google Drive API configuration
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual client ID from Google Cloud Console
const API_KEY = 'YOUR_GOOGLE_API_KEY'; // Replace with your actual API key from Google Cloud Console
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Cart state management with localStorage persistence
const cartState = {
    items: JSON.parse(localStorage.getItem('cartItems')) || [],
    total: parseInt(localStorage.getItem('cartTotal')) || 0
};

// Google Drive functions
const driveFunctions = {
    // Initialize Google API
    initGoogleAPI: function() {
        gapi.load('client:auth2', () => {
            gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES
            }).then(() => {
                console.log('Google API initialized');
            }).catch(error => {
                console.error('Error initializing Google API:', error);
            });
        });
    },

    // Sign in to Google
    signIn: function() {
        return gapi.auth2.getAuthInstance().signIn();
    },

    // Upload file to Google Drive
    uploadToDrive: function(fileName, content) {
        const file = new Blob([content], { type: 'application/json' });
        const metadata = {
            name: fileName,
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        return gapi.client.drive.files.create({
            resource: metadata,
            media: {
                mimeType: 'application/json',
                body: file
            }
        });
    }
};

// All cart functions
const cartFunctions = {
    // Add item to cart
    addToCart: function(name, price) {
        cartState.items.push({ name, price });
        cartState.total += price;
        this.saveCartToStorage();
        this.updateCartCount();
        this.updateCartDisplay();
        this.showNotification(`Added ${name} to cart!`, 'success');
    },

    // Remove item from cart
    removeFromCart: function(name) {
        const index = cartState.items.findIndex(item => item.name === name);
        if (index !== -1) {
            cartState.total -= cartState.items[index].price;
            cartState.items.splice(index, 1);
            this.saveCartToStorage();
            this.updateCartCount();
            this.updateCartDisplay();
            this.showNotification(`Removed ${name} from cart`, 'info');
        }
    },

    // Update cart counter
    updateCartCount: function() {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            cartCount.textContent = cartState.items.length.toString();
        }
    },

    // Update cart display
    updateCartDisplay: function() {
        const cartItems = document.getElementById('cart-items');
        const cartTotalElement = document.getElementById('cart-total');
        
        if (!cartItems || !cartTotalElement) return;

        cartItems.innerHTML = '';

        if (cartState.items.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            cartTotalElement.innerHTML = '<strong>Total: ₹0</strong>';
            return;
        }

        cartState.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <span class="item-name">${item.name}</span>
                <span class="item-price">₹${item.price}</span>
                <button onclick="cartFunctions.removeFromCart('${item.name}')" class="remove-item">×</button>
            `;
            cartItems.appendChild(itemElement);
        });

        cartTotalElement.innerHTML = `<strong>Total: ₹${cartState.total}</strong>`;
    },

    // Show notification
    showNotification: function(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;

        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3'
        };

        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: colors[type],
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: '1000',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);

        // Remove notification
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    // Open cart modal
    openCart: function() {
        const modal = document.getElementById('cart-modal');
        if (modal) {
            this.updateCartDisplay();
            modal.style.display = 'block';
        }
    },

    // Close cart modal
    closeCart: function() {
        const modal = document.getElementById('cart-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // Handle order submission
    handleOrderSubmit: async function(e) {
        e.preventDefault();

        if (cartState.items.length === 0) {
            this.showNotification('Please add items to your cart before checking out', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const orderDetails = {
            customerName: formData.get('Full Name'),
            email: formData.get('Email'),
            phone: formData.get('Phone Number'),
            address: formData.get('Delivery Address'),
            items: cartState.items,
            total: cartState.total,
            orderDate: new Date().toISOString()
        };

        // Validate form fields
        if (!orderDetails.customerName || !orderDetails.email || !orderDetails.phone || !orderDetails.address) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Check if user is signed in
            const authInstance = gapi.auth2.getAuthInstance();
            if (!authInstance.isSignedIn.get()) {
                await driveFunctions.signIn();
            }

            // Upload order to Google Drive
            const fileName = `order_${orderDetails.customerName.replace(/\s+/g, '_')}_${Date.now()}.json`;
            await driveFunctions.uploadToDrive(fileName, JSON.stringify(orderDetails, null, 2));

            console.log('Order submitted and uploaded to Google Drive:', orderDetails);

            // Clear cart and form
            cartState.items = [];
            cartState.total = 0;
            this.saveCartToStorage();
            this.updateCartCount();
            this.updateCartDisplay();
            e.target.reset();
            this.closeCart();

            this.showNotification('Order placed successfully and saved to Google Drive!', 'success');
        } catch (error) {
            console.error('Error uploading order to Google Drive:', error);
            this.showNotification('Order placed but failed to save to Google Drive. Please try again.', 'error');
        }
    },

    // Save cart to localStorage
    saveCartToStorage: function() {
        localStorage.setItem('cartItems', JSON.stringify(cartState.items));
        localStorage.setItem('cartTotal', cartState.total.toString());
    }
};

// Initialize cart functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wire up Add to Cart buttons robustly.
    // Buttons may have been updated to call cartFunctions.addToCart inline,
    // but this ensures any remaining buttons still work by reading
    // the card's title and price if necessary.
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    addToCartButtons.forEach(button => {
        const originalOnclick = button.getAttribute('onclick') || '';
        const match = originalOnclick.match(/'([^']+)'[, ]*\s*(\d+)/);
        if (match) {
            const name = match[1];
            const price = parseInt(match[2], 10);
            button.onclick = () => cartFunctions.addToCart(name, price);
        } else {
            // Fallback: read the name and price from the DOM structure
            button.addEventListener('click', () => {
                const card = button.closest('.flower-card');
                if (!card) return;
                const nameEl = card.querySelector('h3');
                const priceEl = card.querySelector('.price');
                const name = nameEl ? nameEl.textContent.trim() : 'Item';
                // Extract digits from price text (handles ₹ and commas)
                const priceText = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '0';
                const price = parseInt(priceText, 10) || 0;
                cartFunctions.addToCart(name, price);
            });
        }
    });

    // Set up cart modal functionality
    const modal = document.getElementById('cart-modal');
    const cartLink = document.querySelector('.nav-items a[href="#cart"]');
    const closeBtn = document.querySelector('.close');
    const orderForm = document.getElementById('order-form');

    // Cart button click handler
    if (cartLink) {
        cartLink.addEventListener('click', function(e) {
            e.preventDefault();
            cartFunctions.openCart();
        });
    }

    // Close button click handler
    if (closeBtn) {
        closeBtn.addEventListener('click', () => cartFunctions.closeCart());
    }

    // Click outside modal to close
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            cartFunctions.closeCart();
        }
    });

    // Form submission handler
    if (orderForm) {
        orderForm.addEventListener('submit', (e) => cartFunctions.handleOrderSubmit(e));
    }

    // Update cart display initially
    cartFunctions.updateCartCount();
    cartFunctions.updateCartDisplay();

    // Mobile nav toggle behaviour
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            const nav = navToggle.closest('nav');
            if (!nav) return;
            const isOpen = nav.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close nav when a link is clicked (mobile)
        const navLinks = document.querySelectorAll('.nav-items a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const nav = navToggle.closest('nav');
                if (nav && nav.classList.contains('open')) {
                    nav.classList.remove('open');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    // Hamburger menu toggle
    function toggleMenu() {
        const hamburger = document.querySelector('.hamburger');
        const mobileMenu = document.querySelector('.mobile-menu');
        if (hamburger && mobileMenu) {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        }
    }

    // Update mobile cart count
    function updateMobileCartCount() {
        const cartCountMobile = document.getElementById('cart-count-mobile');
        if (cartCountMobile) {
            cartCountMobile.textContent = cartState.items.length.toString();
        }
    }

    // Call updateMobileCartCount when cart changes
    const originalUpdateCartCount = cartFunctions.updateCartCount;
    cartFunctions.updateCartCount = function() {
        originalUpdateCartCount.call(this);
        updateMobileCartCount();
    };

    // Navbar hide/show on scroll
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        const nav = document.querySelector('.navbar');
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop) {
            // scrolling down
            nav.classList.add('hidden');
        } else {
            // scrolling up
            nav.classList.remove('hidden');
        }
        lastScrollTop = scrollTop;
    });



    // Search functionality: animate matching flower cards upwards
    const searchInput = document.getElementById('nav-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const q = (this.value || '').trim().toLowerCase();
            const cards = document.querySelectorAll('.flower-card');
            if (!cards) return;
            cards.forEach(card => {
                const titleEl = card.querySelector('h3');
                const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
                if (q === '' || title.includes(q)) {
                    card.style.display = '';
                    card.style.transform = 'translateY(-20px)';
                    card.style.transition = 'transform 0.5s ease';
                    setTimeout(() => {
                        card.style.transform = 'translateY(0)';
                    }, 100);
                } else {
                    card.style.display = 'none';
                    card.style.transform = 'translateY(0)';
                }
            });
        });
    }

    // Fresh Picks button functionality
    const freshPicksBtn = document.querySelector('.navbar-right button[onclick*="fresh-picks.html"]');
    if (freshPicksBtn) {
        freshPicksBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const flowersSection = document.getElementById('flowers');
            const freshPicksSection = document.getElementById('fresh-picks');
            const footer = document.querySelector('footer');

            if (flowersSection) flowersSection.style.display = 'none';
            if (footer) footer.style.display = 'none';
            if (freshPicksSection) {
                freshPicksSection.style.display = 'block';
                freshPicksSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Carousel functionality
    let currentSlide = 0;
    const slides = document.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
        });
        slides[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
    }

    // Auto-slide every 6 seconds
    setInterval(nextSlide, 6000);

    // Initialize carousel
    if (slides.length > 0) {
        showSlide(0);
    }

    // Initialize Google API
    driveFunctions.initGoogleAPI();
});

// Add animation & cart styles once (single declaration)
const __cartStyle = document.createElement('style');
__cartStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .cart-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem;
        border-bottom: 1px solid #ddd;
    }
`;
document.head.appendChild(__cartStyle);