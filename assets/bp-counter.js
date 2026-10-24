// <bp-counter>: counts a statistic up from zero once, when it scrolls into view (the
// module loads on visibility). The final text is in the HTML, so without JavaScript, or
// with reduced motion, the real number shows straight away. Prefix and suffix
// ("$3.30", "41,208+", "4.9") are kept; decimals and thousands separators too.

class BpCounter extends HTMLElement {
  connectedCallback() {
    const text = this.textContent.trim();
    const match = /^(\D*)([\d.,]+)(.*)$/.exec(text);
    if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [, prefix, number, suffix] = match;
    const decimals = (/\.(\d+)$/.exec(number) || [, ''])[1].length;
    const grouped = number.includes(',');
    const target = Number(number.replace(/,/g, ''));
    if (!Number.isFinite(target) || target === 0) return;
    // Screen readers get the final value at once; the animation is visual only.
    this.setAttribute('aria-label', text);
    const format = (value) => {
      const fixed = value.toFixed(decimals);
      return prefix + (grouped ? Number(fixed).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed) + suffix;
    };
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      this.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else this.textContent = text;
    };
    this.style.fontVariantNumeric = 'tabular-nums';
    requestAnimationFrame(tick);
  }
}

if (!customElements.get('bp-counter')) customElements.define('bp-counter', BpCounter);
