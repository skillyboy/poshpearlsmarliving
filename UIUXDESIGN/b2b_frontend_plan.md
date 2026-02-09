Role: You are an elite Senior Frontend Developer & UI/UX Specialist with 10+ years of experience working on B2B e-commerce platforms. You specialize in conversion rate optimization, performance engineering, and modern design systems.

Context: I have a Django-based B2B wholesale e-commerce platform for smart lock products targeting distributors. The current implementation works but lacks polish, modern UX patterns, and conversion optimization. I need a complete frontend overhaul while maintaining backend functionality.

Current Issues Analysis:
UX Problems:

Cluttered product page layout

Poor visual hierarchy on key sections

Inconsistent spacing and typography

Lack of modern micro-interactions

Weak mobile experience

Confusing navigation between catalog and product details

Performance Concerns:

Inefficient image loading

Bloated CSS with conflicting styles

No proper component architecture

Missing loading states and skeletons

Conversion Blockers:

Weak trust signals presentation

Poor price tier visualization

CTA placement not optimized

Missing social proof elements

Incomplete mobile checkout flow

Your Mission:
Rebuild the entire frontend experience with modern, conversion-optimized design patterns while maintaining Django template compatibility.

Specific Requirements:
1. Information Architecture:
text
Required Sections (Prioritized):
1. Hero Zone (Product Overview)
2. Quick Purchase CTA Bar (Sticky)
3. Image Gallery with Zoom
4. Pricing Tiers (Dynamic Highlighting)
5. Product Specifications Grid
6. Trust & Social Proof Section
7. Related Products Catalog
8. Request Quote Form Modal
9. Mobile-optimized Navigation
10. Detailed Features Breakdown
2. Design System Requirements:
text
- Color Palette: Professional B2B (Blues, Grays, Accent Colors)
- Typography: Inter + system fonts stack
- Spacing: 8px base unit (0.5rem increments)
- Border Radius: 0.375rem (sm), 0.5rem (md), 0.75rem (lg)
- Shadows: 3-layer system (sm/md/lg) with consistent blur
- Breakpoints: Mobile-first (sm:640px, md:768px, lg:1024px, xl:1280px)
- Animation: Subtle micro-interactions (200-300ms duration)
3. Component Library Needed:
text
✅ Navigation:
  - Sticky section nav with active state
  - Mobile hamburger menu
  - Breadcrumb with hover effects

✅ Product Display:
  - Product card with hover animations
  - Image gallery with thumbnails + zoom
  - Price tier comparison table
  - Stock level indicators
  - Quantity selector with quick options

✅ Interactive Elements:
  - Primary/Secondary/Ghost button variants
  - Form inputs with validation states
  - Modal system (quote request, image zoom)
  - Toast notifications (add to cart, errors)
  - Loading skeletons for all async content

✅ Trust Elements:
  - Social proof cards (ratings, testimonials)
  - Trust badges with icons
  - Security/guarantee seals
  - Delivery time indicators

✅ Mobile-specific:
  - Bottom navigation bar
  - Touch-optimized quantity selector
  - Full-screen image viewer
  - Gesture-based gallery navigation
4. Performance Optimization:
text
Must Implement:
- Progressive image loading (blur-up technique)
- Critical CSS inlining
- Lazy loading for below-fold content
- Proper image compression (WebP + fallbacks)
- Font loading optimization
- CSS/JS bundling strategy
- Cache headers for static assets
- Reduced CLS (Cumulative Layout Shift)
5. Accessibility Standards:
text
WCAG 2.1 AA Compliance:
- Color contrast ratio ≥ 4.5:1
- Keyboard navigation support
- Screen reader compatibility (ARIA labels)
- Focus management for modals
- Reduced motion preferences
- Proper heading hierarchy
- Descriptive alt text for all images
- Form field error messaging
6. Conversion Optimization Features:
text
Essential:
1. Dynamic price tier highlighting based on quantity
2. Add-to-cart with immediate feedback
3. Cart counter with animation
4. Exit-intent quote request modal
5. Stock scarcity indicators (limited stock, low quantity)
6. Trust badges above the fold
7. Social proof (ratings, distributor count) in hero
8. Quick comparison feature
9. Persistent cart sidebar (optional)
10. One-click checkout for returning users
7. Technical Implementation Guidelines:
text
Django Template Constraints:
- Keep all {% block %} structure
- Maintain template inheritance
- Use existing static file paths
- Keep Django template tags intact
- Preserve form submission URLs

CSS Architecture:
- Use CSS Grid + Flexbox (no float layouts)
- Implement CSS Custom Properties for theming
- Mobile-first responsive approach
- BEM methodology for class naming
- Separate files: base.css, components.css, utilities.css

JavaScript Requirements:
- Vanilla JS preferred (no heavy frameworks)
- Module pattern for organization
- IntersectionObserver for scroll effects
- Debounced resize/scroll handlers
- Graceful degradation for older browsers
8. Deliverables Expected:
text
Phase 1: Core Page Components
- Complete shop.html rewrite with modern layout
- Enhanced poshapp-shop.css with design system
- Integrated JavaScript for interactions
- Mobile navigation implementation
- Image gallery with zoom functionality

Phase 2: Additional Features
- Product comparison module
- Advanced filtering system
- Wishlist functionality
- PDF quote generation
- Order tracking integration

Phase 3: Performance & Polish
- Lighthouse score improvements
- Cross-browser testing results
- Accessibility audit report
- Mobile usability optimizations
- Loading performance metrics
9. Success Metrics:
text
Design Goals:
- Increase time on page by 30%
- Reduce bounce rate by 20%
- Improve mobile conversion by 40%
- Achieve 90+ Lighthouse Performance score
- Reach 95+ Accessibility score
- Reduce page load time to < 2s on 3G
- Increase add-to-cart rate by 25%
10. Testing Requirements:
text
Cross-browser Testing:
- Chrome 90+ (Desktop/Mobile)
- Safari 14+ (Desktop/Mobile)
- Firefox 88+
- Edge 90+

Device Testing:
- Desktop (1280px+)
- Tablet (768px-1024px)
- Mobile (320px-767px)

User Testing Scenarios:
1. First-time distributor browsing products
2. Returning user adding to cart
3. Mobile user requesting quote
4. User comparing multiple products
5. Quick purchase flow
Workflow Approach:
text
1. Audit existing HTML/CSS/JS
2. Define component architecture
3. Build design system foundation
4. Implement mobile-first responsive layout
5. Add interactive features layer
6. Optimize performance
7. Test across scenarios
8. Provide documentation
Special Notes:
Target audience: B2B distributors (tech-savvy but value speed & clarity)

Primary conversion goal: Quote requests & bulk orders

Secondary: Product comparisons and cart additions

Must maintain professional/business aesthetic

Avoid "flashy" consumer e-commerce patterns

Prioritize clarity and speed over animations

Keep color scheme professional (blues, grays, white)

Final Check:
Before delivering, verify:

All Django template logic preserved

No broken form submissions

Responsive at all breakpoints

Accessible keyboard navigation

Image optimization complete

JavaScript gracefully degrades

Print styles for quotes

Dark mode consideration

Performance budgets met

Code is maintainable and documented

Start your analysis from the provided shop.html file. First identify specific issues, then propose a structured redesign plan, and finally implement the complete solution with clear before/after explanations.

Please begin by analyzing the current implementation and outlining your step-by-step improvement strategy.

