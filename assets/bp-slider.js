// <bp-slider>: previous/next buttons for a .bp-scroller (native horizontal scrolling with
// snap points). Without this module the row still scrolls by touch, trackpad and keyboard.
// Button labels come from data-label-previous / data-label-next (translated in Liquid).

class BpSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.bp-scroller');
    if (!this.track || this.querySelector('.bp-slider__nav')) return;
    const nav = document.createElement('div');
    nav.className = 'bp-slider__nav';
    nav.innerHTML = `<button type="button" class="bp-round-button" data-dir="-1"><span aria-hidden="true">←</span></button><button type="button" class="bp-round-button" data-dir="1"><span aria-hidden="true">→</span></button>`;
    const [prev, next] = nav.querySelectorAll('button');
    prev.setAttribute('aria-label', this.dataset.labelPrevious || 'Previous');
    next.setAttribute('aria-label', this.dataset.labelNext || 'Next');
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-dir]');
      if (!button) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.track.scrollBy({ left: Number(button.dataset.dir) * this.track.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' });
    });
    this.append(nav);
    this.buttons = [prev, next];
    this.track.addEventListener('scroll', () => this.update(), { passive: true });
    this.update();
    if (this.dataset.autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.autoplay(Number(this.dataset.autoplay) * 1000, nav);
  }

  // Slideshows only: advances on a timer, with a pause button (WCAG 2.2.2), and stops while
  // the pointer or keyboard focus is inside.
  autoplay(interval, nav) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'bp-round-button';
    let paused = false;
    const label = () => {
      toggle.setAttribute('aria-label', paused ? this.dataset.labelPlay || 'Play' : this.dataset.labelPause || 'Pause');
      toggle.textContent = paused ? '▶' : '❚❚';
    };
    toggle.addEventListener('click', () => {
      paused = !paused;
      label();
    });
    label();
    nav.prepend(toggle);
    let hold = false;
    for (const [type, value] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false]]) {
      this.addEventListener(type, () => (hold = value));
    }
    setInterval(() => {
      if (paused || hold || document.hidden) return;
      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
      this.track.scrollTo({ left: atEnd ? 0 : scrollLeft + clientWidth, behavior: 'smooth' });
    }, interval);
  }

  update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const [prev, next] = this.buttons;
    prev.disabled = scrollLeft <= 2;
    next.disabled = scrollLeft + clientWidth >= scrollWidth - 2;
    this.querySelector('.bp-slider__nav').hidden = scrollWidth <= clientWidth + 2;
  }
}

if (!customElements.get('bp-slider')) customElements.define('bp-slider', BpSlider);
