// Blueprint core: the only theme script on every page (keep it under 2 KB compressed).
//
// - (The "no-js" → "js" class swap happens inline in layout-head.liquid, before first paint.)
// - Loads feature modules on demand. An element marks the module it needs and when:
//     <div data-bp-module="{{ 'bp-x.js' | asset_url }}" data-bp-load="visible|interaction|idle">
//   Liquid supplies the asset URL, so module URLs stay versioned and cache-safe.
// - Keeps cart counts current when the cart changes (event "bp:cart:changed"), and opens
//   the cart drawer from the header's cart link (loading bp-cart.js first if needed).
// - Supports <button command="show-modal" commandfor="id"> where invoker commands aren't native.

const loaded = new Set();

export function loadModule(url) {
  if (!url || loaded.has(url)) return Promise.resolve();
  loaded.add(url);
  return import(url);
}

function schedule(el) {
  const url = el.dataset.bpModule;
  const when = el.dataset.bpLoad || 'visible';
  if (when === 'idle') {
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(() => loadModule(url));
  } else if (when === 'interaction') {
    const go = () => loadModule(url);
    for (const type of ['pointerenter', 'focusin', 'touchstart']) el.addEventListener(type, go, { once: true, passive: true });
  } else {
    visibility.observe(el);
  }
}

const visibility = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      visibility.unobserve(entry.target);
      loadModule(entry.target.dataset.bpModule);
    }
  },
  { rootMargin: '200px' },
);

function scan(scope = document) {
  scope.querySelectorAll('[data-bp-module]').forEach(schedule);
}

// Reveal on scroll, when the theme setting adds data-bp-reveal to sections.
const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.setAttribute('data-bp-reveal', 'in');
      reveal.unobserve(entry.target);
    }
  },
  { threshold: 0.12 },
);

function scanReveal(scope = document) {
  scope.querySelectorAll('[data-bp-reveal=""]').forEach((el) => reveal.observe(el));
}

// Cart count bubbles: [data-bp-cart-count] holds the number, empty when the cart is empty;
// [data-bp-cart-label] is the cart link's screen-reader text.
function setCartCount(count, label) {
  for (const el of document.querySelectorAll('[data-bp-cart-count]')) el.textContent = count > 0 ? String(count) : '';
  if (label) for (const el of document.querySelectorAll('[data-bp-cart-label]')) el.textContent = `${el.textContent.split(',')[0]}, ${label}`;
}

export async function refreshCartCount(cart) {
  const data = cart || (await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`).then((r) => r.json()));
  setCartCount(data.item_count);
}

// Runs fn with a <bp-cart> or <bp-cart-drawer> once bp-cart.js has defined it.
function withCart(selector, fn) {
  const el = document.querySelector(selector);
  if (!el) return false;
  if (!customElements.get(el.localName)) {
    loadModule((el.closest('[data-bp-module]') || el).dataset.bpModule)
      .then(() => customElements.whenDefined(el.localName))
      .then(() => fn(el));
  }
  return true;
}

document.addEventListener('bp:cart:changed', (event) => {
  if (event.detail?.cart) return setCartCount(event.detail.cart.item_count);
  // A cart on the page re-renders and reports the count (bp:cart:count); otherwise ask Shopify.
  if (!withCart('bp-cart', (cart) => cart.update(event.detail))) refreshCartCount().catch(() => {});
});

document.addEventListener('bp:cart:count', (event) => setCartCount(event.detail.count, event.detail.label));

document.addEventListener('bp:cart:open', (event) => {
  if (withCart('bp-cart-drawer', (drawer) => drawer.open()) && !customElements.get('bp-cart-drawer')) event.preventDefault();
});

// The header's cart link opens the drawer when there is one (it stays a real link otherwise).
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-bp-cart-link]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || !document.querySelector('bp-cart-drawer')) return;
  event.preventDefault();
  document.dispatchEvent(new CustomEvent('bp:cart:open', { cancelable: true }));
});

// Invoker commands fallback (command="show-modal" | "close" with commandfor="dialog-id").
if (!('command' in HTMLButtonElement.prototype)) {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[commandfor]');
    const dialog = button && document.getElementById(button.getAttribute('commandfor'));
    if (!(dialog instanceof HTMLDialogElement)) return;
    const command = button.getAttribute('command');
    if (command === 'show-modal') dialog.showModal();
    else if (command === 'close') dialog.close();
  });
}

scan();
scanReveal();

// Re-scan content the theme editor or the theme re-renders.
for (const type of ['shopify:section:load', 'bp:content:replaced']) {
  document.addEventListener(type, (event) => {
    scan(event.target);
    scanReveal(event.target);
  });
}
