// <bp-bundle>: bundle builder. Without JavaScript the checkboxes post items[n][id] to the
// cart. With it: a running count, the bundle total from the variants' own prices with the
// displayed percentage taken off (in cents, rounded so the saving is never overstated),
// and add to cart in place. The merchant's automatic discount is what checkout applies.

const formatMoney = (cents, format) => {
  const amount = (cents / 100).toFixed(2);
  const [whole, fraction] = amount.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (format || '${{amount}}')
    .replace(/\{\{\s*amount_no_decimals\s*\}\}/, withCommas)
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`)
    .replace(/\{\{\s*amount\s*\}\}/, `${withCommas}.${fraction}`);
};

/** Bundle total in cents after the displayed percentage, rounded up so the saving is never overstated. */
export function bundleTotal(prices, percent) {
  const before = prices.reduce((sum, p) => sum + p, 0);
  const after = Math.ceil((before * (100 - percent)) / 100);
  return { before, after };
}

if (globalThis.customElements) {
  class BpBundle extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.min = Number(this.dataset.min || 1);
      this.percent = Number(this.dataset.percent || 0);
      this.addEventListener('change', () => this.update());
      this.form.addEventListener('submit', this.onSubmit);
      this.update();
    }

    get checked() {
      return [...this.querySelectorAll('.bp-bundle-item__input:checked')];
    }

    update() {
      const picked = this.checked;
      const ready = picked.length >= this.min;
      const progress = this.querySelector('[data-bp-progress]');
      progress.textContent = ready ? this.dataset.labelReady : (this.dataset.labelProgress || '').replace('[count]', picked.length);
      const totals = this.querySelector('[data-bp-totals]');
      const { before, after } = bundleTotal(picked.map((i) => Number(i.dataset.price)), ready ? this.percent : 0);
      totals.hidden = picked.length === 0;
      this.querySelector('[data-bp-before]').textContent = after < before ? formatMoney(before, this.dataset.moneyFormat) : '';
      this.querySelector('[data-bp-after]').textContent = formatMoney(after, this.dataset.moneyFormat);
      this.querySelector('[data-bp-submit]').disabled = !ready;
    }

    onSubmit = async (event) => {
      event.preventDefault();
      const button = this.querySelector('[data-bp-submit]');
      const error = this.querySelector('[data-bp-error]');
      error.hidden = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const sections = document.querySelector('bp-cart')?.dataset.sectionId;
        const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: this.checked.map((input) => ({ id: Number(input.value), quantity: 1 })), sections }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.description || json.message);
        document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'bundle', sections: json.sections } }));
        const unhandled = document.dispatchEvent(new CustomEvent('bp:cart:open', { cancelable: true }));
        if (unhandled) window.location.assign(this.dataset.cartUrl);
      } catch (e) {
        error.textContent = e.message || '';
        error.hidden = false;
      } finally {
        button.removeAttribute('aria-busy');
      }
    };
  }

  if (!customElements.get('bp-bundle')) customElements.define('bp-bundle', BpBundle);
}
