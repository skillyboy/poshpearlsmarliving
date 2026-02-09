(function () {
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const csrfToken = getCookie('csrftoken');

  const postJson = (url, data) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || ''
      },
      body: JSON.stringify(data || {})
    }).then(res => res.json());
  };

  document.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-wishlist-remove]');
    if (removeBtn) {
      const productId = removeBtn.getAttribute('data-product-id');
      if (!productId) return;
      postJson('/wishlist/api/remove/', { product_id: productId }).then(() => {
        const card = removeBtn.closest('[data-wishlist-item]');
        if (card) card.remove();
      }).catch(() => {});
      return;
    }

    const toggleBtn = event.target.closest('[data-wishlist-toggle]');
    if (toggleBtn) {
      const productId = toggleBtn.getAttribute('data-product-id');
      if (!productId) return;
      const active = toggleBtn.classList.contains('active');
      const endpoint = active ? '/wishlist/api/remove/' : '/wishlist/api/add/';
      postJson(endpoint, { product_id: productId }).then(() => {
        toggleBtn.classList.toggle('active');
      }).catch(() => {});
      return;
    }

    const addAllBtn = event.target.closest('[data-wishlist-add-all]');
    if (addAllBtn) {
      postJson('/wishlist/api/add-all-to-cart/', {}).then(() => {
        addAllBtn.textContent = 'Added to cart';
        addAllBtn.disabled = true;
      }).catch(() => {});
    }
  });
})();
