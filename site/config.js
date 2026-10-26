// Sales-site settings. Edit this file to point the site at the live sales store and to
// change any figure the owner has to confirm. site/index.html carries the same values as
// its no-JS defaults; tests/unit/sales-site.test.mjs fails if the two drift apart.

// The Shopify sales store that sells the four licence products (tools/sales/store.json).
const store = 'blueprinttheme.myshopify.com'; // placeholder, set at launch

// Product handles on the sales store (tools/sales/store.json).
const handles = {
  theme: 'blueprint-theme',
  agency: 'blueprint-agency',
  extra: 'blueprint-extra-licence',
  dfy: 'blueprint-done-for-you',
};

// Variant IDs from the sales store's admin. While one is null its links go to the product
// page; once set (and JS runs) they become cart permalinks: https://<store>/cart/<id>:1
const variants = { theme: null, agency: null, extra: null, dfy: null };

// Live demo-store URLs for the tour's "Open the live store" link (hidden while null).
const demoStores = {
  verde: null,
  omni: null,
  kindly: null,
  dreamr: null,
  goodboy: null,
  ode: null,
  rawform: null,
  kindling: null,
  allele: null,
  stillwater: null,
};

// Figures kept from the design that only the owner can vouch for. Set one to null to hide
// the sentence or block that shows it.
export const ownerFigures = {
  installsThisWeek: 219, // owner to confirm before launch (hero badge)
  clientRevenue: '$500k/mo', // owner to confirm before launch ("the storefront we build for $500k/mo brands")
  dfySlotsPerWeek: 4, // owner to confirm before launch ("4 slots a week.")
  community: 'Discord', // owner to confirm before launch (support channel named in pricing and the FAQ)
  communityUrl: null, // owner to confirm before launch (footer link, hidden while null)
  supportResponse: 'A human answers within the day.', // owner to confirm before launch
  setupVideos: 'Setup videos', // owner to confirm before launch (Theme plan: "Setup videos + Discord support")
  supportEmail: 'theme@blueprintdtc.com', // owner to confirm before launch
  company: 'Blueprint DTC LLC', // owner to confirm before launch
  // owner to confirm before launch (updater card: what ships next)
  roadmap: [
    { version: 'v1.1', label: 'quiz pre-lander', when: 'Nov' },
    { version: 'v1.2', label: 'two more presets', when: 'Dec' },
  ],
  // owner to confirm before launch: results from stores that switched, with their permission
  results: [
    {
      metric: '+31% CVR',
      brand: 'Greens brand, $180k/mo',
      quote: 'Same ads, same spend. We moved to Blueprint on a Thursday and product page conversion went from 2.6% to 3.4% in the first 30 days.',
      who: 'Founder · supplements · switched from Impulse + PageFly',
    },
    {
      metric: '+$14 AOV',
      brand: 'Sleep gummies, $90k/mo',
      quote: 'The bundle block alone paid for it in a day. 61% of orders now take the 2-pack. We cancelled the bundle app and the cart app the same week.',
      who: 'Operator · wellness · switched from Dawn + 3 apps',
    },
    {
      metric: '−$3,048/yr',
      brand: 'Pet brand, $240k/mo',
      quote: 'Replo, Rebuy, a bundle app and a cart app, all gone. The listicle template outperformed our Replo page by 18% on the same creative.',
      who: 'Head of growth · pet · switched from Replo stack',
    },
  ],
};

export default {
  store,
  handles,
  variants,
  demoStores,
  ...ownerFigures,
  // Median mobile Lighthouse performance score, demo product page.
  lighthouseMobile: 94,
  // Points ahead of Dawn on the same demo product. While null the site says "Faster than
  // Dawn on the same demo product" with no number.
  vsDawn: null,
};
