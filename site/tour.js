// Demo-store tour: store and page pills swap the desktop and phone screenshots captured by
// tools/sales/capture.mjs (manifest: tour.json). Auto-tours the stores while on screen,
// until the visitor touches it; never under prefers-reduced-motion.
const PAGE_NAMES = { product: 'product page', home: 'home page', advertorial: 'advertorial', listicle: 'listicle', collection: 'collection page', cart: 'cart drawer' };
const TOUR_INTERVAL = 6000;

const titleCase = (brand) => brand.charAt(0) + brand.slice(1).toLowerCase();

export default async function init(root, { config, reduceMotion }) {
  const response = await fetch(new URL('tour.json', import.meta.url));
  if (!response.ok) return null;
  const data = await response.json();
  const stores = new Map(data.stores.map((store) => [store.id, store]));
  const $ = (selector) => root.querySelector(selector);
  const storePills = [...root.querySelectorAll('[data-store]')];
  const pagePills = [...root.querySelectorAll('[data-page]')];
  const view = $('[data-tour-view]');
  const phone = $('[data-tour-phone]');
  const imgD = $('[data-tour-img="d"]');
  const imgM = $('[data-tour-img="m"]');
  const chips = $('[data-tour-chips]');
  const status = $('[data-tour-status]');
  const pagesNote = $('[data-tour-pages-note]');
  const liveLink = $('[data-tour-live-link]');
  const announcer = $('[data-tour-live]');
  const state = { store: 'verde', page: 'product' };
  const behavior = () => (reduceMotion.matches ? 'auto' : 'smooth');

  function render(announce = false) {
    const store = stores.get(state.store);
    if (!store) return;
    // A store the preview can only show as a home page keeps the visitor's page choice for later.
    const pageId = store.pages[state.page] ? state.page : Object.keys(store.pages)[0];
    const page = store.pages[pageId];
    const name = titleCase(store.brand);

    for (const pill of storePills) pill.setAttribute('aria-pressed', String(pill.dataset.store === store.id));
    for (const pill of pagePills) {
      pill.setAttribute('aria-pressed', String(pill.dataset.page === pageId));
      pill.disabled = !store.pages[pill.dataset.page];
    }
    pagesNote.hidden = Object.keys(store.pages).length > 1;

    for (const [img, shot, where] of [[imgD, page.d, 'on desktop'], [imgM, page.m, 'on a phone']]) {
      img.width = shot.w;
      img.height = shot.h;
      img.src = shot.src;
      img.alt = `${name} demo store, ${PAGE_NAMES[pageId]} ${where}`;
    }
    view.scrollTop = 0;
    phone.scrollTop = 0;

    $('[data-tour-url]').textContent = `${store.domain}${page.path}`;
    $('[data-tour-template]').textContent = page.title;
    $('[data-tour-preset]').textContent = `${store.preset} preset`;
    $('[data-tour-vibe]').textContent = store.vibe;

    const sections = page.sections ?? [];
    $('[data-tour-sections-wrap]').hidden = sections.length === 0;
    $('[data-tour-count]').textContent = `${sections.length} sections`;
    chips.replaceChildren(
      ...sections.map(({ label, at }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip-btn';
        button.dataset.at = at;
        button.textContent = label;
        return button;
      }),
    );

    const live = config.demoStores?.[store.id];
    liveLink.hidden = !live;
    if (live) liveLink.href = new URL(page.path, live).href;
    if (announce) announcer.textContent = `${name}, ${PAGE_NAMES[pageId]}`;
  }

  // ---------- Auto-tour ----------
  let timer = null;
  let stopped = reduceMotion.matches;
  const order = [...stores.keys()];
  function stop() {
    stopped = true;
    clearInterval(timer);
    timer = null;
    status.hidden = true;
  }
  function start() {
    if (stopped || timer) return;
    status.hidden = false;
    timer = setInterval(() => {
      state.store = order[(order.indexOf(state.store) + 1) % order.length];
      render();
    }, TOUR_INTERVAL);
  }
  function pause() {
    clearInterval(timer);
    timer = null;
  }
  $('[data-tour-stop]').addEventListener('click', stop);
  root.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('[data-tour-stop]')) stop();
  });
  root.addEventListener('keydown', stop);
  root.addEventListener('wheel', stop, { passive: true });
  root.addEventListener('touchstart', stop, { passive: true });
  reduceMotion.addEventListener?.('change', () => reduceMotion.matches && stop());
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : pause()), { threshold: 0.35 }).observe($('.tour-stage'));

  // ---------- Controls ----------
  root.addEventListener('click', (event) => {
    const storePill = event.target.closest('button[data-store]');
    const pagePill = event.target.closest('button[data-page]');
    const chip = event.target.closest('[data-at]');
    if (storePill) {
      state.store = storePill.dataset.store;
      render(true);
    } else if (pagePill && !pagePill.disabled) {
      state.page = pagePill.dataset.page;
      render(true);
    } else if (chip) {
      // Positions are measured on the desktop capture, so only the desktop frame jumps.
      view.scrollTo({ top: Number(chip.dataset.at) * view.scrollHeight, behavior: behavior() });
    }
  });

  render();
  return {
    select(id) {
      if (!stores.has(id)) return;
      stop();
      state.store = id;
      render(true);
    },
  };
}
