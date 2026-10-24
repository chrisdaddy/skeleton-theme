// Builds pre-lander templates (listicle, advertorial) from copy the model writes and quotes it
// takes from real reviews. The structure mirrors the listing templates (listings/*/templates):
// landing layout, disclosure on, the offer section at the end and a sticky CTA.
//
// Honesty rules enforced here:
// - every quote must be a verbatim excerpt of a review fetched by read_reviews;
// - attribution is the reviewer's first name and initial, and "Verified buyer" only when the
//   review app says so;
// - the advertorial's "Advertisement" disclosure is always on;
// - the listicle headline's number is the [count] token, so it always matches the items.

import { RailError } from './rails.ts';
import { clean, findQuoteSource, type Review } from './reviews.ts';

const escape = (text: string) => clean(text, 2000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraph = (text: string) => `<p>${escape(text)}</p>`;

export function attributedQuote(quote: string, reviews: Review[]) {
  const source = findQuoteSource(quote, reviews);
  if (!source) throw new RailError(`This quote isn't in any fetched review, so it can't be used: "${clean(quote, 120)}". Quote reviews word for word (call read_reviews first).`);
  return { text: clean(quote).replace(/^["“]|["”]$/g, ''), name: source.author, verified: source.verified, rating: source.rating, review: source };
}

const section = (type: string, settings: Record<string, unknown>, blocks: [string, Record<string, unknown>, string?][] = []) => {
  const out: Record<string, unknown> = { type, settings };
  if (blocks.length) {
    const ids = blocks.map(([blockType, , id], i) => id ?? `${blockType.replace(/^product-/, '')}_${i + 1}`);
    out.blocks = Object.fromEntries(blocks.map(([blockType, blockSettings], i) => [ids[i], { type: blockType, settings: blockSettings }]));
    out.block_order = ids;
  }
  return out;
};

const template = (pairs: [string, Record<string, unknown>][]) => ({ layout: 'landing', sections: Object.fromEntries(pairs), order: pairs.map(([id]) => id) });

const offer = (product: string, tier: number, heading: string, guarantee: string) =>
  section('offer', { product, default_tier: tier, heading, guarantee }, [
    ['product-rating', {}],
    ['product-title', {}],
    ['product-offer-tiers', {}],
    ['product-purchase-options', {}],
    ['product-buy-buttons', {}],
    ['product-trust-tiles', {}],
  ]);

export interface ListicleInput {
  product_handle: string;
  heading: string;
  eyebrow?: string;
  items: { title: string; text: string; quote?: string }[];
  cta_label: string;
  offer_heading?: string;
  guarantee?: string;
  default_tier?: number;
}

export function listicleTemplate(input: ListicleInput, reviews: Review[]) {
  if (input.items.length < 3 || input.items.length > 12) throw new RailError('A listicle needs 3 to 12 items.');
  const heading = /\[count\]/.test(input.heading) ? input.heading : input.heading.replace(/^\s*\d+/, '[count]');
  const items = input.items.map((item) => {
    let text = paragraph(item.text);
    if (item.quote) {
      const q = attributedQuote(item.quote, reviews);
      text += `<p><em>“${escape(q.text)}”</em> — ${escape(q.name)}${q.verified ? ', verified buyer' : ''}</p>`;
    }
    return ['item', { title: clean(item.title, 120), text }] as [string, Record<string, unknown>];
  });
  return template([
    ['header', section('article-header', { show_disclosure: true, eyebrow: clean(input.eyebrow ?? '', 80), heading: '', lede: '', padding_bottom: 0 })],
    ['list', section('listicle', { heading: escape(heading), heading_tag: 'h1' }, items)],
    ['offer', offer(input.product_handle, input.default_tier ?? 2, clean(input.offer_heading ?? 'Try it risk-free', 120), clean(input.guarantee ?? '', 120))],
    ['sticky', section('sticky-cta', { target: 'offer', cta_label: clean(input.cta_label, 60) })],
  ]);
}

export interface AdvertorialInput {
  product_handle: string;
  eyebrow: string;
  headline: string;
  author: string;
  read_time?: number;
  paragraphs: string[];
  pull_quote: string;
  closing?: string;
  cta_label: string;
  offer_heading?: string;
  guarantee?: string;
  default_tier?: number;
}

export function advertorialTemplate(input: AdvertorialInput, reviews: Review[]) {
  if (!input.paragraphs.length || input.paragraphs.length > 20) throw new RailError('An advertorial needs 1 to 20 paragraphs.');
  const quote = attributedQuote(input.pull_quote, reviews);
  const body: [string, Record<string, unknown>][] = [
    ['image', { ratio: 'landscape' }],
    ...input.paragraphs.slice(0, 1).map((p) => ['text', { text: paragraph(p) }] as [string, Record<string, unknown>]),
    ['quote', { quote: paragraph(quote.text), attribution: `${quote.name}${quote.verified ? ', verified buyer' : ''}` }],
    ...input.paragraphs.slice(1).map((p) => ['text', { text: paragraph(p) }] as [string, Record<string, unknown>]),
    ...(input.closing ? [['text', { text: paragraph(input.closing) }] as [string, Record<string, unknown>]] : []),
    ['product', { cta_label: clean(input.cta_label, 60), cta_product: input.product_handle, cta_tier: input.default_tier ?? 2 }],
  ];
  return template([
    ['header', section('article-header', { show_disclosure: true, eyebrow: clean(input.eyebrow, 80), heading: escape(input.headline), lede: '' })],
    ['byline', section('author-byline', { author: clean(input.author, 80), ...(input.read_time ? { read_time: input.read_time } : {}) })],
    ['body', section('article-body', {}, body)],
    ['offer', offer(input.product_handle, input.default_tier ?? 2, clean(input.offer_heading ?? 'Try it risk-free', 120), clean(input.guarantee ?? '', 120))],
    ['sticky', section('sticky-cta', { target: 'offer', cta_label: clean(input.cta_label, 60) })],
  ]);
}

// templates/page.<kind>-<suffix>.json (or page.<suffix>.json when the suffix already starts with the kind).
export function templateFilename(kind: string, suffix: string) {
  const safe = suffix.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
  if (!safe) throw new RailError('template_suffix must contain letters or numbers.');
  return `templates/page.${safe.startsWith(kind) ? safe : `${kind}-${safe}`}.json`;
}
