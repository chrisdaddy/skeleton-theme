// Sticky add to cart: revealed (with a transform, so nothing shifts) once the buy box's
// add-to-cart button has scrolled above the viewport, hidden again when it comes back.

class BpStickyAtc extends HTMLElement {
  connectedCallback() {
    const buyBox = this.closest('bp-product');
    this.button = this.querySelector('button');
    const target = buyBox?.querySelector('[data-bp-atc]');
    if (!target) return;
    this.observer = new IntersectionObserver(([entry]) => {
      this.setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    this.observer.observe(target);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  setVisible(visible) {
    this.toggleAttribute('data-visible', visible);
    this.setAttribute('aria-hidden', String(!visible));
    this.button.tabIndex = visible ? 0 : -1;
  }
}

if (!customElements.get('bp-sticky-atc')) customElements.define('bp-sticky-atc', BpStickyAtc);
