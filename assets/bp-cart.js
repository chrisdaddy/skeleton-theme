// Cart drawer and cart page behaviour (docs/PLAN.md §8).
//
// Without this file the cart page still works: every control in
// snippets/cart-contents.liquid is a real form. This module:
// - opens the drawer (<bp-cart-drawer>, a modal <dialog>) instead of leaving the page,
// - sends those same forms with fetch and swaps the cart markup in place
//   (Section Rendering API, one request per interaction),
// - folds quick stepper presses into one request (300 ms),
// - keeps reward gifts, tier gifts and shipping protection in step with the cart
//   (reconcile(), below; a follow-up request when something changes, and one more when a
//   gift it added comes back charged),
// - announces updates in a polite live region and errors in role=alert.

const routesRoot = () => window.Shopify?.routes?.root || '/';
const MEMORY_KEY = 'bp-cart-memory';

// What the shopper has decided this session, so the theme never overrides it:
// declined reward gifts, a protection choice, and in-cart deals seen not to apply. Also the
// gifts the theme took out because Shopify charged for them (with the cart they applied to).
const EMPTY_MEMORY = { declined: [], protectionTouched: false, dealMissed: [], withdrawn: [] };
const memory = {
  read() {
    try {
      return { ...EMPTY_MEMORY, ...JSON.parse(sessionStorage.getItem(MEMORY_KEY)) };
    } catch {
      return { ...EMPTY_MEMORY };
    }
  },
  update(change) {
    const next = { ...memory.read(), ...change(memory.read()) };
    try {
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify(next));
    } catch {
      // Private mode: decisions last until the next page load.
    }
    return next;
  },
};

/**
 * The cart's merchandise (no gifts or protection) as a string: a withdrawn gift is retried
 * only once this changes.
 * @param {object} state - From snippets/cart-state.liquid
 */
export function merchSignature(state) {
  return state.items
    .filter((i) => !i.gift && i.id !== state.protection)
    .map((i) => `${i.id}x${i.quantity}`)
    .sort()
    .join(',');
}

/**
 * Works out which gift and protection lines to add or remove. Pure, so it's unit-tested.
 *
 * - A reward gift is added when its threshold is reached (unless the shopper removed it
 *   this session) and removed when the cart drops below it.
 * - A tier gift is removed when the bundle it came with leaves the cart.
 * - A gift Shopify charges for is taken out (withdrawn): gifts are offered as free, and the
 *   store's discounts decide. Two Buy X Get Y gifts can't both come from one product, and a
 *   gift without its discount is never free. A withdrawn reward isn't added again until the
 *   merchandise changes.
 * - Protection is removed from a cart with no merchandise; when the merchant's default is
 *   on, it's added once, and never again once the shopper has touched it.
 *
 * @param {object} state - From snippets/cart-state.liquid
 * @param {{declined?: number[], protectionTouched?: boolean, withdrawn?: object[]}} [choices]
 * @returns {{add: object[], remove: string[], protectionAdded: boolean, withdrawn: object[]}}
 */
export function reconcile(state, choices = {}) {
  const declined = choices.declined || [];
  const add = [];
  const remove = new Set();
  const withdrawn = [];
  const hasMerch = state.merch > 0;
  const merchIds = new Set(state.items.filter((i) => !i.gift && i.id !== state.protection).map((i) => i.id));
  const rewards = state.rewards || [];
  const signature = merchSignature(state);
  const held = (gift, ref) => (choices.withdrawn || []).some((w) => w.gift === gift && w.ref === ref && w.sig === signature);
  const withdraw = (item, gift, ref) => {
    remove.add(item.key);
    withdrawn.push({ gift, ref, title: item.title || '' });
  };

  for (const reward of rewards) {
    const lines = state.items.filter((i) => i.gift === 'reward' && i.reward === reward.index);
    const earned = reward.threshold > 0 && hasMerch && state.basis >= reward.threshold;
    if (!earned || !reward.gift) lines.forEach((l) => remove.add(l.key));
    else if (lines.some((l) => l.price > 0)) lines.forEach((l) => withdraw(l, 'reward', reward.index));
    else if (!lines.length && !declined.includes(reward.index) && !held('reward', reward.index)) {
      add.push({ id: reward.gift, quantity: 1, properties: { _bp_gift: 'reward', _bp_reward: String(reward.index) } });
    }
  }
  const known = new Set(rewards.map((r) => r.index));
  for (const item of state.items) {
    if (item.gift === 'reward' && !known.has(item.reward)) remove.add(item.key);
    if (item.gift === 'tier' && item.for && !merchIds.has(item.for)) remove.add(item.key);
    else if (item.gift === 'tier' && item.price > 0) withdraw(item, 'tier', item.for);
  }

  let protectionAdded = false;
  if (state.protection) {
    const line = state.items.find((i) => i.id === state.protection);
    if (line && !hasMerch) remove.add(line.key);
    if (!line && hasMerch && state.protectionDefault && !choices.protectionTouched) {
      add.push({ id: state.protection, quantity: 1 });
      protectionAdded = true;
    }
  }
  return { add, remove: [...remove], protectionAdded, withdrawn };
}

if (globalThis.customElements) {
  class BpCart extends HTMLElement {
    connectedCallback() {
      this.queue = Promise.resolve();
      this.pending = new Map();
      this.timers = new Map();
      this.addEventListener('submit', this.onSubmit);
      document.addEventListener('bp:cart:changed', this.onExternalChange);
      this.applyMemory();
    }

    disconnectedCallback() {
      document.removeEventListener('bp:cart:changed', this.onExternalChange);
    }

    get state() {
      try {
        return JSON.parse(this.querySelector('[data-bp-cart-state]').textContent);
      } catch {
        return null;
      }
    }

    onSubmit = (event) => {
      const form = event.target;
      const data = new FormData(form);
      if (form.matches('[data-bp-cart-change]')) {
        event.preventDefault();
        const key = data.get('id');
        const step = Number(event.submitter?.dataset.bpStep || 0);
        if (step) return this.step(form.closest('[data-bp-line]'), key, step);
        if (form.matches('[data-bp-protection]')) memory.update(() => ({ protectionTouched: true }));
        this.noteRemoval(key);
        this.enqueue('cart/change.js', { id: key, quantity: Number(data.get('quantity')) });
      } else if (form.matches('[data-bp-cart-add]')) {
        event.preventDefault();
        const properties = {};
        for (const [name, value] of data) {
          const match = /^properties\[(.+)\]$/.exec(name);
          if (match) properties[match[1]] = value;
        }
        if (form.matches('[data-bp-protection]')) memory.update(() => ({ protectionTouched: true }));
        if (properties._bp_reward) memory.update((m) => ({ declined: m.declined.filter((n) => n !== Number(properties._bp_reward)) }));
        const item = { id: Number(data.get('id')), quantity: Number(data.get('quantity') || 1), properties };
        this.enqueue('cart/add.js', { items: [item] }, { upsell: form.dataset.bpUpsell });
      }
    };

    // Stepper presses update the number at once and send one request after a pause.
    step(line, key, delta) {
      const value = line?.querySelector('[data-bp-qty]');
      const current = this.pending.get(key) ?? Number(value?.textContent || 0);
      const next = Math.max(0, current + delta);
      this.pending.set(key, next);
      if (value) value.textContent = String(next);
      clearTimeout(this.timers.get(key));
      this.timers.set(
        key,
        setTimeout(() => {
          const quantity = this.pending.get(key);
          this.pending.delete(key);
          if (quantity === 0) this.noteRemoval(key);
          this.enqueue('cart/change.js', { id: key, quantity });
        }, 300),
      );
    }

    // A shopper removing a reward gift declines it for this session.
    noteRemoval(key) {
      const line = this.state?.items.find((i) => i.key === key);
      if (line?.gift === 'reward') memory.update((m) => ({ declined: [...new Set([...m.declined, line.reward])] }));
    }

    enqueue(path, body, options = {}) {
      this.queue = this.queue.then(() => this.run(path, body, options));
      this.updating = this.queue;
      return this.queue;
    }

    async run(path, body, options) {
      this.setAttribute('aria-busy', 'true');
      this.showError('');
      try {
        await this.render(await this.post(path, body));
        await this.reconcile();
        if (options.upsell) this.checkDeal(Number(options.upsell));
        this.announce();
        document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'cart' } }));
      } catch {
        this.showError(this.dataset.errorMessage);
        // A failed request may still have changed the cart: show what's really there.
        await this.refresh().catch(() => {});
      } finally {
        this.removeAttribute('aria-busy');
      }
    }

    async post(path, body) {
      const response = await fetch(`${routesRoot()}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, sections: this.dataset.sectionId, sections_url: this.dataset.sectionUrl }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.description || json.message || String(response.status));
      return json.sections || null;
    }

    async refresh() {
      const url = new URL(this.dataset.sectionUrl || routesRoot(), window.location.href);
      url.searchParams.set('sections', this.dataset.sectionId);
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      await this.render(await response.json(), false);
    }

    // Swaps in fresh markup, keeping focus on the same control when it still exists.
    async render(sections, refetch = true) {
      const html = sections?.[this.dataset.sectionId];
      if (!html) {
        if (refetch) await this.refresh();
        return;
      }
      const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-bp-cart-region]');
      const region = this.querySelector('[data-bp-cart-region]');
      if (!fresh || !region) return;
      const focused = region.contains(document.activeElement) ? document.activeElement : null;
      const focusKey = focused?.dataset.bpFocus;
      region.replaceWith(fresh);
      this.pending.forEach((quantity, key) => {
        const value = this.querySelector(`[data-bp-line="${CSS.escape(key)}"] [data-bp-qty]`);
        if (value) value.textContent = String(quantity);
      });
      this.applyMemory();
      if (focused) {
        const target = (focusKey && this.querySelector(`[data-bp-focus="${CSS.escape(focusKey)}"]`)) || this.querySelector('[data-bp-cart-heading]');
        target?.focus({ preventScroll: Boolean(focusKey) });
      }
      const state = this.state;
      if (state) document.dispatchEvent(new CustomEvent('bp:cart:count', { detail: { count: state.count, label: state.countLabel } }));
    }

    // Two passes at most: the second only when the first changed the cart, so a gift it added
    // that Shopify prices is taken out straight away.
    async reconcile() {
      for (let pass = 0; pass < 2; pass++) {
        const state = this.state;
        if (!state) return;
        const plan = reconcile(state, memory.read());
        if (plan.protectionAdded) memory.update(() => ({ protectionTouched: true }));
        if (plan.withdrawn.length) {
          const sig = merchSignature(state);
          memory.update((m) => ({
            withdrawn: [...m.withdrawn.filter((w) => w.sig === sig && !plan.withdrawn.some((n) => n.gift === w.gift && n.ref === w.ref)), ...plan.withdrawn.map((w) => ({ ...w, sig }))],
          }));
          this.applyMemory();
        }
        if (!plan.remove.length && !plan.add.length) return;
        try {
          if (plan.remove.length) await this.render(await this.post('cart/update.js', { updates: Object.fromEntries(plan.remove.map((key) => [key, 0])) }));
          if (plan.add.length) await this.render(await this.post('cart/add.js', { items: plan.add }));
        } catch {
          // A gift that can't be added (sold out, say) never blocks the cart.
          await this.refresh().catch(() => {});
          return;
        }
      }
    }

    // Purchases, apps and Standard Actions change the cart elsewhere: re-render from their result.
    update(detail = {}) {
      this.updating = this.queue = this.queue.then(async () => {
        try {
          await this.render(detail.sections);
          await this.reconcile();
          this.announce();
        } catch {
          await this.refresh().catch(() => {});
        }
      });
      return this.updating;
    }

    onExternalChange = (event) => {
      if (event.detail?.source !== 'cart') this.update(event.detail);
    };

    // An in-cart deal label hides once the deal is seen not to apply.
    checkDeal(variantId) {
      const line = this.state?.items.find((i) => i.id === variantId);
      if (line && !line.discounted) memory.update((m) => ({ dealMissed: [...new Set([...m.dealMissed, variantId])] }));
      this.applyMemory();
    }

    applyMemory() {
      const { dealMissed, withdrawn } = memory.read();
      this.querySelectorAll('[data-bp-deal-for]').forEach((el) => {
        el.hidden = dealMissed.includes(Number(el.dataset.bpDealFor));
      });
      // Gifts taken out for this cart: no claim button, and a note saying why.
      const state = this.state;
      const current = state ? withdrawn.filter((w) => w.sig === merchSignature(state)) : [];
      this.querySelectorAll('[data-bp-gift-claim]').forEach((form) => {
        form.hidden = current.some((w) => `${w.gift}-${w.ref}` === form.dataset.bpGiftClaim);
      });
      const note = this.querySelector('[data-bp-gift-note]');
      if (note) {
        note.textContent = current.map((w) => (note.dataset.template || '').replace('[title]', w.title)).join(' ');
        note.hidden = !current.length;
      }
    }

    announce() {
      const status = this.querySelector('[data-bp-cart-status]');
      const state = this.state;
      const note = this.querySelector('[data-bp-gift-note]:not([hidden])');
      if (status && state) status.textContent = [(this.dataset.statusTemplate || '').replace('[count]', state.countLabel), note?.textContent].filter(Boolean).join(' ');
    }

    showError(message) {
      const el = this.querySelector('[data-bp-cart-error]');
      if (!el) return;
      el.textContent = message || '';
      el.hidden = !message;
    }
  }

  class BpCartDrawer extends HTMLElement {
    get dialog() {
      return this.querySelector('dialog');
    }

    connectedCallback() {
      document.addEventListener('bp:cart:open', this.onOpen);
      // Light dismiss where closedby="any" isn't supported: a click on the backdrop.
      this.dialog?.addEventListener('click', (event) => {
        if (event.target === this.dialog) this.dialog.close();
      });
    }

    disconnectedCallback() {
      document.removeEventListener('bp:cart:open', this.onOpen);
    }

    onOpen = (event) => {
      event.preventDefault();
      this.open();
    };

    async open() {
      await this.loadStyles();
      await this.querySelector('bp-cart')?.updating;
      if (this.dialog && !this.dialog.open) this.dialog.showModal();
    }

    // The stylesheet arrives as media="print" so it never blocks the first paint.
    loadStyles() {
      const link = document.querySelector('link[data-bp-cart-css]');
      if (!link || link.media === 'all') return Promise.resolve();
      return new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 2000);
        link.media = 'all';
        if (link.sheet) resolve();
      });
    }
  }

  if (!customElements.get('bp-cart')) customElements.define('bp-cart', BpCart);
  if (!customElements.get('bp-cart-drawer')) customElements.define('bp-cart-drawer', BpCartDrawer);
}
