#!/usr/bin/env node
// `qgraphflow validate|generate …` runs the skill's own script with the same arguments, output and exit code. It runs
// as a child process because each script reads process.argv and exits on its own when imported as the entry point.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scripts = { validate: 'validate-graph.mjs', generate: 'generate-viewer.mjs' };
const USAGE = `Usage: qgraphflow <command> [arguments]
  validate <graph.json> [options]            check a graph (validate-graph.mjs; add --help for its options)
  generate <graph.json> <output-dir> [opts]  write index.html, graph.json and one SVG per view (generate-viewer.mjs)
  -h, --help                                 this text`;

const [command, ...args] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') { console.log(USAGE); process.exit(0); }
if (!Object.hasOwn(scripts, command)) { console.error(USAGE); process.exit(2); }
const result = spawnSync(process.execPath, [path.join(import.meta.dirname, '../skills/q-flow/scripts', scripts[command]), ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
