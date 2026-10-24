// The draft registry: the themes this server created, per shop, with a snapshot of every file
// before the server first changed it (for revert_draft_file). Writes are only ever allowed to
// themes in this registry. Stored as JSON in BLUEPRINT_MCP_HOME (default ~/.blueprint-mcp).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Draft {
  themeId: string;
  name: string;
  baseThemeId: string;
  createdAt: string;
  // filename → content before the first change (null: the server created the file).
  snapshots: Record<string, string | null>;
}

export class DraftRegistry {
  private file: string;
  private drafts: Draft[];

  constructor(shop: string, home = process.env.BLUEPRINT_MCP_HOME ?? join(homedir(), '.blueprint-mcp')) {
    mkdirSync(home, { recursive: true });
    this.file = join(home, `drafts-${shop.replace(/[^a-z0-9.-]/gi, '_')}.json`);
    this.drafts = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, 'utf8')) as Draft[]) : [];
  }

  list(): Draft[] {
    return this.drafts;
  }

  get(themeId: string): Draft | undefined {
    return this.drafts.find((d) => d.themeId === themeId);
  }

  add(draft: Draft) {
    this.drafts.push(draft);
    this.save();
  }

  snapshot(themeId: string, filename: string, content: string | null) {
    const draft = this.get(themeId);
    if (!draft || filename in draft.snapshots) return;
    draft.snapshots[filename] = content;
    this.save();
  }

  forget(themeId: string, filename: string) {
    const draft = this.get(themeId);
    if (!draft) return;
    delete draft.snapshots[filename];
    this.save();
  }

  private save() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.drafts, null, 2)}\n`);
    renameSync(tmp, this.file);
  }
}
