// Quick add from product cards (snippets/product-card.liquid).
// - Single-variant cards post a real form; this module sends it in place and opens the cart.
// - Other cards link to the product; this module opens that product's buy box in a dialog
//   (sections/quick-add.liquid via the Section Rendering API) instead of leaving the page.
// Both fall back to the plain link or form when anything fails.

const root = () => window.Shopify?.routes?.root || '/';
let dialog;

function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'bp-drawer bp-drawer--right bp-quick-add-dialog';
  dialog.innerHTML = '<div class="bp-quick-add-dialog__bar"><button type="button" class="bp-icon-button" data-bp-close><span aria-hidden="true">✕</span></button></div><div class="bp-quick-add-dialog__body"></div>';
  dialog.querySelector('[data-bp-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => event.target === dialog && dialog.close());
  // After adding, the cart takes over.
  document.addEventListener('bp:cart:changed', () => dialog.open && dialog.close());
  document.body.append(dialog);
  return dialog;
}

async function openQuickAdd(link) {
  const url = new URL(link.dataset.bpQuickAdd, window.location.href);
  url.searchParams.set('section_id', 'quick-add');
  link.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const content = doc.querySelector('.bp-quick-add');
    if (!content) throw new Error('missing');
    const d = getDialog();
    const body = d.querySelector('.bp-quick-add-dialog__body');
    // Wait for the buy box stylesheet before showing it.
    const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    await Promise.all(styles.map(loadStyle));
    body.replaceChildren(content);
    const close = d.querySelector('[data-bp-close]');
    close.setAttribute('aria-label', link.dataset.labelClose || 'Close');
    d.setAttribute('aria-label', link.textContent.trim());
    d.showModal();
    content.dispatchEvent(new CustomEvent('bp:content:replaced', { bubbles: true }));
  } catch {
    window.location.assign(link.href);
  } finally {
    link.removeAttribute('aria-busy');
  }
}

function loadStyle(href) {
  if ([...document.styleSheets].some((s) => s.href === href)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = resolve;
    document.head.append(link);
  });
}

async function quickAddForm(form) {
  const button = form.querySelector('button');
  button?.setAttribute('aria-busy', 'true');
  try {
    const sections = document.querySelector('bp-cart')?.dataset.sectionId;
    const data = new FormData(form);
    if (sections) data.append('sections', sections);
    const response = await fetch(`${root()}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
    const json = await response.json();
    if (!response.ok) throw new Error(json.description);
    document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'quick-add', sections: json.sections } }));
    const unhandled = document.dispatchEvent(new CustomEvent('bp:cart:open', { cancelable: true }));
    if (unhandled) form.submit();
  } catch {
    form.submit();
  } finally {
    button?.removeAttribute('aria-busy');
  }
}

if (!window.__bpQuickAdd) {
  window.__bpQuickAdd = true;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-bp-quick-add]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    openQuickAdd(link);
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-bp-quick-form]');
    if (!form) return;
    event.preventDefault();
    quickAddForm(form);
  });
}
