// Source drift: compares each anchored file with the content the diagram was made from (meta.sourceFiles, git blob
// hashes) and separates harmless line moves from changes a reader of the diagram must see.
// ponytail: C-family regex heuristics (calls, method spans, comments), not a parser; per-language parsing would cut
// the remaining misses (a call split across lines, overloaded names).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const git = (root, args, input) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 << 20, input });
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'synchronized', 'super', 'this', 'else', 'throw']);
const isCode = line => line.trim() && !/^\s*(\/\/|\/\*|\*|#)/.test(line);
const callsIn = line => [...line.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]).filter(name => !KEYWORDS.has(name));
const word = term => new RegExp(`(?<![\\w$])${term.replace(/[$.]/g, '\\$&')}(?![\\w$])`);
const numberIn = value => new RegExp(`(?<![\\w.])${value.replace('.', '\\.')}(?![\\d.])`);
const isAnchor = value => value && typeof value === 'object' && typeof value.file === 'string' && Number.isInteger(value.lineStart);
// Geometry, the drift bookkeeping itself, and fields that hold ids or enum values rather than prose.
const SKIP = new Set(['layout', 'route', 'position', 'size', 'sourceFiles', 'sourceDrift', 'id', 'source', 'target', 'replyTo', 'edgeId', 'edgeIds',
  'participantId', 'parentId', 'groupId', 'module', 'kind', 'evidence', 'viewId', 'diagramType', 'architectureView', 'locale', 'direction', 'at', 'sourceRef']);

// Blob hashes of the given repository-relative files as they are now, or null outside a git work tree.
export function fingerprintFiles(repoRoot, files) {
  if (!files.length || git(repoRoot, ['rev-parse', '--is-inside-work-tree']).status !== 0) return null;
  const result = git(repoRoot, ['hash-object', '--', ...files]);
  if (result.status !== 0) return null;
  const hashes = result.stdout.trim().split('\n');
  return Object.fromEntries(files.map((file, i) => [file, hashes[i]]));
}

// Hunks of a zero-context unified diff, in old-line order.
export function parseHunks(text) {
  const hunks = [];
  let hunk;
  for (const line of text.split('\n')) {
    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (header) { hunk = { oldStart: +header[1], oldCount: header[2] === undefined ? 1 : +header[2], newStart: +header[3], newCount: header[4] === undefined ? 1 : +header[4], removed: [], added: [] }; hunks.push(hunk); }
    else if (hunk && line.startsWith('-') && !line.startsWith('---')) hunk.removed.push(line.slice(1));
    else if (hunk && line.startsWith('+') && !line.startsWith('+++')) hunk.added.push(line.slice(1));
  }
  return hunks;
}

// An old line's new number, or the hunk that rewrote it.
export function mapLine(hunks, line) {
  let delta = 0;
  for (const hunk of hunks) {
    if (hunk.oldCount === 0) { if (hunk.oldStart < line) delta += hunk.newCount; continue; }
    if (line < hunk.oldStart) break;
    if (line < hunk.oldStart + hunk.oldCount) return { hunk };
    delta += hunk.newCount - hunk.oldCount;
  }
  return { line: line + delta };
}

function fileDiff(repoRoot, blob, file) {
  const old = git(repoRoot, ['cat-file', 'blob', blob]);
  if (old.status !== 0) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-drift-'));
  try {
    const before = path.join(dir, 'before');
    fs.writeFileSync(before, old.stdout);
    const result = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '-U0', before, path.resolve(repoRoot, file)], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (result.status !== 0 && result.status !== 1) return null;
    return { hunks: parseHunks(result.stdout), before: old.stdout };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Every human-readable string of a view with the element that carries it (id null for view-level text); anchors and
// geometry are skipped.
function textsOf(graph, view, graphIndex) {
  const texts = [];
  const walk = (value, element, id, key) => {
    if (Array.isArray(value)) return value.forEach(item => walk(item, element, id, key));
    if (value && typeof value === 'object') {
      if (isAnchor(value)) return;
      const own = typeof value.id === 'string' ? value.id : id;
      for (const [name, item] of Object.entries(value)) if (!SKIP.has(name)) walk(item, own === id ? element : `${view} ${own}`, own, name);
    } else if (typeof value === 'string' && /\p{L}/u.test(value)) texts.push({ element, key, text: value, graphIndex, id });
  };
  walk(graph, `${view} meta`, null, '');
  return texts;
}

function methodSpan(lines, name) {
  const definition = new RegExp(`^\\s*(public|private|protected|static|final|\\s)*[\\w<>\\[\\],.? ]+\\s+${name}\\s*\\([^;]*$`);
  const start = lines.findIndex(line => definition.test(line) && !/^\s*(return|new)\b/.test(line));
  if (start < 0) return null;
  let depth = 0, opened = false;
  for (let i = start; i < lines.length; i++) {
    for (const char of lines[i]) { if (char === '{') { depth++; opened = true; } else if (char === '}') depth--; }
    if (opened && depth === 0) return [start + 1, i + 1];
  }
  return null;
}

/**
 * graphs: the views; anchors: [{ source, label, graphIndex, element }] for every node/edge/section/badge anchor;
 * read(file) -> current lines; term(symbol) -> the word an anchor's symbol is checked by.
 * Returns null when no view has a baseline, else { files, realigned, alarms, moves, unchecked }.
 * moves maps an anchor object to its new { lineStart, lineEnd }; alarms are grouped per changed hunk.
 */
export function detectDrift(graphs, { repoRoot, anchors, read, term }) {
  const based = anchors.filter(({ source, graphIndex }) => typeof graphs[graphIndex]?.meta?.sourceFiles?.[source.file] === 'string');
  if (!based.length || git(repoRoot, ['rev-parse', '--is-inside-work-tree']).status !== 0) return null;
  const current = fingerprintFiles(repoRoot, [...new Set(based.map(({ source }) => source.file))]) ?? {};
  const diffs = new Map(), unchecked = new Set();
  const diffOf = (graphIndex, file) => {
    const blob = graphs[graphIndex].meta.sourceFiles[file];
    if (blob === current[file]) return { hunks: [], before: null };
    const key = `${blob}:${file}`;
    if (!diffs.has(key)) diffs.set(key, fileDiff(repoRoot, blob, file));
    if (!diffs.get(key)) unchecked.add(`${file} (${blob.slice(0, 7)})`);
    return diffs.get(key);
  };
  const views = graphs.map((graph, i) => graph?.meta?.viewId ?? graph?.meta?.diagramType ?? `view ${i + 1}`);
  const texts = graphs.flatMap((graph, i) => textsOf(graph, views[i], i));
  const scope = [...new Set(anchors.map(({ source }) => source.file))];
  const scopeText = new Map(), scopeOf = file => { if (!scopeText.has(file)) { try { scopeText.set(file, read(file).join('\n')); } catch { scopeText.set(file, ''); } } return scopeText.get(file); };
  const terms = new Set(anchors.map(({ source }) => term(source.symbol ?? '')).filter(name => name && (name.length >= 6 || /[A-Z_]/.test(name.slice(1)))));
  const receivers = new Set(scope.map(file => path.basename(file).replace(/\.\w+$/, '').toLowerCase()));
  const alarms = new Map(), moves = new Map(), held = new Map(), reported = new Set();
  const alarm = (file, hunk, kind) => {
    const key = `${file}#${hunk.oldStart}`;
    if (!alarms.has(key)) alarms.set(key, { file, oldLine: hunk.oldStart, newLine: hunk.newStart, kinds: new Set(), removed: hunk.removed.filter(isCode).map(line => line.trim()), added: hunk.added.filter(isCode).map(line => line.trim()), anchors: new Set(), mentions: new Set(), refs: new Set() });
    const item = alarms.get(key); item.kinds.add(kind); return item;
  };
  const mention = (item, test) => { for (const t of texts) if (test(t.text) && !reported.has(t)) { reported.add(t); if (t.id !== null) item.refs.add(`${t.graphIndex}:${t.id}`); item.mentions.add(`${t.element}${t.key ? ` ${t.key}` : ''}: "${[...t.text].slice(0, 80).join('')}"`); } };
  let realigned = 0;

  // Rules 1-2: carry every anchor to its new lines; an anchor whose own line was rewritten is a change to report.
  for (const anchor of based) {
    const { source } = anchor, diff = diffOf(anchor.graphIndex, source.file);
    if (!diff) continue;
    const end = source.lineEnd ?? source.lineStart, container = end - source.lineStart > 3;
    const start = mapLine(diff.hunks, source.lineStart), last = mapLine(diff.hunks, end);
    const rewritten = !container && Array.from({ length: end - source.lineStart + 1 }, (_, i) => mapLine(diff.hunks, source.lineStart + i)).find(result => result.hunk);
    if (rewritten) {
      const { hunk } = rewritten, item = alarm(source.file, hunk, 'anchored line rewritten');
      item.anchors.add(`${anchor.element}${source.symbol ? ` (${source.symbol})` : ''}`); item.refs.add(`${anchor.graphIndex}:${anchor.id}`);
      const added = hunk.added.join('\n');
      for (const value of new Set(hunk.removed.join('\n').match(/(?<![\w$.])\d+(?:\.\d+)?(?![\w$])/g) ?? [])) if (!numberIn(value).test(added)) mention(item, text => numberIn(value).test(text));
      const lineStart = Math.max(1, hunk.newStart + Math.min(source.lineStart - hunk.oldStart, Math.max(0, hunk.newCount - 1)));
      moves.set(source, { lineStart, lineEnd: source.lineEnd === undefined ? undefined : lineStart + end - source.lineStart });
      continue;
    }
    const lineStart = start.line ?? start.hunk.newStart, lineEnd = source.lineEnd === undefined ? undefined : container ? (last.line ?? last.hunk.newStart + last.hunk.newCount - 1) : lineStart + end - source.lineStart;
    if (lineStart !== source.lineStart) realigned++;
    moves.set(source, { lineStart, lineEnd });
    if (!container) { const lines = held.get(source.file) ?? new Set(); for (let line = lineStart; line <= (lineEnd ?? lineStart); line++) lines.add(line); held.set(source.file, lines); }
  }

  const seen = new Set();
  for (const anchor of based) {
    const file = anchor.source.file, diff = diffOf(anchor.graphIndex, file), key = `${graphs[anchor.graphIndex].meta.sourceFiles[file]}:${file}`;
    if (!diff?.hunks.length || seen.has(key)) continue;
    seen.add(key);
    let lines; try { lines = read(file); } catch { continue; }
    for (const hunk of diff.hunks) {
      // Rule 3: a removed (not renamed) call leaves its target with no caller in the repository.
      const addedCalls = new Set(hunk.added.flatMap(callsIn));
      for (const name of new Set(hunk.removed.filter(isCode).flatMap(callsIn))) {
        if (addedCalls.has(name) || name.length < 6) continue;
        const span = methodSpan(lines, name);
        if (!span) continue;
        const found = git(repoRoot, ['grep', '-n', '-w', '-F', name]);
        const callers = (found.status === 0 ? found.stdout.split('\n') : []).filter(line => word(name).test(line) && new RegExp(`${name}\\s*\\(`).test(line) && !new RegExp(`(public|private|protected)\\b[^;=]*\\b${name}\\s*\\(`).test(line));
        if (callers.length) continue;
        const item = alarm(file, hunk, `call removed: ${name}() has no remaining caller`);
        for (const other of based) if (other.source.file === file && (other.source.lineEnd ?? other.source.lineStart) - other.source.lineStart <= 3) {
          const line = moves.get(other.source)?.lineStart;
          if (line >= span[0] && line <= span[1]) { item.anchors.add(`${other.element}${other.source.symbol ? ` (${other.source.symbol})` : ''}`); item.refs.add(`${other.graphIndex}:${other.id}`); }
        }
        // Names only this method uses (outside it and the imports they never appear) describe what it did.
        const body = lines.slice(span[0] - 1, span[1]).join('\n');
        const rest = [...lines.slice(0, span[0] - 1), ...lines.slice(span[1])].filter(line => !/^\s*import\b/.test(line)).join('\n');
        const described = [...new Set([...(body.match(/\b[A-Z][a-z][\w$]{6,}\b/g) ?? []), ...(body.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g) ?? [])])].filter(name2 => !word(name2).test(rest));
        for (const name2 of described) mention(item, text => word(name2).test(text));
      }
      // Rule 4: added code that touches what the diagram draws, on lines no anchor covers.
      const covered = held.get(file) ?? new Set();
      const touching = hunk.added.map((line, i) => ({ line, number: hunk.newStart + i })).filter(({ line, number }) => isCode(line) && !covered.has(number)
        && ([...terms].some(name => word(name).test(line)) || [...line.matchAll(/\b([a-z][\w$]*)\s*\.\s*[\w$]+\s*\(/g)].some(match => receivers.has(match[1].toLowerCase()))));
      if (touching.length && !alarms.has(`${file}#${hunk.oldStart}`)) {
        const item = alarm(file, hunk, 'new code not covered by the diagram');
        const fresh = new Set(touching.flatMap(({ line }) => line.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b|\b[a-z][\w$]*[A-Z][\w$]{3,}\b/g) ?? []).filter(name => !word(name).test(diff.before ?? '')));
        for (const name of fresh) mention(item, text => word(name).test(text));
      }
      // Rule 5: names gone from the code this diagram covers but still written in it.
      const addedText = hunk.added.join('\n');
      for (const name of new Set(hunk.removed.filter(isCode).flatMap(line => line.match(/\b[a-z][\w$]*[A-Z][\w$]*\b/g) ?? []).filter(name => name.length >= 6 && !word(name).test(addedText)))) {
        if (scope.some(other => word(name).test(scopeOf(other)))) continue;
        const item = alarm(file, hunk, `name no longer in the code: ${name}`);
        mention(item, text => word(name).test(text));
      }
    }
  }
  const list = [...alarms.values()].filter(item => item.anchors.size || item.mentions.size || [...item.kinds].some(kind => kind.startsWith('new code') || kind.startsWith('call removed')))
    .map(item => ({ ...item, kinds: [...item.kinds], anchors: [...item.anchors], mentions: [...item.mentions], refs: [...item.refs] }));
  return { files: new Set(based.map(({ source }) => source.file)).size, realigned, alarms: list, moves, unchecked: [...unchecked] };
}

export function formatDrift(alarms) {
  return alarms.map(item => [
    `■ ${item.file} line ${item.oldLine} → ${item.newLine}: ${item.kinds.join('; ')}`,
    ...item.removed.slice(0, 6).map(line => `    - ${line}`), ...item.added.slice(0, 6).map(line => `    + ${line}`),
    ...item.anchors.map(anchor => `    → ${anchor}`), ...item.mentions.map(text => `    → ${text}`)
  ].join('\n')).join('\n');
}

// Alarms touching view graphIndex: they name one of its elements or change a file it anchors.
export const viewAlarms = (alarms, graphIndex, files) => alarms.filter(item => item.refs.some(ref => ref.startsWith(`${graphIndex}:`)) || files.has(item.file));

// The compact form kept in meta.sourceDrift until the author has updated the listed elements; `elements` holds the ids
// in view graphIndex that the change touches (anchored there or whose text names what changed).
export const driftItems = (alarms, graphIndex) => alarms.map(item => ({
  file: item.file, line: item.newLine, change: item.kinds.join('; '),
  elements: [...new Set(item.refs.filter(ref => ref.startsWith(`${graphIndex}:`)).map(ref => ref.slice(ref.indexOf(':') + 1)))],
  ...(item.removed.length ? { removed: item.removed.slice(0, 6) } : {}), ...(item.added.length ? { added: item.added.slice(0, 6) } : {}),
  ...(item.anchors.length ? { anchors: item.anchors } : {}), ...(item.mentions.length ? { mentions: item.mentions } : {})
}));
