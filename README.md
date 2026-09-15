# Main Theme

Lean Shopify Online Store 2.0 foundation based on Shopify's official Skeleton Theme. It is designed for direct Liquid development: no bundler, frontend framework, custom backend, or runtime dependency.

## Requirements

- Shopify development store
- Shopify CLI 4+
- Git
- Recommended: Shopify Liquid extension for VS Code

## Start development

```powershell
shopify theme dev --store your-store.myshopify.com
```

Shopify CLI uploads a development theme, starts local preview, and hot reloads supported changes.

## Validate

```powershell
shopify theme check --fail-level suggestion
```

Run Theme Check before every commit. CI runs the same official linter on pushes and pull requests. Check homepage interactions and support timing with `node --test tests/storefront.test.cjs`.

## Architecture

```text
assets/       Small global CSS, progressive JavaScript, static assets
blocks/       Reusable theme blocks
config/       Merchant-editable global settings and saved values
layout/       Storefront and password HTML shells
locales/      Customer-facing and editor translations
sections/     Merchant-editable page and section-group modules
snippets/     Reusable Liquid presentation primitives
templates/    JSON page compositions
```

Architecture choice: Shopify Skeleton over Dawn. Skeleton gives a current, minimal, official base with less code and JavaScript to remove. Trade-off: product filtering, predictive search, quick add, localization selectors, and advanced media behavior must be added only when the store needs them.

## Built-in foundations

- JSON templates and header/footer section groups
- App-block support on product pages
- Responsive Shopify CDN images with dimensions and `srcset`
- Semantic landmarks, labels, keyboard focus, skip link, 44px controls
- Reduced-motion handling and merchant-controlled storefront colors
- Native Shopify product, newsletter, cart, search, account, and checkout flows
- Structured product data, canonical URL, Open Graph, and Twitter metadata
- Reference-inspired homepage sequence: split slideshow, statement, collection tabs, sports statement, athlete tabs, oversized category links; no video
- No fabricated reviews, scarcity, urgency, guarantees, or delivery promises

## Header and footer setup

The header group renders the announcement bar first, followed by the header. In the Theme Editor:

1. Upload the global brand logo in **Theme settings → Brand**, or set separate header/footer logo overrides.
2. Select a compact desktop menu and a richer mobile menu; nested mobile links automatically receive disclosure arrows.
3. Edit announcement copy, height, colors, type size, search/account visibility, logo widths, and header spacing.
4. Select the two footer menus, then edit newsletter copy, privacy link, copyright label, social URLs, colors, type sizes, and spacing.

Social icons render only when a real profile URL exists. Blank section copy uses the bundled English or Arabic storefront translation; merchant-entered copy and navigation titles should be localized with Shopify Translate & Adapt. Arabic, Persian, Hebrew, and Urdu storefronts automatically use RTL direction and logical layout spacing.

## Homepage, contact, and WhatsApp setup

The homepage follows the section flow of [IKONICK](https://ikonick.com/) without its video. It uses original starter copy, not copied photography, sales figures, or licensing claims. All six sections can be reordered, removed, and customized in the Theme Editor. Text has separate English/Arabic fields; blanks fall back to English. Slideshow images include optional mobile overrides and image descriptions. Colors, heading sizes, spacing, autoplay, and product rail settings are editable.

1. In **Customize → Home page**, upload images for each slideshow block and choose actual collections for both collection-tab sections. Update every CTA/category URL to an existing collection. The sample handles and athlete labels are suggestions, not automatically created collections or licensing claims.
2. In **Theme settings → Support & contact**, enter the real email, phone, and HTTPS WhatsApp link (for example, `https://wa.me/COUNTRYCODEANDNUMBER`, with digits only). Blank/unsupported WhatsApp links hide the public widget. The editor shows a setup notice.
3. Create a **Contact us** page in Shopify Admin and assign the **contact** theme template. Add that page to navigation. Its email/phone inherit global support settings, with optional section overrides.
4. The contact form uses Shopify's native `contact` form, required name/email/message fields, an optional phone, server-side error/success output, and Shopify spam protection. Delivery is controlled by Shopify's store notification settings; verify the recipient and send a test on the development store before launch.

The support bubble stays physically bottom-right in LTR and RTL. Clicking it opens WhatsApp in a new tab with `noopener noreferrer`. The greeting appears 15 seconds after the first pointer, keyboard, or scroll interaction (delay editable). Session storage preserves the countdown across same-tab page navigation and prevents repeated greetings. Dismissing it or opening WhatsApp suppresses it for that session. No automatic external tabs or pretend live chat. With blocked storage, it falls back to the current page's memory.

Homepage JavaScript progressively adds accessible tabs, keyboard arrow/Home/End navigation, product scrolling, optional slideshow autoplay, focus/hover pauses, reduced-motion handling, and Theme Editor block selection. Without JavaScript, the first hero and all collection panels remain usable; WhatsApp remains a normal link.

Optional local visual fixtures:

```powershell
npm install --prefix .preview --no-save --package-lock=false liquidjs
node scripts/preview.cjs
```

Open `http://127.0.0.1:4173/home` or `/contact`, adding `?lang=ar` for RTL. These render the actual section Liquid with mocked Shopify filters, placeholder imagery, and clearly marked example contact details. They are not a live Shopify preview and do not send forms. `.preview/`, scripts, and tests are excluded from theme uploads. Use `shopify theme dev --store your-store.myshopify.com` for full platform validation.

## Cart drawer

The header cart and storefront cart links open a modal drawer on the physical right in both LTR and RTL. Its header and checkout footer remain visible while items and recommendations scroll. Quantity changes, removal, discount codes, totals, line-item properties, and subscription labels use Shopify cart data. Adding a product keeps the current page and shows a green, translated notification with the product name. Writes are serialized; duplicate submissions are blocked; failed section refreshes expose a retry and block stale checkout totals.

Shopify owns the `/cart` route. The standalone cart layout is retired: visiting an old cart URL returns to the localized storefront with the drawer open. Without JavaScript, that route provides a minimal total and native checkout fallback.

In **Customize → Cart drawer**, choose a fallback recommendation collection and optionally enter a verified active offer and its terms. Blank recommendations fall back to the all-products collection. Shopify related-product recommendations replace the fallback when available; sold-out products and products already in the cart are excluded. Offer text does not create discounts or free items; savings and discount badges show only platform-calculated amounts.

The implementation uses Shopify's [Ajax Cart API and bundled section rendering](https://shopify.dev/docs/api/ajax/reference/cart) and [Product Recommendations API](https://shopify.dev/docs/api/ajax/reference/product-recommendations). It adds no production dependency or custom backend.

Local cart fixtures run in memory and never submit checkout. `/home` and `/ar/home` include an example add button; `/cart` and `/ar/cart` exercise legacy URL handling. `SAVE10` is a fixture-only example code. Install optional local test dependencies and run the interaction checks:

```powershell
npm install --prefix .preview --no-save --package-lock=false liquidjs jsdom
node --test tests/storefront.test.cjs tests/cart.test.cjs
```

Cart conversion flow score: **7/10**. Checkout hierarchy and local behavior are verified. A higher evidence-based score requires live-store purchase validation, real offer/fulfillment terms, and measurement of add-to-cart, checkout-start, purchase, errors, and device-level abandonment. Conversion impact has not been measured.

## Catalog and product cards

Collection, search, and featured-collection grids share `snippets/product-card.liquid`; use that snippet for future product grids to keep one store-wide card design. Theme settings control catalog columns, image corner radius, vendor visibility, verified rating visibility, and calculated discount visibility.

Collection and product-search pages include the same pill-shaped filter/sort toolbar. **All filters** opens a keyboard-accessible modal side drawer: left in LTR, right in RTL. Configure available storefront filters in Shopify Search & Discovery. Ratings render only from Shopify's `reviews.rating` and `reviews.rating_count` product metafields; missing review data stays hidden rather than being invented.

## Build order

1. Define target customer, product category, desired action, brand voice, and visual direction.
2. Set global fonts, colors, logo, menus, footer, and spacing in Theme settings.
3. Replace starter homepage copy and images. Connect all links and choose real collections in the collection-tab blocks.
4. Add verified shipping, returns, warranty, support, and payment facts at relevant decision points.
5. Add product metafields and reusable sections only after the catalog model is stable.
6. Test keyboard use, 200% zoom, screen readers, mobile layouts, slow networks, and empty/error states.
7. Run Theme Check, Lighthouse, and real-device purchase tests before launch.

## CRO launch inputs

Current scaffold score: **7/10**. Structure, action hierarchy, responsive forms, and trust-placement slots exist. A 10/10 claim requires store-specific evidence:

- One primary conversion KPI and full funnel measurement
- Voice-of-customer research and top objections
- Verified testimonials, reviews, credentials, or outcome evidence
- Clear shipping costs/timing, returns, warranty, and contact expectations
- Analytics segmented by device, source, intent, and buying stage
- Prioritized experiments with primary, secondary, and guardrail metrics

Do not publish starter copy as final positioning. Treat it as editor guidance.

## Deployment safety

Preview with a development theme. Push to an unpublished theme first:

```powershell
shopify theme push --unpublished
```

Never use `--allow-live` until preview, Theme Check, and purchase-flow verification pass.

## Upstream

Initialized from [Shopify Skeleton Theme](https://github.com/Shopify/skeleton-theme), licensed under MIT. Theme Store submissions must be substantively different and satisfy current Shopify Theme Store requirements.
