#!/usr/bin/env node
// Packs the Claude Desktop bundle: the built server, prompts and production dependencies only.
//
//   npm run pack:mcpb          → blueprint-mcp-<version>.mcpb
//
// Signing (for release) needs the publisher certificate: npx @anthropic-ai/mcpb@2.1.2 sign <file>.mcpb --cert … --key …
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const stage = mkdtempSync(join(tmpdir(), 'bp-mcpb-'));
for (const entry of ['dist', 'prompts', 'manifest.json', 'package.json', 'package-lock.json', 'README.md']) cpSync(join(pkgDir, entry), join(stage, entry), { recursive: true });
execFileSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' });
const out = join(pkgDir, `blueprint-mcp-${version}.mcpb`);
execFileSync('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'pack', stage, out], { stdio: 'inherit' });
console.log(out);
