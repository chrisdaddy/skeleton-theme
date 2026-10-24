// <bp-video>: video testimonials.
// - Uploaded videos with data-autoplay play muted and looped while on screen (never under
//   reduced motion), with a sound toggle. Native controls stay for keyboard and screen readers.
// - Linked YouTube/Vimeo videos stay a cover image and play button until clicked; only
//   then is the player's iframe added (from the <template>), so nothing loads up front.

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class BpVideo extends HTMLElement {
  connectedCallback() {
    const play = this.querySelector('[data-bp-play]');
    if (play) play.addEventListener('click', () => this.embed(), { once: true });

    this.video = this.querySelector('video');
    if (!this.video || !this.hasAttribute('data-autoplay') || reduceMotion()) return;
    this.video.muted = true;
    this.video.loop = true;
    this.addSoundToggle();
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) this.video.play().catch(() => {});
      else this.video.pause();
    }, { threshold: 0.5 });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  addSoundToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bp-video-card__sound';
    const update = () => {
      button.textContent = this.video.muted ? '🔇' : '🔊';
      button.setAttribute('aria-label', this.video.muted ? this.dataset.labelUnmute : this.dataset.labelMute);
      button.setAttribute('aria-pressed', String(!this.video.muted));
    };
    button.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      if (!this.video.muted) this.video.play().catch(() => {});
      update();
    });
    this.video.addEventListener('volumechange', update);
    update();
    this.append(button);
  }

  embed() {
    const template = this.querySelector('template[data-bp-embed]');
    if (!template) return;
    const player = template.content.cloneNode(true);
    this.replaceChildren(player);
    this.querySelector('iframe')?.focus();
  }
}

if (!customElements.get('bp-video')) customElements.define('bp-video', BpVideo);
