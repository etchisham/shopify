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

Run Theme Check before every commit. CI runs the same official linter on pushes and pull requests.

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
- Conversion-oriented homepage sequence: value proposition, confidence, discovery, benefit, final action
- No fabricated reviews, scarcity, urgency, guarantees, or delivery promises

## Header and footer setup

The header group renders the announcement bar first, followed by the header. In the Theme Editor:

1. Upload the global brand logo in **Theme settings → Brand**, or set separate header/footer logo overrides.
2. Select a compact desktop menu and a richer mobile menu; nested mobile links automatically receive disclosure arrows.
3. Edit announcement copy, height, colors, type size, search/account visibility, logo widths, and header spacing.
4. Select the two footer menus, then edit newsletter copy, privacy link, copyright label, social URLs, colors, type sizes, and spacing.

Social icons render only when a real profile URL exists. Blank section copy uses the bundled English or Arabic storefront translation; merchant-entered copy and navigation titles should be localized with Shopify Translate & Adapt. Arabic, Persian, Hebrew, and Urdu storefronts automatically use RTL direction and logical layout spacing.

## Catalog and product cards

Collection, search, and featured-collection grids share `snippets/product-card.liquid`; use that snippet for future product grids to keep one store-wide card design. Theme settings control catalog columns, image corner radius, vendor visibility, verified rating visibility, and calculated discount visibility.

Collection and product-search pages include the same pill-shaped filter/sort toolbar. **All filters** opens a keyboard-accessible modal side drawer: left in LTR, right in RTL. Configure available storefront filters in Shopify Search & Discovery. Ratings render only from Shopify's `reviews.rating` and `reviews.rating_count` product metafields; missing review data stays hidden rather than being invented.

## Build order

1. Define target customer, product category, desired action, brand voice, and visual direction.
2. Set global fonts, colors, logo, menus, footer, and spacing in Theme settings.
3. Replace all starter homepage copy. Connect hero buttons and select a featured collection.
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
