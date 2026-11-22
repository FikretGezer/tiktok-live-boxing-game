import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './normalize.js';
import { Game } from './game.js';
import { SimulatorSource } from './sources/simulator.js';

const theme = {
  rules: [
    { on: 'chat', match: 'JOIN', do: 'spawn' },
    { on: 'chat', match: ['BLUE', 'RED'], do: 'setTeam' },
    { on: 'gift', minDiamonds: 1, do: 'promote', slot: 'front' },
    { on: 'gift', minDiamonds: 100, do: 'promote', slot: 'hero' },
  ],
};
const cfg = (o = {}) => ({ limits: { maxAvatars: 3, spawnsPerSecond: 1000, userCooldownMs: 0, giftProtectMinutes: 10, frontSlots: 2, ...o }, blocklist: ['BADWORD'] });
const chat = (id, text) => ({ type: 'chat', userId: id, username: id, nickname: id, text, ts: 0 });
const gift = (id, diamonds, count = 1) => ({ type: 'gift', userId: id, username: id, nickname: id, gift: { name: 'G', diamonds, count } });
const flush = (g) => { while (g.queue.length) g.drainQueue(); };

test('gift streak counted once', () => {
  const sim = new SimulatorSource(); const got = [];
  sim.on('raw', (r) => { const e = normalize(r); if (e) got.push(e); });
  sim.gift({ userId: 'u', username: 'u', nickname: 'u' }, { name: 'Rose', diamonds: 1, giftType: 1 }, 10);
  assert.equal(got.length, 1);
  assert.equal(got[0].gift.count, 10);
});

test('one avatar per user', () => {
  const g = new Game(theme, cfg()); g.handle(chat('a', 'JOIN')); g.handle(chat('a', 'join')); flush(g);
  assert.equal(g.avatars.size, 1); g.destroy();
});

test('cap evicts least active crowd member, never gifters', () => {
  const g = new Game(theme, cfg());
  g.handle(gift('rich', 5)); // promoted, protected
  for (const id of ['b', 'c', 'd', 'e']) { g.handle(chat(id, 'JOIN')); flush(g); }
  assert.equal(g.avatars.size, 3);
  assert.ok(g.avatars.has('rich'));
  assert.ok(!g.avatars.has('b'));
  g.destroy();
});

test('big gift makes hero, previous hero drops to front; front overflow returns to crowd', () => {
  const g = new Game(theme, cfg({ maxAvatars: 10 }));
  g.handle(gift('h1', 200)); g.handle(gift('h2', 300));
  assert.equal(g.avatars.get('h2').slot, 'hero');
  assert.equal(g.avatars.get('h1').slot, 'front');
  g.handle(gift('f1', 1)); g.handle(gift('f2', 1));
  assert.equal([...g.avatars.values()].filter((a) => a.slot === 'front').length, 2);
  g.destroy();
});

test('team keyword spawns with team; blocklist ignored', () => {
  const g = new Game(theme, cfg());
  g.handle(chat('t', 'red')); flush(g);
  assert.equal(g.avatars.get('t').team, 'RED');
  g.handle({ ...chat('x', 'JOIN'), nickname: 'i am badword' }); flush(g);
  assert.ok(!g.avatars.has('x')); g.destroy();
});

test('ring: top two scorers fight, loser leaves with score 0, next scorer climbs in', async () => {
  const ringTheme = { mode: 'ring', rules: [], ring: { punchMs: 5, startDelayMs: 5, koDelayMs: 5, missChance: 0, minDamage: 40, maxDamage: 40 } };
  const g = new Game(ringTheme, cfg({ maxAvatars: 10 }));
  g.handle(gift('a', 5)); g.handle(gift('b', 3)); g.handle(gift('c', 1));
  assert.equal(g.avatars.get('a').slot, 'red');
  assert.equal(g.avatars.get('b').slot, 'blue');
  assert.equal(g.avatars.get('c').slot, 'crowd');
  const ko = await new Promise((r) => g.on('op', (op) => op.op === 'ko' && r(op)));
  await new Promise((r) => setTimeout(r, 30));
  const loser = g.avatars.get(ko.loser), winner = g.avatars.get(ko.winner);
  assert.equal(loser.slot, 'crowd');
  assert.equal(g.ring.scores.get(ko.loser).score, 0);
  assert.notEqual(winner.slot, 'crowd');
  assert.notEqual(g.avatars.get('c').slot, 'crowd'); // c climbed in
  g.destroy();
});

test('ring: likes count as points', () => {
  const g = new Game({ mode: 'ring', rules: [] }, cfg({ maxAvatars: 10 }));
  g.handle({ type: 'like', userId: 'l', username: 'l', nickname: 'l', count: 30 });
  assert.equal(g.ring.scores.get('l').score, 30);
  assert.equal(g.avatars.get('l').slot, 'red');
  g.destroy();
});

test('ring: a fighter who sends a gift mid-fight gets HP back', async () => {
  const g = new Game({ mode: 'ring', rules: [], ring: { punchMs: 100000, startDelayMs: 5 } }, cfg({ maxAvatars: 10 }));
  g.handle(gift('a', 5)); g.handle(gift('b', 3));
  await new Promise((r) => setTimeout(r, 30)); // fight started
  assert.equal(g.ring.phase, 'fighting');
  g.ring.hp.a = 40;
  const heal = new Promise((r) => g.on('op', (op) => op.op === 'heal' && r(op)));
  g.handle(gift('a', 2)); // 2 diamonds = 20 points = 10 HP
  const op = await heal;
  assert.equal(op.id, 'a'); assert.equal(g.ring.hp.a, 50);
  g.destroy();
});
