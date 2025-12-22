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

  // If the main site exported additional products into localStorage (from index), merge them here
  try{
    const siteRaw = localStorage.getItem('site_products_v1');
    if(siteRaw){
      const siteItems = JSON.parse(siteRaw) || [];
      siteItems.forEach(sp => {
        if(!sp || !sp.id) return;
        const exists = products.find(p=>p.id === sp.id);
        if(exists) {
          // merge shallowly
          Object.assign(exists, sp);
        } else {
          products.push(sp);
        }
      });
      // persist merged set so shop reflects site additions
      saveProducts();
    }
  }catch(e){ /* ignore parse errors */ }

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
      // tag button with product id for sync between list and cart
      addBtn.setAttribute('data-id', p.id);
      // if item already in cart, show 'Added' state
      if(cart[p.id]){
        addBtn.classList.add('added');
        addBtn.innerHTML = '<i class="fas fa-check"></i> Added';
      }
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
    // Update all add buttons for this product to show 'Added' state
    try{
      document.querySelectorAll(`.add-to-cart[data-id="${id}"]`).forEach(btn=>{
        btn.classList.add('added');
        btn.innerHTML = '<i class="fas fa-check"></i> Added';
        btn.disabled = false;
      });
    }catch(e){}
    if(triggerBtn){
      try{ triggerBtn.classList.add('added'); triggerBtn.innerHTML = '<i class="fas fa-check"></i> Added'; }catch(e){}
    }
    showToast('Added to cart', 'success');
  }
  function removeFromCart(id){
    delete cart[id];
    saveCart();
    // revert any add buttons for this product to 'Add'
    try{
      document.querySelectorAll(`.add-to-cart[data-id="${id}"]`).forEach(btn=>{
        btn.classList.remove('added');
        btn.innerHTML = 'Add';
        btn.disabled = false;
      });
    }catch(e){}
  }
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

  // Send cart via WhatsApp then clear cart
  function sendAndClearCart(){
    const ids = Object.keys(cart);
    if(!ids.length){ showToast('Cart is empty', 'error'); return; }
    let lines = ['Hello, I would like to order the following items from PoshPearl:'];
    let total = 0;
    ids.forEach(id=>{
      const p = products.find(x=>x.id===id);
      const qty = cart[id].qty;
      if(!p) return;
      lines.push(`- ${p.title} x ${qty} (${p.priceLabel})`);
      total += (p.price||0) * qty;
    });
    lines.push('Total: ' + formatCurrency(total));
    lines.push('Please advise on availability, shipping and payment.');
    const message = lines.join('\n');
    const url = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
    cart = {}; saveCart(); showToast('Cart sent and cleared', 'success');
  }

  // Export current cart as JSON file
  function exportCartJSON(){
    try{
      const ids = Object.keys(cart);
      if(!ids.length){ showToast('Cart is empty', 'error'); return; }
      const payload = ids.map(id => {
        const p = products.find(x=>x.id===id) || { id };
        return { id: p.id, title: p.title || '', price: p.price || 0, priceLabel: p.priceLabel || '', qty: cart[id].qty };
      });
      const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), items: payload }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'posh_cart_' + (new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast('Cart exported as JSON', 'success');
    }catch(e){ showToast('Unable to export cart', 'error'); }
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
  // small-screen close button
  const closeCartSmallBtn = document.getElementById('closeCartSmall');
  if(closeCartSmallBtn){ closeCartSmallBtn.addEventListener('click', ()=>{ cartDrawer.classList.remove('open'); cartToggle.setAttribute('aria-expanded','false'); }); }
  if(checkoutBtn) checkoutBtn.addEventListener('click', checkoutWhatsApp);
  if(clearCartBtn) clearCartBtn.addEventListener('click', ()=>{ cart = {}; saveCart(); showToast('Cart cleared','info'); });
  // additional cart actions (Export JSON, Send & Clear)
  const sendClearBtn = document.getElementById('sendClearWa');
  const exportJsonBtn = document.getElementById('exportJson');
  if(sendClearBtn) sendClearBtn.addEventListener('click', sendAndClearCart);
  if(exportJsonBtn) exportJsonBtn.addEventListener('click', exportCartJSON);
  const checkoutCardBtn = document.getElementById('checkoutCard');
  if(checkoutCardBtn) checkoutCardBtn.addEventListener('click', openCardPaymentModal);

  // Product modal
  let modalBackdrop = null;
  function openProductModal(p){
    closeProductModal();
    modalBackdrop = document.createElement('div');
    // use a namespaced backdrop class to avoid colliding with Bootstrap's modal backdrop
    modalBackdrop.className = 'posh-modal-backdrop';
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
    // preserve previous overflow and then hide page scroll while modal is open
    modalBackdrop._prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalBackdrop.querySelector('.modal-close').addEventListener('click', closeProductModal);
    modalBackdrop.addEventListener('click', (e)=>{ if(e.target===modalBackdrop) closeProductModal(); });
    const modalAddBtn = modalBackdrop.querySelector('.modal-add');
    if(modalAddBtn) modalAddBtn.addEventListener('click', ()=>{ addToCart(p.id,1, modalAddBtn); closeProductModal(); });
    modalBackdrop.querySelector('.modal-wa').addEventListener('click', ()=>{
      const msg = `Hello, I'm interested in ${p.title} (Price: ${p.priceLabel}). ${p.desc} Please advise on ordering.`;
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(msg),'_blank');
    });
    // close on Escape
    document.addEventListener('keydown', escHandler);
  }
  function escHandler(e){ if(e.key==='Escape') closeProductModal(); }
  function closeProductModal(){ if(modalBackdrop){ const prev = modalBackdrop._prevBodyOverflow; modalBackdrop.remove(); modalBackdrop=null; document.body.style.overflow = (typeof prev !== 'undefined') ? prev : ''; cleanupBodyAfterModal(prev); document.removeEventListener('keydown', escHandler); } }
  

  // Toast notifications (simple)
  function showToast(message, type='info'){
    let container = document.getElementById('notificationContainer');
    if(!container){
      container = document.createElement('div');
      container.id = 'notificationContainer';
      container.style.position = 'fixed';
      container.style.right = '18px';
      container.style.top = '18px';
      container.style.zIndex = 99999;
      document.body.appendChild(container);
    }
    const note = document.createElement('div'); note.className = `notification notification-${type}`; note.style.marginTop = '8px'; note.style.background = '#fff'; note.style.padding = '10px 12px'; note.style.borderRadius = '10px'; note.style.boxShadow = '0 8px 20px rgba(0,0,0,.08)'; note.innerHTML=`<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}" style="margin-right:8px"></i><span>${message}</span><button class="notification-close" style="border:none;background:transparent;margin-left:12px;font-size:16px">&times;</button>`;
    container.appendChild(note);
    note.querySelector('.notification-close').addEventListener('click', ()=>note.remove());
    setTimeout(()=>{ try{ note.remove(); }catch(e){} },4000);
  }

  // Helper: ensure body scroll is restored after closing custom modals and avoid leaving Bootstrap's modal-open class behind
  function cleanupBodyAfterModal(prevOverflow){
    // If there are any visible Bootstrap modals, do not remove the modal-open class
    const anyBsOpen = document.querySelectorAll('.modal.show').length > 0;
    if(!anyBsOpen){
      document.body.classList.remove('modal-open');
      if(typeof prevOverflow !== 'undefined') document.body.style.overflow = prevOverflow;
      else document.body.style.overflow = '';
    }
  }

  // Defensive repair: remove any stray namespaced backdrops and restore body scroll state
  function repairStrayOverlays(){
    try{
      const backdrops = Array.from(document.querySelectorAll('.posh-modal-backdrop'));
      let restored = false;
      backdrops.forEach(b => {
        // try restore previous overflow saved on element
        try{
          const prev = b._prevBodyOverflow;
          b.remove();
          if(typeof prev !== 'undefined'){
            document.body.style.overflow = prev;
            restored = true;
          }
        }catch(e){ b.remove(); }
      });
      // If nothing restored but there are no Bootstrap modals visible, ensure body scroll is enabled
      const anyBsOpen = document.querySelectorAll('.modal.show').length > 0;
      if(!anyBsOpen){
        if(!restored) document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
      }
    }catch(e){ /* silent */ }
  }

  // Run repair early in case a previous run left an overlay blocking interaction.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', repairStrayOverlays);
  } else {
    // run after a tick to allow any legitimate Bootstrap initialisation to complete
    setTimeout(repairStrayOverlays, 60);
  }

  // Card/payment modal: prefer Bootstrap modal markup if present; otherwise fall back to the inline simulation.
  function openCardPaymentModal(){
    // If Bootstrap modal exists, open it and handle form submission there
    const bsModal = document.getElementById('paymentModal');
    if(bsModal && window.jQuery && typeof jQuery(bsModal).modal === 'function'){
      // show the Bootstrap modal
      jQuery(bsModal).modal('show');
      // wire submit handler once
      const submit = document.getElementById('submitPayment');
      if(submit && !submit._wired){
        submit._wired = true;
        submit.addEventListener('click', ()=>{
          const form = document.getElementById('paymentForm');
          if(!form) return;
          const name = (document.getElementById('custName')||{}).value||'';
          const phone = (document.getElementById('custPhone')||{}).value||'';
          const email = (document.getElementById('custEmail')||{}).value||'';
          const account = (document.getElementById('accountNumber')||{}).value||'';
          if(!name.trim() || !phone.trim()){
            showToast('Please enter your name and phone number', 'error');
            return;
          }
          // determine chosen method
          const method = (form.querySelector('input[name="method"]:checked')||{}).value || 'card';
          // Collect cart items and total
          const ids = Object.keys(cart || {});
          if(ids.length === 0){ showToast('Cart is empty', 'error'); return; }
          let total = 0; const items = [];
          ids.forEach(id => { const p = products.find(x=>x.id===id); if(!p) return; items.push({ id: p.id, title: p.title, qty: cart[id].qty, price: p.price }); total += (p.price||0) * cart[id].qty; });
          // Simulate or forward to provider depending on method
          if(method === 'card'){
            // Open a simulated card modal (fallback) for user to enter card details — reuse existing inline flow
            jQuery(bsModal).modal('hide');
            setTimeout(()=>{
              // fallback inline card payment
              openInlineCardModal({ name, phone, email, account, items, total });
            }, 300);
            return;
          }
          if(method === 'paystack'){
            // Placeholder for Paystack inline: user must add public key and enable; here we show instructions
            showToast('Paystack flow: add your public key and integration on the site.', 'info');
            jQuery(bsModal).modal('hide');
            return;
          }
          if(method === 'opay'){
            showToast('Opay flow: redirecting to Opay (integration placeholder).', 'info');
            jQuery(bsModal).modal('hide');
            return;
          }
        });
      }
      return;
    }

    // Fallback: existing inline modal simulation (keeps current behaviour for sites without Bootstrap)
    const modal = document.createElement('div');
    modal.className = 'posh-modal-backdrop';
    modal.style.position = 'fixed'; modal.style.inset = 0; modal.style.background = 'rgba(0,0,0,.45)'; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = 99998;
    modal.innerHTML = `
      <div class="modal-card" style="background:#fff;padding:18px;border-radius:12px;max-width:520px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0">Pay by Card</h3>
          <button class="modal-close" aria-label="Close" style="border:none;background:transparent;font-size:22px">&times;</button>
        </div>
        <p style="color:#666;margin-top:0">This simulates a secure card payment. For production, integrate Stripe, Paystack or your payment provider.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          <input id="cardName" placeholder="Full name" style="padding:10px;border-radius:8px;border:1px solid #eee">
          <input id="cardNumber" placeholder="Card number (xxxx xxxx xxxx xxxx)" style="padding:10px;border-radius:8px;border:1px solid #eee">
          <div style="display:flex;gap:8px">
            <input id="cardExp" placeholder="MM/YY" style="flex:1;padding:10px;border-radius:8px;border:1px solid #eee">
            <input id="cardCvc" placeholder="CVC" style="width:120px;padding:10px;border-radius:8px;border:1px solid #eee">
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:6px">
            <button id="paySim" class="btn primary">Pay</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal._prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').addEventListener('click', ()=>{ closeModal(); });
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
    function closeModal(){ if(modal){ const prev = modal._prevBodyOverflow; modal.remove(); document.body.style.overflow = (typeof prev !== 'undefined') ? prev : ''; cleanupBodyAfterModal(prev); } }
    modal.querySelector('#paySim').addEventListener('click', ()=>{
      const name = modal.querySelector('#cardName').value.trim();
      const number = modal.querySelector('#cardNumber').value.replace(/\s+/g,'');
      const exp = modal.querySelector('#cardExp').value.trim();
      const cvc = modal.querySelector('#cardCvc').value.trim();
      if(!name || !number || number.length < 12 || !exp || !cvc){ showToast('Please enter valid card details', 'error'); return; }
      // Simulate processing
      modal.querySelector('#paySim').disabled = true; modal.querySelector('#paySim').textContent = 'Processing...';
      setTimeout(()=>{
        showToast('Payment successful (simulated)', 'success');
        cart = {}; saveCart(); closeModal();
      }, 1400);
    });
  }

  // Helper: open the inline card modal (kept separate so we can call it from Bootstrap flow)
  function openInlineCardModal(details){
    // small wrapper to reuse the fallback modal flow
    // details: { name, phone, email, account, items, total }
    const evt = new Event('openInlineCard');
    document.dispatchEvent(evt);
    // create modal similar to fallback above
    const modal = document.createElement('div');
    modal.className = 'posh-modal-backdrop';
    modal.style.position = 'fixed'; modal.style.inset = 0; modal.style.background = 'rgba(0,0,0,.45)'; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = 99998;
    modal.innerHTML = `
      <div class="modal-card" style="background:#fff;padding:18px;border-radius:12px;max-width:520px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0">Pay by Card</h3>
          <button class="modal-close" aria-label="Close" style="border:none;background:transparent;font-size:22px">&times;</button>
        </div>
        <p style="color:#666;margin-top:0">Simulated card payment for <strong>${escapeHtml(details.name||'')}</strong>. Total: <strong>${formatCurrency(details.total||0)}</strong></p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          <input id="cardName2" placeholder="Full name" value="${escapeHtml(details.name||'')}" style="padding:10px;border-radius:8px;border:1px solid #eee">
          <input id="cardNumber2" placeholder="Card number (xxxx xxxx xxxx xxxx)" style="padding:10px;border-radius:8px;border:1px solid #eee">
          <div style="display:flex;gap:8px">
            <input id="cardExp2" placeholder="MM/YY" style="flex:1;padding:10px;border-radius:8px;border:1px solid #eee">
            <input id="cardCvc2" placeholder="CVC" style="width:120px;padding:10px;border-radius:8px;border:1px solid #eee">
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:6px">
            <button id="paySim2" class="btn primary">Pay</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal._prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').addEventListener('click', ()=>{ if(modal){ const prev = modal._prevBodyOverflow; modal.remove(); document.body.style.overflow = (typeof prev !== 'undefined') ? prev : ''; cleanupBodyAfterModal(prev); } });
    modal.addEventListener('click', (e)=>{ if(e.target===modal){ if(modal){ const prev = modal._prevBodyOverflow; modal.remove(); document.body.style.overflow = (typeof prev !== 'undefined') ? prev : ''; cleanupBodyAfterModal(prev); } } });
    modal.querySelector('#paySim2').addEventListener('click', ()=>{
      const number = modal.querySelector('#cardNumber2').value.replace(/\s+/g,'');
      const exp = modal.querySelector('#cardExp2').value.trim();
      const cvc = modal.querySelector('#cardCvc2').value.trim();
      if(!number || number.length < 12 || !exp || !cvc){ showToast('Please enter valid card details', 'error'); return; }
      modal.querySelector('#paySim2').disabled = true; modal.querySelector('#paySim2').textContent = 'Processing...';
      setTimeout(()=>{ showToast('Payment successful (simulated)', 'success'); cart = {}; saveCart(); if(modal){ const prev = modal._prevBodyOverflow; modal.remove(); document.body.style.overflow = (typeof prev !== 'undefined') ? prev : ''; } }, 1400);
    });
  }

  // Init
  renderProducts(products);
  updateCartUI();
  searchInput.addEventListener('input', debounce(applyFilters, 200));
  filterSelect.addEventListener('change', applyFilters);
  clearBtn.addEventListener('click', ()=>{ searchInput.value=''; filterSelect.value='all'; applyFilters(); });

  // If a product id was supplied in the URL, open its detail modal
  (function openFromQuery(){
    try{
      const params = new URLSearchParams(window.location.search);
      const pid = params.get('product');
      if(!pid) return;
      // try exact id match first
      let found = products.find(p => p.id === pid);
      if(!found){
        // fallback: decode and match by title
        const decoded = decodeURIComponent(pid).toLowerCase();
        found = products.find(p => (p.title||'').toLowerCase() === decoded || (p.title||'').toLowerCase().includes(decoded));
      }
      if(found){
        // ensure it's visible in the grid (applyFilters may have filtered it out)
        applyFilters();
        setTimeout(()=>openProductModal(found), 300);
      }
    }catch(e){ /* ignore */ }
  })();

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
