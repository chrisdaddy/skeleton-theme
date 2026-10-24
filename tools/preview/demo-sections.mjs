// Maps each demo store's sections (data/demo-content.json, from the reference demo) onto
// Blueprint's sections: one JSON template per store, the same shape Shopify stores.
// Used by the preview to render every store's content, and by demo seeding (Phase 6).
//
// Prices in the reference copy ("Shop Verde · $79") are never copied into text: buttons
// show the product's own price instead (money comes only from variants).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const STAR_NOTE = /^★/;
const PRICE_SUFFIX = /\s*·\s*\$\d[\d.,]*(\/\w+)?\s*$/;
const ARROW = /\s*→\s*$/;

// "Shop Verde · $79" → { label: "Shop Verde", show_price: true }
const cta = (text = '') => {
  const plain = text.replace(ARROW, '');
  return { label: plain.replace(PRICE_SUFFIX, ''), show_price: PRICE_SUFFIX.test(plain) };
};
const image = (description) => (description ? { mock_image: description } : undefined);
const yesNo = (v) => (v === 1 || v === true ? 'yes' : v === 0 || v === false ? 'no' : String(v));

function blocks(type, list) {
  const out = {};
  const order = [];
  list.forEach((settings, i) => {
    const id = `${type}_${i + 1}`;
    out[id] = { type, settings };
    order.push(id);
  });
  return { blocks: out, block_order: order };
}

const join2 = (...parts) => {
  const merged = { blocks: {}, block_order: [] };
  for (const p of parts) {
    Object.assign(merged.blocks, p.blocks);
    merged.block_order.push(...p.block_order);
  }
  return merged;
};

// One mapper per reference section type → [section type, settings, blocks]
const MAP = {
  hero: (s, ctx) => {
    const button = cta(s.cta);
    const ratingNote = STAR_NOTE.test(s.note || '');
    return {
      type: 'hero',
      settings: {
        layout: { center: 'centered', bleed: 'bleed' }[s.layout] || 'split',
        eyebrow: s.eyebrow,
        heading: s.h,
        subheading: s.sub,
        image: image(s.photo),
        product: ctx.productHandle,
        show_rating: ratingNote,
        note: ratingNote ? '' : s.note || '',
      },
      ...join2(blocks('button', [{ label: button.label, show_price: button.show_price && Boolean(ctx.productHandle) }]), blocks('stat', (s.stats || []).map(([value, label]) => ({ value, label })))),
    };
  },
  press: (s) => ({ type: 'press', settings: { heading: 'As seen in' }, ...blocks('logo', s.items.map((name) => ({ name }))) }),
  badges: (s) => ({ type: 'badges', settings: { use_metafield: false }, ...blocks('badge', s.items.map((text) => ({ text, icon: 'check' }))) }),
  benefits: (s) => ({ type: 'benefits', settings: { heading: s.h, use_metafield: false, columns: Math.min(4, Math.max(2, s.items.length)) }, ...blocks('benefit', s.items.map(([icon, title, text]) => ({ icon, title, text }))) }),
  study: (s) => ({ type: 'study', settings: { heading: s.h, subheading: s.sub, source: s.src, use_metafield: false }, ...blocks('stat', s.items.map(([value, label]) => ({ value, suffix: '%', label }))) }),
  ingredients: (s) => ({ type: 'ingredients', settings: { heading: s.h, subheading: s.sub, footer_label: (s.foot || '').replace(ARROW, ''), footer_link: '#', use_metafield: false }, ...blocks('row', s.rows.map(([name, dose, why]) => ({ name, dose, why }))) }),
  usvsthem: (s) => ({ type: 'usvsthem', settings: { heading: s.h, us_label: s.us, them_label: s.them, use_metafield: false }, ...blocks('row', s.rows.map(([feature, us, them]) => ({ feature, us: yesNo(us), them: yesNo(them) }))) }),
  subscription: (s, ctx) => ({
    type: 'subscription',
    settings: {
      // The saving comes from the product's selling plan, not the copy.
      heading: ctx.productHandle ? s.h.replace(/\d+%/, '[percent]%') : s.h,
      subheading: s.sub,
      button_label: cta(s.cta).label,
      product: ctx.productHandle,
    },
    ...blocks('tile', s.items.map(([icon, title, text]) => ({ icon, title, text }))),
  }),
  reviews: (s, ctx) => ({
    type: 'reviews',
    settings: { heading: s.h, product: ctx.productHandle },
    ...blocks('review', s.items.map(([quote, who, photo]) => {
      const [name, note = ''] = who.split(' · ');
      return { quote: `<p>${quote}</p>`, name, verified: /verified/i.test(note), image: image(photo) };
    })),
  }),
  faq: (s) => ({ type: 'faq', settings: { heading: s.h, use_metafield: false }, ...blocks('question', s.items.map(([question, answer]) => ({ question, answer: `<p>${answer}</p>` }))) }),
  guarantee: (s, ctx) => ({ type: 'guarantee', settings: { heading: s.h, text: `<p>${s.d}</p>`, days: Number(/(\d+)[- ]day/i.exec(`${s.h} ${s.d}`)?.[1]) || undefined, button_label: s.cta, use_metafield: false, product: ctx.productHandle } }),
  ticker: (s) => ({ type: 'ticker', settings: {}, ...blocks('item', s.items.map((text) => ({ text, icon: 'none' }))) }),
  features: (s) => ({ type: 'features', settings: { heading: s.h }, ...blocks('feature', s.items.map(([kicker, title, text, photo]) => ({ kicker, title, text: `<p>${text}</p>`, image: image(photo) }))) }),
  stats: (s) => ({ type: 'stats', settings: { columns: Math.min(5, s.items.length) }, ...blocks('stat', s.items.map(([value, label]) => ({ value, label }))) }),
  videos: (s) => ({ type: 'videos', settings: { heading: s.h }, ...blocks('video', s.items.map(([quote, name, photo]) => ({ quote, name, poster: image(photo) }))) }),
  quiz: (s) => ({
    type: 'quiz',
    settings: { eyebrow: s.eyebrow, heading: s.h, subheading: s.sub, result_label: s.cta },
    ...join2(blocks('question', [{ question: s.q }]), blocks('answer', s.opts.map((label, i) => ({ label, result: (s.results[i] || '').replace(ARROW, ''), link: '#' })))),
  }),
  imagetext: (s) => ({ type: 'image-with-text', settings: { eyebrow: s.k, heading: s.h, text: `<p>${s.d}</p>`, button_label: cta(s.cta).label, button_style: ARROW.test(s.cta) ? 'link' : 'button', image: image(s.photo) } }),
  bundle: (s) => ({
    type: 'bundle-builder',
    settings: { heading: s.h, subheading: s.sub, min_items: s.min, discount_percent: s.pct, note: s.note, button_label: s.cta },
    ...blocks('item', s.items.map(([name, price, selected]) => ({ product: { mock_product: { title: name, price: Math.round(price * 100) } }, preselected: Boolean(selected) }))),
  }),
  countdown: (s, ctx) => ({ type: 'countdown', settings: { heading: s.h, subheading: s.sub, end: ctx.countdownEnd, style: 'bar', surface_style: 'surface', padding_top: 16, padding_bottom: 16, button_label: '' } }),
  ugc: (s) => ({ type: 'ugc', settings: { heading: s.h }, ...blocks('item', s.items.map((handle) => ({ handle, image: image(`${s.photo} · ${handle}`) }))) }),
  comments: (s) => ({ type: 'comments', settings: { heading: s.h }, ...blocks('comment', s.items.map(([name, text, likes]) => ({ name, text, likes }))) }),
  beforeafter: (s) => ({ type: 'before-after', settings: { heading: s.h, before_label: s.a, after_label: s.b, before_image: image(s.photoA), after_image: image(s.photoB), caption: s.cap } }),
  founder: (s) => ({ type: 'founder', settings: { quote: `<p>${s.q}</p>`, name: s.name, role: s.role, image: image(s.photo) } }),
  collection: (s) => ({
    type: 'featured-collection',
    settings: {
      heading: s.h,
      collection: { mock_collection: s.items.map(([title, price, rating, badge]) => ({ title, price: Math.round(Number(price.replace(/[^\d.]/g, '')) * 100), rating: Number(rating), badge })) },
      count: s.items.length,
    },
  }),
  steps: (s) => ({ type: 'steps', settings: { heading: s.h }, ...blocks('step', s.items.map(([title, text]) => ({ title, text }))) }),
};

export const MAPPED_TYPES = Object.keys(MAP);

/**
 * @param {object} store - A store from data/demo-content.json
 * @param {{productHandle?: string, include?: 'home'|'pdp'|'all', themeRoot?: string}} [ctx]
 * @returns {{template: {sections: object, order: string[]}, skipped: string[]}}
 */
export function demoTemplate(store, ctx = {}) {
  const list = ctx.include === 'home' ? store.home : ctx.include === 'pdp' ? store.pdp : [...store.home, ...store.pdp];
  const sections = {};
  const order = [];
  const skipped = [];
  list.forEach((s, i) => {
    const mapper = MAP[s.type];
    const built = mapper?.(s, ctx);
    if (!built || (ctx.themeRoot && !existsSync(join(ctx.themeRoot, 'sections', `${built.type}.liquid`)))) {
      if (s.type !== 'buybox') skipped.push(s.type);
      return;
    }
    const id = `${s.type}_${i + 1}`;
    for (const [k, v] of Object.entries(built.settings)) if (v === undefined) delete built.settings[k];
    sections[id] = built;
    order.push(id);
  });
  return { template: { sections, order }, skipped };
}
