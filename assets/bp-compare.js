// <bp-compare>: before/after comparison. Without JavaScript the two photos sit side by
// side; with it they stack and a native range input (keyboard and screen-reader operable)
// reveals one over the other.

class BpCompare extends HTMLElement {
  connectedCallback() {
    if (this.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = this.dataset.start || '50';
    input.className = 'bp-beforeafter__range';
    input.setAttribute('aria-label', this.dataset.label || '');
    input.addEventListener('input', () => this.style.setProperty('--bp-position', `${input.value}%`));
    this.append(input);
    this.classList.add('is-comparing');
  }
}

if (!customElements.get('bp-compare')) customElements.define('bp-compare', BpCompare);
