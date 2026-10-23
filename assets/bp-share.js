// Share button: the native share sheet where the browser has one, otherwise copy the link.

class BpShare extends HTMLElement {
  connectedCallback() {
    this.querySelector('button')?.addEventListener('click', () => this.share());
  }

  async share() {
    const { url, title, copied } = this.dataset;
    if (navigator.share) {
      await navigator.share({ url, title }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(url);
    const status = this.querySelector('[data-bp-share-status]');
    if (status) status.textContent = copied;
  }
}

if (!customElements.get('bp-share')) customElements.define('bp-share', BpShare);
