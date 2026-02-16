// PoshPearl Smart Living - Main JavaScript File
document.addEventListener('DOMContentLoaded', function() {
    console.log('PoshPearl Smart Living loaded');
    
    // Initialize your app
    initializeApp();
});

function initializeApp() {
    // Your JavaScript functionality here
    setupMobileMenu();
    setupDropdowns();
    setupBackToTop();
    setupFormValidation();
    setupSmoothScroll();
    setupLoadingScreen();
    setupHeaderScroll();
    setupQuickView();
    setupProductInteractions();
    setupAnimations();
    setupActiveNavigation();
    setupThemeToggle();
    setupSkeletons();
}

// Mobile menu functionality
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const overlay = document.getElementById('overlay');

    if (mobileMenuBtn && mobileNav) {
        const closeMenu = () => {
            mobileNav.classList.remove('active');
            overlay.classList.remove('active');
            mobileMenuBtn.classList.remove('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileNav.setAttribute('aria-hidden', 'true');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            mobileMenuBtn.focus();
        };

        const openMenu = () => {
            mobileNav.classList.add('active');
            overlay.classList.add('active');
            mobileMenuBtn.classList.add('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
            mobileNav.setAttribute('aria-hidden', 'false');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            const first = mobileNav.querySelector('button, a, input, [tabindex]');
            first?.focus();
        };

        mobileMenuBtn.addEventListener('click', () => {
            const opening = !mobileNav.classList.contains('active');
            if (opening) {
                openMenu();
            } else {
                closeMenu();
            }
        });

        mobileCloseBtn?.addEventListener('click', () => {
            closeMenu();
        });

        overlay?.addEventListener('click', () => {
            closeMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && mobileNav.classList.contains('active')) {
                closeMenu();
            }
        });

        // Accordion functionality for mobile submenus
        const accordionToggles = document.querySelectorAll('.accordion-toggle');
        accordionToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const parent = toggle.parentElement;
                const content = parent.querySelector('.accordion-content');
                
                // Toggle active class
                parent.classList.toggle('active');
                
                // Toggle content visibility
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    toggle.setAttribute('aria-expanded', 'false');
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    toggle.setAttribute('aria-expanded', 'true');
                }
                // Ensure mobile nav remains scrollable to newly expanded content
                parent.closest('.mobile-nav-content')?.scrollTo({ top: parent.offsetTop - 20, behavior: 'smooth' });
            });
        });

        mobileNav.dataset.closeMenuBound = 'true';
        mobileNav.closeMenu = closeMenu;
    }
}

// Header scroll behavior
function setupHeaderScroll() {
    const header = document.querySelector('.main-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}

// Desktop dropdown functionality
function setupDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll('.dropdown'));

    function closeAllDropdowns() {
        dropdowns.forEach(dd => {
            dd.classList.remove('active');
            const t = dd.querySelector('.dropdown-toggle');
            const m = dd.querySelector('.dropdown-menu');
            if (t) t.setAttribute('aria-expanded', 'false');
            if (m) {
                m.style.left = '';
                m.style.right = '';
                m.style.top = '';
                m.style.position = '';
            }
        });
    }

    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');

        if (!toggle || !menu) return;

        // Ensure menu will be drawn above other content
        menu.style.zIndex = 9999;

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('active');
            if (isOpen) {
                // close this
                dropdown.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
                menu.style.position = '';
            } else {
                // close others then open
                closeAllDropdowns();
                dropdown.classList.add('active');
                toggle.setAttribute('aria-expanded', 'true');
                alignDropdownToToggle(toggle, menu);
            }
        });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) closeAllDropdowns();
    });

    // Close with Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDropdowns(); });

    // reposition visible dropdowns on resize/scroll
    let repositionTimer;
    ['resize','scroll'].forEach(ev => window.addEventListener(ev, () => {
        clearTimeout(repositionTimer);
        repositionTimer = setTimeout(() => {
            document.querySelectorAll('.dropdown.active').forEach(dd => {
                const toggle = dd.querySelector('.dropdown-toggle');
                const menu = dd.querySelector('.dropdown-menu');
                if (toggle && menu) alignDropdownToToggle(toggle, menu);
            });
        }, 120);
    }));
}

/**
 * Align dropdown menu so its left edge matches the toggle's left edge.
 * If it would overflow to the right, flip it so right edges align instead.
 */
function alignDropdownToToggle(toggle, menu) {
    // reset
    menu.style.left = '';
    menu.style.right = '';
    menu.style.transform = '';
    // Position the menu using fixed coordinates so it's relative to the viewport.
    menu.style.position = 'fixed';

    const rect = toggle.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const pad = 12; // small gutter from edges

    // Place menu below the toggle, aligned to its left edge initially
    const top = Math.round(rect.bottom + 8); // 8px gap
    const left = Math.round(rect.left);
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.right = 'auto';
    menu.style.transformOrigin = 'left top';

    // Allow the browser to layout and then measure
    const mRect = menu.getBoundingClientRect();

    // If menu overflows to the right, flip it so its right edge aligns to the toggle's right edge
    if (mRect.right > viewportWidth - pad) {
        const rightOffset = Math.max(pad, viewportWidth - Math.round(rect.right));
        menu.style.left = 'auto';
        menu.style.right = rightOffset + 'px';
        menu.style.transformOrigin = 'right top';
    }

    // Ensure menu width doesn't overflow viewport
    const finalRect = menu.getBoundingClientRect();
    const maxW = Math.max(200, viewportWidth - (pad * 2));
    if (finalRect.width > maxW) {
        menu.style.maxWidth = maxW + 'px';
        menu.style.overflow = 'auto';
    }
}

// Back to top button
function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// Form validation
function setupFormValidation() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic validation
            const name = document.getElementById('name');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const verify = document.getElementById('humanVerify');
            
            let isValid = true;
            
            // Reset errors
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
            
            // Name validation
            if (!name.value.trim()) {
                showError(name, 'Name is required');
                isValid = false;
            }
            
            // Email validation
            if (!email.value.trim()) {
                showError(email, 'Email is required');
                isValid = false;
            } else if (!isValidEmail(email.value)) {
                showError(email, 'Please enter a valid email address');
                isValid = false;
            }
            
            // Phone validation
            if (!phone.value.trim()) {
                showError(phone, 'Phone number is required');
                isValid = false;
            }
            
            // Human verification
            if (!verify.checked) {
                showError(verify, 'Please verify you are human');
                isValid = false;
            }
            
            if (isValid) {
                // Form is valid - submit it
                const submitBtn = document.getElementById('submitBtn');
                const originalText = submitBtn.querySelector('.btn-text')?.textContent;
                
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                }
                
                // Simulate form submission
                setTimeout(() => {
                    showNotification('Message sent successfully! We\'ll contact you soon.', 'success');
                    contactForm.reset();
                    
                    if (submitBtn && originalText) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<span class="btn-text">${originalText}</span>`;
                    }
                }, 1500);
            }
        });
    }
    
    function showError(element, message) {
        const errorId = element.id + '-error';
        const errorElement = document.getElementById(errorId);
        
        if (errorElement) {
            errorElement.textContent = message;
            element.classList.add('error');
        }
    }
    
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

// Quick view modal for product cards
function setupQuickView() {
    const buttons = document.querySelectorAll('.product-quick-view');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = btn.closest('.product-card');
            if (!card) return;

            // Gather product data
            const img = card.querySelector('.product-image img')?.src || '';
            const title = card.querySelector('.product-title')?.textContent || '';
            const desc = card.querySelector('.product-description')?.textContent || '';
            const price = card.querySelector('.price')?.textContent || '';
            const specs = Array.from(card.querySelectorAll('.product-features .feature-tag')).map(el => el.textContent.trim());

            openQuickView({ img, title, desc, price, specs }, btn);
        });
    });
}

function openQuickView(data, opener) {
        // More detailed specs placeholder — if data.specs provided, render list
        const specsHtml = (data.specs && data.specs.length) ? (`<ul class="product-specs">` + data.specs.map(s => `<li>${escapeHtml(s)}</li>`).join('') + `</ul>`) : '';

        // build shop link to the live shop page (search by title when available)
        const shopUrl = data.title ? ('/shop/?q=' + encodeURIComponent(data.title)) : '/shop/';

        const content = `
            <div class="modal-media"><img src="${data.img}" alt="${escapeHtml(data.title)}"></div>
            <div class="modal-content">
                <h3 class="product-title">${escapeHtml(data.title)}</h3>
                <div class="product-meta"><span class="product-price">${escapeHtml(data.price)}</span></div>
                <p class="product-description">${escapeHtml(data.desc)}</p>
                ${specsHtml}
                <div class="product-actions" style="margin-top:1rem;display:flex;gap:8px;align-items:center;">
                    <a href="${shopUrl}" class="btn btn-primary">See on Shop</a>
                    <button class="btn btn-outline" aria-label="Add to wishlist"><i class="far fa-heart"></i></button>
                    <button class="btn ghost modal-close-alt" aria-label="Close">Close</button>
                </div>
            </div>
        `;

        openModal({
            title: data.title || 'Product quick view',
            content,
            opener,
            className: 'modal-quick-view'
        });
}

function escapeHtml(unsafe) {
    return (unsafe || '').replace(/[&<>"']/g, function(m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m];
    });
}

// Smooth scroll for anchor links
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#' || href === '#!') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Update URL
                history.pushState(null, null, href);

                const mobileNav = document.getElementById('mobileNav');
                if (mobileNav?.classList.contains('active') && typeof mobileNav.closeMenu === 'function') {
                    mobileNav.closeMenu();
                }
            }
        });
    });
}

// Loading screen
function setupLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingOverlay) {
        // Hide loading screen when page is fully loaded
        window.addEventListener('load', () => {
            setTimeout(() => {
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.visibility = 'hidden';
            }, 500);
        });
        
        // If page takes too long to load, hide anyway
        setTimeout(() => {
            if (loadingOverlay.style.visibility !== 'hidden') {
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.visibility = 'hidden';
            }
        }, 3000);
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                          type === 'error' ? 'exclamation-circle' : 
                          'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close" aria-label="Close notification">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Intersection Observer for animations
function setupAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '50px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.product-card, .feature-card, .installation-card').forEach(el => {
        observer.observe(el);
    });
}

// Product hover and click interactions
function setupProductInteractions() {
    const cards = document.querySelectorAll('.product-card, .product');
    if (!cards.length) return;

    cards.forEach(card => {
        // Hover effect (desktop)
        card.addEventListener('mouseenter', () => card.classList.add('hovered'));
        card.addEventListener('mouseleave', () => card.classList.remove('hovered'));

        // Click opens quick view if not clicking a link or button
        card.addEventListener('click', (e) => {
            const target = e.target;
            // if a link or button was clicked, ignore here
            if (target.closest('a') || target.closest('button')) return;
            // prefer to find the quick view button inside
            const quick = card.querySelector('.product-quick-view');
            if (quick) { quick.click(); }
        });
    });
}

// Export for global access if needed
window.PoshPearlApp = {
    showNotification,
    initializeApp
};

function setupActiveNavigation() {
    const navLinks = Array.from(document.querySelectorAll('a.nav-link[href^="#"], a.mobile-nav-link[href^="#"]'));
    if (!navLinks.length) return;

    const sectionMap = new Map();
    navLinks.forEach(link => {
        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const section = document.querySelector(targetId);
        if (!section) return;
        if (!sectionMap.has(section)) sectionMap.set(section, []);
        sectionMap.get(section).push(link);
    });

    if (!sectionMap.size) return;

    const clearActive = () => {
        navLinks.forEach(link => link.classList.remove('active'));
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            clearActive();
            const links = sectionMap.get(entry.target) || [];
            links.forEach(link => link.classList.add('active'));
        });
    }, {
        threshold: 0.4,
        rootMargin: '-20% 0px -55% 0px'
    });

    sectionMap.forEach((_links, section) => observer.observe(section));

    if (window.location.hash) {
        const active = navLinks.find(link => link.getAttribute('href') === window.location.hash);
        active?.classList.add('active');
    }
}

function setupThemeToggle() {
    const body = document.body;
    const root = document.documentElement;
    if (body && body.classList.contains('pp-light')) {
        // Force light and skip toggling on public/light pages
        root.setAttribute('data-theme', 'light');
        try { localStorage.setItem('pp-theme', 'light'); } catch (e) {}
        return; // stop here: no dark toggle on light pages
    }
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const text = toggle.querySelector('.theme-toggle-text');
    const icon = toggle.querySelector('i');
    const stored = localStorage.getItem('pp-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored || (prefersDark ? 'dark' : 'light');

    const applyTheme = (mode, persist = true) => {
        if (mode === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
        toggle.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
        if (text) text.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
        if (icon) icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        if (persist) localStorage.setItem('pp-theme', mode);
    };

    applyTheme(initial, false);

    toggle.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });
}

function setupSkeletons() {
    const containers = document.querySelectorAll('[data-skeleton]');
    if (!containers.length) return;

    containers.forEach(container => {
        container.classList.add('is-loading');
        const images = Array.from(container.querySelectorAll('img'));
        if (!images.length) {
            container.classList.remove('is-loading');
            return;
        }

        let loaded = 0;
        const onDone = () => {
            loaded += 1;
            if (loaded >= images.length) {
                container.classList.remove('is-loading');
            }
        };

        images.forEach(img => {
            if (img.complete) {
                onDone();
            } else {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
            }
        });

        setTimeout(() => container.classList.remove('is-loading'), 4000);
    });
}

function openModal({ title, content, opener, className }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.tabIndex = -1;

    const modal = document.createElement('div');
    modal.className = `modal animate-in ${className || ''}`.trim();
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || 'Dialog');

    modal.innerHTML = `
        <button class="modal-close" aria-label="Close dialog">&times;</button>
        ${content}
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    const previouslyFocused = opener || document.activeElement;

    function trap(e) {
        if (e.key === 'Tab') {
            if (focusable.length === 0) {
                e.preventDefault();
                return;
            }
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }

    function close() {
        document.removeEventListener('keydown', trap);
        backdrop.remove();
        document.body.style.overflow = prevOverflow;
        previouslyFocused?.focus?.();
    }

    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) close(); });
    modal.querySelectorAll('.modal-close, .modal-close-alt').forEach(btn => btn.addEventListener('click', close));
    document.addEventListener('keydown', trap);

    (firstFocusable || modal.querySelector('.modal-close'))?.focus();
}
