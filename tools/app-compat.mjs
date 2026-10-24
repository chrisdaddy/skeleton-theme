#!/usr/bin/env node
// App-compatibility checks (docs/merchant/app-compatibility.md): the integration points that
// common Shopify apps rely on, verified in the theme's source. Part of npm test.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaOf } from './lib/schema-index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const problems = [];
const check = (ok, message) => ok || problems.push(message);

// 1. App embeds and scripts: every layout outputs content_for_header and closes body.
for (const layout of readdirSync(join(root, 'layout')).filter((f) => f.endsWith('.liquid'))) {
  const source = read(`layout/${layout}`);
  check(/\{\{\s*content_for_header\s*\}\}/.test(source), `layout/${layout}: no {{ content_for_header }} (app scripts and embeds)`);
  check(/<\/body>/.test(source), `layout/${layout}: no </body> (app embeds are injected before it)`);
}

// 2. App blocks: every section with a product form or a product context accepts @app.
const productSurfaces = ['main-product', 'featured-product', 'offer'];
for (const file of readdirSync(join(root, 'sections')).filter((f) => f.endsWith('.liquid'))) {
  const type = file.replace('.liquid', '');
  const source = read(`sections/${file}`);
  const schema = schemaOf(join(root, 'sections', file));
  const hasProductForm = /\{%-?\s*form\s+'product'/.test(source) || productSurfaces.includes(type);
  if (hasProductForm && schema?.blocks) check(schema.blocks.some((b) => b.type === '@app'), `sections/${file}: has a product form but doesn't accept app blocks (@app)`);
}
for (const type of productSurfaces) check(schemaOf(join(root, 'sections', `${type}.liquid`))?.blocks?.some((b) => b.type === '@app'), `sections/${type}.liquid must accept @app`);
check(schemaOf(join(root, 'sections/apps.liquid'))?.blocks?.some((b) => b.type === '@app'), 'sections/apps.liquid must accept @app');
check(schemaOf(join(root, 'sections/reviews.liquid'))?.blocks?.some((b) => b.type === '@app'), 'sections/reviews.liquid must accept @app (review widgets)');

// 3. Subscription apps: the product form posts selling_plan, and selling plans come from Shopify.
const buyBox = read('blocks/product-purchase-options.liquid') + read('blocks/product-buy-buttons.liquid') + read('sections/main-product.liquid');
check(/name="selling_plan"/.test(buyBox), 'the product form must post selling_plan (subscription apps)');
check(/selling_plan_groups|selling_plan_allocations/.test(read('blocks/product-purchase-options.liquid')), 'purchase options must read Shopify selling plans');

// 4. Review apps: star ratings read Shopify's standard reviews.* metafields.
check(/metafields\.reviews\.rating/.test(read('blocks/product-rating.liquid')), 'product-rating must read reviews.rating');
check(/metafields\.reviews\.rating/.test(read('snippets/product-card.liquid')), 'product cards must read reviews.rating');

// 5. Cart apps: the documented events exist (bp:cart:changed refreshes, bp:cart:open opens).
const core = read('assets/bp-core.js');
check(/addEventListener\('bp:cart:changed'/.test(core), "bp-core.js must listen for 'bp:cart:changed'");
check(/addEventListener\('bp:cart:open'/.test(core), "bp-core.js must listen for 'bp:cart:open'");
check(/routes\.cart_add_url|routes\.cart_url/.test(read('blocks/product-buy-buttons.liquid') + read('snippets/cart-contents.liquid')), 'cart forms must use routes.* (Markets URLs)');

// 6. Search & Discovery filters render from collection.filters.
check(/collection\.filters/.test(read('sections/main-collection-grid.liquid')), 'the collection grid must render collection.filters');

// 7. No jQuery or other globals apps might clash with.
for (const file of readdirSync(join(root, 'assets')).filter((f) => f.endsWith('.js'))) check(!/jQuery|\$\(/.test(read(`assets/${file}`)), `assets/${file}: no jQuery`);

if (problems.length) {
  console.error(`${problems.join('\n')}\n\nApp compatibility: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log('App compatibility checks passed.');
