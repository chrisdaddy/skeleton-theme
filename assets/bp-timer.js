// <bp-timer>: offer countdown.
// - data-end: a fixed end time (Unix seconds), the default. Everyone sees the same deadline.
// - data-evergreen-hours: a per-visitor window that starts on the first visit and never
//   resets on reload. Only for offers that really are per visitor.
// When it reaches zero it shows data-ended-text, or hides the section (data-hide-section).
// The units are announced to screen readers once, not every second.

const STORE = 'bp-evergreen';

function evergreenEnd(key, hours) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    if (!saved[key]) {
      saved[key] = Date.now() + hours * 3600000;
      localStorage.setItem(STORE, JSON.stringify(saved));
    }
    return saved[key];
  } catch {
    return Date.now() + hours * 3600000;
  }
}

class BpTimer extends HTMLElement {
  connectedCallback() {
    this.end = this.dataset.end ? Number(this.dataset.end) * 1000 : evergreenEnd(this.dataset.key, Number(this.dataset.evergreenHours || 24));
    this.units = Object.fromEntries([...this.querySelectorAll('[data-unit]')].map((el) => [el.dataset.unit, el.querySelector('.bp-timer__value')]));
    this.querySelector('.bp-timer__units').hidden = false;
    this.querySelector('.bp-timer__fallback').hidden = true;
    this.setAttribute('role', 'timer');
    this.tick();
    this.interval = setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.interval);
  }

  tick() {
    const left = Math.max(0, this.end - Date.now());
    const parts = {
      days: Math.floor(left / 86400000),
      hours: Math.floor(left / 3600000) % 24,
      minutes: Math.floor(left / 60000) % 60,
      seconds: Math.floor(left / 1000) % 60,
    };
    for (const [unit, el] of Object.entries(this.units)) if (el) el.textContent = String(parts[unit]).padStart(2, '0');
    this.units.days?.parentElement.toggleAttribute('hidden', parts.days === 0);
    if (left > 0) return;
    clearInterval(this.interval);
    const section = this.dataset.hideSection && document.getElementById(this.dataset.hideSection);
    if (section) section.hidden = true;
    else this.textContent = this.dataset.endedText || '';
  }
}

if (!customElements.get('bp-timer')) customElements.define('bp-timer', BpTimer);
