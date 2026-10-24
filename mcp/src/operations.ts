// Every Admin API operation the server can send. The client only runs documents from this
// list (by name), so nothing else can reach the store. Publishing or deleting a theme is not
// here and must never be: test/rails.test.mjs fails the build if either mutation name appears
// anywhere in the source or the compiled output.

export const OPERATIONS = {
  // ---------- Reads ----------
  Shop: `query Shop { shop { name myshopifyDomain currencyCode } }`,
  Themes: `query Themes {
    themes(first: 50) { nodes { id name role processing updatedAt } }
  }`,
  Theme: `query Theme($id: ID!) {
    theme(id: $id) { id name role processing processingFailed }
  }`,
  ThemeFiles: `query ThemeFiles($id: ID!, $filenames: [String!]!) {
    theme(id: $id) {
      id
      role
      files(filenames: $filenames, first: 250) {
        nodes {
          filename
          checksumMd5
          size
          body {
            ... on OnlineStoreThemeFileBodyText { content }
          }
        }
      }
    }
  }`,
  Products: `query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        productType
        status
        priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
        variants(first: 100) { nodes { id title price compareAtPrice availableForSale } }
      }
    }
  }`,
  ProductByHandle: `query ProductByHandle($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      legacyResourceId
      handle
      title
      onlineStoreUrl
    }
  }`,
  ProductMetafields: `query ProductMetafields($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      handle
      title
      metafields(first: 100) {
        nodes {
          namespace
          key
          type
          value
          reference { ... on Metaobject { type handle fields { key value } } }
          references(first: 50) { nodes { ... on Metaobject { type handle fields { key value } } } }
        }
      }
    }
  }`,
  Pages: `query Pages($query: String!) {
    pages(first: 10, query: $query) { nodes { id handle title isPublished templateSuffix } }
  }`,
  MetaobjectDefinitionByType: `query MetaobjectDefinitionByType($type: String!) {
    metaobjectDefinitionByType(type: $type) { id type fieldDefinitions { key } }
  }`,
  MetafieldDefinitions: `query MetafieldDefinitions($ownerType: MetafieldOwnerType!, $namespace: String!) {
    metafieldDefinitions(first: 100, ownerType: $ownerType, namespace: $namespace) { nodes { id key } }
  }`,

  // ---------- Writes to draft themes (guarded by rails.ts) ----------
  ThemeDuplicate: `mutation ThemeDuplicate($id: ID!, $name: String!) {
    themeDuplicate(id: $id, name: $name) {
      newTheme { id name role processing }
      userErrors { field message code }
    }
  }`,
  ThemeFilesUpsert: `mutation ThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles { filename checksumMd5 }
      userErrors { filename code message }
    }
  }`,
  ThemeFilesDelete: `mutation ThemeFilesDelete($themeId: ID!, $files: [String!]!) {
    themeFilesDelete(themeId: $themeId, files: $files) {
      deletedThemeFiles { filename }
      userErrors { filename code message }
    }
  }`,

  // ---------- Live-store writes (explicit confirmation; see tools) ----------
  PageCreate: `mutation PageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) { page { id handle title isPublished templateSuffix } userErrors { field message code } }
  }`,
  MetaobjectDefinitionCreate: `mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id type } userErrors { field message code } }
  }`,
  MetaobjectDefinitionUpdate: `mutation MetaobjectDefinitionUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) { metaobjectDefinition { id } userErrors { field message code } }
  }`,
  MetafieldDefinitionCreate: `mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) { createdDefinition { id key } userErrors { field message code } }
  }`,
  StandardMetafieldDefinitionEnable: `mutation StandardMetafieldDefinitionEnable($ownerType: MetafieldOwnerType!, $namespace: String!, $key: String!) {
    standardMetafieldDefinitionEnable(ownerType: $ownerType, namespace: $namespace, key: $key) { createdDefinition { id } userErrors { field message code } }
  }`,
} as const;

export type OperationName = keyof typeof OPERATIONS;

// Operations that change the store. Everything else is a read.
export const WRITE_OPERATIONS: ReadonlySet<OperationName> = new Set<OperationName>([
  'ThemeDuplicate',
  'ThemeFilesUpsert',
  'ThemeFilesDelete',
  'PageCreate',
  'MetaobjectDefinitionCreate',
  'MetaobjectDefinitionUpdate',
  'MetafieldDefinitionCreate',
  'StandardMetafieldDefinitionEnable',
]);
