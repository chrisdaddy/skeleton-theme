// Shipping countdown: "Order in 2h 14m for delivery by Thursday, Oct 30".
// Counts to the store's real daily dispatch cutoff in the store's time zone and skips
// weekends for both dispatch and delivery. No resets, no invented deadlines.

const isWeekend = (date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;

function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) added += 1;
  }
  return result;
}

// Works in "store time": a Date whose UTC fields read as the store's local time.
export function nextDispatch(nowMs, offsetMinutes, cutoffHour) {
  const now = new Date(nowMs + offsetMinutes * 60000);
  const cutoff = new Date(now);
  cutoff.setUTCHours(cutoffHour, 0, 0, 0);
  if (isWeekend(now) || now >= cutoff) {
    do cutoff.setUTCDate(cutoff.getUTCDate() + 1);
    while (isWeekend(cutoff));
  }
  return { dispatch: cutoff, remainingMs: cutoff - now };
}

function parseOffset(value) {
  const match = /^([+-])(\d{2})(\d{2})$/.exec(value || '');
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

class BpCountdown extends HTMLElement {
  connectedCallback() {
    this.text = this.querySelector('[data-bp-countdown-text]');
    this.update();
    this.timer = setInterval(() => this.update(), 30000);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  update() {
    const { dispatch, remainingMs } = nextDispatch(Date.now(), parseOffset(this.dataset.utcOffset), Number(this.dataset.cutoffHour));
    const delivery = addBusinessDays(dispatch, Number(this.dataset.transitMax || 4));
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const locale = document.documentElement.lang || 'en';
    const time = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    const date = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(delivery);
    this.text.textContent = this.dataset.template.replace('[time]', time).replace('[date]', date);
  }
}

if (!customElements.get('bp-countdown')) customElements.define('bp-countdown', BpCountdown);
