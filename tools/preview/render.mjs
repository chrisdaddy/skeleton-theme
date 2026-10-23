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
import { Liquid, Tag } from 'liquidjs';
import { contrast, mix } from '../lib/color.mjs';

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
      enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'shopify_pay', 'apple_pay', 'google_pay'],
    },
    cart: { item_count: 2 },
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
      const cls = /class:\s*'([^']*)'/.exec(this.args)?.[1] ?? '';
      const id = /id:\s*'([^']*)'/.exec(this.args)?.[1] ?? '';
      ctx.push({ form: { posted_successfully_q: false, errors: null } });
      emitter.write(`<form method="post" action="#"${cls ? ` class="${cls}"` : ''}${id ? ` id="${id}"` : ''}>`);
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
  image_url: () => '',
  image_tag: () => '',
  time_tag: (value) => String(value),
  format_code: (value) => value,
};
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

async function renderSections(json, scope, groupClass = '') {
  let html = '';
  for (const id of json.order) {
    const data = json.sections[id];
    if (data.disabled) continue;
    const schemaDef = sectionSchema(data.type);
    const blocks = (data.block_order ?? []).map((blockId) => {
      const block = data.blocks[blockId];
      const def = (schemaDef.blocks ?? []).find((b) => b.type === block.type) ?? {};
      return { id: blockId, type: block.type, shopify_attributes: '', settings: resolveSettings(def.settings, block.settings, scope) };
    });
    const section = { id, settings: resolveSettings(schemaDef.settings, data.settings, scope), blocks };
    const source = fs.readFileSync(join(theme, 'sections', `${data.type}.liquid`));
    const body = await engine.parseAndRender(source, { section }, { globals: scope });
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
  return `<link rel="icon" href="data:,">` + local + links.map((href) => `<link rel="stylesheet" href="../fonts/${href}">`).join('');
};

async function renderPage(preset, page) {
  const store = demo.stores[PRESET_STORES[preset]];
  const mock = mockStore(store);
  const settings = themeSettings(preset, store);
  const scope = {
    ...mock,
    settings,
    request: { locale: { iso_code: 'en' }, page_type: page.type },
    routes: {
      root_url: '/',
      cart_url: '/cart',
      search_url: '/search',
      account_url: '/account',
      all_products_collection_url: '/collections/all',
    },
    template: { name: page.type },
    page_title: page.title,
    canonical_url: '#',
    content_for_header: '',
  };
  // The announcement bar previews the demo store's own messages.
  const headerGroup = readJson(join(theme, 'sections/header-group.json'));
  headerGroup.sections.announcement.block_order = mock.announcements.map((_, i) => `m${i}`);
  headerGroup.sections.announcement.blocks = Object.fromEntries(mock.announcements.map((text, i) => [`m${i}`, { type: 'message', settings: { text } }]));
  groupOverrides['header-group'] = headerGroup;

  scope.content_for_layout = page.template
    ? await renderSections(readJson(join(theme, 'templates', `${page.template}.json`)), scope)
    : await engine.parseAndRender(readFileSync(join(here, page.file), "utf8"), { store }, { globals: scope });

  const layoutSource = fs.readFileSync(join(theme, 'layout', `${page.layout ?? 'theme'}.liquid`));
  let html = await engine.parseAndRender(layoutSource, {}, { globals: scope });
  html = html.replace('</head>', `${fontLinks(settings)}</head>`);
  return html;
}

export const PAGES = [
  { name: 'home', type: 'index', title: 'Home', template: 'index' },
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
