#!/usr/bin/env node
// Offline preview: renders Blueprint with LiquidJS and mock store data, for layout and
// style checks while no Shopify store is reachable.
//
// This is an approximation of Shopify's renderer. It mocks the Shopify-only tags and
// filters the theme uses, and it serves DM Sans and Instrument Serif from @fontsource
// instead of Shopify's font CDN. Use a real store for anything behavioural.
//
//   node render.mjs        writes out/<preset>/<page>.html
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hash, Liquid, Tag } from 'liquidjs';
import { contrast, mix } from '../lib/color.mjs';
import { createCart } from './mock-cart.mjs';
import { buildCartFixtures, buildDemoProducts, productForRequest } from './mock-products.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const theme = join(here, '..', '..');
const out = join(here, 'out');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const demo = readJson(join(theme, 'data/demo-content.json'));
const schema = readJson(join(theme, 'config/settings_schema.json'));
const settingsData = readJson(join(theme, 'config/settings_data.json'));
const locale = readJson(join(theme, 'locales/en.default.json'));

// Preset → the demo store whose content it previews (START_HERE build order, step 7).
export const PRESET_STORES = { Clinical: 'verde', Editorial: 'ode', Bold: 'rawform' };

export const PRODUCTS = buildDemoProducts(demo);
export const PRESET_PRODUCTS = { Clinical: PRODUCTS.verde, Editorial: PRODUCTS.ode, Bold: PRODUCTS.rawform };
export const presetForHandle = (handle) => Object.keys(PRESET_PRODUCTS).find((p) => PRESET_PRODUCTS[p].handle === handle);

// ---------- Cart ----------

const CART = buildCartFixtures(demo, PRODUCTS);
const upsells = Object.values(PRESET_PRODUCTS).map((p) => p.metafields.blueprint.upsell.value);
export const ALL_PRODUCTS = [...Object.values(PRESET_PRODUCTS), ...PRODUCTS.gifts, ...upsells, ...CART.products];
export const findVariant = (id) => {
  for (const product of ALL_PRODUCTS) {
    const variant = product.variants.find((v) => String(v.id) === String(id));
    if (variant) return { product, variant };
  }
  return null;
};
export const cartFixtures = (preset) => CART.fixtures[PRESET_STORES[preset]];
// The preset whose store the shopper last looked at (the cart page has no product of its own).
export const session = { preset: 'Clinical' };
export const cart = createCart({
  // Lines see the product as Liquid does, with options_with_values.
  findVariant: (id) => {
    const found = findVariant(id);
    return found && { ...found, product: found.product.options_with_values ? found.product : productForRequest(found.product) };
  },
  rewardsFor: (preset) => cartFixtures(preset).rewards,
  // The upsell's deal copy names its in-cart price ("$18 in cart"); "Engraving included" names none.
  dealPrice: (variantId) => {
    const upsell = upsells.find((p) => p.variants[0].id === Number(variantId));
    const match = /\$(\d+(?:\.\d+)?)/.exec(upsell?.metafields.blueprint.cart_deal_label.value || '');
    return match ? Math.round(Number(match[1]) * 100) : null;
  },
});
export const PROTECTION = CART.protection;

// ---------- Fonts ----------

const FONTS = {
  dm_sans: { family: 'DM Sans', fallback: 'sans-serif' },
  instrument_serif: { family: 'Instrument Serif', fallback: 'serif' },
};

function font(handle) {
  const m = /^(.*)_([ni])(\d)$/.exec(handle || '');
  const meta = (m && FONTS[m[1]]) || FONTS.dm_sans;
  return {
    family: meta.family,
    fallback_families: meta.fallback,
    weight: m ? Number(m[3]) * 100 : 400,
    style: m && m[2] === 'i' ? 'italic' : 'normal',
    system_q: false,
    toString: () => handle,
  };
}

// ---------- Settings ----------

function defaults(list) {
  const values = {};
  for (const s of list) if (s.id && 'default' in s) values[s.id] = s.default;
  return values;
}

function themeSettings(preset, store) {
  const values = { ...defaults(schema.flatMap((g) => g.settings ?? [])), ...settingsData.presets[preset] };
  for (const key of ['type_body_font', 'type_heading_sans', 'type_heading_serif']) values[key] = font(values[key]);
  // Cart settings a merchant would set (mock thresholds and gifts: see buildCartFixtures).
  const fixtures = CART.fixtures[store.id];
  fixtures.rewards.forEach((reward, i) => {
    values[`cart_reward_${i + 1}_label`] = reward.label;
    values[`cart_reward_${i + 1}_threshold`] = reward.threshold;
    values[`cart_reward_${i + 1}_gift`] = reward.gift;
  });
  values.cart_protection_product = CART.protection;
  values.cart_upsell_collection = fixtures.collection;
  values.cart_upsell_show_deal = true;
  values.cart_empty_collection = fixtures.collection;
  values.social_instagram = `https://instagram.com/${store.id}`;
  values.social_tiktok = `https://tiktok.com/@${store.id}`;
  return values;
}

// ---------- Mock store ----------

function mockStore(store) {
  const link = (title, links = []) => ({ title, url: '#', current: false, links });
  const shopChildren = store.collection.slice(0, 4).map(([name]) => link(name));
  const main = { handle: 'main-menu', links: store.nav.map((title, i) => link(title, i === 0 ? shopChildren : [])) };
  const footer = { handle: 'footer', links: ['Search', 'Shipping', 'Returns', 'Contact'].map((t) => link(t)) };
  return {
    linklists: { 'main-menu': main, footer },
    shop: {
      name: store.brand,
      description: store.vibe,
      customer_accounts_enabled: true,
      policies: [
        { title: 'Refund policy', url: '#' },
        { title: 'Privacy policy', url: '#' },
        { title: 'Terms of service', url: '#' },
      ],
      currency: 'USD',
      enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'shopify_pay', 'apple_pay', 'google_pay'],
    },
    announcements: store.bar.split(' · '),
  };
}

// ---------- Engine ----------

// Shopify allows "?" in property names (font.system?, form.posted_successfully?); LiquidJS doesn't.
const fs = {
  readFileSync: (file) => readFileSync(file, 'utf8').replace(/\b([a-z_]+)\?/g, '$1_q'),
  readFile: async (file) => fs.readFileSync(file),
  existsSync,
  exists: async (file) => existsSync(file),
  contains: () => true,
  resolve: (root, file, ext) => join(root, file.endsWith(ext) ? file : file + ext),
  fallback: () => undefined,
  dirname,
  sep: '/',
};

const engine = new Liquid({
  root: [join(theme, 'snippets')],
  partials: [join(theme, 'snippets')],
  layouts: [join(theme, 'layout')],
  extname: '.liquid',
  fs,
  relativeReference: false,
  dynamicPartials: true,
});

// Tags whose content is never output.
for (const name of ['schema', 'doc']) {
  engine.registerTag(
    name,
    class extends Tag {
      constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        let t;
        while ((t = remainTokens.shift()) && !(t.name === `end${name}`));
      }
      *render() {}
    },
  );
}

// {% form 'type', object, class: 'x', id: 'y' %}…{% endform %}
engine.registerTag(
  'form',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.args = token.args;
      this.templates = [];
      const stream = liquid.parser.parseStream(remainTokens);
      stream.on('tag:endform', () => stream.stop()).on('template', (tpl) => this.templates.push(tpl)).on('end', () => {
        throw new Error('form tag not closed');
      });
      stream.start();
    }
    *render(ctx, emitter) {
      // Mirrors Shopify's output: the action for the form type, plus form_type and utf8 inputs.
      const type = /^\s*'([\w-]+)'/.exec(this.args)?.[1] ?? '';
      const named = yield new Hash(this.args.replace(/^\s*'[\w-]+'\s*(,\s*[\w.]+\s*(?=,|$))?\s*,?/, '')).render(ctx);
      const actions = { product: '/cart/add', contact: '/contact', customer: '/contact#contact_form', storefront_password: '/password', localization: '/localization' };
      const attrs = Object.entries(named).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
      const enctype = type === 'product' ? ' enctype="multipart/form-data"' : '';
      ctx.push({ form: { posted_successfully_q: false, errors: null } });
      emitter.write(`<form method="post" action="${actions[type] ?? '#'}" accept-charset="UTF-8"${enctype}${attrs}><input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
      yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
      emitter.write('</form>');
      ctx.pop();
    }
  },
);

// {% paginate list by n %}…{% endpaginate %}
engine.registerTag(
  'paginate',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.templates = [];
      const stream = liquid.parser.parseStream(remainTokens);
      stream.on('tag:endpaginate', () => stream.stop()).on('template', (tpl) => this.templates.push(tpl));
      stream.start();
    }
    *render(ctx, emitter) {
      ctx.push({ paginate: { pages: 1, current_page: 1 } });
      yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
      ctx.pop();
    }
  },
);

// In-memory section group content for the current page (demo-store copy).
const groupOverrides = {};

// {% sections 'group-name' %}
engine.registerTag(
  'sections',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.group = /'([^']+)'/.exec(token.args)[1];
    }
    *render(ctx, emitter) {
      const group = groupOverrides[this.group] ?? readJson(join(theme, 'sections', `${this.group}.json`));
      const html = yield renderSections(group, ctx.getAll(), `shopify-section-group-${this.group}`);
      emitter.write(html);
    }
  },
);

// {% section 'name' %}: a static section (no template entry, ID = file name).
engine.registerTag(
  'section',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.name = /'([^']+)'/.exec(token.args)[1];
    }
    *render(ctx, emitter) {
      emitter.write(yield renderSections(staticSection(this.name), ctx.getAll()));
    }
  },
);
const staticSection = (name) => ({ sections: { [name]: { type: name, settings: {} } }, order: [name] });

// {% content_for 'blocks' %}: renders the current section's or block's child theme blocks.
engine.registerTag(
  'content_for',
  class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.kind = /'(\w+)'/.exec(token.args)?.[1];
    }
    *render(ctx, emitter) {
      if (this.kind !== 'blocks') return;
      const children = ctx.getSync(['__children']) ?? [];
      const section = ctx.getSync(['section']);
      const globals = ctx.getSync(['__globals']);
      for (const child of children) emitter.write(yield renderBlock(child, section, globals));
    }
  },
);

const blockSchema = (type) => {
  const source = readFileSync(join(theme, 'blocks', `${type}.liquid`), 'utf8');
  const json = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(source)?.[1];
  return json ? JSON.parse(json) : {};
};

// Child block data from a JSON template ({ blocks: {...}, block_order: [...] }) as a list.
const childList = (data) => (data.block_order ?? []).map((id) => ({ id, ...data.blocks[id] })).filter((b) => !b.disabled);

async function renderBlock(child, section, globals) {
  if (child.type === '@app') return '';
  const schemaDef = blockSchema(child.type);
  const block = { id: child.id, type: child.type, shopify_attributes: `data-block="${child.type}"`, settings: resolveSettings(schemaDef.settings, child.settings, globals) };
  const source = fs.readFileSync(join(theme, 'blocks', `${child.type}.liquid`));
  return engine.parseAndRender(source, { section, block, __children: childList(child), __globals: globals }, { globals });
}

// ---------- Filters ----------

function translate(key, args = {}) {
  let value = key.split('.').reduce((node, part) => node?.[part], locale);
  if (value && typeof value === 'object') value = args.count === 1 ? value.one : value.other;
  if (typeof value !== 'string') return `[missing: ${key}]`;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => args[name] ?? '');
}

const liquidMix = (a, b, weight) => mix(String(b), String(a), weight / 100);

const filters = {
  t: (key, ...args) => translate(key, Object.fromEntries(args.filter(Array.isArray))),
  asset_url: (name) => `../assets/${name}`,
  stylesheet_tag: (url) => `<link rel="stylesheet" href="${url}">`,
  font_face: () => '',
  font_url: () => '',
  font_modify: (f) => f,
  preload_tag: () => '',
  color_mix: (a, b, weight) => liquidMix(a, b, weight),
  color_contrast: (a, b) => Math.round(contrast(String(a), String(b)) * 10) / 10,
  money: (cents) => `$${(Number(cents) / 100).toFixed(2)}`,
  money_with_currency: (cents) => `$${(Number(cents) / 100).toFixed(2)} USD`,
  payment_type_svg_tag: (type) =>
    `<svg viewBox="0 0 38 24" role="img" aria-label="${type}"><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="#bbb"/><text x="19" y="15" font-size="7" text-anchor="middle" fill="#333">${type.slice(0, 6)}</text></svg>`,
  default_errors: () => '',
  image_url: (image) => placeholder(image?.alt || image?.title || String(image ?? '')),
  image_tag: (url, ...args) => {
    const a = Object.fromEntries(args.filter(Array.isArray));
    const attrs = ['alt', 'loading', 'fetchpriority', 'sizes', 'class', 'width', 'height', 'style']
      .filter((k) => a[k] !== undefined && a[k] !== null)
      .map((k) => `${k}="${String(a[k]).replace(/"/g, '&quot;')}"`)
      .join(' ');
    return `<img src="${url}" ${attrs}${a.width ? '' : ' width="800" height="800"'}>`;
  },
  placeholder_svg_tag: (name, cls) => `<svg class="${cls ?? ''}" viewBox="0 0 10 10"><rect width="10" height="10" fill="currentColor" opacity=".15"/></svg>`,
  metafield_tag: (field) => field?.value ?? '',
  payment_button: () => `<div class="shopify-payment-button"><button type="button" class="shopify-payment-button__button" disabled>Buy with Shop Pay (dynamic checkout, mocked)</button></div>`,
  video_tag: () => '',
  external_video_tag: () => '',
  model_viewer_tag: () => '',
  time_tag: (value) => String(value),
  format_code: (value) => value,
  // Shopify divides two integers as integers (the result is floored); LiquidJS doesn't by default.
  divided_by: (a, b) => (Number.isInteger(Number(a)) && Number.isInteger(Number(b)) ? Math.floor(Number(a) / Number(b)) : Number(a) / Number(b)),
  date: (value, format, ...rest) => {
    if (Array.isArray(format) && format[0] === 'format') format = { abbreviated_date: '%b %d, %Y', date: '%B %d, %Y' }[format[1]] ?? '%b %d, %Y';
    return strftime(value, format);
  },
};

// Labelled placeholder image (like the reference demo's image slots), from the shot description.
function placeholder(label) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = [];
  for (const word of String(label).split(' ')) {
    if (!lines.length || (lines.at(-1) + ' ' + word).length > 30) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
  }
  const text = lines
    .slice(0, 6)
    .map((line, i) => `<text x='400' y='${400 - lines.length * 20 + i * 42}'>${esc(line)}</text>`)
    .join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'><rect width='800' height='800' fill='#D8D5CE'/><g font-family='sans-serif' font-size='30' fill='#3F3C37' text-anchor='middle'>${text}</g><text x='400' y='760' font-family='sans-serif' font-size='20' fill='#5E5A54' text-anchor='middle'>Placeholder · photography to come</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// The strftime subset the theme uses, in UTC.
function strftime(value, format = '%Y-%m-%d') {
  const date = value === 'now' || value === 'today' ? new Date() : typeof value === 'number' || /^\d+$/.test(String(value)) ? new Date(Number(value) * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const map = {
    Y: date.getUTCFullYear(), m: pad(date.getUTCMonth() + 1), d: pad(date.getUTCDate()), H: pad(date.getUTCHours()), M: pad(date.getUTCMinutes()),
    s: Math.floor(date.getTime() / 1000), u: date.getUTCDay() || 7, z: '+0000', b: months[date.getUTCMonth()],
    B: date.toLocaleString('en', { month: 'long', timeZone: 'UTC' }),
  };
  return String(format).replace(/%(\w)/g, (m, k) => (k in map ? map[k] : m));
}
for (const [name, fn] of Object.entries(filters)) engine.registerFilter(name, fn);

// ---------- Sections ----------

const sectionSchema = (type) => {
  const source = readFileSync(join(theme, 'sections', `${type}.liquid`), 'utf8');
  const json = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(source)?.[1];
  return json ? JSON.parse(json) : {};
};

function resolveSettings(definitions = [], values = {}, scope) {
  const resolved = { ...defaults(definitions), ...values };
  for (const def of definitions) if (def.type === 'link_list') resolved[def.id] = scope.linklists[resolved[def.id]] ?? { links: [] };
  return resolved;
}

export async function renderSections(json, scope, groupClass = '', onlyId = null) {
  let html = '';
  for (const id of json.order) {
    const data = json.sections[id];
    if (data.disabled) continue;
    if (onlyId && id !== onlyId) continue;
    const schemaDef = sectionSchema(data.type);
    const blocks = (data.block_order ?? []).map((blockId) => {
      const block = data.blocks[blockId];
      const def = (schemaDef.blocks ?? []).find((b) => b.type === block.type) ?? {};
      return { id: blockId, type: block.type, shopify_attributes: '', settings: resolveSettings(def.settings, block.settings ?? {}, scope) };
    });
    const section = { id, settings: resolveSettings(schemaDef.settings, data.settings, scope), blocks };
    const source = fs.readFileSync(join(theme, 'sections', `${data.type}.liquid`));
    const body = await engine.parseAndRender(source, { section, __children: childList(data), __globals: scope }, { globals: scope });
    html += `<div id="shopify-section-${id}" class="shopify-section ${groupClass} ${schemaDef.class ?? ''}">${body}</div>\n`;
  }
  return html;
}

// ---------- Pages ----------

const fontLinks = (settings) => {
  const links = ['dm-sans/400.css', 'dm-sans/500.css', 'dm-sans/600.css', 'dm-sans/700.css', 'dm-sans/400-italic.css'];
  if (settings.heading_style === 'serif') links.push('instrument-serif/400.css');
  // This container has Liberation fonts (metric-compatible with Arial and Times New Roman)
  // rather than the fonts real devices have, so map the fallback faces onto them.
  const local = `<style>
    @font-face { font-family: 'DM Sans Fallback Arial'; src: local('Liberation Sans'); ascent-override: 94.9001%; descent-override: 29.6563%; line-gap-override: 0%; size-adjust: 104.531%; }
    @font-face { font-family: 'Instrument Serif Fallback Times'; src: local('Liberation Serif'); ascent-override: 117.9435%; descent-override: 36.9318%; line-gap-override: 0%; size-adjust: 83.9385%; }
  </style>`;
  return `<link rel="icon" href="data:,">` + local + links.map((href) => `<link rel="stylesheet" href="/fonts/${href}">`).join('');
};

export async function renderPage(preset, page, query = new URLSearchParams(), onlySection = null) {
  const store = demo.stores[PRESET_STORES[preset]];
  const mock = mockStore(store);
  const settings = themeSettings(preset, store);
  const product = page.type === 'product' ? productForRequest(PRESET_PRODUCTS[preset], query) : null;
  const scope = {
    cart: cart.view(preset),
    additional_checkout_buttons: true,
    content_for_additional_checkout_buttons: '<div class="shopify-cleanslate"><button type="button" disabled>Express checkout (mocked)</button></div>',
    product,
    closest: { product },
    request: { locale: { iso_code: 'en' }, page_type: page.type, origin: 'http://localhost' },
    ...mock,
    settings,
    routes: {
      cart_add_url: '/cart/add',
      root_url: '/',
      cart_url: '/cart',
      cart_change_url: '/cart/change',
      search_url: '/search',
      account_url: '/account',
      all_products_collection_url: '/collections/all',
    },
    template: { name: page.type },
    page_title: page.title,
    canonical_url: '#',
    content_for_header: `<script>window.Shopify = { routes: { root: '/' } };</script>`,
  };
  scope.__globals = scope;
  // The announcement bar previews the demo store's own messages.
  const headerGroup = readJson(join(theme, 'sections/header-group.json'));
  headerGroup.sections.announcement.block_order = mock.announcements.map((_, i) => `m${i}`);
  headerGroup.sections.announcement.blocks = Object.fromEntries(mock.announcements.map((text, i) => [`m${i}`, { type: 'message', settings: { text } }]));
  groupOverrides['header-group'] = headerGroup;

  // Section Rendering API: one section (?section_id=) or a map of them (?sections=a,b).
  if (onlySection) {
    const ids = Array.isArray(onlySection) ? onlySection : [onlySection];
    const template = readJson(join(theme, 'templates', `${page.template}.json`));
    const map = {};
    for (const id of ids) {
      const source = template.sections[id] ? template : staticSection(id);
      map[id] = await renderSections(source, scope, '', id);
    }
    return Array.isArray(onlySection) ? map : map[onlySection];
  }

  scope.content_for_layout = page.template
    ? await renderSections(readJson(join(theme, 'templates', `${page.template}.json`)), scope)
    : await engine.parseAndRender(readFileSync(join(here, page.file), "utf8"), { store }, { globals: scope });

  const layoutSource = fs.readFileSync(join(theme, 'layout', `${page.layout ?? 'theme'}.liquid`));
  let html = await engine.parseAndRender(layoutSource, {}, { globals: scope });
  html = html.replace('</head>', `${fontLinks(settings)}</head>`).replaceAll('"../assets/', '"/assets/').replaceAll("'../assets/", "'/assets/");
  return html;
}

export const PAGES = [
  { name: 'home', type: 'index', title: 'Home', template: 'index' },
  { name: 'product', type: 'product', title: 'Product', template: 'product' },
  { name: 'cart', type: 'cart', title: 'Cart', template: 'cart' },
  { name: 'styleguide', type: 'page', title: 'Style guide', file: 'styleguide.liquid-preview' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(theme, 'assets'), join(out, 'assets'), { recursive: true });
  cpSync(join(here, 'node_modules/@fontsource/dm-sans'), join(out, 'fonts/dm-sans'), { recursive: true });
  cpSync(join(here, 'node_modules/@fontsource/instrument-serif'), join(out, 'fonts/instrument-serif'), { recursive: true });
  for (const preset of Object.keys(PRESET_STORES)) {
    mkdirSync(join(out, preset), { recursive: true });
    for (const page of PAGES) {
      writeFileSync(join(out, preset, `${page.name}.html`), await renderPage(preset, page));
      console.log(`rendered ${preset}/${page.name}.html`);
    }
  }
}
