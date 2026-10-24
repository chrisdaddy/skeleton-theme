// Applies a demo-store config (tools/demo/stores/<id>.json) to a store through the Admin API.
//
// Every step looks up what exists first and only creates or updates the difference, so the
// seed can be re-run after a failure or a data change. Steps, in dependency order:
//
//   shop          currency, primary location, Online Store publication
//   definitions   metaobject and metafield definitions (tools/demo/definitions.mjs)
//   files         placeholder images (rendered by the caller), uploaded once by filename
//   collections   best sellers (manual) and one smart collection per product type
//   products      productSet by handle: options, variants, prices, inventory, media
//   metaobjects   metaobjectUpsert by handle (tiers, benefits, FAQs…)
//   metafields    product metafields that reference metaobjects and other products
//   sellingplans  one subscribe-and-save group per subscription product
//   publish       products and collections on the Online Store
//   pages         pre-landers, about and contact with their templates
//   menus         main and footer menus
//   discounts     automatic discounts behind the theme's gifts, rewards and deals
//
// gql(query, variables) is injected (tools/demo/admin.mjs for a store, tools/demo/fake-admin.mjs
// for a dry run and the tests). Money comes from the config as decimal strings.

import { assertNoUserErrors } from './admin.mjs';
import { METAFIELDS, METAOBJECTS, NAMESPACE, STANDARD_METAFIELDS } from './definitions.mjs';

export const STEPS = ['shop', 'definitions', 'files', 'collections', 'products', 'metaobjects', 'metafields', 'sellingplans', 'publish', 'pages', 'menus', 'discounts'];

const Q = {
  shop: `query BpShop {
    shop { name currencyCode myshopifyDomain }
    locations(first: 5) { nodes { id name isActive } }
    publications(first: 20) { nodes { id catalog { title } } }
  }`,
  metaobjectDefinitionByType: `query BpMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) { id type fieldDefinitions { key } }
  }`,
  metaobjectDefinitionCreate: `mutation BpMetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id type } userErrors { field message code } }
  }`,
  metaobjectDefinitionUpdate: `mutation BpMetaobjectDefinitionUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) { metaobjectDefinition { id } userErrors { field message code } }
  }`,
  metafieldDefinitions: `query BpMetafieldDefinitions($ownerType: MetafieldOwnerType!, $namespace: String!) {
    metafieldDefinitions(first: 100, ownerType: $ownerType, namespace: $namespace) { nodes { id key } }
  }`,
  metafieldDefinitionCreate: `mutation BpMetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) { createdDefinition { id key } userErrors { field message code } }
  }`,
  standardMetafieldDefinitionEnable: `mutation BpStandardMetafieldEnable($ownerType: MetafieldOwnerType!, $namespace: String!, $key: String!) {
    standardMetafieldDefinitionEnable(ownerType: $ownerType, namespace: $namespace, key: $key) { createdDefinition { id } userErrors { field message code } }
  }`,
  files: `query BpFiles($query: String!) {
    files(first: 5, query: $query) { nodes { id fileStatus ... on MediaImage { image { url } } } }
  }`,
  stagedUploadsCreate: `mutation BpStagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } }
  }`,
  fileCreate: `mutation BpFileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) { files { id fileStatus } userErrors { field message code } }
  }`,
  collectionByHandle: `query BpCollection($handle: String!) {
    collectionByIdentifier(identifier: { handle: $handle }) { id handle }
  }`,
  collectionCreate: `mutation BpCollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) { collection { id handle } userErrors { field message } }
  }`,
  collectionUpdate: `mutation BpCollectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) { collection { id handle } userErrors { field message } }
  }`,
  productByHandle: `query BpProduct($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) { id handle variants(first: 250) { nodes { id selectedOptions { name value } } } }
  }`,
  productSet: `mutation BpProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
    productSet(identifier: $identifier, input: $input, synchronous: true) {
      product { id handle variants(first: 250) { nodes { id selectedOptions { name value } } } }
      userErrors { field message code }
    }
  }`,
  metaobjectUpsert: `mutation BpMetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) { metaobject { id handle } userErrors { field message code } }
  }`,
  metafieldsSet: `mutation BpMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id key } userErrors { field message code } }
  }`,
  productSellingPlanGroups: `query BpProductPlans($id: ID!) {
    product(id: $id) { sellingPlanGroups(first: 10) { nodes { id merchantCode } } }
  }`,
  sellingPlanGroupCreate: `mutation BpSellingPlanGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) {
    sellingPlanGroupCreate(input: $input, resources: $resources) { sellingPlanGroup { id } userErrors { field message code } }
  }`,
  publishablePublish: `mutation BpPublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) { userErrors { field message } }
  }`,
  pages: `query BpPages($query: String!) {
    pages(first: 5, query: $query) { nodes { id handle } }
  }`,
  pageCreate: `mutation BpPageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) { page { id handle } userErrors { field message code } }
  }`,
  pageUpdate: `mutation BpPageUpdate($id: ID!, $page: PageUpdateInput!) {
    pageUpdate(id: $id, page: $page) { page { id handle } userErrors { field message code } }
  }`,
  menus: `query BpMenus {
    menus(first: 50) { nodes { id handle } }
  }`,
  menuCreate: `mutation BpMenuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) { menu { id handle } userErrors { field message code } }
  }`,
  menuUpdate: `mutation BpMenuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, items: $items) { menu { id handle } userErrors { field message code } }
  }`,
  discounts: `query BpDiscounts {
    discountNodes(first: 100, query: "method:automatic") {
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticBasic { title }
          ... on DiscountAutomaticBxgy { title }
          ... on DiscountAutomaticFreeShipping { title }
        }
      }
    }
  }`,
  discountAutomaticBasicCreate: `mutation BpDiscountBasic($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) { automaticDiscountNode { id } userErrors { field message code } }
  }`,
  discountAutomaticBxgyCreate: `mutation BpDiscountBxgy($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
    discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) { automaticDiscountNode { id } userErrors { field message code } }
  }`,
  discountAutomaticFreeShippingCreate: `mutation BpDiscountFreeShipping($freeShippingAutomaticDiscount: DiscountAutomaticFreeShippingInput!) {
    discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $freeShippingAutomaticDiscount) { automaticDiscountNode { id } userErrors { field message code } }
  }`,
};
export const OPERATIONS = Q;

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
const richText = (text) => JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }] });
const DEFAULT_OPTION = { name: 'Title', value: 'Default Title' };

export async function seed(config, gql, { steps = STEPS, log = console.log, renderImage, upload } = {}) {
  const state = { products: {}, variants: {}, metaobjects: {}, files: {}, collections: {}, pages: {}, definitions: {}, created: [], updated: [] };
  const created = (what) => state.created.push(what);
  const updated = (what) => state.updated.push(what);
  const run = (step) => steps.includes(step);

  // ---------- References ----------
  const variantId = ([handle, options]) => {
    const list = state.variants[handle];
    if (!list) throw new Error(`No variants seeded for product "${handle}"`);
    const match = options.length ? list.find((v) => options.every((o, i) => v.options[i] === o)) : list[0];
    if (!match) throw new Error(`No variant ${handle} ${options.join(' / ')}`);
    return match.id;
  };
  const resolve = (value) => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object') {
      if ('$product' in value) return need(state.products, value.$product, 'product');
      if ('$variant' in value) return variantId(value.$variant);
      if ('$metaobject' in value) return need(state.metaobjects, value.$metaobject, 'metaobject');
      if ('$file' in value) return need(state.files, value.$file, 'file');
      if ('$collection' in value) return need(state.collections, value.$collection, 'collection');
      if ('$page' in value) return need(state.pages, value.$page, 'page');
    }
    return value;
  };
  const need = (map, key, kind) => {
    if (!map[key]) throw new Error(`Missing ${kind} "${key}" (run the step that creates it first)`);
    return map[key];
  };
  const fieldValue = (value) => {
    const resolved = resolve(value);
    if (value && typeof value === 'object' && 'rich' in value) return richText(value.rich);
    if (Array.isArray(resolved) || (resolved && typeof resolved === 'object')) return JSON.stringify(resolved);
    return String(resolved);
  };

  // ---------- shop ----------
  const shop = await gql(Q.shop);
  const location = shop.locations.nodes.find((l) => l.isActive) ?? shop.locations.nodes[0];
  const onlineStore = shop.publications.nodes.find((p) => /online store/i.test(p.catalog?.title ?? ''));
  if (run('shop')) {
    log(`shop: ${shop.shop.name} (${shop.shop.myshopifyDomain}), ${shop.shop.currencyCode}`);
    if (shop.shop.currencyCode !== 'USD') log(`  warning: the demo prices are USD; this store uses ${shop.shop.currencyCode}`);
    if (!onlineStore) log('  warning: no Online Store publication found; products will not be published');
  }

  // ---------- definitions ----------
  if (run('definitions') || run('metafields') || run('metaobjects')) {
    for (const def of METAOBJECTS) {
      const found = (await gql(Q.metaobjectDefinitionByType, { type: def.type })).metaobjectDefinitionByType;
      if (found) {
        state.definitions[def.type] = found.id;
        const missing = def.fields.filter((f) => !found.fieldDefinitions.some((x) => x.key === f.key));
        if (missing.length && run('definitions')) {
          const payload = (await gql(Q.metaobjectDefinitionUpdate, { id: found.id, definition: { fieldDefinitions: missing.map((f) => ({ create: fieldDefinition(f) })) } })).metaobjectDefinitionUpdate;
          assertNoUserErrors(`metaobject definition ${def.type}`, payload);
          updated(`definition ${def.type} (+${missing.map((f) => f.key).join(', ')})`);
        }
        continue;
      }
      if (!run('definitions')) throw new Error(`Metaobject definition ${def.type} is missing; run the definitions step`);
      const payload = (
        await gql(Q.metaobjectDefinitionCreate, {
          definition: {
            type: def.type,
            name: def.name,
            displayNameKey: def.displayNameKey,
            access: { storefront: 'PUBLIC_READ' },
            capabilities: { translatable: { enabled: true } },
            fieldDefinitions: def.fields.map(fieldDefinition),
          },
        })
      ).metaobjectDefinitionCreate;
      assertNoUserErrors(`metaobject definition ${def.type}`, payload);
      state.definitions[def.type] = payload.metaobjectDefinition.id;
      created(`definition ${def.type}`);
    }
  }
  if (run('definitions')) {
    for (const ownerType of [...new Set(METAFIELDS.map((m) => m.ownerType))]) {
      const existing = (await gql(Q.metafieldDefinitions, { ownerType, namespace: NAMESPACE })).metafieldDefinitions.nodes.map((n) => n.key);
      for (const def of METAFIELDS.filter((m) => m.ownerType === ownerType && !existing.includes(m.key))) {
        const validations = [];
        if (def.metaobject) validations.push({ name: 'metaobject_definition_id', value: state.definitions[def.metaobject] });
        if (def.choices) validations.push({ name: 'choices', value: JSON.stringify(def.choices) });
        const payload = (await gql(Q.metafieldDefinitionCreate, { definition: { ownerType, namespace: NAMESPACE, key: def.key, name: def.name, type: def.type, ...(validations.length ? { validations } : {}) } })).metafieldDefinitionCreate;
        assertNoUserErrors(`metafield definition ${ownerType} ${def.key}`, payload);
        created(`definition ${ownerType.toLowerCase()}.${NAMESPACE}.${def.key}`);
      }
    }
    for (const def of STANDARD_METAFIELDS) {
      const existing = (await gql(Q.metafieldDefinitions, { ownerType: def.ownerType, namespace: def.namespace })).metafieldDefinitions.nodes.map((n) => n.key);
      if (existing.includes(def.key)) continue;
      const payload = (await gql(Q.standardMetafieldDefinitionEnable, def)).standardMetafieldDefinitionEnable;
      assertNoUserErrors(`standard definition ${def.namespace}.${def.key}`, payload);
      created(`definition ${def.namespace}.${def.key} (standard)`);
    }
  }

  // ---------- files ----------
  for (const file of config.files) {
    const found = (await gql(Q.files, { query: `filename:'${file.filename}'` })).files.nodes.find((n) => !n.image?.url || n.image.url.split('?')[0].endsWith(`/${file.filename}`));
    if (found) {
      state.files[file.key] = found.id;
      continue;
    }
    if (!run('files')) continue;
    if (!renderImage) throw new Error('files: no image renderer');
    const bytes = await renderImage(file);
    const staged = (await gql(Q.stagedUploadsCreate, { input: [{ filename: file.filename, mimeType: 'image/png', httpMethod: 'POST', resource: 'IMAGE', fileSize: String(bytes.length) }] })).stagedUploadsCreate;
    assertNoUserErrors(`staged upload ${file.filename}`, staged);
    const target = staged.stagedTargets[0];
    await upload(target, file.filename, bytes);
    const payload = (await gql(Q.fileCreate, { files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE', alt: file.alt ?? '', filename: file.filename, duplicateResolutionMode: 'REPLACE' }] })).fileCreate;
    assertNoUserErrors(`file ${file.filename}`, payload);
    state.files[file.key] = payload.files[0].id;
    created(`file ${file.filename}`);
  }

  // ---------- collections ----------
  if (run('collections') || run('products') || run('menus') || run('publish')) {
    for (const c of config.collections) {
      const found = (await gql(Q.collectionByHandle, { handle: c.handle })).collectionByIdentifier;
      const input = { handle: c.handle, title: c.title, ...(c.rule ? { ruleSet: { appliedDisjunctively: false, rules: [c.rule] } } : {}) };
      if (found) {
        state.collections[c.handle] = found.id;
        if (run('collections')) {
          assertNoUserErrors(`collection ${c.handle}`, (await gql(Q.collectionUpdate, { input: { id: found.id, title: c.title, ...(c.rule ? { ruleSet: input.ruleSet } : {}) } })).collectionUpdate);
          updated(`collection ${c.handle}`);
        }
        continue;
      }
      if (!run('collections')) continue;
      const payload = (await gql(Q.collectionCreate, { input })).collectionCreate;
      assertNoUserErrors(`collection ${c.handle}`, payload);
      state.collections[c.handle] = payload.collection.id;
      created(`collection ${c.handle}`);
    }
  }

  // ---------- products ----------
  // Membership of manual collections is set from the product side (productSet keeps it in sync).
  const manualMembers = Object.fromEntries(config.collections.filter((c) => c.products).map((c) => [c.handle, c.products]));
  for (const product of config.products) {
    if (!run('products')) {
      const found = (await gql(Q.productByHandle, { handle: product.handle })).productByIdentifier;
      if (found) remember(product, found);
      continue;
    }
    const options = product.options.length ? product.options : [{ name: DEFAULT_OPTION.name, values: [DEFAULT_OPTION.value] }];
    const input = {
      handle: product.handle,
      title: product.title,
      descriptionHtml: product.descriptionHtml,
      vendor: config.brand,
      productType: product.productType,
      tags: product.tags,
      status: 'ACTIVE',
      productOptions: options.map((o, i) => ({ name: o.name, position: i + 1, values: o.values.map((name) => ({ name })) })),
      variants: product.variants.map((v, i) => ({
        optionValues: (product.options.length ? v.options : [DEFAULT_OPTION.value]).map((name, j) => ({ optionName: options[j].name, name })),
        position: i + 1,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        taxable: v.taxable ?? true,
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: v.tracked ?? true, requiresShipping: v.requiresShipping ?? true, ...(v.sku ? { sku: v.sku } : {}) },
        ...(location && (v.tracked ?? true) ? { inventoryQuantities: [{ locationId: location.id, name: 'available', quantity: 120 }] } : {}),
        ...(v.tracked === false ? { inventoryPolicy: 'CONTINUE' } : {}),
        ...(v.packQuantity ? { metafields: [{ namespace: NAMESPACE, key: 'pack_quantity', type: 'number_integer', value: String(v.packQuantity) }] } : {}),
      })),
      files: product.files.map((ref) => (state.files[ref.$file] ? { id: state.files[ref.$file] } : null)).filter(Boolean),
      collections: Object.entries(manualMembers)
        .filter(([, members]) => members.includes(product.handle))
        .map(([handle]) => state.collections[handle])
        .filter(Boolean),
      // Plain-value metafields go with the product; references follow once their targets exist.
      metafields: product.metafields.filter((m) => !hasRef(m.value)).map((m) => ({ namespace: m.namespace, key: m.key, type: m.type, value: fieldValue(m.value) })),
    };
    const payload = (await gql(Q.productSet, { identifier: { handle: product.handle }, input })).productSet;
    assertNoUserErrors(`product ${product.handle}`, payload);
    remember(product, payload.product);
    updated(`product ${product.handle} (${product.variants.length} variant${product.variants.length === 1 ? '' : 's'})`);
  }
  function remember(product, found) {
    state.products[product.handle] = found.id;
    state.variants[product.handle] = found.variants.nodes.map((v) => ({
      id: v.id,
      options: v.selectedOptions.map((o) => o.value).filter((value, i, all) => !(all.length === 1 && value === DEFAULT_OPTION.value)),
    }));
  }

  // ---------- metaobjects ----------
  for (const mo of config.metaobjects) {
    if (!run('metaobjects')) continue;
    const fields = Object.entries(mo.fields).map(([key, value]) => ({ key, value: fieldValue(value) }));
    const payload = (await gql(Q.metaobjectUpsert, { handle: { type: mo.type, handle: mo.handle }, metaobject: { fields } })).metaobjectUpsert;
    assertNoUserErrors(`metaobject ${mo.type}/${mo.handle}`, payload);
    state.metaobjects[`${mo.type}/${mo.handle}`] = payload.metaobject.id;
  }
  if (run('metaobjects')) updated(`${config.metaobjects.length} metaobjects`);

  // ---------- metafields (with references) ----------
  if (run('metafields')) {
    const sets = config.products.flatMap((product) =>
      product.metafields.filter((m) => hasRef(m.value)).map((m) => ({ ownerId: need(state.products, product.handle, 'product'), namespace: m.namespace, key: m.key, type: m.type, value: fieldValue(m.value) })),
    );
    for (const part of chunk(sets, 25)) assertNoUserErrors('metafields', (await gql(Q.metafieldsSet, { metafields: part })).metafieldsSet);
    updated(`${sets.length} product metafields with references`);
  }

  // ---------- selling plans ----------
  if (run('sellingplans')) {
    for (const group of config.sellingPlanGroups) {
      const ids = group.products.map((h) => need(state.products, h, 'product'));
      const existing = (await gql(Q.productSellingPlanGroups, { id: ids[0] })).product.sellingPlanGroups.nodes;
      if (existing.some((g) => g.merchantCode === group.merchantCode)) continue;
      const input = {
        name: group.name,
        merchantCode: group.merchantCode,
        options: group.options,
        sellingPlansToCreate: group.plans.map((plan, i) => ({
          name: plan.name,
          options: [plan.option],
          position: i + 1,
          category: 'SUBSCRIPTION',
          billingPolicy: { recurring: { interval: 'MONTH', intervalCount: plan.months } },
          deliveryPolicy: { recurring: { interval: 'MONTH', intervalCount: plan.months } },
          pricingPolicies: [{ fixed: { adjustmentType: 'PERCENTAGE', adjustmentValue: { percentage: group.percentage } } }],
        })),
      };
      assertNoUserErrors(`selling plan group ${group.merchantCode}`, (await gql(Q.sellingPlanGroupCreate, { input, resources: { productIds: ids } })).sellingPlanGroupCreate);
      created(`selling plan group ${group.name}`);
    }
  }

  // ---------- publish ----------
  if (run('publish') && onlineStore) {
    const ids = [...Object.values(state.products), ...Object.values(state.collections)];
    for (const id of ids) assertNoUserErrors(`publish ${id}`, (await gql(Q.publishablePublish, { id, input: [{ publicationId: onlineStore.id }] })).publishablePublish);
    updated(`published ${ids.length} products and collections`);
  }

  // ---------- pages ----------
  for (const page of config.pages) {
    const found = (await gql(Q.pages, { query: `handle:${page.handle}` })).pages.nodes.find((p) => p.handle === page.handle);
    if (found) state.pages[page.handle] = found.id;
    if (!run('pages')) continue;
    const input = { title: page.title, handle: page.handle, body: page.body, templateSuffix: page.templateSuffix, isPublished: true };
    if (found) {
      assertNoUserErrors(`page ${page.handle}`, (await gql(Q.pageUpdate, { id: found.id, page: input })).pageUpdate);
      updated(`page ${page.handle}`);
    } else {
      const payload = (await gql(Q.pageCreate, { page: input })).pageCreate;
      assertNoUserErrors(`page ${page.handle}`, payload);
      state.pages[page.handle] = payload.page.id;
      created(`page ${page.handle}`);
    }
  }

  // ---------- menus ----------
  if (run('menus')) {
    const existing = (await gql(Q.menus)).menus.nodes;
    const item = (i) => ({ title: i.title, type: i.type, ...(i.ref ? { resourceId: resolve(i.ref) } : {}), ...(i.url ? { url: i.url } : {}), items: (i.items ?? []).map(item) });
    for (const menu of config.menus) {
      const found = existing.find((m) => m.handle === menu.handle);
      const items = menu.items.map(item);
      if (found) {
        assertNoUserErrors(`menu ${menu.handle}`, (await gql(Q.menuUpdate, { id: found.id, title: menu.title, items })).menuUpdate);
        updated(`menu ${menu.handle}`);
      } else {
        assertNoUserErrors(`menu ${menu.handle}`, (await gql(Q.menuCreate, { title: menu.title, handle: menu.handle, items })).menuCreate);
        created(`menu ${menu.handle}`);
      }
    }
  }

  // ---------- discounts ----------
  if (run('discounts')) {
    const titles = (await gql(Q.discounts)).discountNodes.nodes.map((n) => n.discount?.title).filter(Boolean);
    const startsAt = new Date().toISOString();
    const combinesWith = { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true };
    for (const d of config.discounts) {
      if (titles.includes(d.title)) continue;
      let payload;
      if (d.kind === 'freeShipping') {
        const input = { title: d.title, startsAt, combinesWith: { productDiscounts: true, orderDiscounts: true }, destination: { all: true }, ...(d.minimumSubtotal ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: d.minimumSubtotal } } } : {}), ...(d.subscriptionsOnly ? { appliesOnSubscription: true, appliesOnOneTimePurchase: false } : { appliesOnSubscription: true, appliesOnOneTimePurchase: true }) };
        payload = (await gql(Q.discountAutomaticFreeShippingCreate, { freeShippingAutomaticDiscount: input })).discountAutomaticFreeShippingCreate;
      } else if (d.kind === 'giftOverAmount' || d.kind === 'giftWithVariants') {
        const buys = d.kind === 'giftOverAmount' ? { items: { products: { productsToAdd: resolve(d.buysProducts) } }, value: { amount: d.minimumAmount } } : { items: { products: { productVariantsToAdd: resolve(d.buysVariants) } }, value: { quantity: '1' } };
        const input = { title: d.title, startsAt, combinesWith, usesPerOrderLimit: '1', customerBuys: buys, customerGets: { items: { products: { productVariantsToAdd: [resolve(d.gift)] } }, value: { discountOnQuantity: { quantity: '1', effect: { percentage: 1 } } } } };
        payload = (await gql(Q.discountAutomaticBxgyCreate, { automaticBxgyDiscount: input })).discountAutomaticBxgyCreate;
      } else if (d.kind === 'amountOffProduct') {
        const input = { title: d.title, startsAt, combinesWith, customerGets: { items: { products: { productsToAdd: resolve(d.products) } }, value: { discountAmount: { amount: d.amountEach, appliesOnEachItem: true } } } };
        payload = (await gql(Q.discountAutomaticBasicCreate, { automaticBasicDiscount: input })).discountAutomaticBasicCreate;
      } else if (d.kind === 'percentOffQuantity') {
        const input = { title: d.title, startsAt, combinesWith: { orderDiscounts: true, shippingDiscounts: true }, minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(d.minimumQuantity) } }, customerGets: { items: { products: { productsToAdd: resolve(d.products) } }, value: { percentage: d.percentage / 100 } } };
        payload = (await gql(Q.discountAutomaticBasicCreate, { automaticBasicDiscount: input })).discountAutomaticBasicCreate;
      } else {
        throw new Error(`Unknown discount kind ${d.kind}`);
      }
      assertNoUserErrors(`discount ${d.title}`, payload);
      created(`discount ${d.title}`);
    }
  }

  return state;
}

function fieldDefinition(f) {
  return { key: f.key, name: f.name, type: f.type, ...(f.required ? { required: true } : {}), ...(f.description ? { description: f.description } : {}) };
}

function hasRef(value) {
  if (Array.isArray(value)) return value.some(hasRef);
  return Boolean(value && typeof value === 'object' && Object.keys(value).some((k) => k.startsWith('$')));
}
