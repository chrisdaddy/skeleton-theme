#!/usr/bin/env node
// Release tooling.
//
//   node tools/release.mjs --check      version stamps agree, migrations are valid, and the theme's
//                                       schema is update-safe against the last release (npm test)
//   node tools/release.mjs              build dist/blueprint-<version>.zip and release/<version>/manifest.json
//
// The zip holds only the theme folders (what Shopify accepts). The manifest, committed with the
// release, records every file's MD5 (the updater spots merchant-edited code with it), the
// schema index (the next release's update-safety baseline) and the migrations up to this version.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMigration } from './lib/migrate.mjs';
import { buildSchemaIndex } from './lib/schema-index.mjs';
import { compareVersions, updateSafetyProblems } from './lib/update-safety.mjs';
import { createZip } from './lib/zip.mjs';

export const THEME_DIRS = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const root = fileURLToPath(new URL('../', import.meta.url));
const md5 = (data) => createHash('md5').update(data).digest('hex');

export function themeFiles(dir = root) {
  const files = [];
  const walk = (folder) => {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(dir, path).split('\\').join('/'));
    }
  };
  for (const folder of THEME_DIRS) walk(join(dir, folder));
  return files;
}

export function loadMigrations(dir = join(root, 'migrations')) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d+\.\d+\.\d+-\d+\.\d+\.\d+\.json$/.test(f))
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

export function releases(dir = join(root, 'release')) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((v) => existsSync(join(dir, v, 'manifest.json')))
    .sort(compareVersions);
}

export function checkRelease(dir = root) {
  const problems = [];
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  const info = JSON.parse(readFileSync(join(dir, 'config/settings_schema.json'), 'utf8')).find((g) => g.name === 'theme_info');
  if (info?.theme_version !== version) problems.push(`config/settings_schema.json theme_version is ${info?.theme_version}, package.json says ${version}`);
  const changelog = existsSync(join(dir, 'CHANGELOG.md')) ? readFileSync(join(dir, 'CHANGELOG.md'), 'utf8') : '';
  if (!new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(changelog)) problems.push(`CHANGELOG.md has no "## [${version}]" entry`);
  for (const m of loadMigrations(join(dir, 'migrations'))) {
    problems.push(...validateMigration(m, `migrations/${m.file}`));
    if (m.file !== `${m.from}-${m.to}.json`) problems.push(`migrations/${m.file}: file name must be ${m.from}-${m.to}.json`);
  }
  const previous = releases(join(dir, 'release')).filter((v) => compareVersions(v, version) < 0).at(-1);
  if (previous) {
    const baseline = JSON.parse(readFileSync(join(dir, 'release', previous, 'manifest.json'), 'utf8')).schema;
    problems.push(...updateSafetyProblems(baseline, buildSchemaIndex(dir)).map((p) => `not update-safe vs ${previous}: ${p}`));
  }
  return { version, previous, problems };
}

export function buildRelease(dir = root) {
  const { version, problems } = checkRelease(dir);
  if (problems.length) throw new Error(`Release blocked:\n- ${problems.join('\n- ')}`);
  const changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  const date = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - (\\d{4}-\\d{2}-\\d{2})`, 'm').exec(changelog)?.[1];
  if (!date) throw new Error(`CHANGELOG.md: date the ${version} entry ("## [${version}] - YYYY-MM-DD") before releasing`);
  const files = themeFiles(dir);
  const zip = createZip(files.map((name) => ({ name, data: readFileSync(join(dir, name)) })));
  mkdirSync(join(dir, 'dist'), { recursive: true });
  const zipPath = join(dir, 'dist', `blueprint-${version}.zip`);
  writeFileSync(zipPath, zip);
  const manifest = {
    version,
    date,
    zip: { name: `blueprint-${version}.zip`, md5: md5(zip), size: zip.length },
    files: Object.fromEntries(files.map((name) => [name, md5(readFileSync(join(dir, name)))])),
    schema: buildSchemaIndex(dir),
    migrations: loadMigrations(join(dir, 'migrations')).filter((m) => compareVersions(m.to, version) <= 0).map(({ file, ...m }) => m),
  };
  mkdirSync(join(dir, 'release', version), { recursive: true });
  writeFileSync(join(dir, 'release', version, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  return { version, zipPath, files: files.length, size: zip.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const { version, previous, problems } = checkRelease();
    if (problems.length) {
      console.error(`${problems.join('\n')}\n\nRelease check failed (${problems.length}).`);
      process.exit(1);
    }
    console.log(`Release check passed: ${version}${previous ? `, update-safe against ${previous}` : ' (first release: no baseline yet)'}.`);
  } else {
    const result = buildRelease();
    console.log(`Built ${relative(root, result.zipPath)} (${result.files} files, ${(result.size / 1024).toFixed(0)} KB) and release/${result.version}/manifest.json`);
  }
}
