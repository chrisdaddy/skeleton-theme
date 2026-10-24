#!/usr/bin/env node
// Publishes a built release to the Blueprint Portal: uploads the zip and manifest to R2 and
// records the version (with its CHANGELOG notes) in D1, so the updater and the buyer portal
// offer it. Run `node tools/release.mjs` first.
//
//   node tools/publish-release.mjs <version>          print the wrangler commands
//   node tools/publish-release.mjs <version> --run    run them (needs Cloudflare credentials)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function changelogNotes(changelog, version) {
  const start = changelog.search(new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
  if (start < 0) return '';
  const rest = changelog.slice(start).split('\n').slice(1).join('\n');
  const end = rest.search(/^## \[/m);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

export function publishCommands(version, dir = root) {
  const zip = join(dir, 'dist', `blueprint-${version}.zip`);
  const manifestPath = join(dir, 'release', version, 'manifest.json');
  if (!existsSync(zip) || !existsSync(manifestPath)) throw new Error(`Build the release first: node tools/release.mjs (missing ${existsSync(zip) ? manifestPath : zip})`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const notes = changelogNotes(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), version);
  const sql = `INSERT OR REPLACE INTO releases (version, date, notes) VALUES ('${version}', '${manifest.date}', '${notes.replace(/'/g, "''")}');\n`;
  const sqlFile = join(mkdtempSync(join(tmpdir(), 'bp-publish-')), 'release.sql');
  writeFileSync(sqlFile, sql);
  const cwd = join(dir, 'portal');
  return [
    { cwd, args: ['wrangler', 'r2', 'object', 'put', `blueprint-releases/releases/${version}/blueprint-${version}.zip`, '--file', zip, '--content-type', 'application/zip', '--remote'] },
    { cwd, args: ['wrangler', 'r2', 'object', 'put', `blueprint-releases/releases/${version}/manifest.json`, '--file', manifestPath, '--content-type', 'application/json', '--remote'] },
    { cwd, args: ['wrangler', 'd1', 'execute', 'blueprint-portal', '--remote', '--file', sqlFile] },
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    console.error('Usage: node tools/publish-release.mjs <version> [--run]');
    process.exit(2);
  }
  const commands = publishCommands(version);
  for (const command of commands) {
    console.log(`(cd portal && npx ${command.args.join(' ')})`);
    if (process.argv.includes('--run')) {
      const result = spawnSync('npx', command.args, { cwd: command.cwd, stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
  if (!process.argv.includes('--run')) console.log('\nRe-run with --run to publish (needs `npx wrangler login` or CLOUDFLARE_API_TOKEN).');
}
