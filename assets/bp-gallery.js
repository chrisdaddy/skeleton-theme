// Product gallery: keeps thumbnails in step with the swipe track, scrolls the track
// (not the page) when a thumbnail is chosen, and opens images in a zoom dialog.
// Without this module the track still swipes and thumbnails still jump to their slide.

class BpGallery extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.bp-gallery__track');
    this.thumbs = [...this.querySelectorAll('.bp-gallery__thumb')];
    if (!this.track) return;

    this.addEventListener('click', this.onClick);
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) this.markCurrent(entry.target.dataset.mediaId);
      },
      { root: this.track, threshold: 0.6 },
    );
    this.track.querySelectorAll('.bp-gallery__slide').forEach((slide) => this.observer.observe(slide));
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  markCurrent(id) {
    for (const thumb of this.thumbs) {
      if (thumb.dataset.mediaId === id) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    }
  }

  onClick = (event) => {
    const thumb = event.target.closest('.bp-gallery__thumb');
    if (thumb) {
      event.preventDefault();
      const slide = this.track.querySelector(`[data-media-id="${thumb.dataset.mediaId}"]`);
      this.track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
      this.markCurrent(thumb.dataset.mediaId);
      return;
    }
    const image = event.target.closest('.bp-gallery__slide > img');
    if (image) this.zoom(image);
  };

  zoom(image) {
    const dialog = document.createElement('dialog');
    dialog.className = 'bp-zoom';
    dialog.setAttribute('closedby', 'any');
    const large = image.cloneNode();
    large.removeAttribute('loading');
    large.removeAttribute('fetchpriority');
    large.sizes = '100vw';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bp-icon-button';
    close.setAttribute('aria-label', this.dataset.closeLabel);
    close.innerHTML = '<svg class="bp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => dialog.close());
    dialog.append(close, large);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (event) => event.target === dialog && dialog.close());
    document.body.append(dialog);
    dialog.showModal();
  }
}

if (!customElements.get('bp-gallery')) customElements.define('bp-gallery', BpGallery);
