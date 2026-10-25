#!/usr/bin/env node
// Validates every Admin API call the seed makes (and the updater's operations) against Shopify's published Admin GraphQL
// schema: the operation documents, and the actual variables a seed of each demo store sends.
//
// The schema comes from shopify.dev's public schema proxy (the one its GraphiQL uses) and is
// cached in tools/demo/.cache/. Each store is seeded against the in-memory fake admin, then
// every recorded call is checked with graphql-js.
//
//   cd tools/demo && npm install && node validate-operations.mjs [--refresh]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildClientSchema, getIntrospectionQuery, parse, validate } from 'graphql';
import { getVariableValues } from 'graphql/execution/values.js';
import { API_VERSION } from './admin.mjs';
import { fakeAdmin } from './fake-admin.mjs';
import { seed } from './seed.mjs';
import { OPERATIONS as UPDATER } from '../update/updater.mjs';

const here = new URL('./', import.meta.url);
const cache = new URL(`.cache/admin-${API_VERSION}.json`, here);

async function schema() {
  if (!existsSync(cache) || process.argv.includes('--refresh')) {
    const response = await fetch(`https://shopify.dev/admin-graphql-direct-proxy/${API_VERSION}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: getIntrospectionQuery({ inputValueDeprecation: true }) }),
    });
    if (!response.ok) throw new Error(`Schema download failed: ${response.status}`);
    mkdirSync(new URL('.cache/', here), { recursive: true });
    writeFileSync(cache, await response.text());
  }
  return buildClientSchema(JSON.parse(readFileSync(cache, 'utf8')).data);
}

const admin = await schema();
const problems = [];
let checked = 0;
const seen = new Set();
for (const store of ['verde', 'ode', 'rawform', 'omni', 'kindly', 'dreamr', 'goodboy', 'kindling', 'allele', 'stillwater']) {
  const config = JSON.parse(readFileSync(new URL(`stores/${store}.json`, here), 'utf8'));
  const fake = fakeAdmin();
  await seed(config, fake.gql, { renderImage: fake.renderImage, upload: fake.upload, log: () => {} });
  // And an image refresh (--refresh-images), which replaces files in place.
  await seed(config, fake.gql, { renderImage: fake.renderImage, upload: fake.upload, log: () => {}, steps: ['files'], refreshImages: true });
  for (const call of fake.calls) {
    const doc = parse(call.query);
    if (!seen.has(call.operation)) {
      seen.add(call.operation);
      for (const error of validate(admin, doc)) problems.push(`${call.operation}: ${error.message}`);
    }
    const definition = doc.definitions[0];
    const { errors } = getVariableValues(admin, definition.variableDefinitions ?? [], call.variables);
    for (const error of errors ?? []) problems.push(`${store} ${call.operation}: ${error.message}`);
    checked += 1;
  }
}

// The updater's operations (tools/update/updater.mjs), documents only.
for (const [name, doc] of Object.entries(UPDATER)) {
  for (const error of validate(admin, parse(doc))) problems.push(`updater ${name}: ${error.message}`);
  seen.add(`updater:${name}`);
}

for (const p of [...new Set(problems)]) console.log(`✗ ${p}`);
console.log(`${seen.size} operations and ${checked} calls checked against Admin API ${API_VERSION}: ${problems.length ? `${new Set(problems).size} problems` : 'all valid'}`);
process.exit(problems.length ? 1 : 0);
