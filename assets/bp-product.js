// Buy box behaviour for <bp-product> (sections/main-product.liquid).
//
// Everything a shopper must be able to do works without this file: tier and plan radios
// post the product form, option pills are links, and CSS shows the checked tier's prices.
// This module adds:
// - add to cart without leaving the page (plus a tier's free gift as its own line),
// - the ?tier= and ?plan= deep-link parameters (Liquid can't read them; ?variant= and
//   ?selling_plan= are already applied server-side),
// - swapping the buy box in place when another flavour or size is picked
//   (Section Rendering API),
// - mix-and-match pickers for "pick any N" tiers,
// - the delivery-frequency select, the quantity stepper and the hidden inputs that
//   dynamic checkout buttons read.

const routesRoot = () => window.Shopify?.routes?.root || '/';

class BpProduct extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', this.onChange);
    this.addEventListener('click', this.onClick);
    this.addEventListener('submit', this.onSubmit);
    this.applyUrlParameters();
    this.enhance();
  }

  get form() {
    return document.getElementById(this.dataset.formId);
  }

  get tierInput() {
    return this.querySelector('[data-bp-tier-input]:checked');
  }

  get planInput() {
    return this.querySelector('[data-bp-plan]:checked');
  }

  // The variant the form will post (the checked tier's, or the selected variant's).
  currentVariantId() {
    return this.form ? new FormData(this.form).getAll('id').at(-1) : undefined;
  }

  // Runs after first load and after every in-place swap.
  enhance() {
    this.querySelectorAll('[data-bp-frequency]').forEach((el) => (el.hidden = false));
    this.sync();
  }

  applyUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const tier = params.get('tier');
    if (tier && !params.has('variant')) {
      const input = this.querySelector(`[data-bp-tier-input="${CSS.escape(tier)}"]`);
      if (input && !input.disabled) input.checked = true;
    }
    const plan = params.get('plan');
    if ((plan === 'sub' || plan === 'once') && !params.has('selling_plan')) {
      const input = this.querySelector(`[data-bp-plan="${plan}"]`);
      if (input) input.checked = true;
    }
  }

  onChange = (event) => {
    const frequency = event.target.closest('[data-bp-frequency] select');
    if (frequency) {
      const subscribe = this.querySelector('[data-bp-plan="sub"]');
      subscribe.value = frequency.value;
      subscribe.checked = true;
      this.frequencyChosen = true;
      // Frequencies can be priced differently: re-render every figure for the chosen plan.
      const url = new URL(this.dataset.productUrl, window.location.href);
      url.searchParams.set('selling_plan', frequency.value);
      this.swapVariant(url, this.currentVariantId());
      return;
    }
    if (event.target.matches('[data-bp-tier-input]')) this.frequencyChosen = false;
    this.sync();
  };

  // Keeps derived state in step with the checked tier and plan.
  sync() {
    const tier = this.tierInput;
    const subscribe = this.querySelector('[data-bp-plan="sub"]');
    if (tier && subscribe && tier.dataset.planId && !this.frequencyChosen) {
      subscribe.value = tier.dataset.planId;
      const select = this.querySelector('[data-bp-frequency] select');
      if (select) select.value = tier.dataset.planId;
    }
    this.renderMix(tier);

    const form = this.form;
    if (!form) return;
    // Dynamic checkout buttons read the first id, quantity and selling_plan in the form's
    // element order, checked or not. Copy the effective (last) values into the synced inputs
    // (disabled first, so they don't read themselves) and move those inputs ahead of the rest.
    const synced = [...form.elements].filter((el) => el.dataset.bpSync);
    synced.forEach((el) => (el.disabled = true));
    const data = new FormData(form);
    const slots = [...this.querySelectorAll('[data-bp-mix-slot]')].map((el) => el.value);
    const counts = new Map();
    for (const id of slots) counts.set(id, (counts.get(id) || 0) + 1);
    const [main, ...others] = counts.size ? [...counts] : [[data.getAll('id').at(-1), data.getAll('quantity').at(-1) ?? 1]];
    // A mix posts its picks without a plan (see addToCart), so Buy it now does the same.
    const values = { id: main[0], quantity: main[1], selling_plan: counts.size ? '' : (data.getAll('selling_plan').at(-1) ?? '') };
    synced.forEach((el) => {
      el.value = values[el.dataset.bpSync] ?? '';
      el.disabled = false;
    });
    const first = [...form.elements].find((el) => Object.hasOwn(values, el.name) && !el.dataset.bpSync);
    if (first && first.compareDocumentPosition(synced[0]) & Node.DOCUMENT_POSITION_FOLLOWING) {
      synced.forEach((el) => el.setAttribute('form', form.getAttribute('id')));
      first.before(...synced);
    }

    // What else Buy it now checks out with (Shopify's shopify-additional-items fields): a mix's
    // other picks, and the tier's free gift nested under the bundle, as add to cart does.
    form.querySelectorAll('[data-bp-extra]').forEach((el) => el.remove());
    const extras = others.map(([id, quantity]) => ({ id, quantity }));
    const giftId = tier?.dataset.giftId;
    // properties is a JSON list of { key, value } (what Shopify's wallet script maps over).
    const giftProperties = [{ key: '_bp_gift', value: 'tier' }, { key: '_bp_gift_for', value: String(main[0]) }];
    if (giftId) extras.push({ id: giftId, quantity: 1, parent_id: main[0], properties: JSON.stringify(giftProperties) });
    extras.forEach((item, index) => {
      for (const [key, value] of Object.entries(item)) {
        const input = Object.assign(document.createElement('input'), { type: 'hidden', name: `shopify-additional-items[${index + 1}][${key}]`, value });
        input.dataset.bpExtra = '';
        form.append(input);
      }
    });
    const button = form.querySelector('[data-bp-atc]');
    if (button && tier) button.disabled = tier.disabled;
  }

  // "Pick any N" tiers: one select per item, filled with the product's variants.
  renderMix(tier) {
    // Rebuilt only when the tier changes, so picking an item keeps the other picks.
    if (tier === this.mixTier && this.querySelector('.bp-mix')) return;
    this.mixTier = tier;
    this.querySelectorAll('.bp-mix').forEach((el) => el.remove());
    const count = Number(tier?.dataset.bpMix || 0);
    const source = this.querySelector('[data-bp-variants]');
    if (!count || !source) return;
    const variants = JSON.parse(source.textContent);
    const current = this.form ? new FormData(this.form).getAll('id').at(0) : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'bp-mix';
    for (let i = 1; i <= count; i += 1) {
      const label = document.createElement('label');
      label.className = 'bp-field';
      label.innerHTML = `<span class="bp-label"></span><select class="bp-select" data-bp-mix-slot></select>`;
      label.querySelector('.bp-label').textContent = `${source.dataset.itemLabel} ${i}`;
      const select = label.querySelector('select');
      for (const variant of variants) {
        const option = new Option(variant.title, variant.id, false, String(variant.id) === String(current));
        option.disabled = !variant.available;
        select.append(option);
      }
      wrapper.append(label);
    }
    tier.closest('.bp-tier').after(wrapper);
  }

  onClick = (event) => {
    const step = event.target.closest('[data-step]');
    if (step) {
      const input = step.parentElement.querySelector('input');
      if (step.dataset.step === '1') input.stepUp();
      else input.stepDown();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const link = event.target.closest('[data-bp-option-link]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, window.location.href);
    // Combined listings link to another product: let the browser navigate.
    if (url.pathname !== new URL(this.dataset.productUrl, window.location.href).pathname) return;
    event.preventDefault();
    this.swapVariant(url, link.dataset.variantId);
  };

  async swapVariant(url, variantId) {
    const state = { tier: this.tierInput?.dataset.bpTierInput, plan: this.planInput?.dataset.bpPlan };
    this.controller?.abort();
    this.controller = new AbortController();
    if (variantId) url.searchParams.set('variant', variantId);
    // Keep a frequency the shopper picked.
    const plan = new URLSearchParams(window.location.search).get('selling_plan');
    if (plan && !url.searchParams.has('selling_plan')) url.searchParams.set('selling_plan', plan);
    url.searchParams.set('section_id', this.dataset.sectionId);
    this.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = doc.querySelector(`bp-product[data-section-id="${CSS.escape(this.dataset.sectionId)}"]`);
      if (!fresh) throw new Error('missing section');
      const media = this.closest('.bp-product')?.querySelector('.bp-product__media');
      const freshMedia = doc.querySelector('.bp-product__media');
      if (media && freshMedia) media.replaceWith(freshMedia);
      this.replaceChildren(...fresh.childNodes);
      if (state.tier) {
        const tier = this.querySelector(`[data-bp-tier-input="${state.tier}"]`);
        if (tier && !tier.disabled) tier.checked = true;
      }
      if (state.plan) this.querySelector(`[data-bp-plan="${state.plan}"]`)?.click();
      this.enhance();
      // The address bar names what will post, so a shared link opens the same choice.
      const clean = new URL(window.location.href);
      const posted = this.currentVariantId();
      if (posted) clean.searchParams.set('variant', posted);
      if (url.searchParams.has('selling_plan')) clean.searchParams.set('selling_plan', url.searchParams.get('selling_plan'));
      window.history.replaceState({}, '', clean);
      this.querySelector('[data-bp-option-link][aria-current="true"]')?.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('bp:content:replaced', { bubbles: true }));
    } catch (error) {
      if (error.name !== 'AbortError') window.location.assign(url.href.replace(/[?&]section_id=[^&]+/, ''));
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  onSubmit = async (event) => {
    const form = event.target;
    if (form !== this.form) return;
    event.preventDefault();
    const button = form.querySelector('[data-bp-atc]');
    if (button?.getAttribute('aria-busy') === 'true') return;
    this.showError('');
    button?.setAttribute('aria-busy', 'true');
    try {
      const sections = await this.addToCart(form);
      document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'product-form', sections } }));
      // The cart drawer (when present) handles this; otherwise go to the cart page,
      // exactly as the form does without JavaScript.
      const unhandled = document.dispatchEvent(new CustomEvent('bp:cart:open', { cancelable: true }));
      if (unhandled) window.location.assign(this.dataset.cartUrl);
    } catch (error) {
      this.showError(error.message);
    } finally {
      button?.removeAttribute('aria-busy');
    }
  };

  // Returns the cart's re-rendered sections (when a cart is on the page) from the last request.
  async addToCart(form) {
    const data = new FormData(form);
    // Those fields are for Buy it now; add to cart posts the gift itself, below.
    for (const key of [...data.keys()]) if (key.startsWith('shopify-additional-items')) data.delete(key);
    const tier = this.tierInput;
    const slots = [...this.querySelectorAll('[data-bp-mix-slot]')];
    const giftId = tier?.dataset.giftId;
    const sections = document.querySelector('bp-cart')?.dataset.sectionId;
    let result;

    if (slots.length) {
      const counts = new Map();
      for (const slot of slots) counts.set(slot.value, (counts.get(slot.value) || 0) + 1);
      result = await this.post({ items: [...counts].map(([id, quantity]) => ({ id: Number(id), quantity })), ...(giftId ? {} : { sections }) });
    } else {
      // The form data already carries id, quantity, selling_plan and any line item properties.
      if (sections && !giftId) data.append('sections', sections);
      result = await this.post(data);
    }

    // A tier's free gift is its own line, priced at zero by the merchant's automatic discount.
    // Added separately so a gift problem never blocks the purchase itself.
    if (giftId) {
      const parentId = Number(data.getAll('id').at(-1));
      // A line already in the cart is a parent by its line key (parent_line_key); parent_id is a
      // variant ID and only links to a parent added in the same request.
      const parentKey = result?.key ?? result?.items?.find((item) => item.variant_id === parentId)?.key;
      const gift = { id: Number(giftId), quantity: 1, properties: { _bp_gift: 'tier', _bp_gift_for: String(parentId) } };
      try {
        result = await this.post({ items: [{ ...gift, ...(parentKey ? { parent_line_key: parentKey } : { parent_id: parentId }) }], sections });
      } catch {
        result = await this.post({ items: [gift], sections }).catch(() => result);
      }
    }
    return result?.sections;
  }

  async post(body) {
    const isForm = body instanceof FormData;
    const response = await fetch(`${routesRoot()}cart/add.js`, {
      method: 'POST',
      headers: isForm ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.description || json.message || this.dataset.errorMessage || 'Error');
    return json;
  }

  showError(message) {
    const el = this.querySelector('[data-bp-error]');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }
}

if (!customElements.get('bp-product')) customElements.define('bp-product', BpProduct);
