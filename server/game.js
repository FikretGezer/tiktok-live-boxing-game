// Game state + rules engine. Emits ops ({op, ...}) for the client.
import { EventEmitter } from 'node:events';
import { Ring } from './ring.js';

const upper = (s) => String(s ?? '').trim().toUpperCase();

export class Game extends EventEmitter {
  constructor(theme, config) {
    super();
    this.theme = theme;
    this.limits = config.limits;
    this.blocklist = (config.blocklist ?? []).map(upper);
    this.avatars = new Map(); // userId -> avatar
    this.queue = [];          // pending spawns
    this.queued = new Set();
    this.lastAction = new Map();
    this.likes = 0;
    this.supporters = new Map(); // userId -> {name, diamonds}
    this.stats = { events: 0, spawned: 0, evicted: 0, dropped: 0 };
    this.spawnTimer = setInterval(() => this.drainQueue(), 1000 / this.limits.spawnsPerSecond);
    this.ring = theme.mode === 'ring' ? new Ring(this, theme.ring) : null;
  }

  destroy() { clearInterval(this.spawnTimer); this.ring?.destroy(); }

  out(op) { this.emit('op', op); }

  snapshot() {
    return { op: 'sync', theme: this.theme, avatars: [...this.avatars.values()], leaderboard: this.leaderboard(), ring: this.ring?.state() ?? null, stats: this.stats };
  }

  blocked(ev) { const n = upper(ev.username) + ' ' + upper(ev.nickname); return this.blocklist.some((b) => b && n.includes(b)); }

  handle(ev) {
    this.stats.events++;
    if (this.blocked(ev)) return;
    for (const rule of this.theme.rules) {
      if (rule.on !== ev.type) continue;
      if (ev.type === 'chat') {
        const want = [].concat(rule.match).map(upper);
        const word = upper(ev.text);
        const hit = want.find((w) => word === w || word.split(/\s+/).includes(w));
        if (!hit) continue;
        if (!this.cooldownOk(ev.userId, rule.do)) continue;
        this.apply(rule, ev, hit);
      } else if (ev.type === 'like') {
        const before = Math.floor(this.likes / rule.every);
        this.likes += ev.count;
        if (Math.floor(this.likes / rule.every) > before) this.apply(rule, ev);
      } else if (ev.type !== 'gift') {
        this.apply(rule, ev);
      }
    }
    if (ev.type === 'gift') this.handleGift(ev);
    if (ev.type === 'like' && this.ring) this.ring.addPoints(ev, ev.count * this.ring.s.likePoints);
  }

  cooldownOk(userId, action) {
    const k = userId + ':' + action, now = Date.now();
    if (now - (this.lastAction.get(k) ?? 0) < this.limits.userCooldownMs) return false;
    this.lastAction.set(k, now);
    return true;
  }

  handleGift(ev) {
    const total = ev.gift.diamonds * ev.gift.count;
    if (this.ring) {
      this.out({ op: 'banner', text: `${ev.nickname} sent ${ev.gift.count}× ${ev.gift.name}` });
      const a = this.avatars.get(ev.userId) ?? this.spawnNow(ev);
      if (a) this.out({ op: 'effect', effect: 'sparkle', by: a.name, id: a.id });
      this.ring.addPoints(ev, total * this.ring.s.diamondPoints);
      return;
    }
    const s = this.supporters.get(ev.userId) ?? { name: ev.nickname, diamonds: 0 };
    s.diamonds += total; s.name = ev.nickname;
    this.supporters.set(ev.userId, s);
    this.out({ op: 'banner', text: `${ev.nickname} sent ${ev.gift.count}× ${ev.gift.name}` });
    this.out({ op: 'leaderboard', leaderboard: this.leaderboard() });
    // best matching gift rule (highest threshold)
    const rule = this.theme.rules.filter((r) => r.on === 'gift' && total >= (r.minDiamonds ?? 0))
      .sort((a, b) => (b.minDiamonds ?? 0) - (a.minDiamonds ?? 0))[0];
    if (rule) this.apply(rule, ev);
  }

  leaderboard() {
    if (this.ring) return this.ring.leaderboard();
    return [...this.supporters.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, 5);
  }

  apply(rule, ev, matched) {
    switch (rule.do) {
      case 'spawn': return this.requestSpawn(ev);
      case 'setTeam': {
        const a = this.avatars.get(ev.userId);
        if (!a) return this.requestSpawn(ev, { team: matched });
        a.team = matched; this.touch(a);
        return this.out({ op: 'update', avatar: a });
      }
      case 'say': {
        const a = this.avatars.get(ev.userId);
        if (a) { this.touch(a); this.out({ op: 'say', id: a.id, text: rule.text }); }
        return;
      }
      case 'promote': return this.promote(ev, rule.slot, rule.effect);
      case 'effect': return this.out({ op: 'effect', effect: rule.effect, by: ev.nickname });
    }
  }

  touch(a) { a.lastActive = Date.now(); }

  requestSpawn(ev, extra = {}) {
    const a = this.avatars.get(ev.userId);
    if (a) { this.touch(a); return; }
    if (this.queued.has(ev.userId)) return;
    if (this.queue.length > 500) { this.stats.dropped++; return; }
    this.queued.add(ev.userId);
    this.queue.push({ ev, extra });
  }

  drainQueue() {
    const item = this.queue.shift();
    if (!item) return;
    this.queued.delete(item.ev.userId);
    this.spawnNow(item.ev, item.extra);
  }

  spawnNow(ev, extra = {}) {
    if (this.avatars.has(ev.userId)) return this.avatars.get(ev.userId);
    if (this.avatars.size >= this.limits.maxAvatars && !this.evictOne()) { this.stats.dropped++; return null; }
    const a = { id: ev.userId, name: ev.nickname, team: extra.team ?? null, slot: 'crowd', protectedUntil: 0, lastActive: Date.now() };
    this.avatars.set(a.id, a);
    this.stats.spawned++;
    this.out({ op: 'spawn', avatar: a });
    return a;
  }

  // remove least-recently-active avatar that is in the crowd and not gift-protected
  evictOne() {
    const now = Date.now();
    let victim = null;
    for (const a of this.avatars.values()) {
      if (a.slot !== 'crowd' || a.protectedUntil > now) continue;
      if (!victim || a.lastActive < victim.lastActive) victim = a;
    }
    if (!victim) return false;
    this.avatars.delete(victim.id);
    this.stats.evicted++;
    this.out({ op: 'remove', id: victim.id });
    return true;
  }

  promote(ev, slot, effect) {
    const a = this.avatars.get(ev.userId) ?? this.spawnNow(ev); // gifters skip the queue
    if (!a) return;
    a.protectedUntil = Date.now() + this.limits.giftProtectMinutes * 60000;
    this.touch(a);
    if (slot === 'hero') {
      for (const o of this.avatars.values()) if (o.slot === 'hero' && o !== a) { o.slot = 'front'; this.out({ op: 'update', avatar: o }); }
      a.slot = 'hero';
    } else if (a.slot !== 'hero') {
      a.slot = 'front';
    }
    // front row overflow: oldest front member goes back to crowd
    const front = [...this.avatars.values()].filter((o) => o.slot === 'front').sort((x, y) => x.lastActive - y.lastActive);
    while (front.length > this.limits.frontSlots) { const o = front.shift(); o.slot = 'crowd'; this.out({ op: 'update', avatar: o }); }
    this.out({ op: 'update', avatar: a });
    if (effect) this.out({ op: 'effect', effect, by: a.name, id: a.id });
  }
}
