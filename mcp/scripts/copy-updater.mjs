#!/usr/bin/env node
// Ships the theme updater in the package (npx -y @blueprint/mcp update): copies the repository's
// tools/update and the libraries it uses into dist/, keeping their relative layout.
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../tools/', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
mkdirSync(`${dist}update`, { recursive: true });
mkdirSync(`${dist}lib`, { recursive: true });
for (const file of ['updater.mjs', 'cli.mjs']) cpSync(`${repo}update/${file}`, `${dist}update/${file}`);
for (const file of ['migrate.mjs', 'update-safety.mjs']) cpSync(`${repo}lib/${file}`, `${dist}lib/${file}`);
