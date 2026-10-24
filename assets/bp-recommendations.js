// <bp-recommendations>: fills a related or complementary products section from Shopify's
// product recommendations endpoint (Section Rendering). Renders nothing until there are
// recommendations, and nothing at all without JavaScript.

class BpRecommendations extends HTMLElement {
  async connectedCallback() {
    if (!this.dataset.url || this.querySelector('li')) return;
    try {
      const response = await fetch(this.dataset.url);
      if (!response.ok) return;
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = doc.querySelector('bp-recommendations');
      if (!fresh?.querySelector('li')) return;
      this.replaceChildren(...fresh.childNodes);
      this.dispatchEvent(new CustomEvent('bp:content:replaced', { bubbles: true }));
    } catch {
      // Recommendations are optional.
    }
  }
}

if (!customElements.get('bp-recommendations')) customElements.define('bp-recommendations', BpRecommendations);
