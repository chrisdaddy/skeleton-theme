// Rotating announcement bar.
//
// Every message is already in the page, stacked in one grid cell, so rotating
// never changes the bar's height. Autoplay pauses on hover and focus, can be
// paused with the button (WCAG 2.2.2), and is off under prefers-reduced-motion.

class BpAnnouncements extends HTMLElement {
  connectedCallback() {
    this.items = [...this.querySelectorAll('.bp-announcement__item')];
    if (this.items.length < 2) return;
    this.index = Math.max(0, this.items.findIndex((item) => item.hasAttribute('data-active')));
    this.interval = Number(this.dataset.interval || 5) * 1000;
    this.pauseButton = this.querySelector('[data-action="pause"]');

    this.querySelector('[data-action="previous"]')?.addEventListener('click', () => this.show(this.index - 1));
    this.querySelector('[data-action="next"]')?.addEventListener('click', () => this.show(this.index + 1));
    this.pauseButton?.addEventListener('click', () => this.setPaused(!this.paused));

    for (const type of ['pointerenter', 'focusin']) this.addEventListener(type, () => (this.hovering = true));
    for (const type of ['pointerleave', 'focusout']) this.addEventListener(type, () => (this.hovering = false));

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setPaused(this.dataset.autoplay !== 'true' || reduceMotion);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  setPaused(paused) {
    this.paused = paused;
    clearInterval(this.timer);
    if (!paused) this.timer = setInterval(() => !this.hovering && this.show(this.index + 1), this.interval);
    if (this.pauseButton) {
      this.pauseButton.setAttribute('aria-pressed', String(paused));
      this.pauseButton.querySelector('[data-icon="pause"]').hidden = paused;
      this.pauseButton.querySelector('[data-icon="play"]').hidden = !paused;
    }
  }

  show(next) {
    this.index = (next + this.items.length) % this.items.length;
    this.items.forEach((item, i) => {
      item.toggleAttribute('data-active', i === this.index);
      item.setAttribute('aria-hidden', String(i !== this.index));
    });
  }
}

if (!customElements.get('bp-announcements')) customElements.define('bp-announcements', BpAnnouncements);
