// An in-memory store for the tests: answers the server's allow-listed operations like the Admin
// API would. The live theme holds this repository's real theme files (templates, section
// groups, settings), and the products are the Verde demo catalog.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const md5 = (text) => createHash('md5').update(text).digest('hex');

function themeFiles() {
  const files = {};
  for (const dir of ['templates', 'sections', 'config', 'locales']) {
    for (const name of readdirSync(join(repo, dir))) {
      if (name.endsWith('.json')) files[`${dir}/${name}`] = readFileSync(join(repo, dir, name), 'utf8');
    }
  }
  return files;
}

export function fakeShopify() {
  let next = 1000;
  const gid = (type) => `gid://shopify/${type}/${next++}`;
  const calls = [];
  const catalog = JSON.parse(readFileSync(join(repo, 'tools/demo/stores/verde.json'), 'utf8'));
  const store = {
    themes: [{ id: 'gid://shopify/OnlineStoreTheme/1', name: 'Blueprint', role: 'MAIN', processing: false, files: themeFiles() }],
    products: catalog.products.map((p, i) => ({
      id: `gid://shopify/Product/${i + 1}`,
      legacyResourceId: String(i + 1),
      handle: p.handle,
      title: p.title,
      productType: p.productType,
      status: 'ACTIVE',
      variants: p.variants.map((v, j) => ({ id: `gid://shopify/ProductVariant/${(i + 1) * 100 + j}`, title: v.options.join(' / ') || 'Default Title', price: v.price, compareAtPrice: v.compareAtPrice, availableForSale: true })),
      metafields: p.metafields.filter((m) => typeof m.value !== 'object' || m.type === 'rating').map((m) => ({ namespace: m.namespace, key: m.key, type: m.type, value: typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value), reference: null, references: null })),
    })),
    pages: [],
    metaobjectDefinitions: [],
    metafieldDefinitions: [],
  };
  const theme = (id) => store.themes.find((t) => t.id === id);
  const ok = (payload) => ({ ...payload, userErrors: [] });

  const handlers = {
    Shop: () => ({ shop: { name: 'Verde (test)', myshopifyDomain: 'verde-test.myshopify.com', currencyCode: 'USD' } }),
    Themes: () => ({ themes: { nodes: store.themes.map(({ files, ...t }) => ({ ...t, updatedAt: '2026-10-24T00:00:00Z' })) } }),
    Theme: ({ id }) => {
      const t = theme(id);
      return { theme: t ? { id: t.id, name: t.name, role: t.role, processing: t.processing, processingFailed: false } : null };
    },
    ThemeFiles: ({ id, filenames }) => {
      const t = theme(id);
      if (!t) return { theme: null };
      const nodes = filenames.filter((f) => f in t.files).map((f) => ({ filename: f, checksumMd5: md5(t.files[f]), size: t.files[f].length, body: { content: t.files[f] } }));
      return { theme: { id: t.id, role: t.role, files: { nodes } } };
    },
    Products: ({ first, query }) => {
      const match = /handle:(\S+)/.exec(query ?? '')?.[1];
      const list = store.products.filter((p) => !match || p.handle === match).slice(0, first);
      return { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: list.map((p) => ({ id: p.id, handle: p.handle, title: p.title, productType: p.productType, status: p.status, priceRangeV2: null, variants: { nodes: p.variants } })) } };
    },
    ProductByHandle: ({ handle }) => {
      const p = store.products.find((x) => x.handle === handle);
      return { productByIdentifier: p ? { id: p.id, legacyResourceId: p.legacyResourceId, handle: p.handle, title: p.title, onlineStoreUrl: null } : null };
    },
    ProductMetafields: ({ handle }) => {
      const p = store.products.find((x) => x.handle === handle);
      return { productByIdentifier: p ? { id: p.id, handle: p.handle, title: p.title, metafields: { nodes: p.metafields } } : null };
    },
    Pages: ({ query }) => ({ pages: { nodes: store.pages.filter((p) => p.handle === /handle:(\S+)/.exec(query)?.[1]) } }),
    MetaobjectDefinitionByType: ({ type }) => ({ metaobjectDefinitionByType: store.metaobjectDefinitions.find((d) => d.type === type) ?? null }),
    MetafieldDefinitions: ({ ownerType, namespace }) => ({ metafieldDefinitions: { nodes: store.metafieldDefinitions.filter((d) => d.ownerType === ownerType && d.namespace === namespace) } }),
    ThemeDuplicate: ({ id, name }) => {
      const source = theme(id);
      const copy = { id: gid('OnlineStoreTheme'), name, role: 'UNPUBLISHED', processing: false, files: { ...source.files } };
      store.themes.push(copy);
      return { themeDuplicate: ok({ newTheme: { id: copy.id, name: copy.name, role: copy.role, processing: copy.processing } }) };
    },
    ThemeFilesUpsert: ({ themeId, files }) => {
      const t = theme(themeId);
      for (const f of files) t.files[f.filename] = f.body.value;
      return { themeFilesUpsert: ok({ upsertedThemeFiles: files.map((f) => ({ filename: f.filename, checksumMd5: md5(f.body.value) })) }) };
    },
    ThemeFilesDelete: ({ themeId, files }) => {
      const t = theme(themeId);
      for (const f of files) delete t.files[f];
      return { themeFilesDelete: ok({ deletedThemeFiles: files.map((filename) => ({ filename })) }) };
    },
    PageCreate: ({ page }) => {
      const p = { id: gid('Page'), handle: page.handle, title: page.title, isPublished: page.isPublished, templateSuffix: page.templateSuffix };
      store.pages.push(p);
      return { pageCreate: ok({ page: p }) };
    },
    MetaobjectDefinitionCreate: ({ definition }) => {
      const d = { id: gid('MetaobjectDefinition'), type: definition.type, fieldDefinitions: definition.fieldDefinitions.map((f) => ({ key: f.key })) };
      store.metaobjectDefinitions.push(d);
      return { metaobjectDefinitionCreate: ok({ metaobjectDefinition: { id: d.id, type: d.type } }) };
    },
    MetaobjectDefinitionUpdate: ({ id, definition }) => {
      const d = store.metaobjectDefinitions.find((x) => x.id === id);
      for (const op of definition.fieldDefinitions) d.fieldDefinitions.push({ key: op.create.key });
      return { metaobjectDefinitionUpdate: ok({ metaobjectDefinition: { id } }) };
    },
    MetafieldDefinitionCreate: ({ definition }) => {
      const d = { id: gid('MetafieldDefinition'), ...definition };
      store.metafieldDefinitions.push(d);
      return { metafieldDefinitionCreate: ok({ createdDefinition: { id: d.id, key: d.key } }) };
    },
    StandardMetafieldDefinitionEnable: (def) => {
      const d = { id: gid('MetafieldDefinition'), ...def };
      store.metafieldDefinitions.push(d);
      return { standardMetafieldDefinitionEnable: ok({ createdDefinition: { id: d.id } }) };
    },
  };

  const admin = async (name, variables = {}) => {
    if (!handlers[name]) throw new Error(`fake-shopify: no handler for ${name}`);
    calls.push({ name, variables: structuredClone(variables) });
    return structuredClone(handlers[name](variables));
  };
  return { admin, store, calls, theme };
}
