// <bp-sticky-cta>: the pre-lander's fixed call-to-action bar. Shows once the reader has
// scrolled past data-after percent of the page, and (with data-hide-over-offer) hides while
// the offer section is on screen. Without this module the bar sits at the end of the page.

class BpStickyCta extends HTMLElement {
  connectedCallback() {
    this.after = Number(this.dataset.after || 0) / 100;
    this.offerVisible = false;
    const offer = this.hasAttribute('data-hide-over-offer') && document.querySelector('[data-bp-offer]');
    if (offer) {
      new IntersectionObserver(([entry]) => {
        this.offerVisible = entry.isIntersecting;
        this.update();
      }).observe(offer);
    }
    this.classList.add('is-enhanced');
    window.addEventListener('scroll', () => this.update(), { passive: true });
    this.update();
  }

  update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 1;
    const show = progress >= this.after && !this.offerVisible;
    this.toggleAttribute('data-visible', show);
    // Keyboard and screen-reader users can't reach a hidden bar.
    this.inert = !show;
  }
}

if (!customElements.get('bp-sticky-cta')) customElements.define('bp-sticky-cta', BpStickyCta);
