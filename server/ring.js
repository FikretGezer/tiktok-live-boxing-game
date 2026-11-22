// Boxing ring mode.
// - Gifts and likes give points (1 diamond = diamondPoints, 1 like = likePoints).
// - The two highest scorers not in the ring climb in (red and blue corners) and fight.
// - Points sent DURING a fight by a fighter give them power (harder punches) and heal them (like = 0.5 HP, 1 diamond = 5 HP by default).
// - Loser goes back to the crowd with score reset to 0; winner stays; next highest scorer climbs in.

const DEFAULTS = { diamondPoints: 10, likePoints: 1, punchMs: 800, minDamage: 5, maxDamage: 11, missChance: 0.25, maxBoost: 1.5, boostPer: 100, healPerPoint: 0.5, startDelayMs: 2500, koDelayMs: 3000 };

export class Ring {
  constructor(game, settings = {}) {
    this.game = game;
    this.s = { ...DEFAULTS, ...settings };
    this.scores = new Map(); // userId -> {name, score, wins}
    this.corner = { red: null, blue: null }; // userIds
    this.hp = {}; this.power = {};
    this.phase = 'waiting'; // waiting | starting | fighting | ko
    this.timers = new Set();
    this.lbTimer = null;
    this.punchTimer = setInterval(() => this.tick(), this.s.punchMs);
  }

  destroy() { clearInterval(this.punchTimer); for (const t of this.timers) clearTimeout(t); clearTimeout(this.lbTimer); }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); }
  out(op) { this.game.out(op); }

  entry(userId, name) {
    let e = this.scores.get(userId);
    if (!e) { e = { name, score: 0, wins: 0 }; this.scores.set(userId, e); }
    if (name) e.name = name;
    return e;
  }

  inRing(userId) { return this.corner.red === userId || this.corner.blue === userId; }

  addPoints(ev, pts) {
    if (!(pts > 0)) return;
    const e = this.entry(ev.userId, ev.nickname);
    e.score += pts;
    if (this.inRing(ev.userId) && this.phase === 'fighting') {
      this.power[ev.userId] = (this.power[ev.userId] ?? 0) + pts;
      const before = this.hp[ev.userId];
      this.hp[ev.userId] = Math.min(100, before + pts * this.s.healPerPoint);
      const healed = this.hp[ev.userId] - before;
      if (healed > 0) this.out({ op: 'heal', id: ev.userId, amount: healed, hp: Math.round(this.hp[ev.userId]) });
      this.out({ op: 'ringState', ring: this.state() });
    }
    this.scheduleLeaderboard();
    if (this.phase === 'waiting') this.fill();
  }

  challengers() {
    return [...this.scores.entries()].filter(([id, e]) => e.score > 0 && !this.inRing(id)).sort((a, b) => b[1].score - a[1].score);
  }

  leaderboard() {
    return [...this.scores.values()].filter((e) => e.score > 0 || e.wins > 0).sort((a, b) => b.score - a.score).slice(0, 5)
      .map((e) => ({ name: e.name, diamonds: e.score, wins: e.wins }));
  }

  scheduleLeaderboard() {
    if (this.lbTimer) return;
    this.lbTimer = setTimeout(() => { this.lbTimer = null; this.out({ op: 'leaderboard', leaderboard: this.leaderboard() }); this.out({ op: 'ringState', ring: this.state() }); }, 400);
  }

  state() {
    const f = (c) => { const id = this.corner[c]; if (!id) return null; const e = this.scores.get(id); return { id, name: e?.name ?? id, hp: Math.max(0, Math.round(this.hp[id] ?? 100)), wins: e?.wins ?? 0, power: Math.round(Math.min(this.s.maxBoost, (this.power[id] ?? 0) / this.s.boostPer) * 100) }; };
    return { phase: this.phase, red: f('red'), blue: f('blue'), next: this.challengers().slice(0, 3).map(([, e]) => e.name) };
  }

  fill() {
    for (const c of ['red', 'blue']) {
      if (this.corner[c]) continue;
      const next = this.challengers()[0];
      if (!next) break;
      const [id, e] = next;
      const a = this.game.avatars.get(id) ?? this.game.spawnNow({ userId: id, nickname: e.name });
      if (!a) break;
      this.corner[c] = id; this.hp[id] = 100; this.power[id] = 0;
      a.slot = c; a.protectedUntil = Infinity; this.game.touch(a);
      this.out({ op: 'update', avatar: a });
      this.out({ op: 'banner', text: `🥊 ${e.name} climbs into the ring!` });
    }
    this.out({ op: 'ringState', ring: this.state() });
    if (this.corner.red && this.corner.blue && this.phase === 'waiting') {
      this.phase = 'starting';
      this.out({ op: 'ringState', ring: this.state() });
      this.later(() => { this.phase = 'fighting'; this.out({ op: 'fightStart', ring: this.state() }); }, this.s.startDelayMs);
    }
  }

  tick() {
    if (this.phase !== 'fighting') return;
    const r = this.corner.red, b = this.corner.blue;
    // stronger fighter attacks a bit more often
    const pr = 1 + this.boost(r), pb = 1 + this.boost(b);
    const [att, def] = Math.random() < pr / (pr + pb) ? [r, b] : [b, r];
    const miss = Math.random() < this.s.missChance;
    const dmg = miss ? 0 : Math.round((this.s.minDamage + Math.random() * (this.s.maxDamage - this.s.minDamage)) * (1 + this.boost(att)));
    this.hp[def] = Math.max(0, this.hp[def] - dmg);
    this.out({ op: 'punch', by: att, target: def, dmg, miss, hp: this.hp[def], hand: Math.random() < 0.5 ? 'left' : 'right' });
    if (this.hp[def] <= 0) this.ko(att, def);
  }

  boost(id) { return Math.min(this.s.maxBoost, (this.power[id] ?? 0) / this.s.boostPer); }

  ko(winner, loser) {
    this.phase = 'ko';
    const we = this.entry(winner), le = this.entry(loser);
    we.wins++;
    this.out({ op: 'ko', winner, loser, winnerName: we.name, loserName: le.name, wins: we.wins });
    this.later(() => {
      le.score = 0;
      const corner = this.corner.red === loser ? 'red' : 'blue';
      this.corner[corner] = null;
      const la = this.game.avatars.get(loser);
      if (la) { la.slot = 'crowd'; la.protectedUntil = Date.now() + this.game.limits.giftProtectMinutes * 60000; this.out({ op: 'update', avatar: la }); }
      this.hp[winner] = 100; this.power[winner] = 0;
      this.phase = 'waiting';
      this.out({ op: 'leaderboard', leaderboard: this.leaderboard() });
      this.fill();
    }, this.s.koDelayMs);
  }
}
