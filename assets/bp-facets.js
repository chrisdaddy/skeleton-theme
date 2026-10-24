// <bp-facets>: collection filters and sorting without page reloads.
// Without this module everything works as links and a GET form. With it, a changed filter
// or sort (or a pill, chip or pagination link) fetches the same section through the Section
// Rendering API, swaps the results, updates the address bar and announces the new count.
// The filter panel starts closed at every width, so opening it never shifts the page on load.

class BpFacets extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', this.onChange);
    this.addEventListener('submit', this.onSubmit);
    this.addEventListener('click', this.onClick);
    window.addEventListener('popstate', () => this.render(window.location.href, false));
  }

  urlFromForm() {
    const form = this.querySelector('[data-bp-facets-form]');
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (value !== '') params.append(key, value);
    return `${form.action.split('?')[0]}?${params}`;
  }

  onChange = (event) => {
    if (!event.target.closest('[data-bp-facets-form]')) return;
    // Price fields wait for the shopper to finish (submit or leave the field).
    if (event.target.type === 'number') return;
    this.render(this.urlFromForm());
  };

  onSubmit = (event) => {
    if (!event.target.matches('[data-bp-facets-form]')) return;
    event.preventDefault();
    this.render(this.urlFromForm());
  };

  onClick = (event) => {
    const link = event.target.closest('.bp-pill-link, .bp-chip, .bp-facets__active a, .bp-pagination a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    this.render(link.href);
  };

  async render(href, push = true) {
    const url = new URL(href, window.location.href);
    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set('section_id', this.dataset.sectionId);
    this.controller?.abort();
    this.controller = new AbortController();
    const wasOpen = this.querySelector('[data-bp-facets-panel]')?.open;
    const focusName = document.activeElement?.name;
    const focusValue = document.activeElement?.value;
    this.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(fetchUrl, { signal: this.controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = doc.querySelector('[data-bp-facets-results]');
      if (!fresh) throw new Error('missing');
      this.querySelector('[data-bp-facets-results]').replaceWith(fresh);
      const panel = this.querySelector('[data-bp-facets-panel]');
      if (panel && wasOpen) panel.open = true;
      if (focusName) {
        const selector = `[name="${CSS.escape(focusName)}"]${focusValue != null ? `[value="${CSS.escape(focusValue)}"]` : ''}`;
        (this.querySelector(selector) || this.querySelector(`[name="${CSS.escape(focusName)}"]`))?.focus();
      }
      if (push) window.history.pushState({}, '', url);
      fresh.dispatchEvent(new CustomEvent('bp:content:replaced', { bubbles: true }));
    } catch (error) {
      if (error.name !== 'AbortError') window.location.assign(url);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }
}

if (!customElements.get('bp-facets')) customElements.define('bp-facets', BpFacets);
