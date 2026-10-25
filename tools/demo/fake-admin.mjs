// An in-memory stand-in for the Admin API, for `seed-demo --dry-run` and the unit tests.
//
// It answers the seed's own named operations (tools/demo/seed.mjs) the way a store would:
// lookups find what earlier calls created, so a second run shows what an idempotent re-seed
// does. Every call is recorded as { operation, variables } for inspection and for schema
// validation (tools/demo/validate-operations.mjs).

export function fakeAdmin({ shop = 'demo.myshopify.com', currencyCode = 'USD' } = {}) {
  let next = 1;
  const gid = (type) => `gid://shopify/${type}/${next++}`;
  const db = { metaobjectDefinitions: [], metafieldDefinitions: [], files: [], collections: [], products: [], metaobjects: [], sellingPlanGroups: [], pages: [], menus: [{ id: gid('Menu'), handle: 'main-menu' }, { id: gid('Menu'), handle: 'footer' }], discounts: [], published: new Set(), stock: {} };
  const calls = [];
  const ok = (payload) => ({ ...payload, userErrors: [] });

  const handlers = {
    BpShop: () => ({
      shop: { name: 'Dry run', currencyCode, myshopifyDomain: shop },
      locations: { nodes: [{ id: 'gid://shopify/Location/2', name: 'My Custom Location', isActive: true, fulfillsOnlineOrders: true, shipsInventory: false }, { id: 'gid://shopify/Location/1', name: 'Shop location', isActive: true, fulfillsOnlineOrders: true, shipsInventory: true }] },
      publications: { nodes: [{ id: 'gid://shopify/Publication/1', catalog: { title: 'Online Store' } }] },
    }),
    BpMetaobjectDefinition: ({ type }) => ({ metaobjectDefinitionByType: db.metaobjectDefinitions.find((d) => d.type === type) ?? null }),
    BpMetaobjectDefinitionCreate: ({ definition }) => {
      const d = { id: gid('MetaobjectDefinition'), type: definition.type, fieldDefinitions: definition.fieldDefinitions.map((f) => ({ key: f.key })) };
      db.metaobjectDefinitions.push(d);
      return { metaobjectDefinitionCreate: ok({ metaobjectDefinition: d }) };
    },
    BpMetaobjectDefinitionUpdate: ({ id, definition }) => {
      const d = db.metaobjectDefinitions.find((x) => x.id === id);
      for (const op of definition.fieldDefinitions ?? []) if (op.create) d.fieldDefinitions.push({ key: op.create.key });
      return { metaobjectDefinitionUpdate: ok({ metaobjectDefinition: { id } }) };
    },
    BpMetafieldDefinitions: ({ ownerType, namespace }) => ({ metafieldDefinitions: { nodes: db.metafieldDefinitions.filter((d) => d.ownerType === ownerType && d.namespace === namespace) } }),
    BpMetafieldDefinitionCreate: ({ definition }) => {
      const d = { id: gid('MetafieldDefinition'), ...definition };
      db.metafieldDefinitions.push(d);
      return { metafieldDefinitionCreate: ok({ createdDefinition: { id: d.id, key: d.key } }) };
    },
    BpStandardMetafieldEnable: ({ ownerType, namespace, key }) => {
      const d = { id: gid('MetafieldDefinition'), ownerType, namespace, key };
      db.metafieldDefinitions.push(d);
      return { standardMetafieldDefinitionEnable: ok({ createdDefinition: { id: d.id } }) };
    },
    BpFiles: ({ query }) => {
      const name = /filename:'([^']+)'/.exec(query)?.[1];
      return { files: { nodes: db.files.filter((f) => f.filename === name).map((f) => ({ id: f.id, fileStatus: 'READY', image: { url: `https://cdn.shopify.com/s/files/1/0/files/${f.filename}?v=1` } })) } };
    },
    BpStagedUploads: ({ input }) => ({ stagedUploadsCreate: ok({ stagedTargets: input.map((i) => ({ url: 'https://shopify-staged-uploads.storage.googleapis.com/', resourceUrl: `https://shopify-staged-uploads.storage.googleapis.com/tmp/${i.filename}`, parameters: [{ name: 'key', value: `tmp/${i.filename}` }] })) }) }),
    BpFileUpdate: ({ files }) => {
      for (const f of files) {
        const file = db.files.find((x) => x.id === f.id);
        if (!file) throw new Error(`fileUpdate: no file ${f.id}`);
        file.source = f.originalSource;
      }
      return { fileUpdate: ok({ files: files.map((f) => ({ id: f.id, fileStatus: 'UPLOADED' })) }) };
    },
    BpFileCreate: ({ files }) => {
      const created = files.map((f) => {
        const file = { id: gid('MediaImage'), filename: f.filename };
        db.files.push(file);
        return { id: file.id, fileStatus: 'UPLOADED' };
      });
      return { fileCreate: ok({ files: created }) };
    },
    BpCollection: ({ handle }) => ({ collectionByIdentifier: db.collections.find((c) => c.handle === handle) ?? null }),
    BpCollectionCreate: ({ input }) => {
      const c = { id: gid('Collection'), handle: input.handle };
      db.collections.push(c);
      return { collectionCreate: ok({ collection: c }) };
    },
    BpCollectionUpdate: ({ input }) => ({ collectionUpdate: ok({ collection: db.collections.find((c) => c.id === input.id) }) }),
    BpProduct: ({ handle }) => ({ productByIdentifier: view(db.products.find((p) => p.handle === handle)) }),
    BpProductSet: ({ identifier, input }) => {
      let product = db.products.find((p) => p.handle === identifier.handle);
      if (!product) {
        product = { id: gid('Product'), handle: input.handle, variants: [] };
        db.products.push(product);
      }
      // Variants keep their IDs across runs when their options match (as productSet does).
      product.variants = input.variants.map((v) => {
        const options = v.optionValues.map((o) => ({ name: o.optionName, value: o.name }));
        const same = product.variants.find((x) => JSON.stringify(x.selectedOptions) === JSON.stringify(options));
        return { id: same?.id ?? gid('ProductVariant'), selectedOptions: options, inventoryItem: same?.inventoryItem ?? { id: gid('InventoryItem'), tracked: v.inventoryItem?.tracked ?? true } };
      });
      product.input = input;
      // productSet replaces the product's metafield list when it's given one (as Shopify does).
      if (input.metafields) product.metafields = Object.fromEntries(input.metafields.map((m) => [`${m.namespace}.${m.key}`, m.value]));
      return { productSet: ok({ product: view(product) }) };
    },
    BpInventoryActivate: ({ item, location }) => {
      db.stock[`${item}@${location}`] ??= 0;
      return { inventoryActivate: ok({ inventoryLevel: { id: gid('InventoryLevel') } }) };
    },
    BpInventorySet: ({ input }) => {
      for (const q of input.quantities) {
        if (!(`${q.inventoryItemId}@${q.locationId}` in db.stock)) return { inventorySetQuantities: { inventoryAdjustmentGroup: null, userErrors: [{ field: ['input'], message: 'not stocked at location', code: 'ITEM_NOT_STOCKED_AT_LOCATION' }] } };
        if (q.changeFromQuantity === undefined) throw new Error('changeFromQuantity is required from 2026-04');
        db.stock[`${q.inventoryItemId}@${q.locationId}`] = q.quantity;
      }
      return { inventorySetQuantities: ok({ inventoryAdjustmentGroup: { id: gid('InventoryAdjustmentGroup') } }) };
    },
    BpMetaobjectUpsert: ({ handle, metaobject }) => {
      let mo = db.metaobjects.find((m) => m.type === handle.type && m.handle === handle.handle);
      if (!mo) {
        mo = { id: gid('Metaobject'), ...handle };
        db.metaobjects.push(mo);
      }
      mo.fields = metaobject.fields;
      return { metaobjectUpsert: ok({ metaobject: { id: mo.id, handle: mo.handle } }) };
    },
    BpMetafieldsSet: ({ metafields }) => {
      for (const m of metafields) {
        const product = db.products.find((p) => p.id === m.ownerId);
        if (product) (product.metafields ??= {})[`${m.namespace}.${m.key}`] = m.value;
      }
      return { metafieldsSet: ok({ metafields: metafields.map((m) => ({ id: gid('Metafield'), key: m.key })) }) };
    },
    BpProductPlans: ({ id }) => ({ product: { sellingPlanGroups: { nodes: db.sellingPlanGroups.filter((g) => g.productIds.includes(id)) } } }),
    BpSellingPlanGroupCreate: ({ input, resources }) => {
      const g = { id: gid('SellingPlanGroup'), merchantCode: input.merchantCode, productIds: resources.productIds };
      db.sellingPlanGroups.push(g);
      return { sellingPlanGroupCreate: ok({ sellingPlanGroup: { id: g.id } }) };
    },
    BpPublish: ({ id }) => {
      db.published.add(id);
      return { publishablePublish: ok({}) };
    },
    BpPages: ({ query }) => ({ pages: { nodes: db.pages.filter((p) => p.handle === /handle:(\S+)/.exec(query)?.[1]) } }),
    BpPageCreate: ({ page }) => {
      const p = { id: gid('Page'), handle: page.handle };
      db.pages.push(p);
      return { pageCreate: ok({ page: p }) };
    },
    BpPageUpdate: ({ id }) => ({ pageUpdate: ok({ page: db.pages.find((p) => p.id === id) }) }),
    BpMenus: () => ({ menus: { nodes: db.menus } }),
    BpMenuCreate: ({ handle }) => {
      const m = { id: gid('Menu'), handle };
      db.menus.push(m);
      return { menuCreate: ok({ menu: m }) };
    },
    BpMenuUpdate: ({ id }) => ({ menuUpdate: ok({ menu: db.menus.find((m) => m.id === id) }) }),
    BpDiscounts: () => ({ discountNodes: { nodes: db.discounts.map((d) => ({ id: d.id, discount: { __typename: d.typename, title: d.title } })) } }),
    BpDiscountBasic: ({ automaticBasicDiscount }) => discount('DiscountAutomaticBasic', automaticBasicDiscount, 'discountAutomaticBasicCreate'),
    BpDiscountBxgy: ({ automaticBxgyDiscount }) => discount('DiscountAutomaticBxgy', automaticBxgyDiscount, 'discountAutomaticBxgyCreate'),
    BpDiscountFreeShipping: ({ freeShippingAutomaticDiscount }) => discount('DiscountAutomaticFreeShipping', freeShippingAutomaticDiscount, 'discountAutomaticFreeShippingCreate'),
  };

  function view(product) {
    return product ? { id: product.id, handle: product.handle, variants: { nodes: product.variants } } : null;
  }
  function discount(typename, input, field) {
    const d = { id: gid('DiscountAutomaticNode'), typename, title: input.title, input };
    db.discounts.push(d);
    return { [field]: ok({ automaticDiscountNode: { id: d.id } }) };
  }

  async function gql(query, variables = {}) {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
    const handler = handlers[operation];
    if (!handler) throw new Error(`fake-admin: no handler for ${operation}`);
    calls.push({ operation, query, variables: structuredClone(variables) });
    return handler(variables);
  }

  return { gql, calls, db, upload: async () => {}, renderImage: async (file) => Buffer.from(`png:${file.filename}`) };
}
