// Connects Shopify's Standard Actions (window.Shopify.actions) to the theme.
//
// Apps and on-page AI agents call Shopify.actions.openCart() and updateCart().
// Without these handlers, the platform's default updateCart reloads the page on
// a theme it doesn't recognise. Only the first configure() call wins, so this
// module loads above {{ content_for_header }}.
//
// - openCart: the cart drawer (Phase 3) handles "bp:cart:open" and calls
//   preventDefault(). Otherwise the platform default runs.
// - updateCart: after the platform writes the cart, the theme refreshes its own
//   cart UI from "bp:cart:changed".

function configure() {
  const actions = window.Shopify?.actions;
  if (!actions) return;

  actions.openCart?.configure({
    async handler(defaultHandler) {
      const unhandled = document.dispatchEvent(new CustomEvent('bp:cart:open', { cancelable: true }));
      if (unhandled) return defaultHandler();
    },
  });

  actions.updateCart?.configure({
    eventTarget: () => document,
    async handler(defaultHandler) {
      const result = await defaultHandler();
      document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'standard-action' } }));
      return result;
    },
  });
}

// The platform injects Shopify.actions as a module that runs after this one;
// DOMContentLoaded fires once every module script has run.
if (window.Shopify?.actions) configure();
else document.addEventListener('DOMContentLoaded', configure, { once: true });
