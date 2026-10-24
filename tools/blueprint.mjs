#!/usr/bin/env node
// Blueprint command line (this repository). Merchants run the same command from the AI-kit
// package: npx -y @blueprint/mcp update.
//
//   node tools/blueprint.mjs update [--yes] [--dry-run]
//
// Environment: see tools/update/cli.mjs. The app needs read_themes and write_themes. The update
// creates a new, unpublished theme; you publish it yourself after a look in the theme editor.
import { spawnSync } from 'node:child_process';
import { main } from './update/cli.mjs';

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const result = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(result.status ?? 1);
}

const [command, ...flags] = process.argv.slice(2);
if (command !== 'update') {
  console.error('Usage: node tools/blueprint.mjs update [--yes] [--dry-run]');
  process.exit(2);
}
process.exit(await main(flags));
