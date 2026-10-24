// The safety rails for every theme write, enforced here rather than left to the model:
//
// 1. Only themes this server created (the draft registry) can be written, and only while
//    Shopify reports them UNPUBLISHED or DEVELOPMENT. The role is re-read before every write,
//    so a draft that was published in the meantime is refused.
// 2. Only these files: templates/*.json, sections/*-group.json, config/settings_data.json.
// 3. Every file is validated against Blueprint's section and settings schemas.
// 4. Two steps: a change is first planned (diff + change_token), and applied only when the
//    same token comes back. The token covers the new content and the base file's checksumMd5,
//    so a file changed by someone else in between is never overwritten (optimistic concurrency).

import { createHash } from 'node:crypto';
import { userErrors, type Executor } from './admin.ts';
import { unifiedDiff } from './diff.ts';
import type { DraftRegistry } from './registry.ts';
import { validateFile } from './validate.ts';

export const WRITABLE_ROLES = new Set(['UNPUBLISHED', 'DEVELOPMENT']);
export const FILE_ALLOWLIST = [/^templates\/[a-z0-9_.-]+\.json$/, /^sections\/[a-z0-9_-]+-group\.json$/, /^config\/settings_data\.json$/];

export class RailError extends Error {}

export function assertAllowedFile(filename: string) {
  if (!FILE_ALLOWLIST.some((re) => re.test(filename))) {
    throw new RailError(`"${filename}" can't be changed: only templates/*.json, sections/*-group.json and config/settings_data.json are editable.`);
  }
}

export async function assertWritableDraft(admin: Executor, registry: DraftRegistry, themeId: string) {
  if (!registry.get(themeId)) throw new RailError(`Theme ${themeId} isn't a Blueprint AI draft. Create one with create_draft; the live theme is never edited.`);
  const { theme } = await admin('Theme', { id: themeId });
  if (!theme) throw new RailError(`Theme ${themeId} no longer exists.`);
  if (!WRITABLE_ROLES.has(theme.role)) throw new RailError(`Theme ${themeId} is ${theme.role}, not a draft. Writes are refused; create a new draft.`);
  if (theme.processing) throw new RailError(`Theme ${themeId} is still being copied by Shopify. Try again in a moment.`);
  return theme;
}

export interface ThemeFile {
  filename: string;
  content: string;
  checksum: string | null;
}

export async function readThemeFiles(admin: Executor, themeId: string, filenames: string[]): Promise<Record<string, ThemeFile>> {
  const out: Record<string, ThemeFile> = {};
  for (let i = 0; i < filenames.length; i += 50) {
    const { theme } = await admin('ThemeFiles', { id: themeId, filenames: filenames.slice(i, i + 50) });
    if (!theme) throw new RailError(`Theme ${themeId} not found.`);
    for (const node of theme.files?.nodes ?? []) out[node.filename] = { filename: node.filename, content: node.body?.content ?? '', checksum: node.checksumMd5 ?? null };
  }
  return out;
}

export interface Change {
  filename: string;
  content: string | null; // null removes a file the server created
}

interface Plan {
  themeId: string;
  changes: { filename: string; content: string | null; base: string | null; baseChecksum: string | null }[];
  token: string;
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

export class Planner {
  private plans = new Map<string, Plan>();
  constructor(
    private admin: Executor,
    private registry: DraftRegistry,
  ) {}

  latest(themeId: string): Plan | undefined {
    return [...this.plans.values()].reverse().find((p) => p.themeId === themeId);
  }

  // Validates and stages changes; returns the diff and the token that applies them.
  async plan(themeId: string, changes: Change[]) {
    await assertWritableDraft(this.admin, this.registry, themeId);
    const draft = this.registry.get(themeId)!;
    for (const change of changes) {
      assertAllowedFile(change.filename);
      if (change.content === null && draft.snapshots[change.filename] !== null) throw new RailError(`${change.filename}: only files this server created can be removed.`);
      if (change.content !== null) {
        const errors = validateFile(change.filename, change.content);
        if (errors.length) throw new RailError(`The change doesn't fit Blueprint's schema:\n- ${errors.slice(0, 30).join('\n- ')}`);
      }
    }
    const base = await readThemeFiles(this.admin, themeId, changes.map((c) => c.filename));
    const planned = changes.map((c) => ({ filename: c.filename, content: c.content, base: base[c.filename]?.content ?? null, baseChecksum: base[c.filename]?.checksum ?? null }));
    const token = sha(JSON.stringify([themeId, planned.map((p) => [p.filename, p.baseChecksum, p.content === null ? null : sha(p.content)])])).slice(0, 24);
    const plan = { themeId, changes: planned, token };
    this.plans.set(token, plan);
    const diff = planned.map((p) => unifiedDiff(p.filename, p.base ?? '', p.content ?? '') || `(no change to ${p.filename})`).join('\n\n');
    return { diff, change_token: token, files: planned.map((p) => p.filename) };
  }

  async apply(themeId: string, token: string) {
    const plan = this.plans.get(token);
    if (!plan || plan.themeId !== themeId) throw new RailError('Unknown or expired change_token. Plan the change again (call the tool without change_token) and review the diff.');
    await assertWritableDraft(this.admin, this.registry, themeId);
    const current = await readThemeFiles(this.admin, themeId, plan.changes.map((c) => c.filename));
    for (const c of plan.changes) {
      if ((current[c.filename]?.checksum ?? null) !== c.baseChecksum) {
        this.plans.delete(token);
        throw new RailError(`${c.filename} changed since the plan was made. Plan the change again.`);
      }
    }
    for (const c of plan.changes) this.registry.snapshot(themeId, c.filename, c.base);
    const upserts = plan.changes.filter((c) => c.content !== null);
    const removals = plan.changes.filter((c) => c.content === null).map((c) => c.filename);
    if (upserts.length) {
      const { themeFilesUpsert } = await this.admin('ThemeFilesUpsert', { themeId, files: upserts.map((c) => ({ filename: c.filename, body: { type: 'TEXT', value: c.content } })) });
      userErrors('themeFilesUpsert', themeFilesUpsert);
    }
    if (removals.length) {
      const { themeFilesDelete } = await this.admin('ThemeFilesDelete', { themeId, files: removals });
      userErrors('themeFilesDelete', themeFilesDelete);
      for (const filename of removals) this.registry.forget(themeId, filename);
    }
    this.plans.delete(token);
    return { applied: plan.changes.map((c) => c.filename) };
  }
}
