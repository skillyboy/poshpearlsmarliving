/**
 * Product Comparison System
 * Allows users to compare up to 4 products side-by-side
 */

(function () {
    'use strict';

    const Compare = {
        maxProducts: 4,
        storageKey: 'poshpearl_compare',
        products: [],

        init() {
            this.loadFromStorage();
            this.renderComparison();
            this.attachEventListeners();
            this.updateUI();
        },

        loadFromStorage() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                this.products = stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.error('Error loading comparison:', e);
                this.products = [];
            }
        },

        saveToStorage() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.products));
            } catch (e) {
                console.error('Error saving comparison:', e);
            }
        },

        addProduct(product) {
            // Check if product already exists
            if (this.products.some(p => p.id === product.id)) {
                this.showToast('Product already in comparison', 'warning');
                return false;
            }

            // Check max limit
            if (this.products.length >= this.maxProducts) {
                this.showToast(`Maximum ${this.maxProducts} products allowed`, 'error');
                return false;
            }

            this.products.push(product);
            this.saveToStorage();
            this.updateUI();
            this.showToast('Added to comparison', 'success');
            return true;
        },

        removeProduct(productId) {
            this.products = this.products.filter(p => p.id !== productId);
            this.saveToStorage();
            this.updateUI();
            this.renderComparison();
        },

        clearAll() {
            if (confirm('Remove all products from comparison?')) {
                this.products = [];
                this.saveToStorage();
                this.updateUI();
                this.renderComparison();
            }
        },

        updateUI() {
            // Update compare bar (if on shop page)
            const compareBar = document.getElementById('compareBar');
            if (compareBar) {
                const count = this.products.length;
                if (count > 0) {
                    compareBar.style.display = 'flex';
                    document.getElementById('compareCount').textContent = count;
                } else {
                    compareBar.style.display = 'none';
                }
            }

            // Update checkboxes (if on shop page)
            document.querySelectorAll('[data-compare-checkbox]').forEach(checkbox => {
                const productId = parseInt(checkbox.dataset.productId);
                checkbox.checked = this.products.some(p => p.id === productId);
            });

            // Update counter badge
            const badges = document.querySelectorAll('[data-compare-count]');
            badges.forEach(badge => {
                badge.textContent = this.products.length;
                badge.style.display = this.products.length > 0 ? 'flex' : 'none';
            });
        },

        renderComparison() {
            const table = document.getElementById('comparisonTable');
            const empty = document.getElementById('emptyState');
            const actions = document.getElementById('comparisonActions');

            if (this.products.length === 0) {
                if (table) table.style.display = 'none';
                if (actions) actions.style.display = 'none';
                if (empty) empty.style.display = 'block';
                return;
            }

            if (table) table.style.display = 'block';
            if (actions) actions.style.display = 'block';
            if (empty) empty.style.display = 'none';

            // Populate table
            this.products.forEach((product, index) => {
                const col = index + 1;

                // Header
                const header = document.getElementById(`productHeader${col}`);
                if (header) {
                    header.innerHTML = `
            <button class="btn btn-sm btn-link text-white" onclick="CompareModule.removeProduct(${product.id})">
              <i class="fa-solid fa-times"></i>
            </button>
          `;
                }

                // Image
                const imageCell = document.getElementById(`productImage${col}`);
                if (imageCell) {
                    imageCell.innerHTML = `
            <img src="${product.image}" alt="${product.name}" 
                 class="img-fluid mb-2" style="max-height: 150px; object-fit: contain;">
            <div class="fw-bold">${product.name}</div>
            <a href="${product.url}" class="btn btn-sm btn-outline-primary mt-2">View Details</a>
          `;
                }

                // Price
                const priceCell = document.getElementById(`productPrice${col}`);
                if (priceCell) {
                    priceCell.textContent = `${product.currency} ${product.price.toLocaleString()}`;
                }

                // Stock
                const stockCell = document.getElementById(`productStock${col}`);
                if (stockCell) {
                    const inStock = product.stock > 0;
                    stockCell.innerHTML = inStock
                        ? '<span class="badge bg-success">In Stock</span>'
                        : '<span class="badge bg-danger">Out of Stock</span>';
                }

                // Description
                const descCell = document.getElementById(`productDesc${col}`);
                if (descCell) {
                    descCell.textContent = product.description || 'No description available';
                }

                // Actions
                const actionsCell = document.getElementById(`productActions${col}`);
                if (actionsCell) {
                    actionsCell.innerHTML = `
            <button class="btn btn-gold btn-sm w-100 mb-2" 
                    onclick="window.location.href='${product.url}'">
              <i class="fa-solid fa-eye me-1"></i> View
            </button>
            <button class="btn btn-outline-danger btn-sm w-100" 
                    onclick="CompareModule.removeProduct(${product.id})">
              <i class="fa-solid fa-trash me-1"></i> Remove
            </button>
          `;
                }
            });

            // Clear unused columns
            for (let i = this.products.length + 1; i <= this.maxProducts; i++) {
                ['productHeader', 'productImage', 'productPrice', 'productStock', 'productDesc', 'productActions'].forEach(prefix => {
                    const cell = document.getElementById(`${prefix}${i}`);
                    if (cell) cell.innerHTML = '';
                });
            }
        },

        attachEventListeners() {
            // Clear all button
            const clearBtn = document.getElementById('clearAll');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearAll());
            }

            // Compare checkboxes (on shop page)
            document.addEventListener('change', (e) => {
                const checkbox = e.target.closest('[data-compare-checkbox]');
                if (checkbox) {
                    const productData = {
                        id: parseInt(checkbox.dataset.productId),
                        name: checkbox.dataset.productName,
                        price: parseFloat(checkbox.dataset.productPrice),
                        currency: checkbox.dataset.productCurrency,
                        image: checkbox.dataset.productImage,
                        url: checkbox.dataset.productUrl,
                        stock: parseInt(checkbox.dataset.productStock),
                        description: checkbox.dataset.productDescription || ''
                    };

                    if (checkbox.checked) {
                        if (!this.addProduct(productData)) {
                            checkbox.checked = false;
                        }
                    } else {
                        this.removeProduct(productData.id);
                    }
                }
            });
        },

        showToast(message, type = 'info') {
            // Simple toast notification
            const toast = document.createElement('div');
            toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
            toast.style.zIndex = '9999';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Compare.init());
    } else {
        Compare.init();
    }

    // Expose globally for inline onclick handlers
    window.CompareModule = Compare;

})();
