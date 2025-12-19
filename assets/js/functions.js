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
}

// Mobile menu functionality
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const overlay = document.getElementById('overlay');

    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNav.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        mobileCloseBtn?.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });

        overlay?.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
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
            });
        });
    }
}

// Desktop dropdown functionality
function setupDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close other dropdowns
                dropdowns.forEach(other => {
                    if (other !== dropdown && other.classList.contains('active')) {
                        other.classList.remove('active');
                        other.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                    }
                });
                
                // Toggle current dropdown
                const isActive = dropdown.classList.contains('active');
                dropdown.classList.toggle('active', !isActive);
                toggle.setAttribute('aria-expanded', !isActive);
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
            dropdown.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
        });
    });
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

// Initialize animations
setupAnimations();

// Export for global access if needed
window.PoshPearlApp = {
    showNotification,
    initializeApp
};