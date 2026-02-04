(() => {
    document.documentElement.classList.replace('no-js', 'js');
    const root = document.documentElement;
    const body = document.body;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const qs = (sel, scope = document) => scope.querySelector(sel);
    const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
    const escapeHtml = (value) =>
        (value || '').replace(/[&<>"']/g, (match) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[match]));

    const toastRoot = qs('#toast-root');
    const showToast = (message, type = 'info') => {
        if (!toastRoot) return;
        const toast = document.createElement('div');
        toast.className = `pp-toast ${type}`;
        toast.textContent = message;
        toastRoot.appendChild(toast);
        setTimeout(() => toast.remove(), 3200);
    };

    const formatMoney = (currency, value) => {
        const amount = typeof value === 'number' ? value : Number(value || 0);
        return `${currency} ${amount.toLocaleString()}`;
    };

    const getCookie = (name) => {
        if (!document.cookie) return null;
        const token = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
        return token ? decodeURIComponent(token.split('=')[1]) : null;
    };
    const csrfToken = getCookie('csrftoken');

    const cartToggle = qs('[data-cart-toggle]');
    const cartDrawer = qs('[data-cart-drawer]');
    const cartBackdrop = qs('[data-cart-backdrop]');
    const cartClose = qs('[data-cart-close]');
    const cartItemsEl = qs('[data-cart-items]');
    const cartSubtotalEl = qs('[data-cart-subtotal]');
    const cartCountEls = qsa('[data-cart-count]');
    const cartPage = qs('[data-cart-page]');

    const openCart = () => {
        if (!cartDrawer) return;
        body.classList.add('cart-open');
        cartDrawer.setAttribute('aria-hidden', 'false');
        if (cartBackdrop) cartBackdrop.hidden = false;
        refreshCart();
    };

    const closeCart = () => {
        if (!cartDrawer) return;
        body.classList.remove('cart-open');
        cartDrawer.setAttribute('aria-hidden', 'true');
        if (cartBackdrop) cartBackdrop.hidden = true;
    };

    cartToggle?.addEventListener('click', () => {
        body.classList.contains('cart-open') ? closeCart() : openCart();
    });
    cartClose?.addEventListener('click', closeCart);
    cartBackdrop?.addEventListener('click', closeCart);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && body.classList.contains('cart-open')) closeCart();
    });

    const cartRequest = async (url, options) => {
        const merged = { ...options };
        const method = (merged.method || 'GET').toUpperCase();
        merged.headers = { ...(merged.headers || {}) };
        if (method !== 'GET' && csrfToken) {
            merged.headers['X-CSRFToken'] = csrfToken;
        }
        const response = await fetch(url, merged);
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.detail || 'Cart update failed.');
        }
        return response.json();
    };

    const renderCartDrawer = (data) => {
        if (!cartItemsEl || !cartSubtotalEl) return;
        cartItemsEl.innerHTML = '';
        if (!data?.items?.length) {
            cartItemsEl.innerHTML = '<p>Your cart is empty.</p>';
            cartSubtotalEl.textContent = formatMoney('NGN', 0);
            return;
        }
        data.items.forEach((item) => {
            const node = document.createElement('div');
            node.className = 'pp-cart-item-mini';
            node.innerHTML = `
                <img src="${item.image || '/static/assets/images/products/d2pro1.jpeg'}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='/static/assets/images/products/d2pro1.jpeg';">
                <div>
                    <h4>${escapeHtml(item.name)}</h4>
                    <span>${item.quantity} × ${formatMoney(item.currency, item.unit_price)}</span>
                </div>
                <button type="button" data-cart-remove data-item-id="${item.id}" aria-label="Remove item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            cartItemsEl.appendChild(node);
        });
        cartSubtotalEl.textContent = formatMoney(data.currency, data.subtotal);
    };

    const updateCartCount = (data) => {
        const count = data?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        cartCountEls.forEach((el) => {
            el.textContent = count;
        });
    };

    const refreshCart = async () => {
        try {
            const data = await cartRequest('/api/cart', { method: 'GET' });
            renderCartDrawer(data);
            updateCartCount(data);
            return data;
        } catch (error) {
            showToast(error.message || 'Unable to load cart.', 'error');
            return null;
        }
    };

    const syncCartPage = (data) => {
        if (!cartPage || !data) return;
        if (!data.items.length) {
            window.location.reload();
            return;
        }
        const subtotalEl = qs('[data-cart-page-subtotal]', cartPage);
        if (subtotalEl) subtotalEl.textContent = formatMoney(data.currency, data.subtotal);
        const itemsById = new Map(data.items.map((item) => [String(item.id), item]));
        qsa('[data-cart-item]', cartPage).forEach((row) => {
            const itemId = row.getAttribute('data-item-id');
            const item = itemsById.get(itemId);
            if (!item) {
                row.remove();
                return;
            }
            const qtyInput = qs('[data-qty-input]', row);
            if (qtyInput) qtyInput.value = item.quantity;
            const unitPrice = qs('[data-unit-price]', row);
            if (unitPrice) unitPrice.textContent = formatMoney(item.currency, item.unit_price);
            const lineTotal = qs('[data-line-total]', row);
            if (lineTotal) lineTotal.textContent = formatMoney(item.currency, item.line_total);
        });
    };

    const updateItemQuantity = async (itemId, quantity) => {
        const data = await cartRequest(`/api/cart/items/${itemId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity }),
        });
        renderCartDrawer(data);
        updateCartCount(data);
        syncCartPage(data);
    };

    const removeCartItem = async (itemId) => {
        const data = await cartRequest(`/api/cart/items/${itemId}`, {
            method: 'DELETE',
        });
        renderCartDrawer(data);
        updateCartCount(data);
        syncCartPage(data);
    };

    const handleAddToCart = async (button) => {
        const productId = button.getAttribute('data-product-id');
        if (!productId) {
            showToast('Missing product id.', 'error');
            return;
        }
        const qtyInput = button.closest('.pp-hero__actions')?.querySelector('[data-add-qty]');
        const quantity = Math.max(1, Number(qtyInput?.value || 1));
        const previousLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'Adding...';
        try {
            const data = await cartRequest('/api/cart/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ product_id: Number(productId), quantity }),
            });
            updateCartCount(data);
            renderCartDrawer(data);
            showToast('Added to cart.', 'success');
            openCart();
        } catch (error) {
            showToast(error.message || 'Unable to add item.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = previousLabel;
        }
    };

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-add-to-cart]');
        if (!button) return;
        event.preventDefault();
        handleAddToCart(button);
    });

    cartItemsEl?.addEventListener('click', (event) => {
        const target = event.target.closest('[data-cart-remove]');
        if (!target) return;
        const itemId = target.getAttribute('data-item-id');
        if (!itemId) return;
        removeCartItem(itemId).catch((error) => {
            showToast(error.message || 'Unable to remove item.', 'error');
        });
    });

    cartPage?.addEventListener('click', (event) => {
        const row = event.target.closest('[data-cart-item]');
        if (!row) return;
        const itemId = row.getAttribute('data-item-id');
        if (!itemId) return;
        if (event.target.closest('[data-cart-remove]')) {
            removeCartItem(itemId).catch((error) => {
                showToast(error.message || 'Unable to remove item.', 'error');
            });
            return;
        }
        if (event.target.closest('[data-qty-inc]') || event.target.closest('[data-qty-dec]')) {
            const input = qs('[data-qty-input]', row);
            if (!input) return;
            const current = Number(input.value || 1);
            const next = event.target.closest('[data-qty-inc]') ? current + 1 : Math.max(1, current - 1);
            input.value = next;
            updateItemQuantity(itemId, next).catch((error) => {
                showToast(error.message || 'Unable to update quantity.', 'error');
            });
        }
    });

    cartPage?.addEventListener('change', (event) => {
        if (!event.target.matches('[data-qty-input]')) return;
        const row = event.target.closest('[data-cart-item]');
        if (!row) return;
        const itemId = row.getAttribute('data-item-id');
        if (!itemId) return;
        const next = Math.max(1, Number(event.target.value || 1));
        event.target.value = next;
        updateItemQuantity(itemId, next).catch((error) => {
            showToast(error.message || 'Unable to update quantity.', 'error');
        });
    });

    const themeToggle = qs('[data-theme-toggle]');
    const setTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
        }
        try {
            localStorage.setItem('pp-theme', theme);
        } catch (e) {
            // Ignore storage errors.
        }
    };

    if (themeToggle) {
        let stored = null;
        try {
            stored = localStorage.getItem('pp-theme');
        } catch (e) {
            stored = null;
        }
        setTheme(stored || 'light');
        themeToggle.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            setTheme(next);
        });
    }

    const header = qs('[data-sticky-header]');
    if (header) {
        const onScroll = () => {
            header.classList.toggle('is-sticky', window.scrollY > 8);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    const navToggle = qs('[data-nav-toggle]');
    const nav = qs('[data-nav]');
    const overlay = qs('[data-nav-overlay]');
    let lastFocused = null;

    const openNav = () => {
        if (!nav || !navToggle) return;
        lastFocused = document.activeElement;
        body.classList.add('nav-open');
        navToggle.setAttribute('aria-expanded', 'true');
        if (overlay) overlay.hidden = false;
        const firstLink = nav.querySelector('a');
        firstLink?.focus();
    };

    const closeNav = () => {
        if (!nav || !navToggle) return;
        body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        if (overlay) overlay.hidden = true;
        if (lastFocused instanceof HTMLElement) lastFocused.focus();
    };

    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            body.classList.contains('nav-open') ? closeNav() : openNav();
        });
        overlay?.addEventListener('click', closeNav);
        qsa('a', nav).forEach((link) => {
            link.addEventListener('click', () => {
                if (body.classList.contains('nav-open')) closeNav();
            });
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && body.classList.contains('nav-open')) {
                closeNav();
            }
        });
    }

    const mainNavLinks = qsa('.main-nav a');
    if (mainNavLinks.length) {
        const path = window.location.pathname.replace(/\/$/, '') || '/';
        mainNavLinks.forEach((link) => {
            const href = link.getAttribute('href')?.replace(/\/$/, '') || '';
            if (href && href === path) {
                link.classList.add('is-active');
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    qsa('a[data-scroll]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const targetId = link.getAttribute('href');
            if (!targetId || !targetId.startsWith('#')) return;
            const target = qs(targetId);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        });
    });

    const sectionLinks = qsa('[data-section-link]');
    const sections = sectionLinks
        .map((link) => {
            const id = link.getAttribute('href');
            return id ? qs(id) : null;
        })
        .filter(Boolean);

    if (sections.length) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const activeId = `#${entry.target.id}`;
                    sectionLinks.forEach((link) => {
                        link.classList.toggle('is-active', link.getAttribute('href') === activeId);
                    });
                });
            },
            { rootMargin: '-45% 0px -50% 0px', threshold: 0.1 }
        );
        sections.forEach((section) => observer.observe(section));
    }

    const modal = qs('[data-modal]');
    const modalContent = modal?.querySelector('[data-modal-content]');
    const modalClose = modal?.querySelector('[data-modal-close]');
    let modalLastFocus = null;

    const openModal = (node) => {
        if (!modal || !modalContent) return;
        modalLastFocus = document.activeElement;
        modalContent.innerHTML = '';
        modalContent.appendChild(node);
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        body.style.overflow = 'hidden';
        const focusable = modalContent.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        focusable?.focus();
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        body.style.overflow = '';
        if (modalLastFocus instanceof HTMLElement) modalLastFocus.focus();
    };

    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal?.classList.contains('is-open')) closeModal();
    });

    const quoteTemplate = qs('#quote-form-template');
    qsa('[data-modal-target="quote"]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            if (!quoteTemplate || !(quoteTemplate instanceof HTMLTemplateElement)) return;
            const node = quoteTemplate.content.cloneNode(true);
            openModal(node);
        });
    });

    qsa('[data-modal-image]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-modal-image');
            if (!src) return;
            const alt = btn.getAttribute('data-modal-alt') || 'Product image';
            const figure = document.createElement('figure');
            figure.innerHTML = `<img src="${src}" alt="${escapeHtml(alt)}" style="width:100%;height:auto;border-radius:16px;">`;
            openModal(figure);
        });
    });

    qsa('[data-gallery]').forEach((gallery) => {
        const mainButton = qs('[data-gallery-main]', gallery);
        const mainImage = mainButton?.querySelector('img');
        const thumbs = qsa('[data-gallery-thumb]', gallery);
        if (!mainButton || !mainImage || !thumbs.length) return;

        thumbs.forEach((thumb) => {
            thumb.addEventListener('click', () => {
                const src = thumb.getAttribute('data-preview-src');
                if (!src) return;
                const alt = thumb.getAttribute('data-preview-alt') || mainImage.alt;
                mainImage.src = src;
                mainImage.alt = alt;
                mainButton.setAttribute('data-modal-image', src);
                mainButton.setAttribute('data-modal-alt', alt);
                thumbs.forEach((item) => item.classList.remove('is-active'));
                thumb.classList.add('is-active');
            });
        });
    });

    const validateField = (field) => {
        const errorEl = field.closest('.pp-field')?.querySelector('.pp-field__error');
        if (!errorEl) return true;
        let message = '';
        if (field.hasAttribute('required') && !field.value.trim()) {
            message = 'This field is required.';
        } else if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) message = 'Enter a valid email address.';
        }
        errorEl.textContent = message;
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
        return !message;
    };

    document.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.matches('[data-validate]')) return;
        event.preventDefault();
        const fields = qsa('input, select, textarea', form);
        const allValid = fields.map(validateField).every(Boolean);
        if (!allValid) return;
        form.classList.add('is-submitting');
        setTimeout(() => {
            form.classList.remove('is-submitting');
            form.reset();
            showToast('Request sent. We will follow up shortly.', 'success');
            closeModal();
        }, 700);
    });

    const animated = qsa('[data-animate]');
    if (animated.length) {
        const revealAll = () => animated.forEach((el) => el.classList.add('is-visible'));
        if (typeof IntersectionObserver === 'undefined') {
            revealAll();
        } else {
            try {
                const reveal = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                entry.target.classList.add('is-visible');
                                reveal.unobserve(entry.target);
                            }
                        });
                    },
                    { threshold: 0.2 }
                );
                animated.forEach((el) => reveal.observe(el));
            } catch (error) {
                revealAll();
            }
        }
    }

    if (body.classList.contains('pp-shop')) {
        body.classList.add('is-loading');
        window.addEventListener('load', () => {
            setTimeout(() => body.classList.remove('is-loading'), 160);
        });
    }

    refreshCart();
})();
