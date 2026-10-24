// <bp-tabs>: turns stacked panels (each with an h3 title) into an ARIA tablist with arrow-key
// navigation. Without JavaScript every panel shows, one after another, under its title.

let counter = 0;

class BpTabs extends HTMLElement {
  connectedCallback() {
    if (this.querySelector('[role="tablist"]')) return;
    const panels = [...this.querySelectorAll(':scope > .bp-tabs__panel')];
    if (panels.length < 2) return;
    const list = document.createElement('div');
    list.setAttribute('role', 'tablist');
    list.className = 'bp-tabs__list';
    counter += 1;
    this.tabs = panels.map((panel, i) => {
      const title = panel.querySelector('.bp-tabs__title');
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'bp-tabs__tab';
      tab.id = `bp-tab-${counter}-${i}`;
      tab.textContent = title?.textContent.trim() || String(i + 1);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      if (title) title.hidden = true;
      tab.addEventListener('click', () => this.select(i));
      list.append(tab);
      return tab;
    });
    this.panels = panels;
    list.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const current = this.tabs.indexOf(document.activeElement);
      let next = current + keys[event.key];
      if (keys[event.key] === -Infinity) next = 0;
      else if (keys[event.key] === Infinity) next = this.tabs.length - 1;
      next = (next + this.tabs.length) % this.tabs.length;
      this.select(next);
      this.tabs[next].focus();
    });
    this.prepend(list);
    this.select(0);
  }

  select(index) {
    this.tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      this.panels[i].hidden = i !== index;
    });
  }
}

if (!customElements.get('bp-tabs')) customElements.define('bp-tabs', BpTabs);
