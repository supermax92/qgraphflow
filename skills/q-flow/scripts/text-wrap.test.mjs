import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText } from '../assets/viewer/src/text-layout.js';
import { collection, jeepay } from '../../../tests/jeepay.mjs';

// A width estimate used to select identifier cases that fit the tested line.
const widthOf = (value, fontSize) => [...value].reduce((sum, character) => sum + fontSize * (/[^\u0000-ÿ]|[MWmw@%&]/.test(character) ? 1 : /[A-Z]/.test(character) ? .8 : 6.8 / 12), 0);
const CLOSING = [...'，。、．；：！？）］｝〕】》〉」』”’…'], OPENING = [...'（［｛〔【《〈「『“‘'];
const random = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (next, items) => items[Math.floor(next() * items.length)];

test('an identifier that fits a line is never cut, whatever the CJK punctuation around it', () => {
  const labels = jeepay('state').edges.map(edge => [edge.label, edge.guard, edge.action].filter(Boolean).join(' / '));
  for (const label of labels) for (const limit of [180, 210, 240, 300]) {
    const { lines } = layoutText(label, limit, 16, 24);
    assert.equal(lines.join(''), label);
    for (const run of label.match(/[^\s　-〿＀-￯一-鿿]+/g)) {
      if (widthOf(run, 16) <= limit) assert.ok(lines.some(line => line.includes(run)), `${run} was cut at ${limit}: ${JSON.stringify(lines)}`);
    }
  }
});

test('closing punctuation never starts a line and opening punctuation never ends one', () => {
  const next = random(7), alphabet = [...'订单支付结算库存发货收取消状态', ...CLOSING, ...CLOSING.slice(0, 5), ...OPENING, 'A', 'b', '_', '=', '1', 'x'];
  for (let round = 0; round < 300; round++) {
    const first = pick(next, [...'订单支付结算']), middle = Array.from({ length: 30 + Math.floor(next() * 50) }, () => pick(next, alphabet)).join(''), last = pick(next, [...'库存发货']);
    const value = first + middle + last, limit = 90 + Math.floor(next() * 120), { lines } = layoutText(value, limit, 16, 24);
    assert.equal(lines.join(''), value);
    for (const line of lines.slice(1)) assert.ok(!CLOSING.includes([...line][0]), `line starts with ${line[0]} (limit ${limit}): ${JSON.stringify(lines)}`);
    for (const line of lines.slice(0, -1)) assert.ok(!OPENING.includes([...line].at(-1)), `line ends with ${[...line].at(-1)} (limit ${limit}): ${JSON.stringify(lines)}`);
  }
});

test('an identifier wider than the line is cut at its own separators before any other place', () => {
  const identifier = 'ConfigContextQueryService.getMchAppConfigContext';
  for (const limit of [140, 170, 220]) {
    const { lines } = layoutText(identifier, limit, 16, 24);
    assert.equal(lines.join(''), identifier);
    assert.ok(lines.length > 1);
    for (let i = 0; i < lines.length - 1; i++) {
      assert.ok(/[_./\-=,;:|&)>\]}]$/.test(lines[i]) || (/[a-z0-9]$/.test(lines[i]) && /^[A-Z]/.test(lines[i + 1])), `cut inside a word at ${limit}: ${JSON.stringify(lines)}`);
    }
  }
  const unbroken = 'a'.repeat(60), { lines } = layoutText(unbroken, 150, 16, 24);
  assert.equal(lines.join(''), unbroken, 'a token with no separator at all still wraps, anywhere');
  assert.ok(lines.length > 1 && lines.every(line => widthOf(line, 16) <= 150));
});

test('all Jeepay titles, notes and relationship labels preserve their complete text when wrapped', () => {
  const values = collection.diagrams.flatMap(graph => [graph.meta.title, ...(graph.meta.notes ?? []),
    ...graph.nodes.flatMap(node => [node.label, node.subtitle, ...(node.facts ?? [])]),
    ...graph.edges.flatMap(edge => [edge.label, edge.guard, edge.action])]).filter(value => typeof value === 'string');
  for (const value of values) for (const limit of [140, 220, 360]) {
    assert.equal(layoutText(value, limit, 16, 24).lines.join(''), value.replace(/\r?\n/g, ''));
  }
});

test('no character is ever dropped or invented, in any script', () => {
  const next = random(23), alphabet = [...'订单支付Aa_=.1 \t（），；字段Состояниеçéß한국어', '\n'];
  for (let round = 0; round < 300; round++) {
    const value = Array.from({ length: 5 + Math.floor(next() * 90) }, () => pick(next, alphabet)).join(''), limit = 30 + Math.floor(next() * 260);
    assert.equal(layoutText(value, limit, 16, 24).lines.join('\n').replace(/\n/g, ''), value.replace(/\r?\n/g, ''), JSON.stringify(value));
  }
});

test('words of non-CJK languages stay whole when they fit', () => {
  for (const [value, limit] of [['Состояние в процессе: от тёплого цвета к холодному по мере продвижения', 170], ['Zustand in Bearbeitung: von warm nach kalt, je weiter er fortschreitet', 150], ['État en cours : du chaud au froid à mesure qu’il avance', 140]]) {
    const { lines } = layoutText(value, limit, 14, 20);
    for (const word of value.split(' ')) if (widthOf(word, 14) <= limit) assert.ok(lines.some(line => line.includes(word)), `${word}: ${JSON.stringify(lines)}`);
  }
});
