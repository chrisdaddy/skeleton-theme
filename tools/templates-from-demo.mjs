#!/usr/bin/env node
// Builds each preset's JSON templates from the reference demo copy (data/demo-content.json),
// through the same section mapper the preview uses (tools/preview/demo-sections.mjs).
//
//   node tools/templates-from-demo.mjs
//
// Writes listings/<preset>/templates/{index,product,page.advertorial,page.listicle,
// page.comparison,page.about}.json, and copies the Clinical set into templates/ (the theme's
// default listing). Generated files are committed and can be edited by hand afterwards;
// re-running overwrites them.
//
// Demo-only values are made store-ready: photo descriptions are dropped (images are picked
// in the editor or seeded in Phase 6), and products named in the copy become handles that
// demo seeding creates. Prices are never copied into text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { demoTemplate } from './preview/demo-sections.mjs';

const root = new URL('../', import.meta.url);
const demo = JSON.parse(readFileSync(new URL('data/demo-content.json', root), 'utf8'));
const LISTINGS = { clinical: 'verde', editorial: 'ode', bold: 'rawform' };
const HERO_PRODUCT = { verde: 'verde-daily', ode: 'ode-no-04', rawform: 'rawform-whey' };
const handleize = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const ARROW = /\s*→\s*$/;

// Replace preview-only values with what a store template can hold.
function storeReady(value) {
  if (Array.isArray(value)) return value.map(storeReady);
  if (value && typeof value === 'object') {
    if (value.mock_image) return undefined;
    if (value.mock_product) return handleize(value.mock_product.title);
    if (value.mock_collection) return 'best-sellers';
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const ready = storeReady(v);
      if (ready !== undefined) out[k] = ready;
    }
    return out;
  }
  return value;
}

const section = (type, settings = {}, blockList = []) => {
  const blocks = {};
  const block_order = [];
  blockList.forEach(([blockType, blockSettings = {}], i) => {
    const id = `${blockType.replace(/^product-/, '')}_${i + 1}`;
    blocks[id] = { type: blockType, settings: blockSettings };
    block_order.push(id);
  });
  return blockList.length ? { type, settings, blocks, block_order } : { type, settings };
};

const template = (pairs, layout) => {
  const out = layout ? { layout, sections: {}, order: [] } : { sections: {}, order: [] };
  for (const [id, value] of pairs) {
    out.sections[id] = value;
    out.order.push(id);
  }
  return out;
};

const fromMapped = ({ sections, order }) => order.map((id) => [id, sections[id]]);

// The product page: the buy box (main-product, from the current product.json) and the store's
// product-page stack. On the product page those sections read the product's metafields first.
function productTemplate(store) {
  const main = JSON.parse(readFileSync(new URL('templates/product.json', root), 'utf8')).sections.main;
  const { template: mapped } = demoTemplate(store, { include: 'pdp', productHandle: HERO_PRODUCT[store.id] });
  for (const s of Object.values(mapped.sections)) {
    delete s.settings.use_metafield;
    delete s.settings.product;
  }
  return template([['main', main], ...fromMapped(storeReady(mapped)), ['related', section('related-products', { heading: 'Pairs well with' })]]);
}

function indexTemplate(store) {
  const { template: mapped } = demoTemplate(store, { include: 'home', productHandle: HERO_PRODUCT[store.id] });
  return template(fromMapped(storeReady(mapped)));
}

// The tier and plan a CTA's words promise: a tier it names ("Try the discovery set"), else the
// second tier; the subscription when it promises a discount ("Claim 20% off").
function ctaChoice(store, text) {
  const tiers = store.product.tiers || [];
  const named = tiers.findIndex((t) => text.toLowerCase().includes(t.label.toLowerCase()));
  return { tier: named >= 0 ? named + 1 : Math.min(2, tiers.length || 1), plan: /% off|subscri/i.test(text) ? 'sub' : 'default' };
}

const offer = (store, cta = store.adv.cta) =>
  section('offer', { product: HERO_PRODUCT[store.id], default_tier: ctaChoice(store, cta).tier, ...(ctaChoice(store, cta).plan === 'sub' ? { default_plan: 'sub' } : {}), heading: 'Try it risk-free', guarantee: store.product.trust?.[0] || '' }, [
    ['product-rating'],
    ['product-title'],
    ['product-offer-tiers'],
    ['product-purchase-options'],
    ['product-buy-buttons'],
    ['product-trust-tiles'],
  ]);

const stickyCta = (label) => section('sticky-cta', { target: 'offer', cta_label: label.replace(ARROW, '') });

function advertorialTemplate(store) {
  const adv = store.adv;
  const [, author = '', minutes = ''] = /^By (.+?) · (\d+) min/.exec(adv.by) || [];
  const comments = [...store.home, ...store.pdp].find((s) => s.type === 'comments');
  const pairs = [
    ['header', section('article-header', { eyebrow: adv.eyebrow, heading: adv.h, lede: adv.lede })],
    ['byline', section('author-byline', { author, read_time: Number(minutes) || undefined })],
    [
      'body',
      section('article-body', {}, [
        ['text', { text: '<p>Tell the story in your customer\'s words: what they tried before, what changed and when.</p>' }],
        ['heading', { text: 'What happened next' }],
        ['text', { text: '<p>Keep every claim specific and true. Link the study, show the label, say what it costs.</p>' }],
        ['quote', { quote: `<p>${adv.pull}</p>` }],
        ['product', { cta_label: adv.cta.replace(ARROW, ''), cta_product: HERO_PRODUCT[store.id], cta_tier: ctaChoice(store, adv.cta).tier, cta_plan: ctaChoice(store, adv.cta).plan }],
      ]),
    ],
  ];
  if (comments) pairs.push(['comments', section('comments', { heading: comments.h }, comments.items.map(([name, text, likes]) => ['comment', { name, text, likes }]))]);
  pairs.push(['offer', offer(store)], ['sticky', stickyCta(adv.cta)]);
  return template(pairs, 'landing');
}

function listicleTemplate(store) {
  const list = store.list;
  // The number in the headline always matches the items ([count]).
  const heading = list.h.replace(/^\d+/, '[count]');
  return template(
    [
      ['header', section('article-header', { eyebrow: store.adv.eyebrow, heading: '', lede: '', show_disclosure: true, padding_bottom: 0 })],
      ['list', section('listicle', { heading, heading_tag: 'h1' }, list.items.map(([title, text]) => ['item', { title, text: `<p>${text}</p>` }]))],
      ['offer', offer(store, list.cta)],
      ['sticky', stickyCta(list.cta)],
    ],
    'landing',
  );
}

function comparisonTemplate(store) {
  const versus = [...store.home, ...store.pdp].find((s) => s.type === 'usvsthem');
  const reviews = [...store.home, ...store.pdp].find((s) => s.type === 'reviews');
  const yesNo = (v) => (v === 1 ? 'yes' : v === 0 ? 'no' : String(v));
  const pairs = [['header', section('article-header', { eyebrow: store.adv.eyebrow, heading: versus ? versus.h : `How ${store.brand} compares`, lede: '' })]];
  if (versus) {
    pairs.push(['table', section('comparison-table', { heading: '', columns: '2', column_1: versus.us, column_2: versus.them, highlight: 1 }, versus.rows.map(([label, us, them]) => ['row', { label, cell_1: yesNo(us), cell_2: yesNo(them) }]))]);
  }
  if (reviews) {
    pairs.push(['reviews', section('reviews', { heading: reviews.h, layout: 'grid', product: HERO_PRODUCT[store.id] }, reviews.items.map(([quote, who]) => ['review', { quote: `<p>${quote}</p>`, name: who.split(' · ')[0], verified: /verified/i.test(who) }]))]);
  }
  pairs.push(['offer', offer(store)], ['sticky', stickyCta(store.adv.cta)]);
  return template(pairs, 'landing');
}

function aboutTemplate(store) {
  const all = [...store.home, ...store.pdp];
  const founder = all.find((s) => s.type === 'founder');
  const stats = all.find((s) => s.type === 'stats');
  const pairs = [['hero', section('hero', { layout: 'bleed', eyebrow: `About ${store.brand}`, heading: store.vibe ? `${store.brand}` : 'Our story', subheading: store.vibe || '' })]];
  pairs.push(['founder', founder ? section('founder', { quote: `<p>${founder.q}</p>`, name: founder.name, role: founder.role }) : section('founder')]);
  pairs.push(['text', section('image-with-text', { eyebrow: 'How we make it', heading: 'Tell the story behind the product', image_side: 'right' })]);
  if (stats) pairs.push(['stats', section('stats', {}, stats.items.map(([value, label]) => ['stat', { value, label }]))]);
  pairs.push(['newsletter', section('newsletter')]);
  return template(pairs);
}

const write = (path, data) => {
  mkdirSync(new URL('.', new URL(path, root)), { recursive: true });
  writeFileSync(new URL(path, root), `${JSON.stringify(data, null, 2)}\n`);
};

const builders = {
  index: indexTemplate,
  product: productTemplate,
  'page.advertorial': advertorialTemplate,
  'page.listicle': listicleTemplate,
  'page.comparison': comparisonTemplate,
  'page.about': aboutTemplate,
};

for (const [listing, storeId] of Object.entries(LISTINGS)) {
  const store = demo.stores[storeId];
  for (const [name, build] of Object.entries(builders)) {
    const data = JSON.parse(JSON.stringify(build(store), (k, v) => (v === undefined ? undefined : v)));
    write(`listings/${listing}/templates/${name}.json`, data);
    if (listing === 'clinical') write(`templates/${name}.json`, data);
  }
  console.log(`listings/${listing}: ${Object.keys(builders).join(', ')}`);
}
