/**
 * Advanced Shop Filters
 * AJAX-based filtering with burgundy + gold styling
 */

(function () {
    'use strict';

    const ShopFilters = {
        // Filter state
        state: {
            priceMin: 0,
            priceMax: 500000,
            features: [],
            inStock: null,
            sort: 'default'
        },

        init() {
            this.bindEvents();
            this.loadStateFromURL();
            this.initPriceSlider();
        },

        // Event bindings
        bindEvents() {
            // Feature checkboxes
            document.querySelectorAll('[data-feature]').forEach(checkbox => {
                checkbox.addEventListener('change', () => this.updateFilters());
            });

            // Stock filter
            document.querySelectorAll('[name="stock"]').forEach(radio => {
                radio.addEventListener('change', () => this.updateFilters());
            });

            // Sort dropdown
            const sortSelect = document.querySelector('[data-sort]');
            if (sortSelect) {
                sortSelect.addEventListener('change', () => this.updateFilters());
            }

            // Clear filters
            const clearBtn = document.querySelector('[data-clear-filters]');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearAllFilters());
            }

            // Apply filters button (mobile)
            const applyBtn = document.querySelector('[data-apply-filters]');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => this.updateFilters());
            }
        },

        // Initialize price range slider
        initPriceSlider() {
            const slider = document.querySelector('[data-price-slider]');
            if (!slider) return;

            const minInput = document.querySelector('[data-price-min]');
            const maxInput = document.querySelector('[data-price-max]');
            const minValue = document.querySelector('[data-price-min-value]');
            const maxValue = document.querySelector('[data-price-max-value]');

            // Update display when slider changes
            const updateDisplay = () => {
                const min = parseInt(minInput.value);
                const max = parseInt(maxInput.value);

                if (minValue) minValue.textContent = this.formatPrice(min);
                if (maxValue) maxValue.textContent = this.formatPrice(max);

                this.state.priceMin = min;
                this.state.priceMax = max;
            };

            minInput?.addEventListener('input', updateDisplay);
            maxInput?.addEventListener('input', updateDisplay);

            minInput?.addEventListener('change', () => this.updateFilters());
            maxInput?.addEventListener('change', () => this.updateFilters());

            updateDisplay();
        },

        // Update filter state and fetch results
        updateFilters() {
            // Collect selected features
            this.state.features = Array.from(document.querySelectorAll('[data-feature]:checked'))
                .map(cb => cb.dataset.feature);

            // Stock filter
            const stockRadio = document.querySelector('[name="stock"]:checked');
            this.state.inStock = stockRadio ? stockRadio.value === 'in-stock' : null;

            // Sort
            const sortSelect = document.querySelector('[data-sort]');
            this.state.sort = sortSelect ? sortSelect.value : 'default';

            // Update URL
            this.updateURL();

            // Fetch filtered results
            this.fetchProducts();
        },

        // Fetch products via AJAX
        async fetchProducts() {
            const container = document.querySelector('[data-products-grid]');
            if (!container) return;

            // Show loading skeleton
            this.showLoading(container);

            try {
                const params = new URLSearchParams({
                    price_min: this.state.priceMin,
                    price_max: this.state.priceMax,
                    features: this.state.features.join(','),
                    sort: this.state.sort
                });

                if (this.state.inStock !== null) {
                    params.append('in_stock', this.state.inStock);
                }

                const response = await fetch(`/shop/?${params.toString()}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) throw new Error('Failed to fetch products');

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newProducts = doc.querySelector('[data-products-grid]');

                if (newProducts) {
                    container.innerHTML = newProducts.innerHTML;
                    this.updateFilterCounts();
                    this.showActiveFilters();
                }

            } catch (error) {
                console.error('Filter error:', error);
                Toast.show('Failed to load products', 'error');
            }
        },

        // Show loading state
        showLoading(container) {
            const skeletonHTML = `
        <div class="col-md-6 col-lg-4">
          <div class="skeleton skeleton-card"></div>
        </div>
        <div class="col-md-6 col-lg-4">
          <div class="skeleton skeleton-card"></div>
        </div>
        <div class="col-md-6 col-lg-4">
          <div class="skeleton skeleton-card"></div>
        </div>
      `;
            container.innerHTML = skeletonHTML.repeat(3);
        },

        // Update filter counts (e.g., "Bluetooth (5)")
        updateFilterCounts() {
            // This would be populated from server response
            // For now, placeholder
        },

        // Show active filter pills
        showActiveFilters() {
            const activeContainer = document.querySelector('[data-active-filters]');
            if (!activeContainer) return;

            const pills = [];

            // Price filter
            if (this.state.priceMin > 0 || this.state.priceMax < 500000) {
                pills.push({
                    label: `${this.formatPrice(this.state.priceMin)} - ${this.formatPrice(this.state.priceMax)}`,
                    type: 'price'
                });
            }

            // Feature filters
            this.state.features.forEach(feature => {
                pills.push({
                    label: feature,
                    type: 'feature',
                    value: feature
                });
            });

            // Stock filter
            if (this.state.inStock !== null) {
                pills.push({
                    label: 'In Stock Only',
                    type: 'stock'
                });
            }

            // Render pills
            if (pills.length === 0) {
                activeContainer.innerHTML = '';
                return;
            }

            activeContainer.innerHTML = `
        <div class="d-flex flex-wrap gap-2 mb-3">
          ${pills.map(pill => `
            <span class="badge bg-primary d-flex align-items-center gap-2">
              ${pill.label}
              <button type="button" class="btn-close btn-close-white btn-sm" 
                      style="font-size: 0.65rem;" 
                      data-remove-filter="${pill.type}" 
                      data-filter-value="${pill.value || ''}"
                      aria-label="Remove filter"></button>
            </span>
          `).join('')}
          <button class="btn btn-sm btn-link text-secondary" data-clear-filters>
            Clear All
          </button>
        </div>
      `;

            // Bind remove events
            activeContainer.querySelectorAll('[data-remove-filter]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const type = e.currentTarget.dataset.removeFilter;
                    const value = e.currentTarget.dataset.filterValue;
                    this.removeFilter(type, value);
                });
            });
        },

        // Remove a single filter
        removeFilter(type, value) {
            switch (type) {
                case 'price':
                    document.querySelector('[data-price-min]').value = 0;
                    document.querySelector('[data-price-max]').value = 500000;
                    break;
                case 'feature':
                    const checkbox = document.querySelector(`[data-feature="${value}"]`);
                    if (checkbox) checkbox.checked = false;
                    break;
                case 'stock':
                    document.querySelector('[name="stock"][value="all"]').checked = true;
                    break;
            }
            this.updateFilters();
        },

        // Clear all filters
        clearAllFilters() {
            // Reset price
            document.querySelector('[data-price-min]').value = 0;
            document.querySelector('[data-price-max]').value = 500000;

            // Uncheck all features
            document.querySelectorAll('[data-feature]').forEach(cb => cb.checked = false);

            // Reset stock
            const allStockRadio = document.querySelector('[name="stock"][value="all"]');
            if (allStockRadio) allStockRadio.checked = true;

            // Reset sort
            const sortSelect = document.querySelector('[data-sort]');
            if (sortSelect) sortSelect.value = 'default';

            this.updateFilters();
        },

        // Update URL with filter state
        updateURL() {
            const params = new URLSearchParams();

            if (this.state.priceMin > 0) params.append('price_min', this.state.priceMin);
            if (this.state.priceMax < 500000) params.append('price_max', this.state.priceMax);
            if (this.state.features.length > 0) params.append('features', this.state.features.join(','));
            if (this.state.inStock !== null) params.append('in_stock', this.state.inStock);
            if (this.state.sort !== 'default') params.append('sort', this.state.sort);

            const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
            window.history.replaceState({}, '', newURL);
        },

        // Load filter state from URL
        loadStateFromURL() {
            const params = new URLSearchParams(window.location.search);

            // Price
            const priceMin = params.get('price_min');
            const priceMax = params.get('price_max');
            if (priceMin) {
                this.state.priceMin = parseInt(priceMin);
                const input = document.querySelector('[data-price-min]');
                if (input) input.value = priceMin;
            }
            if (priceMax) {
                this.state.priceMax = parseInt(priceMax);
                const input = document.querySelector('[data-price-max]');
                if (input) input.value = priceMax;
            }

            // Features
            const features = params.get('features');
            if (features) {
                this.state.features = features.split(',');
                this.state.features.forEach(feature => {
                    const checkbox = document.querySelector(`[data-feature="${feature}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            // Stock
            const inStock = params.get('in_stock');
            if (inStock !== null) {
                this.state.inStock = inStock === 'true';
                const radio = document.querySelector(`[name="stock"][value="${inStock === 'true' ? 'in-stock' : 'all'}"]`);
                if (radio) radio.checked = true;
            }

            // Sort
            const sort = params.get('sort');
            if (sort) {
                this.state.sort = sort;
                const select = document.querySelector('[data-sort]');
                if (select) select.value = sort;
            }

            this.showActiveFilters();
        },

        // Format price
        formatPrice(price) {
            return `NGN ${parseInt(price).toLocaleString()}`;
        }
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('[data-shop-filters]')) {
            ShopFilters.init();
        }
    });

    window.ShopFilters = ShopFilters;

})();
