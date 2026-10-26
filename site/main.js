// Entry module: applies site/config.js to the page, upgrades the buy links, runs the
// floating buy bar, and loads each interactive demo when it comes into view.
import config from './config.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const valueAt = (path) => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), config);
const isEmpty = (value) => value == null || value === false || (Array.isArray(value) && value.length === 0);

// ---------- Config values (owner figures, measured speed) ----------

for (const el of document.querySelectorAll('[data-owner]')) {
  const value = valueAt(el.dataset.owner);
  if (!isEmpty(value) && typeof value !== 'object') el.textContent = String(value);
}
for (const el of document.querySelectorAll('[data-owner-hide]')) el.hidden = isEmpty(valueAt(el.dataset.ownerHide));
for (const el of document.querySelectorAll('[data-owner-href]')) {
  const key = el.dataset.ownerHref;
  const value = valueAt(key);
  if (isEmpty(value)) el.removeAttribute('href');
  else el.href = key === 'supportEmail' ? `mailto:${value}` : value;
}
for (const el of document.querySelectorAll('[data-config]')) el.textContent = String(config[el.dataset.config]);
for (const el of document.querySelectorAll('[data-config-style]')) el.style.setProperty('--score', config[el.dataset.configStyle]);
if (typeof config.vsDawn === 'number' && config.vsDawn > 0) {
  for (const el of document.querySelectorAll('[data-vs-dawn]')) el.textContent = `${config.vsDawn} points faster than Dawn on the same demo product.`;
}

// ---------- Checkout links ----------
// The HTML links to each product page, so buying works without JS. With a variant ID set,
// the link becomes a cart permalink that skips straight to checkout.

for (const link of document.querySelectorAll('a[data-buy]')) {
  const key = link.dataset.buy;
  const variant = config.variants[key];
  link.href = variant ? `https://${config.store}/cart/${variant}:1` : `https://${config.store}/products/${config.handles[key]}`;
}
for (const link of document.querySelectorAll('a[data-store-link]')) {
  const url = new URL(link.href);
  url.host = config.store;
  link.href = url.href;
}

// ---------- Floating buy bar ----------
// Shown once the hero's buttons scroll away; out of the way while another buy button is on screen.

const bar = document.querySelector('[data-buybar]');
const watched = [document.querySelector('.hero'), document.querySelector('#pricing .plans'), document.querySelector('.final')].filter(Boolean);
if (bar && 'IntersectionObserver' in window) {
  const visible = new Set();
  bar.classList.add('is-away');
  bar.hidden = false;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    const away = visible.size > 0;
    bar.classList.toggle('is-away', away);
    bar.inert = away;
  });
  watched.forEach((el) => observer.observe(el));
}

// ---------- Demos, loaded on visibility ----------

const loaders = new Map();
function load(selector, path) {
  if (!loaders.has(selector)) {
    const el = document.querySelector(selector);
    loaders.set(selector, el ? import(path).then((module) => module.default(el, { config, reduceMotion })) : Promise.resolve(null));
  }
  return loaders.get(selector);
}
function onVisible(selector, path, margin = '300px') {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!('IntersectionObserver' in window)) return load(selector, path);
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      load(selector, path);
    }
  }, { rootMargin: `${margin} 0px` });
  io.observe(el);
}
onVisible('[data-tour]', './tour.js');
onVisible('[data-compare]', './compare.js');
onVisible('[data-editor]', './editor.js');
onVisible('[data-chat]', './chat.js', '0px');

// Store wall: a card loads its store into the tour above (the link itself jumps there).
document.addEventListener('click', (event) => {
  const card = event.target.closest('a[data-store]');
  if (!card) return;
  load('[data-tour]', './tour.js').then((tour) => tour?.select(card.dataset.store));
});

// Marquees: duplicate the chips so the loop is seamless, then start them while on screen.
if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      const track = target.querySelector('.marquee-track');
      for (const item of [...track.children]) {
        const copy = item.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        track.append(copy);
      }
      target.classList.add('is-running');
    }
  });
  document.querySelectorAll('.marquee').forEach((el) => io.observe(el));
}
