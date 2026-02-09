/**
 * Advanced Interactions JavaScript
 * Premium micro-interactions for PoshPearl B2B platform
 */

(function () {
    'use strict';

    // ==========================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================
    const Toast = {
        container: null,

        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        },

        show(message, type = 'success', duration = 4000) {
            this.init();

            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            const toast = document.createElement('div');
            toast.className = `toast-burgundy toast-${type}`;
            toast.innerHTML = `
        <i class="toast-icon fa-solid ${icons[type] || icons.info}"></i>
        <span class="toast-content">${message}</span>
        <button class="toast-close" aria-label="Close">
          <i class="fa-solid fa-times"></i>
        </button>
      `;

            this.container.appendChild(toast);

            // Close button handler
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => this.remove(toast));

            // Auto-dismiss
            if (duration > 0) {
                setTimeout(() => this.remove(toast), duration);
            }

            return toast;
        },

        remove(toast) {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 200);
        }
    };

    // Expose globally
    window.Toast = Toast;

    // ==========================================
    // CART COUNTER ANIMATION
    // ==========================================
    function animateCartCounter(count) {
        const counters = document.querySelectorAll('[data-cart-count]');
        counters.forEach(counter => {
            counter.textContent = count;
            counter.classList.add('counter-animate');
            setTimeout(() => {
                counter.classList.remove('counter-animate');
            }, 300);
        });
    }

    window.animateCartCounter = animateCartCounter;

    // ==========================================
    // BUTTON RIPPLE EFFECT
    // ==========================================
    function initRippleEffect() {
        const buttons = document.querySelectorAll('.btn-gold, .btn-primary, .btn-ripple');

        buttons.forEach(button => {
            if (!button.classList.contains('btn-ripple')) {
                button.classList.add('btn-ripple');
            }
        });
    }

    // ==========================================
    // LOADING STATE HELPER
    // ==========================================
    function setButtonLoading(button, loading = true) {
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `
        <span class="spinner-gold d-inline-block me-2" style="width: 16px; height: 16px; border-width: 2px;"></span>
        Loading...
      `;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    window.setButtonLoading = setButtonLoading;

    // ==========================================
    // FORM ENHANCEMENT
    // ==========================================
    function enhanceForms() {
        const forms = document.querySelectorAll('form[data-enhance]');

        forms.forEach(form => {
            form.addEventListener('submit', function (e) {
                const submitBtn = this.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    setButtonLoading(submitBtn, true);
                }
            });
        });
    }

    // ==========================================
    // SKELETON LOADER HELPER
    // ==========================================
    function showSkeleton(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = `
      <div class="skeleton skeleton-card mb-3"></div>
      <div class="skeleton skeleton-text" style="width: 80%;"></div>
      <div class="skeleton skeleton-text" style="width: 60%;"></div>
    `;
    }

    function hideSkeleton(containerSelector, content) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = content;
    }

    window.showSkeleton = showSkeleton;
    window.hideSkeleton = hideSkeleton;

    // ==========================================
    // SMOOTH SCROLL TO ERROR
    // ==========================================
    function scrollToError() {
        const firstError = document.querySelector('.invalid-feedback.d-block, .is-invalid');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Find associated input and focus
            const input = firstError.closest('.form-group, .mb-3')?.querySelector('input, select, textarea');
            if (input) {
                setTimeout(() => input.focus(), 300);
            }
        }
    }

    window.scrollToError = scrollToError;

    // ==========================================
    // ADD TO CART ANIMATION
    // ==========================================
    function addToCartAnimation(productElement) {
        // Show toast
        Toast.show('Added to cart successfully!', 'success');

        // Animate cart counter
        const currentCount = parseInt(document.querySelector('[data-cart-count]')?.textContent || 0);
        animateCartCounter(currentCount + 1);

        // Optional: Flying animation (product to cart)
        if (productElement) {
            const clone = productElement.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.zIndex = '9999';
            clone.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

            const rect = productElement.getBoundingClientRect();
            clone.style.top = rect.top + 'px';
            clone.style.left = rect.left + 'px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';

            document.body.appendChild(clone);

            const cartIcon = document.querySelector('[data-cart-toggle]');
            if (cartIcon) {
                const cartRect = cartIcon.getBoundingClientRect();
                setTimeout(() => {
                    clone.style.top = cartRect.top + 'px';
                    clone.style.left = cartRect.left + 'px';
                    clone.style.transform = 'scale(0.1)';
                    clone.style.opacity = '0';
                }, 50);

                setTimeout(() => clone.remove(), 700);
            }
        }
    }

    window.addToCartAnimation = addToCartAnimation;

    // ==========================================
    // PROGRESS STEPS
    // ==========================================
    function setProgressStep(stepNumber) {
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < stepNumber - 1) {
                step.classList.add('completed');
            } else if (index === stepNumber - 1) {
                step.classList.add('active');
            }
        });
    }

    window.setProgressStep = setProgressStep;

    // ==========================================
    // INITIALIZATION
    // ==========================================
    document.addEventListener('DOMContentLoaded', function () {
        initRippleEffect();
        enhanceForms();

        // Auto-scroll to errors on page load
        if (document.querySelector('.invalid-feedback.d-block')) {
            setTimeout(scrollToError, 500);
        }

        console.log('✨ PoshPearl Advanced Interactions Loaded');
    });

})();
