(function(){
    // Site product sync - extracts product data from the page and stores in localStorage
    // Improves slug generation, parses price labels to numbers and keeps a debug-safe approach

    function slugify(s){
        return String(s||'')
            .toLowerCase()
            .trim()
            .normalize('NFKD') // decompose unicode
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g,'-')
            .replace(/(^-|-$)/g,'');
    }

    function parsePrice(label){
        if(!label) return 0;
        try{
            // Remove currency symbols and common separators, keep digits and dot
            const cleaned = String(label).replace(/[^0-9.,]/g, '').replace(/,/g, '');
            const n = parseFloat(cleaned);
            return Number.isFinite(n) ? n : 0;
        }catch(e){ return 0; }
    }

    function shopSearchUrl(term){
        const q = term ? ('q=' + encodeURIComponent(term)) : '';
        return q ? ('/shop/?' + q) : '/shop/';
    }

    function collectProducts(){
        const items = [];

        document.querySelectorAll('.product-card').forEach(card => {
            try{
                const title = card.querySelector('.product-title')?.textContent.trim();
                const priceLabel = card.querySelector('.product-price .price')?.textContent.trim() || '';
                const price = parsePrice(priceLabel);
                const desc = card.querySelector('.product-description')?.textContent.trim() || '';
                const img = card.querySelector('.product-image img')?.currentSrc || card.querySelector('.product-image img')?.src || 'assets/placeholder-1.svg';
                const category = card.getAttribute('data-category') || card.querySelector('.product-category')?.textContent.trim() || 'products';
                const id = slugify(title || category);
                if(title){
                    items.push({ id, title, price, priceLabel: priceLabel || 'Request price', category, stock: 'In stock', img, desc });
                }
            }catch(e){ console.warn('product card parse error', e); }
        });

        // Collect megamenu items
        document.querySelectorAll('#megamenu-products .megamenu-list a').forEach(a => {
            try{
                const title = a.textContent.trim();
                const section = a.closest('.megamenu-section')?.querySelector('.megamenu-title')?.textContent.trim() || 'products';
                const id = slugify(title || section);
                const exists = items.find(x=>x.id===id);
                if(!exists && title){
                    items.push({ id, title, price: 0, priceLabel: 'Request price', category: section, stock: 'Contact for price', img: 'assets/placeholder-2.svg', desc: section + ' — ' + title });
                }

                // make the menu link navigate to shop detail (progressive enhancement)
                a.addEventListener('click', function(e){
                    e.preventDefault();
                    window.location.href = shopSearchUrl(title);
                });
            }catch(e){ }
        });

        // Ensure Buy/Inquire links in product cards point to shop detail via slug id
        document.querySelectorAll('.product-card').forEach(card => {
            try{
                const title = card.querySelector('.product-title')?.textContent.trim();
                if(!title) return;
                const buy = card.querySelector('.product-actions a.btn-primary');
                if(buy){
                    buy.setAttribute('href', shopSearchUrl(title));
                }
            }catch(e){ }
        });

        return items;
    }

    function save(items){
        try{ localStorage.setItem('site_products_v1', JSON.stringify(items)); }
        catch(e){ console.warn('Could not save site products', e); }
        window.SiteProducts = items; // expose for debugging
    }

    function init(){
        const items = collectProducts();
        save(items);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
