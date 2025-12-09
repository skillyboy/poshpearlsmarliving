# PoshPearl — Development Plan

This document outlines the plan to develop the PoshPearl site into a small static storefront and evolve it toward a production-ready shop.

Goals
1. Provide a clear, usable static shop experience (catalog, product pages, cart demo).
2. Keep the site lightweight and accessible (mobile-first, fast, SEO-friendly).
3. Prepare the project for a future backend (Django or a headless CMS) without major refactors.

Scope (initial)
- Build a static `shop.html` (done) with client-side search and filters.
- Add product detail pages (static templates populated with real product assets).

- Implement a static cart (localStorage) and a simple checkout flow that collects customer info and sends to email or displays a quote summary.
- Improve responsiveness and accessibility across pages.
- Replace placeholder images with real product imagery and add meta tags for SEO.


Milestones

Milestone 1 — Static storefront (current)
- `index.html`: polished, responsive landing page.
- `shop.html`: product grid, search and filter (client-side).
- Tasks:
  - Replace placeholders with real images.
  - Review product data model (id, sku, title, price, inventory, category, images, description).

Milestone 2 — Product detail & cart
- Add `product-<slug>.html` templates (or a single `product.html` that can be used with simple client-side routing).
- Build a client-side cart using localStorage.
- Add a `cart.html` to review items, adjust quantity, and collect contact details.
- Tasks:
  - Implement Add to Cart, Update Quantity, Remove from Cart.
  - Persist cart state across sessions with localStorage.
  - Add simple form validation for checkout/contact details.

Milestone 3 — Order/Quote handling (static -> backend bridge)
- Options:
  - Small serverless function (Netlify Functions / Vercel Serverless / AWS Lambda) to receive order/quote POSTs and email them (via SendGrid/Mailgun).
  - Integrate with third-party order/contact forms (Formspree, Getform) as a no-code alternative.
- Tasks:
  - Pick provider and implement a secure POST from cart/checkout form.
  - Add success/failure handling and email confirmations.

Milestone 4 — Optional: full e-commerce backend
- If you want a full store (inventory, payments): integrate a lightweight backend (Django, Strapi, or Shopify headless).
- Tasks:
  - Design product API and authentication.
  - Integrate payment provider (Stripe, PayPal) and implement secure checkout.

Data Model (recommended for product JSON)
```
{
  "id": "mode-classic",
  "title": "Mode Smart Lock — Classic",
  "sku": "PP-LOCK-CLASSIC",
  "price": 249.00,
  "currency": "USD",
  "category": "locks",
  "inventory": 42,
  "images": ["assets/products/mode-classic-1.jpg","assets/products/mode-classic-2.jpg"],
  "shortDescription": "Refined hardware with Bluetooth & optional Wi‑Fi hub.",
  "longDescription": "Longer marketing/spec text...",
  "attributes": {"finish":["Polished Pearl","Satin Bronze"]}
}
```

UI / UX Requirements
- Mobile-first design; responsive grid breakpoints (1 / 2 / 4 columns).
- Accessible controls: keyboard nav, focus states, aria labels, skip links (already added).
- Fast loads: optimize images (webp), use lazy loading, minimize inline JS.

Assets & Content
- Replace placeholders under `poshpearl/assets/` with optimized product images.
- Create a small `data/products.json` for local development to populate the shop.

Testing & Quality
- Accessibility: run axe or Lighthouse to fix obvious issues.
- Cross-browser: test on Chrome, Edge, Safari (mobile + desktop).
- Performance: ensure images are optimized; consider generating 2 sizes for responsive images.

Deployment
- For a static site: host on GitHub Pages, Netlify, or Vercel.
- If adding serverless/email: prefer Netlify/Vercel where functions are simple to configure.

Security & Privacy
- If collecting contact info, add privacy/privacy policy and consent checkbox on checkout.
- Avoid storing sensitive payment data in the frontend; use a PCI-compliant provider (Stripe Checkout recommended).

Next immediate steps (this week)
1. Replace placeholder images in `poshpearl/assets/` and confirm they render (I can help locate or add images).
2. Add `data/products.json` and modify `shop.html` to load products from JSON (so adding products is data-driven).
3. Implement a static `cart.html` and localStorage cart prototype.
4. Create one `product.html` detail template and wire Details buttons on `shop.html` to open it (or a modal).

Owner / Contacts
- Developer: you (or I can continue to implement features here).
- Suggested reviewers: designer, product manager for descriptions/pricing.

Acceptance criteria (for MVP static shop)
- Shop lists products with images, title, price and Buy/Details buttons.
- Search and category filter work client-side.
- Product detail page exists and shows image gallery and full description.
- Cart persists items via localStorage and can submit a contact/quote form.

Longer-term extensions (nice-to-have)
- Integrate with real payments (Stripe Checkout or a backend).
- Add user accounts and order history.
- Add multi-currency and shipping calculation.

----
If you want, I can start on the next items immediately: (A) create `data/products.json` and wire `shop.html` to consume it, (B) implement the localStorage cart + `cart.html`, or (C) replace placeholders with real images if you provide them or their paths.
