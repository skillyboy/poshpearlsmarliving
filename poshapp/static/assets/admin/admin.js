(() => {
  /* -------------------------------
   * Helpers
   * ------------------------------- */
  const qs = (sel, scope = document) => scope.querySelector(sel);
  const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const toastRoot = document.getElementById('toast-root');

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const csrfToken = () => getCookie('csrftoken');

  const apiFetch = async (url, { json, formData, method = 'GET', ...opts } = {}) => {
    const headers = opts.headers || {};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    if (!formData) {
      headers['X-CSRFToken'] = csrfToken();
    }
    const body = json ? JSON.stringify(json) : formData ? formData : undefined;
    const res = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      ...opts,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed (${res.status})`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  };

  const showToast = (message, type = 'info') => {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `pp-toast ${type}`;
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };

  /* -------------------------------
   * State
   * ------------------------------- */
  let products = [];
  let orders = [];
  let customers = [];
  let categories = [];
  let settings = null;

  /* -------------------------------
   * Layout / routing
   * ------------------------------- */
  const syncHeader = () => {
    const header = qs('.admin-header');
    if (header) {
      const h = Math.round(header.getBoundingClientRect().height) || 68;
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    }
  };
  window.addEventListener('load', syncHeader);
  window.addEventListener('resize', () => requestAnimationFrame(syncHeader));

  const pages = qsa('[data-page]');
  const navLinks = qsa('[data-nav]');
  const pageTitle = qs('#pageTitle');
  const setActivePage = (hash) => {
    const target = hash || '#dashboard';
    pages.forEach((p) => { p.hidden = `#${p.id}` !== target; });
    navLinks.forEach((lnk) => lnk.classList.toggle('is-active', lnk.getAttribute('href') === target));
    pageTitle.textContent = (target.replace('#', '') || 'Dashboard').replace(/^./, (c) => c.toUpperCase());
  };
  window.addEventListener('hashchange', () => setActivePage(location.hash));
  setActivePage(location.hash || '#dashboard');

  const sidebar = qs('[data-sidebar]');
  const sidebarOverlay = qs('#sidebarOverlay');
  qs('#sidebarToggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('is-open');
    const open = sidebar?.classList.contains('is-open');
    if (sidebarOverlay) {
      sidebarOverlay.style.opacity = open ? '1' : '0';
      sidebarOverlay.style.pointerEvents = open ? 'auto' : 'none';
    }
  });
  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('is-open');
    sidebarOverlay.style.opacity = '0';
    sidebarOverlay.style.pointerEvents = 'none';
  });

  const formatMoney = (v, currency = 'NGN') => `${currency} ${Number(v || 0).toLocaleString()}`;
  const badgeForStatus = (status) => ({
    active: 'badge--success',
    archived: 'badge--muted',
    inactive: 'badge--warning',
    new: 'badge--info',
    processing: 'badge--info',
    pending: 'badge--warning',
    paid: 'badge--success',
    shipped: 'badge--info',
    completed: 'badge--success',
    cancelled: 'badge--danger',
    delivered: 'badge--success',
  }[status] || '');

  /* -------------------------------
   * Dashboard
   * ------------------------------- */
  const renderDashboard = () => {
    qs('#statOrders').textContent = orders.length;
    qs('#statRevenue').textContent = formatMoney(orders.reduce((s, o) => s + Number(o.total || 0), 0));
    qs('#statUsers').textContent = customers.length;
    qs('#statLowStock').textContent = products.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold || 0)).length;

    const recentBody = qs('#recentOrdersBody');
    if (recentBody) {
      recentBody.innerHTML = '';
      orders.slice(0, 5).forEach((o) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${o.id}</td><td>${o.customer}</td><td>${formatMoney(o.total, o.currency)}</td><td>${o.status}</td><td>${new Date(o.date).toLocaleString()}</td>`;
        recentBody.appendChild(tr);
      });
    }
    const activity = qs('#activityList');
    if (activity) {
      activity.innerHTML = '';
      orders.slice(0, 5).forEach((o) => {
        const li = document.createElement('li');
        li.textContent = `${o.customer} placed #${o.id} (${o.status})`;
        activity.appendChild(li);
      });
    }
  };

  /* -------------------------------
   * Products
   * ------------------------------- */
  const renderProducts = (filter = '') => {
    const tbody = qs('#productsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    products
      .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase()))
      .forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img src="${p.primary_image_url || p.image || ''}" alt="${p.name}" width="48" height="48" style="border-radius:8px;object-fit:cover;background:#f3f3f3;"></td>
          <td>${p.name}</td>
          <td>${p.sku || ''}</td>
          <td>${formatMoney(p.price, p.currency)}</td>
          <td>${p.stock}</td>
          <td><span class="badge ${badgeForStatus(p.status)}">${p.status}</span></td>
          <td class="actions">
            <button class="btn ghost" data-action="edit" data-id="${p.id}">Edit</button>
            <button class="btn" data-action="status" data-status="${p.status === 'archived' ? 'active' : 'archived'}" data-id="${p.id}">${p.status === 'archived' ? 'Activate' : 'Archive'}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="text-muted">No products found</td>';
      tbody.appendChild(tr);
    }
  };

  const tierRow = (tier = {}) => {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.innerHTML = `
      <input type="number" min="1" name="min_qty" value="${tier.min_qty ?? 1}" placeholder="Min qty" required>
      <input type="number" min="0" name="tier_price" value="${tier.price ?? ''}" placeholder="Price" required>
      <select name="tier_currency">
        ${['NGN','USD','EUR'].map(cur => `<option ${tier.currency===cur?'selected':''}>${cur}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn tier-remove" aria-label="Remove tier">✕</button>
    `;
    row.querySelector('.tier-remove').addEventListener('click', () => row.remove());
    return row;
  };

  const buildImagesPanel = (product) => {
    const wrap = document.createElement('div');
    wrap.className = 'images-panel';
    wrap.innerHTML = `
      <div class="images-head">
        <h4>Images</h4>
        <label class="btn ghost">
          Upload<input type="file" name="images" accept="image/*" multiple style="display:none;">
        </label>
      </div>
      <div class="images-grid" id="imagesGrid"></div>
    `;
    const grid = wrap.querySelector('#imagesGrid');

    const renderGrid = (imgs) => {
      grid.innerHTML = '';
      imgs.sort((a,b) => a.order - b.order).forEach((img, idx) => {
        const card = document.createElement('div');
        card.className = 'img-card';
        card.innerHTML = `
          <img src="${img.url}" alt="" />
          <div class="img-actions">
            <button type="button" class="icon-btn" data-move="up" data-id="${img.id}" ${idx===0?'disabled':''}>↑</button>
            <button type="button" class="icon-btn" data-move="down" data-id="${img.id}" ${idx===imgs.length-1?'disabled':''}>↓</button>
            <button type="button" class="icon-btn danger" data-delete="${img.id}">🗑</button>
          </div>
        `;
        grid.appendChild(card);
      });
    };

    renderGrid(product.images || []);

    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = Number(btn.dataset.id || btn.dataset.delete);
      if (btn.dataset.delete) {
        await apiFetch(`/poshadmin/api/products/${product.id}/images/${id}/`, { method: 'DELETE' });
        product.images = product.images.filter((i) => i.id !== id);
        renderGrid(product.images);
        showToast('Image deleted', 'success');
        return;
      }
      const move = btn.dataset.move;
      if (move) {
        const idx = product.images.findIndex((i) => i.id === id);
        const swapWith = move === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= product.images.length) return;
        [product.images[idx], product.images[swapWith]] = [product.images[swapWith], product.images[idx]];
        const orderPayload = { order: product.images.map((i) => i.id) };
        await apiFetch(`/poshadmin/api/products/${product.id}/images/order/`, { method: 'PATCH', json: orderPayload });
        product.images = product.images.map((img, i) => ({ ...img, order: i }));
        renderGrid(product.images);
      }
    });

    wrap.querySelector('input[type="file"]').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));
      await apiFetch(`/poshadmin/api/products/${product.id}/images/`, { method: 'POST', formData: fd });
      const refreshed = await apiFetch('/poshadmin/api/products/');
      products = refreshed.results || [];
      const updated = products.find((p) => p.id === product.id);
      product.images = updated?.images || [];
      renderGrid(product.images);
      showToast('Images uploaded', 'success');
      e.target.value = '';
    });
    return wrap;
  };

  const buildProductForm = (product = null) => {
    const isEdit = !!product;
    const form = document.createElement('form');
    form.className = 'form-card';
    const selectedCats = new Set(product?.category_ids || []);
    form.innerHTML = `
      <div class="grid-2">
        <label class="field"><span>Name</span><input class="input" name="name" required value="${product?.name || ''}"></label>
        <label class="field"><span>Slug</span><input class="input" name="slug" value="${product?.slug || ''}" placeholder="auto from name"></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>SKU</span><input class="input" name="sku" value="${product?.sku || ''}" placeholder="auto"></label>
        <label class="field"><span>Price</span><input class="input" type="number" min="0" name="price" required value="${product?.price ?? ''}"></label>
        <label class="field"><span>Compare at</span><input class="input" type="number" min="0" name="compare_at_price" value="${product?.compare_at_price ?? ''}"></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>Currency</span>
          <select class="input" name="currency">
            ${['NGN','USD','EUR'].map(cur => `<option value="${cur}" ${product?.currency===cur?'selected':''}>${cur}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Stock</span><input class="input" type="number" min="0" name="stock" required value="${product?.stock ?? 0}"></label>
        <label class="field"><span>Low stock threshold</span><input class="input" type="number" min="0" name="low_stock_threshold" value="${product?.low_stock_threshold ?? 3}"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Status</span>
          <select class="input" name="status">
            ${['active','inactive','archived'].map(s => `<option value="${s}" ${product?.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Categories</span>
          <select class="input" name="category_ids" multiple size="4">
            ${categories.map(c => `<option value="${c.id}" ${selectedCats.has(c.id)?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field"><span>Short description</span><input class="input" name="short_description" value="${product?.short_description || ''}" maxlength="255"></label>
      <label class="field"><span>Description</span><textarea class="input" name="description" rows="4">${product?.description || ''}</textarea></label>
      <div class="tier-block">
        <div class="tier-head">
          <h4>Price tiers</h4>
          <button type="button" class="btn ghost" id="addTier">Add tier</button>
        </div>
        <div id="tierList"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" id="cancelProduct">Cancel</button>
        <button type="submit" class="btn primary">${isEdit ? 'Save changes' : 'Create product'}</button>
      </div>
    `;
    const tierList = form.querySelector('#tierList');
    (product?.tiers && product.tiers.length ? product.tiers : [{ min_qty: 1, price: product?.price || 0, currency: product?.currency || 'NGN' }]).forEach(t => tierList.appendChild(tierRow(t)));
    form.querySelector('#addTier').addEventListener('click', () => tierList.appendChild(tierRow()));

    form.querySelector('#cancelProduct').addEventListener('click', () => closeModal());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name')?.trim(),
        slug: fd.get('slug')?.trim() || undefined,
        sku: fd.get('sku')?.trim() || undefined,
        price: Number(fd.get('price')) || 0,
        compare_at_price: fd.get('compare_at_price') ? Number(fd.get('compare_at_price')) : null,
        currency: fd.get('currency') || 'NGN',
        stock: Number(fd.get('stock')) || 0,
        low_stock_threshold: Number(fd.get('low_stock_threshold')) || 0,
        status: fd.get('status') || 'active',
        short_description: fd.get('short_description') || '',
        description: fd.get('description') || '',
        category_ids: qsa('option:checked', form.querySelector('select[name="category_ids"]')).map(o => Number(o.value)),
        tiers: qsa('.tier-row', tierList).map((row) => ({
          min_qty: Number(qs('input[name="min_qty"]', row).value) || 1,
          price: Number(qs('input[name="tier_price"]', row).value) || 0,
          currency: qs('select[name="tier_currency"]', row).value || 'NGN',
        })),
      };
      try {
        if (isEdit) {
          await apiFetch(`/poshadmin/api/products/${product.id}/`, { method: 'PATCH', json: payload });
        } else {
          await apiFetch('/poshadmin/api/products/create/', { method: 'POST', json: payload });
        }
        const refreshed = await apiFetch('/poshadmin/api/products/');
        products = refreshed.results || [];
        renderProducts(qs('#productSearch').value || '');
        renderDashboard();
        closeModal();
        showToast(isEdit ? 'Product saved' : 'Product created', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to save product', 'error');
      }
    });

    if (isEdit) {
      const imagesPanel = buildImagesPanel(product);
      form.appendChild(imagesPanel);
    }
    return form;
  };

  /* -------------------------------
   * Orders
   * ------------------------------- */
  let orderFilter = 'all';
  const renderOrders = () => {
    const tbody = qs('#ordersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    orders
      .filter((o) => orderFilter === 'all' || o.status === orderFilter)
      .forEach((o) => {
        const tr = document.createElement('tr');
        tr.dataset.id = o.id;
        tr.innerHTML = `
          <td>${o.id}</td>
          <td>${o.customer}</td>
          <td>${formatMoney(o.total, o.currency)}</td>
          <td><span class="badge ${badgeForStatus(o.status)}">${o.status}</span></td>
          <td>${new Date(o.date).toLocaleString()}</td>
        `;
        tr.addEventListener('click', () => openOrderDetail(o));
        tbody.appendChild(tr);
      });
    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5" class="text-muted">No orders</td>';
      tbody.appendChild(tr);
    }
  };

  const openOrderDetail = (order) => {
    const wrap = document.createElement('div');
    wrap.className = 'form-card';
    wrap.innerHTML = `
      <p><strong>ID:</strong> ${order.id}</p>
      <p><strong>Customer:</strong> ${order.customer}</p>
      <p><strong>Total:</strong> ${formatMoney(order.total, order.currency)}</p>
      <label class="field"><span>Status</span>
        <select class="input" name="status">
          ${['new','processing','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${order.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Payment status</span>
        <select class="input" name="payment_status">
          ${['pending','paid','failed','refunded'].map(s => `<option value="${s}" ${order.payment_status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Internal note</span><textarea class="input" name="internal_note" rows="3">${order.internal_note || ''}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" id="closeOrderDetail">Close</button>
        <button type="button" class="btn" id="resendEmail">Resend email</button>
        <button type="button" class="btn primary" id="saveOrder">Save</button>
      </div>
    `;
    wrap.querySelector('#closeOrderDetail').addEventListener('click', closeModal);
    wrap.querySelector('#resendEmail').addEventListener('click', async () => {
      try {
        await apiFetch(`/poshadmin/api/orders/${order.id}/resend/`, { method: 'POST' });
        showToast('Confirmation email resent', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    wrap.querySelector('#saveOrder').addEventListener('click', async () => {
      const status = wrap.querySelector('[name="status"]').value;
      const payment_status = wrap.querySelector('[name="payment_status"]').value;
      const internal_note = wrap.querySelector('[name="internal_note"]').value;
      try {
        await apiFetch(`/poshadmin/api/orders/${order.id}/`, {
          method: 'PATCH',
          json: { status, payment_status, internal_note },
        });
        await fetchOrders();
        closeModal();
        showToast('Order updated', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    openModal('Order Detail', wrap);
  };

  /* -------------------------------
   * Customers
   * ------------------------------- */
  const renderCustomers = (filter = '') => {
    const tbody = qs('#customersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    customers
      .filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(filter.toLowerCase()))
      .forEach((c) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.phone || ''}</td>
          <td>${new Date(c.joined).toLocaleDateString()}</td>
          <td><span class="badge ${c.status === 'active' ? 'badge--success' : 'badge--muted'}">${c.status}</span></td>
          <td><button class="btn ghost" data-id="${c.id}" data-status="${c.status === 'active' ? 'disable' : 'enable'}">${c.status === 'active' ? 'Disable' : 'Enable'}</button></td>
        `;
        tbody.appendChild(tr);
      });
    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="text-muted">No customers</td>';
      tbody.appendChild(tr);
    }
  };

  /* -------------------------------
   * Modal plumbing
   * ------------------------------- */
  const modal = qs('#modal');
  const modalOverlay = qs('#modalOverlay');
  const modalClose = qs('#modalClose');
  const modalBody = qs('#modalBody');
  const modalTitle = qs('#modalTitle');
  let lastFocus = null;

  const openModal = (title, contentNode) => {
    lastFocus = document.activeElement;
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modalBody.appendChild(contentNode);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const focusable = modalBody.querySelector('input, button, select, textarea, a[href]');
    focusable?.focus();
  };
  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    lastFocus?.focus();
  };
  modalOverlay?.addEventListener('click', closeModal);
  modalClose?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('is-open')) closeModal();
  });

  /* -------------------------------
   * Settings
   * ------------------------------- */
  const populateSettings = () => {
    if (!settings || !qs('#settingsForm')) return;
    const f = qs('#settingsForm');
    f.store_name.value = settings.store_name || '';
    f.support_email.value = settings.support_email || '';
    f.currency.value = settings.default_currency || 'NGN';
    f.low_stock_threshold.value = settings.low_stock_threshold ?? 3;
  };

  /* -------------------------------
   * Event bindings
   * ------------------------------- */
  qs('#productSearch')?.addEventListener('input', (e) => renderProducts(e.target.value));
  qs('#createProductBtn')?.addEventListener('click', () => openModal('Create Product', buildProductForm()));
  qs('#productsTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const action = btn.dataset.action;
    if (action === 'edit') {
      openModal('Edit Product', buildProductForm(product));
    } else if (action === 'status') {
      const newStatus = btn.dataset.status;
      await apiFetch(`/poshadmin/api/products/${id}/status/`, { method: 'PATCH', json: { status: newStatus } });
      const refreshed = await apiFetch('/poshadmin/api/products/');
      products = refreshed.results || [];
      renderProducts(qs('#productSearch').value || '');
      showToast('Status updated', 'success');
    }
  });

  qs('#orderTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    qsa('.tab', qs('#orderTabs')).forEach((b) => b.classList.toggle('is-active', b === btn));
    orderFilter = btn.dataset.status;
    renderOrders();
  });

  qs('#customerSearch')?.addEventListener('input', (e) => renderCustomers(e.target.value));
  qs('#customersTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const status = btn.dataset.status;
    try {
      await apiFetch(`/poshadmin/api/customers/${id}/status/`, { method: 'PATCH', json: { status } });
      await fetchCustomers();
      showToast('Customer updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  qs('#settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      store_name: fd.get('store_name'),
      support_email: fd.get('support_email'),
      default_currency: fd.get('currency') || 'NGN',
      low_stock_threshold: Number(fd.get('low_stock_threshold')) || 3,
    };
    try {
      await apiFetch('/poshadmin/api/settings/', { method: 'POST', json: payload });
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  qs('#themeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });

  /* -------------------------------
   * Data loaders
   * ------------------------------- */
  const fetchProducts = async () => {
    const data = await apiFetch('/poshadmin/api/products/');
    products = data.results || [];
    renderProducts(qs('#productSearch').value || '');
    renderDashboard();
  };
  const fetchOrders = async () => {
    const data = await apiFetch('/poshadmin/api/orders/');
    orders = data.results || [];
    renderOrders();
    renderDashboard();
  };
  const fetchCustomers = async () => {
    const data = await apiFetch('/poshadmin/api/customers/');
    customers = data.results || [];
    renderCustomers(qs('#customerSearch').value || '');
    renderDashboard();
  };
  const fetchCategories = async () => {
    const data = await apiFetch('/poshadmin/api/categories/');
    categories = data.results || [];
  };
  const fetchSettings = async () => {
    settings = await apiFetch('/poshadmin/api/settings/');
    populateSettings();
  };

  const loadAll = async () => {
    try {
      await Promise.all([fetchCategories(), fetchSettings(), fetchProducts(), fetchOrders(), fetchCustomers()]);
    } catch (e) {
      showToast(e.message || 'Failed to load admin data', 'error');
    }
  };

  loadAll();
})();
