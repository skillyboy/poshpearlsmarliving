# Lighthouse Audit Checklist — PoshPearl Smart Living

Use this checklist to run and remediate Lighthouse findings. The `audit` script in `package.json` runs Lighthouse against `http://localhost:3000` and outputs `lighthouse-report.html`.

1. Run the site locally
   - Install a simple static server when needed: `npm i -g http-server` (optional). The `start` script uses `npx http-server`.
   - Start the server:
     ```powershell
     npm run start
     ```

2. Run Lighthouse
   - In a separate terminal run:
     ```powershell
     npm run audit
     ```
   - The report will be generated as `lighthouse-report.html` in the repository root.

3. Top priority checks (fix these first)
   - Performance
     - Largest Contentful Paint (LCP): ensure hero image is optimized, use width/height, responsive srcset, and modern formats (WebP/AVIF).
     - Reduce render-blocking CSS: inline critical CSS for header/hero, defer the rest.
     - Minify & bundle JS; mark non-critical scripts `defer` or `async`.
     - Use efficient cache headers (set up on CDN or webserver).
   - Accessibility
     - Ensure ARIA roles for dynamic content, `aria-live` for notifications (already added), and focus management for modals and mobile nav.
     - Color contrast for text over hero background and call-to-action buttons.
   - Best Practices
     - Avoid mixed content, ensure `rel="noopener noreferrer"` for external links (done), secure external resources.
   - SEO
     - Add canonical, structured data, and meta description (already present); ensure meaningful titles and headings per page.

4. Secondary checks
   - Reduce unused CSS (run coverage in Chrome DevTools or use PurgeCSS during build).
   - Optimize fonts: consider self-hosting or `font-display: swap`.
   - Image lazy-loading and placeholder (LQIP or CSS blur-up) for better perceived performance.

5. CI integration suggestions
   - Add a job to run the server, then run `npx lighthouse` and fail the job if scores drop below thresholds (e.g., performance < 85, accessibility < 90).
   - Use `lhci` (Lighthouse CI) for historical tracking:
     - `npm i -D @lhci/cli` and configure `lighthouserc.json` and GitHub Actions to upload results.

6. After running
   - Inspect `lighthouse-report.html` and open the Opportunities and Diagnostics sections. Triage each item as: Quick Fix / Medium / Requires Backend.
   - Implement quick fixes first (image formats, preload/prefetch, defer scripts), then re-run audit.

If you want I can: generate the responsive `srcset` and optimized image versions (WebP/AVIF) for the hero & product images, or create an `esbuild` pipeline to bundle/minify assets next.
