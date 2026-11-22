// Fake TikTok LIVE events. No network, no TikTok.
import { EventEmitter } from 'node:events';

const FIRST = ['ali', 'zeynep', 'mehmet', 'ayse', 'can', 'elif', 'emre', 'selin', 'mert', 'deniz', 'max', 'lena', 'sam', 'nora', 'leo', 'mia', 'omar', 'yuki', 'ivan', 'sofia'];
const SUFFIX = ['', '_01', '.tr', '99', '_x', '07', '_official', '123', '.live', '_42'];
const CHATS = ['JOIN', 'join', 'BLUE', 'RED', 'GREEN', 'GOLD', 'WAVE', 'hello!', 'lol', 'nice stream', '🔥🔥', 'Join pls'];
const GIFTS = [
  { name: 'Rose', diamonds: 1, giftType: 1, w: 60 },
  { name: 'Heart', diamonds: 10, giftType: 1, w: 25 },
  { name: 'Perfume', diamonds: 20, giftType: 1, w: 10 },
  { name: 'Lion', diamonds: 299, giftType: 2, w: 3 },
  { name: 'Universe', diamonds: 3000, giftType: 2, w: 2 },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickW = (a) => { let r = Math.random() * a.reduce((s, x) => s + x.w, 0); for (const x of a) if ((r -= x.w) < 0) return x; return a[0]; };

export class SimulatorSource extends EventEmitter {
  constructor() { super(); this.rate = 0; this.timer = null; this.pool = []; }

  start() { this.emit('status', { connected: true, source: 'simulator' }); }
  stop() { this.setRate(0); }

  randomUser() {
    if (this.pool.length < 400 && (this.pool.length < 20 || Math.random() < 0.3)) {
      const name = pick(FIRST) + pick(SUFFIX) + (Math.random() < 0.5 ? Math.floor(Math.random() * 1000) : '');
      this.pool.push({ userId: 'sim_' + Math.random().toString(36).slice(2, 10), username: name, nickname: name });
    }
    return pick(this.pool);
  }

  // events per second; 0 stops chaos mode
  setRate(rate) {
    this.rate = Math.max(0, Math.min(200, Number(rate) || 0));
    clearInterval(this.timer);
    this.timer = null;
    if (!this.rate) return;
    const tickMs = 50;
    this.timer = setInterval(() => {
      let n = (this.rate * tickMs) / 1000;
      while (n > 0) { if (n >= 1 || Math.random() < n) this.randomEvent(); n -= 1; }
    }, tickMs);
  }

  randomEvent() {
    const u = this.randomUser();
    const r = Math.random();
    if (r < 0.7) this.emit('raw', { type: 'chat', ...u, text: pick(CHATS) });
    else if (r < 0.9) this.emit('raw', { type: 'like', ...u, count: 1 + Math.floor(Math.random() * 15) });
    else if (r < 0.96) this.emit('raw', { type: 'follow', ...u }); // ~4% gifts: closer to a real stream
    else this.gift(u, pickW(GIFTS), 1 + Math.floor(Math.random() * 5));
  }

  // Emits streak updates like real TikTok; only the last has repeatEnd.
  gift(u, g, count = 1) {
    for (let i = 1; i <= count; i++) {
      const end = g.giftType !== 1 || i === count;
      this.emit('raw', { type: 'gift', ...u, gift: { name: g.name, diamonds: g.diamonds, giftType: g.giftType, repeatCount: i, repeatEnd: g.giftType === 1 ? end : undefined } });
    }
  }

  // manual event from the dev panel
  inject(e) {
    const u = e.username ? { userId: 'man_' + e.username, username: e.username, nickname: e.username } : this.randomUser();
    if (e.type === 'gift') {
      const g = GIFTS.find((x) => x.name === e.gift) ?? GIFTS[0];
      return this.gift(u, g, Number(e.count) || 1);
    }
    this.emit('raw', { type: e.type, ...u, text: e.text, count: e.count });
  }
}
