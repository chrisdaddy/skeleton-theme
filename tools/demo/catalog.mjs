// Demo-store catalogs, built from the reference copy (data/demo-content.json).
//
// buildCatalog(demo, storeId) returns plain data the seed script applies through the Admin API
// (tools/seed-demo.mjs): products and variants, metaobjects and metafields, selling plans,
// collections, pages, menus, automatic discounts and the theme settings that must agree with
// them (reward thresholds, gift products). Nothing here talks to a store.
//
// References to things the seed creates are written as { $product }, { $variant },
// { $metaobject } and { $file } and resolved to IDs while seeding.
//
// Money: variant prices only, written as decimal strings from integer cents. Where the reference
// is silent (extra sizes, gift products, reward thresholds) the values match the offline
// preview's mock data and are marked "demo value". Demo stores show a notice that products,
// prices and reviews are samples.

export const handleize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const cents = (dollars) => Math.round(Number(dollars) * 100);
const money = (c) => (c / 100).toFixed(2);
const dollarsIn = (text) => Number(/\$(\d+(?:\.\d+)?)/.exec(String(text))?.[1] || 0);
const leadingNumber = (text) => Number(/(\d+)/.exec(String(text))?.[1] || 1);

// The three required stores keep the handles the listing templates use.
export const HERO_HANDLES = { verde: 'verde-daily', ode: 'ode-no-04', rawform: 'rawform-whey' };
export const LISTING_FOR = { Clinical: 'clinical', Editorial: 'editorial', Bold: 'bold' };
export const REQUIRED_STORES = ['verde', 'ode', 'rawform'];

export function heroHandle(store) {
  return HERO_HANDLES[store.id] ?? handleize(store.product.name.toLowerCase().startsWith(store.brand.toLowerCase()) ? store.product.name : `${store.brand} ${store.product.name}`);
}

// A product named in the reference copy: the hero when the names overlap ("Whey Isolate"),
// else its own handle.
export function productHandle(store, title) {
  const hero = store.product.name.toLowerCase();
  const name = String(title).toLowerCase();
  if (name && (hero === name || hero.includes(name) || name.includes(hero))) return heroHandle(store);
  return handleize(title);
}

const sectionOf = (store, type) => [...store.home, ...store.pdp].find((s) => s.type === type);
// The store's own "N% with subscription", else the 15% the reference's product template
// offers every store ("Subscribe & save 15%").
export const REFERENCE_SUBSCRIPTION_PCT = 15;
const subscriptionPct = (store) => Number(/(\d+)%\s*with subscription/i.exec(store.product.save)?.[1] || 0) || REFERENCE_SUBSCRIPTION_PCT;
const rating = (store) => Number(/★\s*([\d.]+)/.exec(store.home[0]?.note || '')?.[1] || store.collection[0]?.[2] || 4.8);

// Per-store facts the reference doesn't state (demo values, kept in step with the preview).
const RECIPES = {
  verde: {
    mode: 'pack',
    servings: 30,
    days: 30,
    serving: 'serving',
    guarantee: { title: '90-day money-back guarantee', days: 90 },
    tierGift: { tier: 3, title: 'Travel packs (5)', price: 1800, label: '$18 value' },
    rewards: [
      { threshold: 50 },
      { threshold: 130, gift: { title: 'Glass shaker', price: 1500 } },
      { threshold: 250, gift: { title: 'Travel packs (10)', price: 3600 } },
    ],
    freeShippingOnSubscriptions: true,
  },
  rawform: {
    mode: 'pack',
    servings: 28,
    days: 28,
    serving: 'serving',
    // Demo value: the reference prices only the 2 lb tub; 5 lb costs 2.3×.
    sizeFactor: (values) => (values.some((v) => /^5 lb/.test(v)) ? 2.3 : 1),
    guarantee: { title: '60-day money-back guarantee', days: 60 },
    tierGift: { tier: 3, title: 'Steel shaker', price: 1800, label: '$18 value' },
    rewards: [{ threshold: 75 }, { threshold: 120, gift: { title: 'Shaker', price: 1200 } }, { threshold: 200, gift: { title: 'Sample sachets (6)', price: 1800 } }],
  },
  ode: {
    mode: 'size',
    // Demo value: the 10 ml travel size isn't priced in the reference.
    sizePrices: { '10 ml travel': 3400 },
    setTier: 1,
    guarantee: { title: 'Free returns within 30 days, even opened', days: 30 },
    rewards: [{ threshold: 80 }, { threshold: 150, gift: { title: 'Samples (2)', price: 1200 } }],
  },
};

function genericRecipe(store) {
  const tiers = store.product.tiers;
  const mix = tiers.some((t) => /-pack$/i.test(t.label));
  const freeShipping = /over \$(\d+)/i.exec(store.bar)?.[1];
  return {
    mode: mix ? 'mix' : 'pack',
    guarantee: { title: store.product.trust.find((t) => /guarantee|returns/i.test(t)) || 'Money-back guarantee' },
    rewards: [{ threshold: Number(freeShipping) || 50 }],
    setTier: tiers.findIndex((t) => /set$/i.test(t.label)) + 1 || null,
  };
}

// ---------- Builders ----------

function simpleProduct(title, price, extra = {}) {
  return {
    handle: extra.handle ?? handleize(title),
    title,
    productType: extra.productType ?? '',
    tags: extra.tags ?? [],
    descriptionHtml: extra.descriptionHtml ?? `<p>${title}.</p>`,
    options: [],
    variants: [{ options: [], price: money(price), compareAtPrice: null, requiresShipping: extra.requiresShipping ?? true, taxable: extra.taxable ?? true }],
    files: extra.files ?? [],
    metafields: extra.metafields ?? [],
  };
}

const mf = (key, type, value, namespace = 'blueprint') => ({ namespace, key, type, value });
const isDark = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

export function buildCatalog(demo, storeId) {
  const store = demo.stores[storeId];
  if (!store) throw new Error(`Unknown demo store "${storeId}"`);
  const recipe = RECIPES[storeId] ?? genericRecipe(store);
  const preset = demo.presets[storeId];
  const files = [];
  const file = (key, label, alt = label) => {
    if (!files.some((f) => f.key === key)) files.push({ key, filename: `bp-${storeId}-${key}.png`, label, alt });
    return { $file: key };
  };
  const metaobjects = [];
  const metaobject = (type, handle, fields) => {
    metaobjects.push({ type, handle: `${storeId}-${handle}`, fields });
    return { $metaobject: `${type}/${storeId}-${handle}` };
  };

  const products = [];
  const add = (product) => {
    const existing = products.find((p) => p.handle === product.handle);
    if (existing) return existing;
    products.push(product);
    return product;
  };

  // ---------- Hero product ----------
  const p = store.product;
  const hero = { handle: heroHandle(store), title: p.name, productType: store.filters[0] ?? '', tags: ['bp-hero'], descriptionHtml: `<p>${p.title}</p>`, files: [], metafields: [] };
  const tiers = p.tiers;
  const pct = subscriptionPct(store);
  let packOption = null;

  if (recipe.mode === 'size') {
    // Sizes are the tiers (Ode); a set sold as its own product can be the first tier.
    const axis = p.variants[0];
    hero.options = [{ name: axis.label, values: axis.options }];
    const priceOf = (size) => recipe.sizePrices?.[size] ?? cents(tiers.find((t) => t.label === size)?.price ?? 0);
    hero.variants = axis.options.map((size) => ({ options: [size], price: money(priceOf(size)), compareAtPrice: null, packQuantity: 1 }));
    packOption = axis.label;
  } else if (recipe.mode === 'mix') {
    // Pick-any multipacks (Kindly, Stillwater): one variant per option, tiers are quantities.
    hero.options = p.variants.map((v) => ({ name: v.label, values: v.options }));
    const single = cents(tiers[0].price);
    const combos = hero.options.reduce((acc, o) => acc.flatMap((prev) => o.values.map((v) => [...prev, v])), [[]]);
    hero.variants = combos.map((values) => ({ options: values, price: money(single), compareAtPrice: null }));
  } else {
    const axes = p.variants.map((v) => ({ name: v.label, values: v.options }));
    // Allele-style sets are a separate product; the pack axis holds the other tiers.
    const packTiers = tiers.filter((t, i) => i + 1 !== recipe.setTier);
    packOption = 'Pack';
    hero.options = [...axes, { name: 'Pack', values: packTiers.map((t) => t.label) }];
    const combos = hero.options.reduce((acc, o) => acc.flatMap((prev) => o.values.map((v) => [...prev, v])), [[]]);
    hero.variants = combos.map((values) => {
      const tier = packTiers.find((t) => t.label === values.at(-1));
      const factor = recipe.sizeFactor?.(values) ?? 1;
      return {
        options: values,
        price: money(cents(tier.price * factor)),
        compareAtPrice: tier.was ? money(cents(tier.was * factor)) : null,
        packQuantity: leadingNumber(tier.label),
      };
    });
  }
  hero.files = [file('hero', p.photo), ...[2, 3, 4, 5].map((n) => file(`hero-${n}`, `${p.photo} · view ${n}`))];
  add(hero);

  const firstVariant = hero.variants[0].options;
  const variantRef = (product, options) => ({ $variant: [product.handle, options] });

  // A set tier (Ode's discovery set, Allele's routine set) is its own product.
  let setProduct = null;
  if (recipe.setTier) {
    const t = tiers[recipe.setTier - 1];
    setProduct = add(simpleProduct(t.label, cents(t.price), { handle: productHandle(store, t.label), productType: store.filters[1] ?? store.filters[0] ?? '', files: [file(handleize(t.label), t.label)] }));
    if (t.was) setProduct.variants[0].compareAtPrice = money(cents(t.was));
  }

  // Tier gift (e.g. 3 pouches → free travel packs).
  let tierGift = null;
  if (recipe.tierGift) {
    tierGift = add(simpleProduct(recipe.tierGift.title, recipe.tierGift.price, { tags: ['bp-gift'], files: [file(handleize(recipe.tierGift.title), recipe.tierGift.title)] }));
  }

  // ---------- Metaobjects for the hero ----------
  // In size mode the tiers are the size picker, so a size the reference only shows in its
  // picker (Ode's 10 ml travel) joins them in picker order; otherwise it couldn't be bought.
  // The preselected tier stays the reference's second tier.
  const tierList = tiers.map((t, i) => ({ ...t, preselected: i === 1 }));
  if (recipe.mode === 'size') {
    const sizes = p.variants[0].options;
    for (const size of sizes.filter((s) => !tiers.some((t) => t.label === s))) {
      const next = tierList.findIndex((t) => sizes.indexOf(t.label) > sizes.indexOf(size));
      tierList.splice(next < 0 ? tierList.length : next, 0, { label: size, preselected: false });
    }
  }
  const tierRefs = tierList.map((t, i) => {
    const n = i + 1;
    const original = tiers.indexOf(tiers.find((x) => x.label === t.label)) + 1;
    const fields = { label: t.label, sublabel: t.sub ?? '', badge: t.tag ?? '', preselected: t.preselected };
    if (recipe.mode === 'mix') {
      fields.quantity = leadingNumber(t.label);
      if (fields.quantity > 1) fields.discount_label = `${t.label} discount`;
    } else if (original === recipe.setTier) {
      fields.variant = variantRef(setProduct, []);
    } else {
      fields.pack_value = t.label;
    }
    if (pct && recipe.mode === 'pack') fields.subscription_plan_hint = ['', '2 months', '3 months'][i] ?? '';
    if (recipe.tierGift?.tier === original) {
      fields.gift_variant = variantRef(tierGift, []);
      fields.gift_value_label = recipe.tierGift.label;
    }
    for (const [k, v] of Object.entries(fields)) if (v === '') delete fields[k];
    return metaobject('blueprint_tier', `tier-${n}`, fields);
  });
  const benefitRefs = p.benefits.map(([icon, title], i) => metaobject('blueprint_benefit', `benefit-${i + 1}`, { icon, title }));
  const ingredients = sectionOf(store, 'ingredients');
  const ingredientRefs = ingredients ? ingredients.rows.map(([name, dose, why], i) => metaobject('blueprint_ingredient', `ingredient-${i + 1}`, { name, dose, why })) : [];
  const study = sectionOf(store, 'study');
  const studyRefs = study ? study.items.map(([value, label], i) => metaobject('blueprint_study', `study-${i + 1}`, { stat_value: Number(value), stat_suffix: '%', label, source: study.src })) : [];
  const versus = sectionOf(store, 'usvsthem');
  const yesNo = (v) => (v === 1 ? 'yes' : v === 0 ? 'no' : String(v));
  const comparisonRefs = versus ? versus.rows.map(([feature, us, them], i) => metaobject('blueprint_comparison_row', `comparison-${i + 1}`, { feature, us: yesNo(us), them: yesNo(them) })) : [];
  const faq = sectionOf(store, 'faq');
  const faqRefs = faq ? faq.items.map(([question, answer], i) => metaobject('blueprint_faq', `faq-${i + 1}`, { question, answer: { rich: answer } })) : [];
  const guaranteeSection = sectionOf(store, 'guarantee');
  const guaranteeRef = metaobject('blueprint_guarantee', 'guarantee', {
    title: recipe.guarantee.title,
    ...(recipe.guarantee.days ? { days: recipe.guarantee.days } : {}),
    ...(guaranteeSection ? { body: guaranteeSection.d } : {}),
  });
  const badges = sectionOf(store, 'badges');

  // ---------- Upsell, collection items and section products ----------
  const upsellDeal = /\$(\d+) in cart/.exec(store.upsell.deal);
  // The upsell is often a best seller listed by a shorter name ("Travel atomiser · 10 ml",
  // "Vitamin D3 + K2 drops") at the same price.
  const listed = store.collection.find(([name, price]) => (name === store.upsell.name.split(' · ')[0] || store.upsell.name.toLowerCase().includes(name.toLowerCase())) && dollarsIn(price) === dollarsIn(store.upsell.price));
  const upsell = add(
    simpleProduct(listed ? listed[0] : store.upsell.name, cents(dollarsIn(store.upsell.price)), {
      productType: store.filters.at(-1) ?? '',
      files: [file(handleize(listed ? listed[0] : store.upsell.name), listed ? listed[0] : store.upsell.name)],
      metafields: upsellDeal ? [mf('cart_deal_label', 'single_line_text_field', store.upsell.deal)] : [],
    }),
  );
  if (listed) upsell.productType = '';

  const ratingOf = (r) => ({ value: String(r), scale_min: '1.0', scale_max: '5.0' });
  const bestSellers = [hero.handle];
  store.collection.forEach(([name, price, stars], i) => {
    const handle = productHandle(store, name);
    if (handle === hero.handle) return;
    const product = add(
      simpleProduct(name, cents(dollarsIn(price)), {
        handle,
        productType: store.filters[(i + 1) % store.filters.length] ?? '',
        files: [file(handle, name)],
        metafields: stars ? [mf('rating', 'rating', ratingOf(stars), 'reviews')] : [],
      }),
    );
    if (!bestSellers.includes(product.handle)) bestSellers.push(product.handle);
  });
  // Products the home and product-page sections name (bundle builder items, featured lists).
  for (const s of [...store.home, ...store.pdp]) {
    for (const [name, price] of s.type === 'bundle' ? s.items : []) {
      const handle = productHandle(store, name);
      if (!products.some((x) => x.handle === handle)) add(simpleProduct(name, cents(price), { handle, files: [file(handle, name)] }));
    }
    for (const [name, price] of s.type === 'collection' ? s.items : []) {
      const handle = productHandle(store, name);
      if (!products.some((x) => x.handle === handle)) add(simpleProduct(name, cents(dollarsIn(price)), { handle, files: [file(handle, name)] }));
      if (!bestSellers.includes(handle)) bestSellers.push(handle);
    }
  }

  // Reward gifts (cart rewards bar) and shipping protection.
  const rewards = (recipe.rewards ?? []).map((r, i) => {
    const label = store.rewards[i] ?? r.label;
    const gift = r.gift ? add(simpleProduct(r.gift.title, r.gift.price, { handle: products.some((x) => x.handle === handleize(r.gift.title)) ? handleize(r.gift.title) : undefined, tags: ['bp-gift'], files: [file(handleize(r.gift.title), r.gift.title)] })) : null;
    return { label, threshold: r.threshold, gift: gift?.handle ?? null };
  });
  const protection = add(simpleProduct('Shipping protection', 295, { requiresShipping: false, taxable: false, tags: ['bp-protection'], descriptionHtml: '<p>Covers loss, theft and damage in transit.</p>' }));

  // ---------- Hero metafields ----------
  hero.metafields = [
    mf('tiers', 'list.metaobject_reference', tierRefs),
    ...(packOption ? [mf('pack_option', 'single_line_text_field', packOption)] : []),
    ...(recipe.servings ? [mf('servings_per_unit', 'number_integer', recipe.servings), mf('serving_label', 'single_line_text_field', recipe.serving), mf('days_per_unit', 'number_integer', recipe.days)] : []),
    mf('badge', 'single_line_text_field', p.badge),
    mf('benefits', 'list.metaobject_reference', benefitRefs),
    ...(ingredientRefs.length ? [mf('ingredients', 'list.metaobject_reference', ingredientRefs)] : []),
    ...(studyRefs.length ? [mf('studies', 'list.metaobject_reference', studyRefs)] : []),
    ...(comparisonRefs.length ? [mf('comparison', 'list.metaobject_reference', comparisonRefs), mf('comparison_competitor_label', 'single_line_text_field', versus.them)] : []),
    ...(faqRefs.length ? [mf('faqs', 'list.metaobject_reference', faqRefs)] : []),
    mf('guarantee', 'metaobject_reference', guaranteeRef),
    ...(badges ? [mf('certifications', 'list.single_line_text_field', badges.items)] : []),
    mf('upsell', 'product_reference', { $product: upsell.handle }),
    mf('rating', 'rating', ratingOf(rating(store)), 'reviews'),
    mf('rating_count', 'number_integer', Number(String(p.reviews).replace(/,/g, '')), 'reviews'),
    mf('subtitle', 'single_line_text_field', p.title, 'descriptors'),
    mf('shot_note', 'single_line_text_field', p.photo),
  ];

  // ---------- Selling plans ----------
  const sellingPlanGroups = pct
    ? [
        {
          merchantCode: `bp-${storeId}-subscribe`,
          name: `Subscribe & save ${pct}%`,
          options: ['Delivery every'],
          percentage: pct,
          plans: [1, 2, 3].map((months) => ({ name: months === 1 ? 'Delivery every month' : `Delivery every ${months} months`, option: months === 1 ? 'month' : `${months} months`, months })),
          products: [hero.handle],
        },
      ]
    : [];

  // ---------- Collections ----------
  const sellable = products.filter((x) => !x.tags.includes('bp-gift') && !x.tags.includes('bp-protection'));
  const collections = [
    { handle: 'best-sellers', title: 'Best sellers', products: bestSellers.filter((h) => sellable.some((x) => x.handle === h)) },
    ...store.filters.map((type) => ({ handle: handleize(type), title: type, rule: { column: 'TYPE', relation: 'EQUALS', condition: type } })),
  ];

  // ---------- Pages and menus ----------
  const pages = [
    { handle: 'advertorial', title: store.adv.h, templateSuffix: 'advertorial', body: `<p>${store.adv.lede}</p>` },
    { handle: 'listicle', title: store.list.h, templateSuffix: 'listicle', body: '' },
    { handle: 'comparison', title: `How ${store.brand} compares`, templateSuffix: 'comparison', body: '' },
    { handle: 'about', title: `About ${store.brand}`, templateSuffix: 'about', body: `<p>${store.vibe}</p>` },
    { handle: 'contact', title: 'Contact', templateSuffix: 'contact', body: '' },
  ];
  const navItem = (title, i) => {
    const filter = store.filters.find((f) => f.toLowerCase() === title.toLowerCase() || title.toLowerCase().startsWith(f.toLowerCase()));
    if (i === 0) {
      return {
        title,
        type: 'COLLECTION',
        ref: { $collection: 'best-sellers' },
        items: sellable.slice(0, 4).map((x) => ({ title: x.title, type: 'PRODUCT', ref: { $product: x.handle } })),
      };
    }
    if (filter) return { title, type: 'COLLECTION', ref: { $collection: handleize(filter) } };
    if (/review/i.test(title)) return { title, type: 'PRODUCT', ref: { $product: hero.handle } };
    if (/journal|blog/i.test(title)) return { title, type: 'HTTP', url: '/blogs/news' };
    return { title, type: 'PAGE', ref: { $page: 'about' } };
  };
  const menus = [
    { handle: 'main-menu', title: 'Main menu', items: store.nav.map(navItem) },
    {
      handle: 'footer',
      title: 'Footer menu',
      items: [
        { title: 'Search', type: 'SEARCH', url: '/search' },
        { title: 'Shipping', type: 'HTTP', url: '/policies/shipping-policy' },
        { title: 'Returns', type: 'HTTP', url: '/policies/refund-policy' },
        { title: 'Contact', type: 'PAGE', ref: { $page: 'contact' } },
      ],
    },
  ];

  // ---------- Automatic discounts (what the theme's offers promise) ----------
  const all = sellable.map((x) => ({ $product: x.handle }));
  const discounts = [];
  if (rewards[0]) discounts.push({ kind: 'freeShipping', title: `Blueprint demo: free shipping over $${rewards[0].threshold}`, minimumSubtotal: money(rewards[0].threshold * 100) });
  if (recipe.freeShippingOnSubscriptions) discounts.push({ kind: 'freeShipping', title: 'Blueprint demo: free shipping on subscriptions', subscriptionsOnly: true });
  rewards.slice(1).forEach((r) => {
    if (r.gift) discounts.push({ kind: 'giftOverAmount', title: `Blueprint demo: ${r.label.toLowerCase()} over $${r.threshold}`, buysProducts: all, minimumAmount: money(r.threshold * 100), gift: { $variant: [r.gift, []] } });
  });
  if (tierGift) {
    const tierLabel = tiers[recipe.tierGift.tier - 1].label;
    discounts.push({
      kind: 'giftWithVariants',
      title: `Blueprint demo: free ${recipe.tierGift.title.toLowerCase()} with ${tierLabel}`,
      buysVariants: hero.variants.filter((v) => v.options.at(-1) === tierLabel).map((v) => variantRef(hero, v.options)),
      gift: variantRef(tierGift, []),
    });
  }
  if (upsellDeal) {
    const off = cents(dollarsIn(store.upsell.price)) - cents(upsellDeal[1]);
    if (off > 0) discounts.push({ kind: 'amountOffProduct', title: `Blueprint demo: ${store.upsell.name} ${store.upsell.deal}`, products: [{ $product: upsell.handle }], amountEach: money(off) });
  }
  if (recipe.mode === 'mix') {
    const single = cents(tiers[0].price);
    tiers.slice(1).forEach((t) => {
      const qty = leadingNumber(t.label);
      // The tier's own price against singles, rounded down so the discount never exceeds it.
      const percentage = Math.floor((1 - cents(t.price) / (single * qty)) * 100);
      if (percentage > 0) discounts.push({ kind: 'percentOffQuantity', title: `${t.label} discount`, products: [{ $product: hero.handle }], minimumQuantity: qty, percentage });
    });
  }

  // ---------- Theme ----------
  const listing = LISTING_FOR[preset.name];
  // The reference's colours fill the set for its own mode (Rawform, Omni and Dreamr are dark).
  // Button text, accent text and muted text are left blank so the theme derives contrast-safe
  // values from them.
  const mode = isDark(preset.bg) ? 'dark' : 'light';
  const settings = {
    color_mode: mode,
    accent_color: preset.accent,
    [`${mode}_bg`]: preset.bg,
    [`${mode}_surface`]: preset.surface,
    [`${mode}_ink`]: preset.ink,
    [`${mode}_line`]: preset.line,
    [`${mode}_accent_soft`]: preset.accentSoft,
    light_on_accent: '',
    dark_on_accent: '',
    light_accent_text: '',
    dark_accent_text: '',
    cart_protection_product: protection.handle,
    cart_upsell_collection: 'best-sellers',
    cart_upsell_show_deal: Boolean(upsellDeal),
    cart_empty_collection: 'best-sellers',
    social_instagram: `https://instagram.com/${storeId}`,
    social_tiktok: `https://tiktok.com/@${storeId}`,
  };
  [1, 2, 3].forEach((n) => {
    const r = rewards[n - 1];
    settings[`cart_reward_${n}_label`] = r?.label ?? '';
    settings[`cart_reward_${n}_threshold`] = r?.threshold ?? null;
    settings[`cart_reward_${n}_gift`] = r?.gift ?? '';
  });

  return {
    id: storeId,
    brand: store.brand,
    preset: preset.name,
    listing,
    required: REQUIRED_STORES.includes(storeId),
    mode: recipe.mode,
    // Shown in the announcement bar: the demo's products, prices and reviews are samples.
    notice: 'Demo store: sample products, prices and reviews',
    files,
    products,
    metaobjects,
    sellingPlanGroups,
    collections,
    pages,
    menus,
    discounts,
    theme: { preset: preset.name, listing, settings },
  };
}
