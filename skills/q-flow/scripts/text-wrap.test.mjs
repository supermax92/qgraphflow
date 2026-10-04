import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText } from '../assets/viewer/src/text-layout.js';

// The width model of text-layout.js, repeated so the "wraps exactly as before" check has its own reference.
const widthOf = (value, fontSize) => [...value].reduce((sum, character) => sum + fontSize * (/[^\u0000-ÿ]|[MWmw@%&]/.test(character) ? 1 : /[A-Z]/.test(character) ? .8 : 6.8 / 12), 0);
function wrappedBefore(value, limit, fontSize) {
  const lines = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = '', width = 0;
    for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
      const tokenWidth = widthOf(token, fontSize);
      if (line && tokenWidth <= limit && width + tokenWidth > limit) { lines.push(line); line = ''; width = 0; }
      for (const character of token) {
        const characterWidth = widthOf(character, fontSize);
        if (line && width + characterWidth > limit) { lines.push(line); line = ''; width = 0; }
        line += character; width += characterWidth;
      }
    }
    lines.push(line);
  }
  return lines;
}

const CLOSING = [...'，。、．；：！？）］｝〕】》〉」』”’…'], OPENING = [...'（［｛〔【《〈「『“‘'];
const random = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (next, items) => items[Math.floor(next() * items.length)];

test('an identifier that fits a line is never cut, whatever the CJK punctuation around it', () => {
  const labels = [
    'tz_order：status=6、cancel_time=NOW()；返还 SKU 与商品库存；发布 CancelOrderEvent',
    'pay [结算单未支付，且 updateToPay 按 version 更新成功] / tz_order：status=2、is_payed=1、pay_time=NOW()',
    'submit / 生成订单号；写入订单（status=1、is_payed=0）与结算单（pay_status=0）；扣减 SKU 与商品库存'
  ];
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
  const identifier = 'orderSettlementMapper.updateByOrderNumberAndUserId';
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

test('text without an over-long token wraps exactly as it did before', () => {
  const next = random(11), words = ['Create', 'payment', 'request', '支付结果', '订单', 'status=2', 'OrderService.submit', 'UNPAY）', '（待付款', 'Состояние', 'Zustand', 'a', 'of'];
  let compared = 0;
  for (let round = 0; round < 400; round++) {
    const value = Array.from({ length: 3 + Math.floor(next() * 12) }, () => pick(next, words)).join(next() < .2 ? '  ' : ' '), limit = 140 + Math.floor(next() * 220), fontSize = pick(next, [14, 16, 20]);
    if (value.split(/\s+/).some(word => widthOf(word, fontSize) > limit)) continue;
    assert.deepEqual(layoutText(value, limit, fontSize).lines, wrappedBefore(value, limit, fontSize), `${JSON.stringify(value)} @${limit}/${fontSize}`);
    compared++;
  }
  assert.ok(compared > 300, `only ${compared} comparable samples`);
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
