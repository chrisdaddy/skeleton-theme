// Theme-editor mock: block switches show and hide parts of the buy box, the Text tab and
// the preview's editable text stay in sync, and the Theme tab restyles the preview.
export default function init(root) {
  const pdp = root.querySelector('[data-pdp]');
  const status = root.querySelector('[data-editor-status]');
  const save = root.querySelector('[data-editor-save]');

  const markDirty = () => {
    status.textContent = 'Unsaved changes';
    save.classList.add('is-dirty');
  };
  save.addEventListener('click', () => {
    status.textContent = 'Saved (demo only, nothing leaves this page)';
    save.classList.remove('is-dirty');
  });

  // ---------- Tabs (arrow keys move between them, as the ARIA tabs pattern expects) ----------
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const selectTab = (tab, focus = false) => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !selected;
    }
    if (focus) tab.focus();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const i = tabs.indexOf(tab);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
  }

  // ---------- Block switches ----------
  for (const toggle of root.querySelectorAll('[role="switch"][data-block]')) {
    const part = pdp.querySelector(`[data-b="${toggle.dataset.block}"]`);
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(on));
      if (part) part.hidden = !on;
      markDirty();
    });
  }

  // ---------- Text: inputs ↔ editable preview text ----------
  for (const input of root.querySelectorAll('[data-text]')) {
    const targets = [...pdp.querySelectorAll(`[data-t="${input.dataset.text}"]`)];
    input.addEventListener('input', () => {
      for (const el of targets) el.textContent = input.value;
      markDirty();
    });
    for (const el of targets) {
      if (!el.isContentEditable) continue;
      el.addEventListener('input', () => {
        input.value = el.textContent;
        markDirty();
      });
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          el.blur();
        }
      });
    }
  }

  // ---------- Theme settings ----------
  root.addEventListener('change', (event) => {
    const { name, value } = event.target;
    if (name === 'ed-accent') pdp.style.setProperty('--acc', value);
    else if (name === 'ed-radius') pdp.style.setProperty('--rad', value);
    else if (name === 'ed-bg') pdp.classList.toggle('is-dark', value === 'dark');
    else return;
    markDirty();
  });

  // ---------- Desktop / mobile preview ----------
  const devices = [...root.querySelectorAll('[data-device]')];
  for (const button of devices) {
    button.addEventListener('click', () => {
      for (const b of devices) b.setAttribute('aria-pressed', String(b === button));
      pdp.classList.toggle('is-mobile', button.dataset.device === 'mobile');
    });
  }
}
