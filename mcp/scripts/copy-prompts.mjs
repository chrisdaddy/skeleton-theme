#!/usr/bin/env node
// Copies the repository's prompts/ into the package (npm ships mcp/prompts/).
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../prompts/', import.meta.url));
const to = fileURLToPath(new URL('../prompts/', import.meta.url));
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
