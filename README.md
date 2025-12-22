# PoshPearl Smart Living — Landing Page

This is a simple static landing page prototype for *PoshPearl Smart Living*.

Files:
- `index.html` — main page
- `styles.css` — page styles
- `script.js` — small interactive behaviors (nav toggle, smooth scroll, form handler)
- `assets/` — SVG placeholders for hero, icons and gallery images

How to view:
1. Open `index.html` in your browser (double-click or right-click -> Open with > browser).

Notes & next steps:
- Replace the SVG placeholders with your brand photography and logos.
- Hook the contact form to your backend or a service like Formspree / Netlify forms.
- Add analytics, accessibility audit, and any SEO metadata for production.

Lighthouse audit (recommended)
-------------------------------
To run a Lighthouse audit locally and produce a report:

1. Start a local static server (uses `npx http-server`):

```powershell
npm run start
```

2. In a separate terminal run the Lighthouse audit script:

```powershell
npm run audit
```

This generates `lighthouse-report.html` in the repository root. See `Lighthouse_CHECKLIST.md` for remediation guidance and CI suggestions.


Design inspiration: modern smart-home UI patterns and premium ecommerce landing pages — this is a clean, responsive single-page prototype matching the same structure (hero, features, product, gallery, CTA).





