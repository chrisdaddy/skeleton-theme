// Mock Shopify product objects for the offline preview, built from data/demo-content.json.
//
// They mirror the shape Liquid sees on a real store (variants, options, selling plan
// allocations, metafields with .value), so the theme's own Liquid computes every figure.
// Prices are in cents. Where the demo data is silent (extra variants, gift products,
// plan names), the values here are labelled mock data.

const cents = (dollars) => Math.round(dollars * 100);
const leadingNumber = (text) => Number(/^(\d+)/.exec(String(text))?.[1] || 1);
const handleize = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

let nextId = 1000;
const id = () => (nextId += 1);

const field = (value) => ({ value });

function media(alt, count = 5) {
  return Array.from({ length: count }, (_, i) => {
    const m = { id: id(), media_type: 'image', alt: i === 0 ? alt : `${alt} · view ${i + 1}`, aspect_ratio: 1 };
    m.preview_image = m;
    return m;
  });
}

// variant.product, as Liquid has it (not enumerable, so cart JSON stays acyclic).
function linkVariants(product) {
  for (const variant of product.variants) Object.defineProperty(variant, 'product', { value: product, enumerable: false });
}

export function simpleProduct(title, price, extra = {}) {
  const variantId = id();
  const product = {
    id: id(),
    title,
    handle: handleize(title),
    available: true,
    media: media(title, 1),
    ...extra,
  };
  product.url = `/products/${product.handle}`;
  product.featured_media = product.media[0];
  const variant = { id: variantId, title: 'Default Title', price, compare_at_price: null, available: true, options: ['Default Title'], url: `${product.url}?variant=${variantId}`, metafields: {}, selling_plan_allocations: [] };
  product.variants = [variant];
  product.selected_or_first_available_variant = variant;
  product.price = price;
  product.price_min = price;
  product.price_max = price;
  product.price_varies = false;
  product.options_with_values = [];
  product.has_only_default_variant = true;
  product.requires_selling_plan = false;
  product.selling_plan_groups = [];
  linkVariants(product);
  return product;
}

// Builds a product with options, a pack option driving the tiers, and optional selling plans.
function buildProduct({ title, handle, options, priceFor, compareFor, packOption, subscriptionPct, planHints = [], tiers, metafields, mediaAlt, swatches }) {
  const product = { id: id(), title, handle, url: `/products/${handle}`, description: `<p>${title}.</p>`, tags: ['label:Third-party tested'], available: true };
  const combos = options.reduce((acc, opt) => acc.flatMap((prev) => opt.values.map((v) => [...prev, v])), [[]]);

  const plans = subscriptionPct
    ? ['Delivery every month', 'Delivery every 2 months', 'Delivery every 3 months'].map((name) => ({ id: id(), name, description: '' }))
    : [];
  product.selling_plan_groups = plans.length ? [{ id: id(), name: `Subscribe & save ${subscriptionPct}%`, selling_plans: plans }] : [];
  product.requires_selling_plan = false;

  product.variants = combos.map((values) => {
    const variant = {
      id: id(),
      title: values.join(' / '),
      options: values,
      price: priceFor(values),
      compare_at_price: compareFor ? compareFor(values) : null,
      available: true,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      inventory_quantity: 120,
      quantity_rule: { min: 1, increment: 1, max: null },
      store_availabilities: [],
      metafields: { blueprint: {} },
    };
    variant.url = `/products/${handle}?variant=${variant.id}`;
    variant.selling_plan_allocations = plans.map((plan) => ({
      selling_plan: plan,
      selling_plan_group_id: product.selling_plan_groups[0].id,
      price: Math.round(variant.price * (1 - subscriptionPct / 100)),
      compare_at_price: variant.price,
    }));
    if (packOption) {
      const packIndex = options.findIndex((o) => o.name === packOption);
      if (packIndex >= 0) variant.metafields.blueprint.pack_quantity = field(leadingNumber(values[packIndex]));
    }
    return variant;
  });

  product.selected_or_first_available_variant = product.variants.find((v) => v.available) || product.variants[0];
  product.price = Math.min(...product.variants.map((v) => v.price));
  product.price_min = product.price;
  product.price_max = Math.max(...product.variants.map((v) => v.price));
  product.price_varies = new Set(product.variants.map((v) => v.price)).size > 1;
  product.options = options.map((o) => o.name);
  product.has_only_default_variant = false;
  product.media = media(mediaAlt);
  product.featured_media = product.media[0];
  product.metafields = metafields;
  product.metafields.blueprint.tiers = field(tiers(product));
  if (packOption) product.metafields.blueprint.pack_option = field(packOption);
  product.swatches = swatches;
  linkVariants(product);
  return product;
}

export function buildDemoProducts(demo) {
  const reviewsFrom = (store) => {
    const rating = Number(/★\s*([\d.]+)/.exec(store.home[0].note || '')?.[1] || store.collection[0][2] || 4.8);
    return { rating: field({ rating, scale_max: 5 }), rating_count: field(Number(String(store.product.reviews).replace(/,/g, ''))) };
  };
  const benefits = (store) => field(store.product.benefits.map(([icon, title]) => ({ icon: field(icon), title: field(title) })));
  const sectionOf = (store, type) => [...store.home, ...store.pdp].find((s) => s.type === type);
  const ingredients = (store) => {
    const s = sectionOf(store, 'ingredients');
    return s ? field(s.rows.map(([name, dose, why]) => ({ name: field(name), dose: field(dose), why: field(why) }))) : undefined;
  };
  const faqs = (store) => {
    const s = sectionOf(store, 'faq');
    return s ? field(s.items.map(([q, a]) => ({ question: field(q), answer: { value: `<p>${a}</p>`, type: 'rich_text_field' } }))) : undefined;
  };
  const upsell = (store) => field(simpleProduct(store.upsell.name, cents(Number(store.upsell.price.replace('$', '')))));
  const subscriptionPct = (store) => Number(/(\d+)%\s*with subscription/.exec(store.product.save)?.[1] || 0) || null;

  // Verde: a Format option plus pack tiers, 20% subscription (from the store's own copy).
  const verde = demo.stores.verde;
  const verdeTiers = verde.product.tiers;
  const verdeGift = simpleProduct('Travel packs (5) · free gift', 1800);
  const verdeProduct = buildProduct({
    title: verde.product.name,
    handle: 'verde-daily',
    mediaAlt: verde.product.photo,
    options: [
      { name: verde.product.variants[0].label, values: verde.product.variants[0].options },
      { name: 'Pack', values: verdeTiers.map((t) => t.label) },
    ],
    packOption: 'Pack',
    priceFor: ([, pack]) => cents(verdeTiers.find((t) => t.label === pack).price),
    compareFor: ([, pack]) => cents(verdeTiers.find((t) => t.label === pack).was),
    subscriptionPct: subscriptionPct(verde),
    tiers: () =>
      verdeTiers.map((t, i) => ({
        label: field(t.label),
        sublabel: field(t.sub),
        pack_value: field(t.label),
        badge: field(t.tag || ''),
        preselected: field(i === 1),
        subscription_plan_hint: field(['', '2 months', '3 months'][i]),
        gift_variant: field(i === 2 ? verdeGift.variants[0] : null),
        gift_value_label: field(i === 2 ? '$18 value' : ''),
      })),
    metafields: {
      blueprint: {
        servings_per_unit: field(30),
        serving_label: field('serving'),
        days_per_unit: field(30),
        badge: field(verde.product.badge),
        benefits: benefits(verde),
        ingredients: ingredients(verde),
        faqs: faqs(verde),
        guarantee: field({ title: field('90-day money-back guarantee') }),
        upsell: upsell(verde),
      },
      reviews: reviewsFrom(verde),
      descriptors: { subtitle: field(verde.product.title) },
    },
  });

  // Rawform: Flavour × Size × Pack (24 variants), 15% subscription.
  const raw = demo.stores.rawform;
  const rawTiers = raw.product.tiers;
  const shaker = simpleProduct('Steel shaker · free gift', 1800);
  const rawProduct = buildProduct({
    title: raw.product.name,
    handle: 'rawform-whey',
    mediaAlt: raw.product.photo,
    options: [...raw.product.variants.map((v) => ({ name: v.label, values: v.options })), { name: 'Pack', values: rawTiers.map((t) => t.label) }],
    packOption: 'Pack',
    // Mock: the 5 lb size costs 2.3× the 2 lb price (the demo data only prices 2 lb).
    priceFor: ([, size, pack]) => cents(rawTiers.find((t) => t.label === pack).price * (size.startsWith('5') ? 2.3 : 1)),
    compareFor: ([, size, pack]) => cents(rawTiers.find((t) => t.label === pack).was * (size.startsWith('5') ? 2.3 : 1)),
    subscriptionPct: subscriptionPct(raw),
    tiers: () =>
      rawTiers.map((t, i) => ({
        label: field(t.label),
        sublabel: field(t.sub),
        pack_value: field(t.label),
        badge: field(t.tag || ''),
        preselected: field(i === 1),
        subscription_plan_hint: field(['', '2 months', '3 months'][i]),
        gift_variant: field(i === 2 ? shaker.variants[0] : null),
        gift_value_label: field(i === 2 ? '$18 value' : ''),
      })),
    metafields: {
      blueprint: {
        servings_per_unit: field(28),
        serving_label: field('serving'),
        days_per_unit: field(28),
        badge: field(raw.product.badge),
        benefits: benefits(raw),
        ingredients: ingredients(raw),
        faqs: faqs(raw),
        guarantee: field({ title: field('Money-back guarantee') }),
        upsell: upsell(raw),
      },
      reviews: reviewsFrom(raw),
      descriptors: { subtitle: field(raw.product.title) },
    },
  });

  // Ode: sizes are the tiers (pack option "Size"); the discovery set is a separate product.
  const ode = demo.stores.ode;
  const discovery = simpleProduct('Discovery set', cents(ode.product.tiers[0].price));
  const odeSizes = ode.product.variants[0];
  const odePrices = { '10 ml travel': 3400, '50 ml': cents(ode.product.tiers[1].price), '100 ml': cents(ode.product.tiers[2].price) };
  const odeProduct = buildProduct({
    title: ode.product.name,
    handle: 'ode-no-04',
    mediaAlt: ode.product.photo,
    options: [{ name: odeSizes.label, values: odeSizes.options }],
    packOption: null,
    priceFor: ([size]) => odePrices[size],
    subscriptionPct: null,
    tiers: () =>
      ode.product.tiers.map((t, i) => ({
        label: field(t.label),
        sublabel: field(t.sub),
        pack_value: field(i === 0 ? '' : t.label),
        variant: field(i === 0 ? discovery.variants[0] : null),
        badge: field(t.tag || ''),
        preselected: field(i === 1),
      })),
    metafields: {
      blueprint: {
        badge: field(ode.product.badge),
        benefits: benefits(ode),
        faqs: faqs(ode),
        guarantee: field({ title: field('Free returns within 30 days, even opened') }),
        upsell: upsell(ode),
      },
      reviews: reviewsFrom(ode),
      descriptors: { subtitle: field(ode.product.title) },
    },
  });
  odeProduct.metafields.blueprint.pack_option = field(odeSizes.label);
  // Every Ode tier is one bottle.
  for (const v of odeProduct.variants) v.metafields.blueprint.pack_quantity = field(1);

  // Upsell products carry the store's in-cart deal copy (blueprint.cart_deal_label).
  for (const [product, store] of [[verdeProduct, verde], [rawProduct, raw], [odeProduct, ode]]) {
    const upsellProduct = product.metafields.blueprint.upsell.value;
    upsellProduct.metafields = { blueprint: { cart_deal_label: field(store.upsell.deal) } };
  }

  return { verde: verdeProduct, rawform: rawProduct, ode: odeProduct, gifts: [verdeGift, shaker, discovery] };
}

// Cart fixtures per store: rewards, gifts, shipping protection and the best-seller collection.
// Thresholds and gift choices are mock data (the demo only names the rewards); each reward's
// gift is a separate product from the store's bundle-tier gift, so the two never overlap.
export function buildCartFixtures(demo, products) {
  const protection = simpleProduct('Shipping protection', 295, { requires_shipping: false });
  const collectionOf = (store, hero) => {
    const items = store.collection
      .filter(([name]) => name !== hero.title && !hero.title.includes(name))
      .map(([name, price, rating]) => {
        const product = simpleProduct(name, cents(Number(price.replace('$', ''))));
        product.metafields = { reviews: { rating: field({ rating: Number(rating), scale_max: 5 }) } };
        return product;
      });
    return { title: 'Best sellers', handle: `${store.id}-best-sellers`, url: `/collections/${store.id}-best-sellers`, products: items, products_count: items.length, all_products_count: items.length };
  };
  const reward = (label, threshold, gift = null) => ({ label, threshold, gift });
  const verde = demo.stores.verde;
  const ode = demo.stores.ode;
  const raw = demo.stores.rawform;
  const verdeShaker = simpleProduct('Glass shaker · reward', 1500);
  const verdePacks = simpleProduct('Travel packs (10) · reward', 3600);
  const odeSamples = simpleProduct('Samples (2) · reward', 1200);
  const rawSamples = simpleProduct('Sample sachets (6) · reward', 1800);
  const fixtures = {
    verde: { rewards: [reward(verde.rewards[0], 50), reward(verde.rewards[1], 130, verdeShaker), reward(verde.rewards[2], 250, verdePacks)], collection: collectionOf(verde, products.verde) },
    ode: { rewards: [reward(ode.rewards[0], 100), reward(ode.rewards[1], 150, odeSamples), reward(ode.rewards[2], 300)], collection: collectionOf(ode, products.ode) },
    rawform: { rewards: [reward(raw.rewards[0], 50), reward(raw.rewards[1], 120), reward(raw.rewards[2], 200, rawSamples)], collection: collectionOf(raw, products.rawform) },
  };
  const extra = [protection, verdeShaker, verdePacks, odeSamples, rawSamples, ...Object.values(fixtures).flatMap((f) => f.collection.products)];
  return { protection, fixtures, products: extra };
}

// Shopify's per-request view of a product: selected variant and plan from the URL,
// and option values resolved against the current selection.
export function productForRequest(product, query = new URLSearchParams()) {
  const requested = product.variants.find((v) => String(v.id) === query.get('variant'));
  const current = requested || product.variants.find((v) => v.available) || product.variants[0];
  const planId = query.get('selling_plan');
  const selectedPlan = planId ? product.selling_plan_groups.flatMap((g) => g.selling_plans).find((p) => String(p.id) === planId) : null;

  const optionsWithValues = product.options.map((name, index) => {
    const values = [...new Set(product.variants.map((v) => v.options[index]))];
    return {
      name,
      position: index + 1,
      selected_value: current.options[index],
      values: values.map((value) => {
        const match = product.variants.find((v) => v.options[index] === value && v.options.every((o, i) => i === index || o === current.options[i]));
        const swatchColor = product.swatches?.[value];
        return {
          name: value,
          selected: current.options[index] === value,
          available: Boolean(match?.available),
          variant: match || null,
          product_url: null,
          swatch: swatchColor ? { color: swatchColor } : null,
          toString: () => value,
        };
      }),
    };
  });

  return {
    ...product,
    selected_variant: requested || null,
    selected_or_first_available_variant: current,
    selected_selling_plan: selectedPlan || null,
    options_with_values: optionsWithValues,
    options_by_name: Object.fromEntries(optionsWithValues.map((o) => [o.name, o])),
  };
}
