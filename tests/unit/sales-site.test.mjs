// The static sales site (site/): checkout links, honest claims, the version badge and the
// owner-confirmed figures all agree with their sources of truth.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import config from '../../site/config.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('site/index.html');
const pkg = JSON.parse(read('package.json'));
const salesStore = JSON.parse(read('tools/sales/store.json'));
const textOf = (fragment) => fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, tag, inner]) => ({ tag, text: textOf(inner) }));

test('every Buy/Book link goes to the configured store product page', () => {
  const handles = salesStore.products.map((p) => p.handle);
  for (const handle of Object.values(config.handles)) assert.ok(handles.includes(handle), `${handle} is sold on the sales store`);
  const buyLinks = anchors.filter((a) => /^(Buy|Book|Have us set it up)\b/.test(a.text));
  assert.ok(buyLinks.length >= 8, 'the page has its buy buttons');
  for (const link of buyLinks) assert.ok(attr(link.tag, 'data-buy'), `"${link.text}" is a checkout link (data-buy)`);
  const used = new Set();
  for (const link of anchors.filter((a) => attr(a.tag, 'data-buy'))) {
    const key = attr(link.tag, 'data-buy');
    assert.ok(config.handles[key], `"${link.text}": known product key ${key}`);
    assert.equal(attr(link.tag, 'href'), `https://${config.store}/products/${config.handles[key]}`, `"${link.text}" works without JS`);
    used.add(key);
  }
  assert.deepEqual([...used].sort(), Object.keys(config.handles).sort(), 'all four licence products are on sale');
});

test('no Dawn-base claims and no unmeasured speed claims', () => {
  const files = ['site/index.html', 'site/tour.json', ...readdirSync(new URL('site/', root)).filter((f) => f.endsWith('.js')).map((f) => `site/${f}`)];
  for (const file of files) {
    const text = textOf(read(file));
    assert.doesNotMatch(text, /built on dawn|dawn is the base|based on dawn|on top of dawn|fork of dawn/i, `${file} claims a Dawn base`);
    assert.doesNotMatch(text, /11 points/i, `${file} prints the unmeasured "11 points"`);
    assert.doesNotMatch(text, /updater app/i, `${file}: the updater is a command, not an app`);
  }
  assert.match(textOf(html), /original code, not derived from Dawn/i, 'the FAQ answers the Dawn question');
  assert.equal(config.vsDawn === null || typeof config.vsDawn === 'number', true);
});

test('the version badge matches package.json', () => {
  const badge = /<span class="version"[^>]*>([^<]+)<\/span>/.exec(html)?.[1];
  assert.equal(badge, `v${pkg.version}`);
  assert.match(html, new RegExp(`v${pkg.version.replace(/\./g, '\\.')} live`));
});

test('one h1, and every landmark the page needs', () => {
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  for (const tag of ['<header', '<nav', '<main', '<footer']) assert.ok(html.includes(tag), tag);
  assert.match(html, /<html lang="en"/);
});

test('the HTML carries the same owner figures and measurements as site/config.js', () => {
  const valueAt = (path) => path.split('.').reduce((node, key) => node?.[key], config);
  const owned = [...html.matchAll(/<(\w+)\b([^>]*\sdata-owner="([^"]+)"[^>]*)>([^<]*)</g)];
  assert.ok(owned.length > 10);
  for (const [, , , path, text] of owned) {
    const value = valueAt(path);
    assert.notEqual(value, undefined, `config has ${path}`);
    if (value !== null) assert.equal(text.trim(), String(value), `data-owner="${path}"`);
  }
  for (const [, key, text] of html.matchAll(/data-config="(\w+)">([^<]*)</g)) assert.equal(text, String(config[key]), key);
});

test('every file the page and the tour reference exists', () => {
  const refs = [...html.matchAll(/\s(?:src|href)="([^"#:]+)"/g)].map(([, ref]) => ref);
  const tour = JSON.parse(read('site/tour.json'));
  for (const store of tour.stores) for (const page of Object.values(store.pages)) refs.push(page.d.src, page.m.src);
  for (const ref of refs) assert.ok(existsSync(new URL(`site/${ref}`, root)), `site/${ref}`);
});
