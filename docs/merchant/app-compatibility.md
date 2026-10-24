# Using apps with Blueprint

Blueprint uses Shopify's standard places for apps, so most apps install without code changes:
- **App blocks** are added in the theme editor.
- **App embeds** are switched on in **Theme settings → App embeds**.
- **Standard data**, such as ratings and selling plans, is read where apps already write it.

`node tools/app-compat.mjs`, part of the theme's tests, checks these integration points on every change.

| App type | Examples | How it works with Blueprint |
|---|---|---|
| **Reviews** | Judge.me, Okendo, Yotpo, Stamped, Loox | Stars on product pages and cards come from Shopify's standard `reviews.rating` and `reviews.rating_count`, which these apps fill in. Add the app's review widget as an app block in the **Reviews** section, the product page or the **Apps** section. The AI kit can quote reviews from Judge.me, Okendo, Yotpo and Stamped, or a CSV export (Loox). |
| **Subscriptions** | Shopify Subscriptions, Recharge, Skio, Loop, Appstle | Blueprint's **Purchase options** block shows any app's selling plans and posts the chosen plan with the form. If you use the app's own widget block instead, hide Blueprint's **Purchase options** block so there's only one. |
| **Upsell and cart apps** | Rebuy, UpCart, AfterSell | Product-page and cart widgets go in as app blocks or embeds. After an app changes the cart, it can refresh Blueprint's drawer and count with `document.dispatchEvent(new CustomEvent('bp:cart:changed'))`, and open the drawer with `bp:cart:open`. Post-purchase apps work at checkout and need nothing from the theme. |
| **Bundles** | Shopify Bundles, Fast Bundle | Products made with Shopify Bundles show like any product, and their variants can be tier variants. Blueprint's own tiers and bundle builder use plain variants and automatic discounts, so they work with subscriptions. |
| **Email and SMS** | Klaviyo, Omnisend, Postscript, Attentive | Turn on the app embed for pop-ups and tracking. Blueprint's newsletter forms create Shopify customers, which these apps sync. |
| **Search and filters** | Shopify Search & Discovery | Collection filters and sorting come from Search & Discovery. Add **Product type** as a filter to get the collection page's pills. |
| **Translation and markets** | Translate & Adapt, Shopify Markets | All storefront text is translatable, and links use Shopify's routes, so market and language URLs work. Prices follow the shopper's currency. Cart reward thresholds can be set per currency (see [Cart](cart-setup.md)). |
| **Analytics and pixels** | Meta, TikTok, Google, Triple Whale | Pixels load through Shopify's customer events and `content_for_header`, on every layout including pre-landers. Pre-lander buttons carry UTM and click IDs to the product page. |
| **Page builders** | — | Not needed: pre-landers, sections and the AI kit cover these pages. A page builder's own templates replace Blueprint's on those pages. |

## If an app doesn't show up

1. **App embed:** check that the embed is switched on in **Theme settings → App embeds**.
2. **App block:** in the theme editor, select the section and click **Add block**; the app's blocks are listed under **Apps**.
3. **Old-style apps:** apps that ask you to paste code into theme files predate app blocks. Ask the app for its app block or embed first. Pasted code doesn't carry over when you [update](updating.md).
