// Product reviews from the store's review app, or a CSV export.
//
// Order (docs/PLAN.md §12): Judge.me API → Okendo storefront API → Yotpo → Stamped → CSV.
// Loox has no API, so it uses its CSV export. Each provider is used only when its key is set.
//
// Review text is untrusted: it is stripped of markup and control characters, truncated, and
// returned as data. The drafting tools only accept quotes that appear verbatim in a review
// fetched here, so a page can't put words in a customer's mouth.

import { readFileSync } from 'node:fs';

export interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  verified: boolean;
  date: string;
  source: string;
}

export interface ReviewKeys {
  judgemeToken?: string;
  okendoStoreId?: string;
  yotpoAppKey?: string;
  stampedApiKey?: string;
  stampedStoreUrl?: string;
}

type Fetch = typeof fetch;
const MAX_BODY = 1500;

export function clean(text: unknown, max = MAX_BODY): string {
  return String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// "Dana Reyes" → "Dana R." (reviews show a first name and an initial, never a full name).
export function displayName(name: unknown): string {
  const parts = clean(name, 80).split(' ').filter(Boolean);
  if (!parts.length) return 'Customer';
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0]!;
}

const normalize = (r: Partial<Review> & { id: unknown }, source: string): Review => ({
  id: `${source}:${String(r.id)}`,
  rating: Math.max(0, Math.min(5, Number(r.rating) || 0)),
  title: clean(r.title, 200),
  body: clean(r.body),
  author: displayName(r.author),
  verified: Boolean(r.verified),
  date: clean(r.date, 40),
  source,
});

async function json(fetchImpl: Fetch, url: string) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json() as Promise<any>;
}

export async function fetchReviews(opts: { shop: string; productId: string; handle: string; keys: ReviewKeys; limit: number; csvPath?: string; fetchImpl?: Fetch }): Promise<{ source: string; reviews: Review[]; tried: string[] }> {
  const { shop, productId, handle, keys, limit, csvPath } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const tried: string[] = [];
  const attempt = async (source: string, run: () => Promise<Review[]>) => {
    try {
      const reviews = await run();
      tried.push(`${source}: ${reviews.length}`);
      return reviews.length ? { source, reviews: reviews.slice(0, limit), tried } : null;
    } catch (error) {
      tried.push(`${source}: ${(error as Error).message}`);
      return null;
    }
  };

  if (csvPath) {
    const found = await attempt('csv', async () => parseReviewsCsv(readFileSync(csvPath, 'utf8'), handle));
    return found ?? { source: 'csv', reviews: [], tried };
  }
  if (keys.judgemeToken) {
    const found = await attempt('judge.me', async () => {
      const base = `https://judge.me/api/v1`;
      const auth = `shop_domain=${encodeURIComponent(shop)}&api_token=${encodeURIComponent(keys.judgemeToken!)}`;
      const product = await json(fetchImpl, `${base}/products/-1?${auth}&handle=${encodeURIComponent(handle)}`);
      const data = await json(fetchImpl, `${base}/reviews?${auth}&product_id=${product.product.id}&per_page=${Math.min(100, limit)}`);
      return (data.reviews ?? []).filter((r: any) => r.published !== false && !r.hidden).map((r: any) => normalize({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.reviewer?.name, verified: r.verified === 'buyer' || r.verified === 'verified-purchase', date: r.created_at }, 'judge.me'));
    });
    if (found) return found;
  }
  if (keys.okendoStoreId) {
    const found = await attempt('okendo', async () => {
      const data = await json(fetchImpl, `https://api.okendo.io/v1/stores/${encodeURIComponent(keys.okendoStoreId!)}/products/shopify-${productId}/reviews?limit=${Math.min(100, limit)}`);
      return (data.reviews ?? []).map((r: any) => normalize({ id: r.reviewId, rating: r.rating, title: r.title, body: r.body, author: r.reviewer?.displayName, verified: Boolean(r.reviewer?.isVerified), date: r.dateCreated }, 'okendo'));
    });
    if (found) return found;
  }
  if (keys.yotpoAppKey) {
    const found = await attempt('yotpo', async () => {
      const data = await json(fetchImpl, `https://api-cdn.yotpo.com/v1/widget/${encodeURIComponent(keys.yotpoAppKey!)}/products/${productId}/reviews.json?per_page=${Math.min(150, limit)}`);
      return (data.response?.reviews ?? []).map((r: any) => normalize({ id: r.id, rating: r.score, title: r.title, body: r.content, author: r.user?.display_name, verified: Boolean(r.verified_buyer), date: r.created_at }, 'yotpo'));
    });
    if (found) return found;
  }
  if (keys.stampedApiKey && keys.stampedStoreUrl) {
    const found = await attempt('stamped', async () => {
      const data = await json(fetchImpl, `https://stamped.io/api/widget/reviews?apiKey=${encodeURIComponent(keys.stampedApiKey!)}&storeUrl=${encodeURIComponent(keys.stampedStoreUrl!)}&productId=${productId}&take=${Math.min(100, limit)}`);
      return (data.data ?? []).map((r: any) => normalize({ id: r.id, rating: r.reviewRating ?? r.rating, title: r.reviewTitle ?? r.title, body: r.reviewMessage ?? r.body, author: r.author, verified: Boolean(r.isVerified ?? r.verifiedType), date: r.dateCreated }, 'stamped'));
    });
    if (found) return found;
  }
  return { source: 'none', reviews: [], tried };
}

// ---------- CSV (Loox, Judge.me and other exports) ----------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const COLUMN = {
  body: ['body', 'review', 'content', 'review_body', 'review content', 'text'],
  title: ['title', 'review_title', 'review title'],
  rating: ['rating', 'score', 'stars', 'review_score'],
  author: ['reviewer_name', 'author', 'full_name', 'name', 'nickname', 'customer name'],
  verified: ['verified', 'verified_purchase', 'verified buyer', 'is_verified'],
  date: ['review_date', 'date', 'created_at', 'created'],
  handle: ['product_handle', 'handle', 'product handle'],
  id: ['id', 'review_id'],
  status: ['curated', 'status', 'published'],
};

export function parseReviewsCsv(text: string, handle?: string): Review[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!header) return [];
  const names = header.map((h) => h.trim().toLowerCase());
  const col = (key: keyof typeof COLUMN) => names.findIndex((n) => COLUMN[key].includes(n));
  const at = Object.fromEntries(Object.keys(COLUMN).map((k) => [k, col(k as keyof typeof COLUMN)])) as Record<keyof typeof COLUMN, number>;
  if (at.body < 0) throw new Error('CSV has no review text column (body, review or content)');
  return rows
    .filter((r) => at.handle < 0 || !handle || (r[at.handle] ?? '').trim() === handle)
    .filter((r) => at.status < 0 || !/^(false|no|hidden|unpublished|not-curated)$/i.test((r[at.status] ?? '').trim()))
    .map((r, i) =>
      normalize(
        {
          id: at.id >= 0 ? r[at.id] : String(i + 1),
          rating: at.rating >= 0 ? Number(r[at.rating]) : 0,
          title: at.title >= 0 ? r[at.title] : '',
          body: r[at.body],
          author: at.author >= 0 ? r[at.author] : '',
          verified: at.verified >= 0 ? /^(true|yes|1|buyer|verified)/i.test((r[at.verified] ?? '').trim()) : false,
          date: at.date >= 0 ? r[at.date] : '',
        },
        'csv',
      ),
    )
    .filter((r) => r.body);
}

// A quote must be a verbatim excerpt (ignoring whitespace, case and curly quotes) of a review.
export function findQuoteSource(quote: string, reviews: Review[]): Review | undefined {
  const norm = (t: string) => t.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}'"%$.,!?&-]+/gu, ' ').trim();
  const q = norm(clean(quote).replace(/^["“]|["”]$/g, ''));
  if (q.length < 12) return undefined;
  return reviews.find((r) => norm(`${r.title} ${r.body}`).includes(q) || norm(r.body).includes(q));
}
