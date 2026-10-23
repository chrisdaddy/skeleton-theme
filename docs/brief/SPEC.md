# SPEC: Blueprint Theme (Dawn-based)

The source of truth for content and tokens is `data/demo-content.json`, exported from the reference demo, together with `reference/Blueprint Theme v4.dc.html`. This file explains how they map to a Shopify theme.

## 1. Presets
There are three base presets. The ten demo stores are tuned variants of them; ship the three as `settings_data.json` presets and keep the ten as demo-store configs.

| Token | Clinical | Editorial | Bold |
|---|---|---|---|
| bg | #FFFFFF | #F6F1E8 | #0F0F12 |
| surface | #EEF3F0 | #EADFCE | #1E1E25 |
| ink | #0F1A14 | #2A2420 | #FFFFFF |
| line | #DCE3DF | #DCCFBC | #2E2E38 |
| accent | #1E6B4F | #B5532E | #D8FF3D |
| accentSoft | #E3F0EA | #F2E1D6 | #2A2F14 |
| onAccent | #FFFFFF | #FFF8F0 | #0F0F12 |
| star | #1E6B4F | #B5532E | #D8FF3D |
| body font | DM Sans | DM Sans | DM Sans |
| heading font | DM Sans 600, −0.04em | Instrument Serif 400, −0.01em | DM Sans 700, −0.05em |
| radius / small / button | 12 / 8 / 999px | 4 / 3 / 3px | 18 / 12 / 14px |

Token rules:
- Map every token to a theme setting.
- Expose them as CSS custom properties on `:root` and per color scheme.
- Any element that sets a background from a token must also set the matching text color from the same preset. Contrast must be 4.5:1 in every preset, including the dark Bold preset.

The mock editor in the reference exposes the four settings merchants touch most. Make these the first settings group:
- **Accent color.**
- **Background**: light or dark.
- **Headings**: sans or serif.
- **Corners**: sharp, soft or round.

## 2. Demo stores (in `data/demo-content.json` under `stores`)
- VERDE, greens powder (Clinical)
- OMNI, all-in-one daily (Clinical, dark)
- KINDLY, clean deodorant and body care (Bold)
- DREAMR, sleep gummies (Bold, dark)
- GOODBOY, pet supplement (Bold)
- ODE, fragrance (Editorial)
- RAWFORM, protein (Bold, dark)
- Kindling, functional coffee (Editorial)
- ALLELE, clinical skincare (Clinical)
- STILLWATER, apparel basics (Editorial)

Each store has the following content:
- `bar`: announcement bar text
- `nav`
- `filters`
- `product`:
  - name, title, price, was, reviews, badge
  - `variants`
  - `benefits` (icon + text)
  - `tiers`: label, sub, price, was, tag
  - `trust`
  - `photo`: the shot description
- `upsell`
- `rewards`: cart tiers
- `collection`: grid items
- `adv`: the advertorial
- `list`: the listicle
- `home`: an ordered section stack
- `pdp`: the below-buy-box section stack

Seed the three hero demo stores from this content: Verde, Ode and Rawform.

## 3. Templates (the "8 templates")
1. `index`: home.
2. `product`: buy box plus `pdp` stack.
3. `collection`: filters, sort, quick add, badges, rating.
4. `cart`: the page, plus the drawer as the default cart type.
5. `page.advertorial`: native pre-lander, editorial article layout.
6. `page.listicle`: native pre-lander, "N reasons" layout.
7. `page.comparison`: native pre-lander, us vs them plus a table.
8. `page.about`: founder story.

Also polish `404`, `search`, `blog`, `article`, `password` and `gift_card` to the preset. Pre-landers carry these settings:
- **noindex:** a toggle.
- **Hidden header:** a minimal-header option.
- **CTA product:** a product picker.
- **CTA preselection:** variant, tier and selling plan, via the URL contract `?tier=&plan=sub|once&variant=`.

## 4. Section catalog
These are the types used in the reference demo, with the number of demo stores using each. Every one needs a section with schema, presets and sensible defaults. Per-product sections read metafields first, then section settings.

| Type | Uses | Notes |
|---|---|---|
| hero | 10 | split, centered and full-bleed layouts; eyebrow, h, sub, CTA, rating note, image |
| press | 7 | logo or wordmark strip, marquee option |
| badges | 2 | certification pills |
| benefits | 3 | icon grid |
| study | 4 | clinical results: big % stats, source line |
| ingredients | 4 | table: name, dose, why; footer link to COA |
| usvsthem | 3 | check/cross comparison table |
| subscription | 6 | why-subscribe tiles |
| reviews | 13 | rating summary plus cards; app-block slot for the review apps |
| faq | 18 | accordion, schema.org FAQ JSON-LD |
| guarantee | 4 | money-back block |
| ticker | 4 | scrolling benefit or offer marquee |
| features | 6 | image + text features |
| stats | 2 | animated counters |
| videos | 3 | UGC video row: lazy, muted, tap to unmute |
| quiz | 3 | product-finder quiz (multi-step, result maps to a product) |
| imagetext | 6 | image with text, alternating |
| bundle | 5 | build-a-bundle / bundle offer |
| countdown | 1 | offer timer; evergreen option, no fake urgency by default |
| ugc | 4 | photo grid |
| comments | 2 | social-proof comments (advertorial style) |
| beforeafter | 4 | draggable before/after slider |
| founder | 2 | founder note |
| collection | 2 | featured collection |
| steps | 2 | how it works |

Reaching 70+ sections:
- Add header and footer groups, the announcement bar, and the cart drawer.
- Add the pre-lander-specific sections: article body, pull quote, author byline, listicle item, comparison table and sticky CTA bar.
- Keep the Dawn essentials: rich text, multicolumn, image banner, slideshow, collage, newsletter, contact form, blog posts, collection list, featured product and email signup.
- Count layout variants of the sections above.

List the final 70+ in PLAN.md.

## 5. Buy box: product information blocks
These are the reference editor's block list, in order, with default on/off. Each block is a real block in `main-product`:
- **rating**: Reviews rating (on).
- **viewers**: "N people viewing" (off; must be honest or off by default).
- **award**: Award badge (off).
- **title**: Product title (on).
- **price**: Price (on).
- **benefits**: Benefits grid (on).
- **stock**: Stock indicator (off; real inventory only).
- **bundle**: Bundle and save (on).
- **sub**: Subscription toggle (on).
- **shipping**: Shipping countdown (off).
- **atc**: Add to cart (on).
- **guarantee**: Guarantee row (on).
- **moneyback**: Money-back statistic (off).
- **pay**: Payment icons (on).

Add these as well to reach 30+ blocks:
- variant pills and swatches, gift-with-purchase, ingredients popover, size guide, delivery estimate
- trust tiles, bought-today line, sticky ATC settings
- custom liquid, app block, text, icon list, accordion, image, divider

The buy box rules in START_HERE §Non-negotiables 2 are acceptance criteria. Write a checklist test for every tier × subscribe/one-time combination.

The tiers come from the demo, for example Verde:

| Tier | Supply | Price | Was | Tag |
|---|---|---|---|---|
| 1 pouch | 30 servings | $79 | $99 | none |
| 2 pouches | 60 servings, free shipping | $142 | $198 | Most popular |
| 3 pouches | 90 servings, free travel packs | $199 | $297 | Best value |

Show per-serving cost ($79 ÷ 30 = $2.63) and savings % that reconcile.

## 6. Cart drawer
- **Header:** "Your cart (n)".
- **Rewards progress bar:** tiers from settings, for example Free shipping, then Free shaker, then Free travel packs, each with a threshold and an auto-added gift product.
- **Lines:** quantity stepper and remove.
- **Shipping protection:** an optional product line, default price $2.95, with a description ("Loss, theft and damage covered") and a toggle that defaults on or off per setting.
- **"Goes well with":** one upsell from a product metafield or a collection fallback, with an Add button. Show the in-cart deal price when one is configured.
- **Totals:** subtotal, then the bundle discount line, then the total.
- **Checkout:** Checkout button, "Secure checkout" line, payment marks, dynamic checkout buttons.
- **Empty state:** best sellers.
- **Behavior:** everything updates through the section rendering API with no full reload, and it is accessible (focus trap, Escape closes, aria-live).

## 7. Pre-landers (content shapes from `adv` and `list`)
- **Advertorial:** eyebrow ("Health · Sponsored"), headline, byline ("By Dana R. · 5 min read"), lede, body sections, pull quote, comments block, CTA ("Check availability →") that deep-links into the PDP with a preselected tier, and the guarantee line.
- **Listicle:** headline ("7 reasons 41,000 people…"), numbered items (title + body + image), sticky CTA, and a final offer block.
- **Comparison:** us-vs-them table, review highlights, CTA.

## 8. AI kit
- **Package:** `mcp/`, an MCP server in TypeScript.
- **Tools:**
  - read products, metafields, reviews (via app API when available), the theme section library and the current preset
  - write only to a duplicated unpublished theme
  - `diff_draft` before any write, and never call publish
- **Prompts:** `prompts/` holds 20+ prompts, for example:
  - "Write a listicle from my top 50 reviews."
  - "Add a benefits icon row to the PDP."
  - "Make the Editorial preset warmer."
  - "Build a Mother's Day advertorial."
- **Docs:** for Claude Desktop, Cursor and ChatGPT.
- **Pricing:** it runs on the merchant's own model account, with no cost to us.

## 9. Updater
- **Release:** versioned releases (v1.0.x), a changelog, and a documented update path that keeps `settings_data.json` and JSON templates.
- **Upcoming versions:** the reference shows v1.1 (quiz pre-lander, Nov) and v1.2 (two more presets, Dec). Plan for them.

## 10. Performance and quality targets
- Mobile Lighthouse on the PDP: Performance ≥ 90 and better than Dawn on the same product, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.
- LCP image preloaded with the correct `sizes`.
- Under 50 KB JS on first load, beyond Shopify's own.
- No layout shift from the announcement bar or sticky ATC.
- Theme Check clean.
- Every string in locales.
- `prefers-reduced-motion` respected for marquees, counters and sliders.
