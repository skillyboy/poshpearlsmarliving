(function(){
  // Modern dynamic shop script: renders products, search/filter, cart with localStorage, product modal, and WhatsApp checkout.
  const waPhone = '2347041087502';
  const PRODUCTS_KEY = 'posh_products_v1';
  // initial product set
  const initialProducts = [
    {
      id: 'mode-classic',
      title: 'Mode Smart Lock — Classic',
      price: 85000,
      priceLabel: '₦85,000',
      category: 'locks',
      stock: 'In stock',
      img: 'assets/placeholder-1.svg',
      desc: 'Refined hardware, Bluetooth & optional Wi‑Fi bridge.'
    },
    {
      id: 'mode-modern',
      title: 'Mode Smart Lock — Modern',
      price: 95000,
      priceLabel: '₦95,000',
      category: 'locks',
      stock: 'Pre-order',
      img: 'assets/placeholder-2.svg',
      desc: 'Thin profile for flush doors, guest codes and activity logs.'
    },
    {
      id: 'outdoor-keypad',
      title: 'Outdoor Keypad',
      price: 8900,
      priceLabel: '₦8,900',
      category: 'accessories',
      stock: 'In stock',
      img: 'assets/placeholder-3.svg',
      desc: 'Weatherproof keypad for guest codes and one-time pins.'
    },
    {
      id: 'battery-pack',
      title: 'Battery Pack — 4x AA',
      price: 1200,
      priceLabel: '₦1,200',
      category: 'accessories',
      stock: 'In stock',
      img: 'assets/placeholder-1.svg',
      desc: 'Long-life alkaline batteries and low-battery alerts.'
    }
  ];

  // products is mutable at runtime and may include saved products from localStorage
  let products = [];

  function loadProducts(){
    try{
      const raw = localStorage.getItem(PRODUCTS_KEY);
      const saved = raw ? JSON.parse(raw) : [];
      // merge saved + initial, saved should override by id
      const map = {};
      initialProducts.forEach(p => map[p.id] = p);
      saved.forEach(p => map[p.id] = p);
      products = Object.keys(map).map(k=>map[k]);
    }catch(e){ products = initialProducts.slice(); }
  }

  function saveProducts(){
    try{ localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); }catch(e){ /* ignore */ }
  }

  // load at startup
  loadProducts();

  const root = document.getElementById('productsGrid');
  const searchInput = document.getElementById('search');
  const filterSelect = document.getElementById('filter');
  const clearBtn = document.getElementById('clear');

  // Cart state
  const CART_KEY = 'posh_cart_v1';
  let cart = loadCart();

  function loadCart(){
    try{
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : {}; 
    }catch(e){ return {}; }
  }
  function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartUI(); }

  // Render functions
  function renderProducts(list){
    root.innerHTML = '';
    list.forEach(p => {
      const el = document.createElement('article');
      el.className = 'product';
      el.setAttribute('data-id', p.id);
      el.setAttribute('data-cat', p.category);
      el.innerHTML = `
        <img src="${p.img}" alt="${escapeHtml(p.title)}" loading="lazy">
        <h4>${escapeHtml(p.title)}</h4>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="price">${p.priceLabel}</div>
          <div style="color:#6b6b6b;font-size:.95rem">${p.stock}</div>
        </div>
        <p style="color:#6b6b6b;margin:8px 0;font-size:.95rem">${escapeHtml(p.desc)}</p>
        <div class="cta"><button class="btn primary add-to-cart">Add</button> <button class="btn ghost details" style="margin-left:8px">Details</button></div>
      `;
      // add event listeners
      const addBtn = el.querySelector('.add-to-cart');
      addBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        addToCart(p.id, 1, addBtn);
      });
      el.querySelector('.details').addEventListener('click', (e)=>{
        e.stopPropagation();
        openProductModal(p);
      });
      el.addEventListener('click', (e)=>{
        // clicking card opens modal
        if(e.target.tagName.toLowerCase() === 'button' || e.target.closest('a')) return;
        openProductModal(p);
      });
      root.appendChild(el);
    });
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); }

  // Search & filter with debounce
  function debounce(fn, wait=250){ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }
  function applyFilters(){
    const q = (searchInput.value||'').trim().toLowerCase();
    const cat = filterSelect.value || 'all';
    const filtered = products.filter(p=>{
      const matchesQ = !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
      const matchesCat = cat === 'all' || p.category === cat;
      return matchesQ && matchesCat;
    });
    renderProducts(filtered);
  }

  // Cart functions
  function addToCart(id, qty=1, triggerBtn=null){
    if(!cart[id]) cart[id] = { id, qty };
    else cart[id].qty += qty;
    saveCart();
    // visual feedback: pulse cart toggle and animate button
    const cartBtn = document.getElementById('cartToggle');
    if(cartBtn){
      cartBtn.classList.add('pulse');
      setTimeout(()=>cartBtn.classList.remove('pulse'), 420);
    }
    if(triggerBtn){
      const original = triggerBtn.innerHTML;
      triggerBtn.innerHTML = '<i class="fas fa-check"></i> Added';
      triggerBtn.disabled = true;
      setTimeout(()=>{ triggerBtn.innerHTML = original; triggerBtn.disabled = false; }, 900);
    }
    showToast('Added to cart', 'success');
  }
  function removeFromCart(id){ delete cart[id]; saveCart(); }
  function updateQty(id, qty){ if(qty<=0) removeFromCart(id); else { cart[id].qty = qty; saveCart(); } }

  function updateCartUI(){
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if(!countEl || !itemsEl || !totalEl) return;
    const ids = Object.keys(cart);
    let total = 0; itemsEl.innerHTML = '';
    ids.forEach(id=>{
      const p = products.find(x=>x.id===id);
      if(!p) return;
      const qty = cart[id].qty;
      total += p.price * qty;
      const itemEl = document.createElement('div');
      itemEl.style.padding='8px 0';
      itemEl.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${p.img}" alt="${escapeHtml(p.title)}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;border:1px solid #eee">
          <div style="flex:1">
            <div style="font-weight:700">${escapeHtml(p.title)}</div>
            <div style="color:#666;font-size:.9rem">${p.priceLabel}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <div style="display:flex;align-items:center;gap:6px">
              <button class='qty minus' data-id='${p.id}' aria-label='Decrease'>−</button>
              <input type='number' min='1' value='${qty}' data-id='${p.id}' style='width:48px;text-align:center;padding:6px;border-radius:6px;border:1px solid #eee'>
              <button class='qty plus' data-id='${p.id}' aria-label='Increase'>+</button>
            </div>
            <div><button class='btn ghost remove' data-id='${p.id}'>Remove</button></div>
          </div>
        </div>
      `;
      itemsEl.appendChild(itemEl);
    });
    countEl.textContent = ids.reduce((s,id)=>s+cart[id].qty,0) || 0;
    totalEl.textContent = formatCurrency(total);

    // wire remove and qty controls
    itemsEl.querySelectorAll('button.remove').forEach(b=>b.addEventListener('click', (e)=>{ removeFromCart(b.getAttribute('data-id')); }));
    itemsEl.querySelectorAll('button.qty.plus').forEach(b=>b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-id'); updateQty(id, (cart[id].qty||0) + 1);
    }));
    itemsEl.querySelectorAll('button.qty.minus').forEach(b=>b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-id'); updateQty(id, Math.max(0, (cart[id].qty||0) - 1));
    }));
    itemsEl.querySelectorAll('input[type=number]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const id = inp.getAttribute('data-id');
        const v = Math.max(0, parseInt(inp.value||0,10));
        updateQty(id, v);
      });
    });
  }

  function formatCurrency(n){
    // naive Naira format
    if(isNaN(n)) return '₦0';
    return '₦' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Checkout to WhatsApp: compile items list and open wa.me
  function checkoutWhatsApp(){
    const ids = Object.keys(cart);
    if(!ids.length){ showToast('Cart is empty', 'error'); return; }
    let lines = ['Hello, I would like to order the following items from PoshPearl:'];
    let total = 0;
    ids.forEach(id=>{
      const p = products.find(x=>x.id===id);
      const qty = cart[id].qty;
      if(!p) return;
      lines.push(`- ${p.title} x ${qty} (${p.priceLabel})`);
      total += p.price * qty;
    });
    lines.push('Total: ' + formatCurrency(total));
    lines.push('Please advise on availability, shipping and payment.');
    const message = lines.join('\n');
    const url = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
  }

  // Cart drawer toggle
  const cartToggle = document.getElementById('cartToggle');
  const cartDrawer = document.getElementById('cartDrawer');
  const checkoutBtn = document.getElementById('checkoutWa');
  const clearCartBtn = document.getElementById('clearCart');
  if(cartToggle){
    cartToggle.addEventListener('click', ()=>{
      cartDrawer.classList.toggle('open');
      cartToggle.setAttribute('aria-expanded', String(cartDrawer.classList.contains('open')));
      updateCartUI();
    });
  }
  if(checkoutBtn) checkoutBtn.addEventListener('click', checkoutWhatsApp);
  if(clearCartBtn) clearCartBtn.addEventListener('click', ()=>{ cart = {}; saveCart(); showToast('Cart cleared','info'); });

  // Product modal
  let modalBackdrop = null;
  function openProductModal(p){
    closeProductModal();
    modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.innerHTML = `
      <div class="modal animate-in">
        <div class="modal-media"><img src="${p.img}" alt="${escapeHtml(p.title)}"></div>
        <div class="modal-content">
          <button class="modal-close" aria-label="Close">&times;</button>
          <h3>${escapeHtml(p.title)}</h3>
          <p style="color:#666">${escapeHtml(p.desc)}</p>
          <p style="font-weight:700;margin-top:8px">${p.priceLabel}</p>
          <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary modal-add">Add to cart</button><button class="btn ghost modal-wa">Buy on WhatsApp</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(modalBackdrop);
    document.body.style.overflow = 'hidden';
    modalBackdrop.querySelector('.modal-close').addEventListener('click', closeProductModal);
    modalBackdrop.addEventListener('click', (e)=>{ if(e.target===modalBackdrop) closeProductModal(); });
    modalBackdrop.querySelector('.modal-add').addEventListener('click', ()=>{ addToCart(p.id,1); closeProductModal(); });
    modalBackdrop.querySelector('.modal-wa').addEventListener('click', ()=>{
      const msg = `Hello, I'm interested in ${p.title} (Price: ${p.priceLabel}). ${p.desc} Please advise on ordering.`;
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(msg),'_blank');
    });
    // close on Escape
    document.addEventListener('keydown', escHandler);
  }
  function escHandler(e){ if(e.key==='Escape') closeProductModal(); }
  function closeProductModal(){ if(modalBackdrop){ modalBackdrop.remove(); modalBackdrop=null; document.body.style.overflow=''; document.removeEventListener('keydown', escHandler); } }

  // Toast notifications (simple)
  function showToast(message, type='info'){
    const container = document.getElementById('notificationContainer');
    if(!container) return; // notification container exists on index page, not on shop; create fallback
    const note = document.createElement('div'); note.className = `notification notification-${type}`; note.innerHTML=`<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i><span>${message}</span><button class="notification-close">&times;</button>`;
    container.appendChild(note);
    note.querySelector('.notification-close').addEventListener('click', ()=>note.remove());
    setTimeout(()=>note.remove(),4000);
  }

  // Init
  renderProducts(products);
  updateCartUI();
  searchInput.addEventListener('input', debounce(applyFilters, 200));
  filterSelect.addEventListener('change', applyFilters);
  clearBtn.addEventListener('click', ()=>{ searchInput.value=''; filterSelect.value='all'; applyFilters(); });

  /**
   * Add a new product to the in-memory product list and re-render.
   * Useful for programmatically creating shop items (e.g., from console or admin UI).
   * product should be an object matching existing shape: { id, title, price, priceLabel, category, stock, img, desc }
   */
  function addProduct(product){
    if(!product || !product.id) throw new Error('Product must have an id');
    // prevent duplicate ids
    if(products.find(p=>p.id === product.id)) throw new Error('Product with this id already exists');
    products.push(product);
    saveProducts();
    applyFilters(); // respects current search/filter and re-renders
    return product;
  }

  // Expose a small API for debugging or programmatic creation
  window.PoshShop = window.PoshShop || {};
  window.PoshShop.addProduct = addProduct;
  window.PoshShop.products = products;
  window.PoshShop.saveProducts = saveProducts;

})();
