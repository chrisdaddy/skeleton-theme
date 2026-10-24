// Prompts: Markdown files with a small front-matter block, usable as plain files or served as
// MCP prompts. {{argument}} placeholders are filled from the prompt's arguments.
//
//   ---
//   name: listicle-from-reviews
//   title: Listicle from top reviews
//   description: …
//   arguments:
//     - name: product
//       description: Product handle
//       required: true
//   ---
//   Body…

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}
export interface PromptFile {
  name: string;
  title: string;
  description: string;
  arguments: PromptArgument[];
  body: string;
}

export function parsePrompt(text: string): PromptFile {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!match) throw new Error('missing front-matter');
  const meta: Record<string, string> = {};
  const args: PromptArgument[] = [];
  let current: PromptArgument | null = null;
  for (const line of match[1]!.split('\n')) {
    const item = /^\s+-\s+name:\s*(.+)$/.exec(line);
    const field = /^\s+(description|required):\s*(.+)$/.exec(line);
    const top = /^(\w+):\s*(.*)$/.exec(line);
    if (item) {
      current = { name: item[1]!.trim(), description: '', required: false };
      args.push(current);
    } else if (field && current) {
      if (field[1] === 'required') current.required = field[2]!.trim() === 'true';
      else current.description = unquote(field[2]!);
    } else if (top) {
      meta[top[1]!] = unquote(top[2]!);
    }
  }
  for (const key of ['name', 'title', 'description']) if (!meta[key]) throw new Error(`front-matter needs ${key}`);
  return { name: meta.name!, title: meta.title!, description: meta.description!, arguments: args, body: match[2]!.trim() };
}

const unquote = (value: string) => value.trim().replace(/^"(.*)"$/, '$1');

export function fillPrompt(prompt: PromptFile, values: Record<string, string | undefined>) {
  return prompt.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key]?.trim() || `(${prompt.arguments.find((a) => a.name === key)?.description ?? key}: ask the merchant)`);
}

// The package ships prompts/ next to dist/; in the repository they live at the root.
export function promptsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const dir of [join(here, '..', 'prompts'), join(here, '..', '..', 'prompts')]) if (existsSync(dir)) return dir;
  throw new Error('prompts directory not found');
}

export function loadPrompts(dir = promptsDir()): PromptFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => {
      try {
        return parsePrompt(readFileSync(join(dir, f), 'utf8'));
      } catch (error) {
        throw new Error(`prompts/${f}: ${(error as Error).message}`);
      }
    });
}
