// TikTok LIVE source. The ONLY file that touches tiktok-live-connector (unofficial).
// Loaded lazily, so the game runs fine on the simulator if the package is missing or broken.
import { EventEmitter } from 'node:events';

export class TikTokSource extends EventEmitter {
  constructor({ username, signApiKey } = {}) {
    super();
    this.username = String(username ?? '').replace(/^@/, '').trim();
    this.signApiKey = signApiKey || undefined;
    this.conn = null;
    this.retryMs = 2000;
    this.stopped = true;
    this.retryTimer = null;
  }

  status(connected, extra = {}) { this.emit('status', { connected, source: 'tiktok', username: this.username, ...extra }); }

  async start() {
    if (!this.username) return this.status(false, { error: 'no username set' });
    this.stopped = false;
    let lib;
    try { lib = await import('tiktok-live-connector'); }
    catch (e) { return this.status(false, { error: 'tiktok-live-connector not installed: ' + e.message }); }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    this.conn = new TikTokLiveConnection(this.username, { signApiKey: this.signApiKey });
    const c = this.conn;
    // Field names differ between library versions (README says uniqueId/comment; v2.5 sends id/displayId/content).
    const user = (d) => {
      const u = d?.user ?? {};
      const handle = u.uniqueId || u.displayId;
      return { userId: String(u.userId || u.id || handle || ''), username: handle || u.nickname, nickname: u.nickname || handle };
    };
    const send = (raw) => { if (raw.userId) this.emit('raw', raw); };
    let loggedGift = false;

    c.on(WebcastEvent.CHAT, (d) => send({ type: 'chat', ...user(d), text: d.comment ?? d.content }));
    c.on(WebcastEvent.GIFT, (d) => {
      const g = d.giftDetails ?? d.gift ?? {};
      if (!loggedGift) { loggedGift = true; console.log('[tiktok] first gift fields:', Object.keys(d).join(','), '| details:', Object.keys(g).join(',')); }
      send({
        type: 'gift', ...user(d),
        gift: { name: g.giftName ?? g.name ?? `Gift ${d.giftId}`, diamonds: Number(g.diamondCount ?? 0), giftType: Number(g.giftType ?? g.type), repeatCount: d.repeatCount, repeatEnd: Boolean(d.repeatEnd) },
      });
    });
    c.on(WebcastEvent.LIKE, (d) => send({ type: 'like', ...user(d), count: d.likeCount ?? d.count }));
    c.on(WebcastEvent.FOLLOW, (d) => send({ type: 'follow', ...user(d) }));
    c.on(WebcastEvent.SHARE, (d) => send({ type: 'share', ...user(d) }));
    c.on(WebcastEvent.MEMBER, (d) => send({ type: 'join', ...user(d) }));
    c.on(ControlEvent.DISCONNECTED, () => { this.status(false, { error: 'disconnected' }); this.scheduleRetry(); });
    c.on(ControlEvent.ERROR, (e) => console.warn('[tiktok] error:', e?.exception?.message ?? e?.info ?? e?.message ?? e));
    this.connect();
  }

  async connect() {
    if (this.stopped || !this.conn) return;
    this.status(false, { connecting: true });
    try {
      const state = await this.conn.connect();
      this.retryMs = 2000;
      console.log(`[tiktok] connected to @${this.username} (room ${state?.roomId ?? '?'})`);
      this.status(true);
    } catch (e) {
      const msg = e?.constructor?.name === 'UserOfflineError' ? `@${this.username} is not live` : (e?.message ?? String(e));
      console.warn('[tiktok] connect failed:', msg);
      this.status(false, { error: msg });
      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    if (this.stopped || this.retryTimer) return;
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 60000);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, wait);
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer); this.retryTimer = null;
    try { await this.conn?.disconnect(); } catch {}
    this.conn?.removeAllListeners?.();
    this.conn = null;
    this.status(false);
  }
}
