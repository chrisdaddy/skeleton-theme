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
    // Dynamic checkout buttons read id and selling_plan from inside the form. Copy the
    // effective values in (disabled first, so they don't read themselves).
    const synced = form.querySelectorAll('[data-bp-sync]');
    synced.forEach((el) => (el.disabled = true));
    const data = new FormData(form);
    synced.forEach((el) => {
      el.value = data.getAll(el.dataset.bpSync).at(-1) ?? '';
      el.disabled = false;
    });
    const button = form.querySelector('[data-bp-atc]');
    if (button && tier) button.disabled = tier.disabled;
  }

  // "Pick any N" tiers: one select per item, filled with the product's variants.
  renderMix(tier) {
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
      await this.addToCart(form);
      document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'product-form' } }));
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

  async addToCart(form) {
    const data = new FormData(form);
    const tier = this.tierInput;
    const slots = [...this.querySelectorAll('[data-bp-mix-slot]')];

    if (slots.length) {
      const counts = new Map();
      for (const slot of slots) counts.set(slot.value, (counts.get(slot.value) || 0) + 1);
      await this.post({ items: [...counts].map(([id, quantity]) => ({ id: Number(id), quantity })) });
    } else {
      // The form data already carries id, quantity, selling_plan and any line item properties.
      await this.post(data);
    }

    // A tier's free gift is its own line, priced at zero by the merchant's automatic discount.
    // Added separately so a gift problem never blocks the purchase itself.
    const giftId = tier?.dataset.giftId;
    if (giftId) {
      const parentId = Number(data.getAll('id').at(-1));
      const gift = { id: Number(giftId), quantity: 1, properties: { _bp_gift: '1' } };
      try {
        await this.post({ items: [{ ...gift, parent_id: parentId }] });
      } catch {
        await this.post({ items: [gift] }).catch(() => {});
      }
    }
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
