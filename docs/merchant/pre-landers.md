# Pre-landers

Pre-landers are pages built for paid traffic: an **advertorial** (a story), a **listicle** ("7 reasons…") or a **comparison** (you vs. the alternatives). They run on your own store, so pixels, analytics, the cart and checkout all work as usual.

## Create one

1. **Create the page:** in **Online Store → Pages**, add a page and choose the template **page.advertorial**, **page.listicle** or **page.comparison**. The page's own text is used for the reading-time estimate. Everything else is set in the theme editor.
2. **Edit the template:** in the editor, choose **Pages → page.advertorial** (or the one you picked) and edit its sections.
3. **Make it ready to sell:** pick the product in the **Offer** section and in each button.

To run several campaigns, duplicate the template in the editor (**Create template**), for example `advertorial-mothers-day`, and assign it to a new page. Every page that uses one template shares its content.

The AI kit can draft an advertorial or listicle from your real reviews into a draft theme; see [AI kit](../ai-kit.md).

## What's on the page

- **Layout:** pre-landers use a landing layout, with a minimal header (logo, or logo and one button) and a short footer, so readers stay on the page.
- **Header override:** on any page, set the `blueprint.header` page metafield to:
  - `full` for the store header;
  - `minimal` for the logo only;
  - `hidden` for no header.
- **Article header:** shows an **"Advertisement"** disclosure by default. Keep it on for paid or affiliate content. The editor warns you if you turn it off.
- **Offer** section: the real buy box for the product you choose. It starts on the tier and plan you set (**Default tier**, **Default plan**).
- **Sticky call to action:**
  - appears after the reader scrolls past a set point, and hides while the offer is on screen;
  - its button scrolls to the offer, or opens the product page on a chosen tier and plan.

## Search engines

Pre-landers are **not indexed** by default (`noindex, follow`), so ad copy doesn't compete with your product pages in search.
- **For all pre-landers:** change it in **Theme settings → Pre-landers**.
- **For one page:** set the `blueprint.robots` page metafield to `index` or `noindex_follow`.

Shopify's own **Hide page from search engines** setting also works, but it adds `nofollow` too.

## Tracking

Buttons on pre-landers carry the visitor's campaign parameters to the product page when clicked:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term`;
- `fbclid`, `ttclid`, `gclid`, `msclkid`, `wbraid` and `gbraid`.

Attribution survives the click, and the button's own tier and plan stay.

## Writing honest pre-landers

Blueprint helps keep ads honest; your copy has to do the rest:
- Quote reviews word for word, with the reviewer's first name.
- Use real study numbers with their source.
- Countdowns end at a fixed date.
- Don't invent scarcity or results.

Ad platforms and consumer-protection rules also expect a clear "Advertisement" or "Sponsored" label on advertorials.
