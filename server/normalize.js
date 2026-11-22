// Turns raw source events into the standard event shape.
// Gift streaks: only the final event of a streak counts (repeatEnd === true),
// or a gift that cannot streak (giftType !== 1).

const TYPES = new Set(['chat', 'gift', 'follow', 'like', 'share', 'join']);

export function normalize(raw) {
  if (!raw || !TYPES.has(raw.type)) return null;
  const userId = String(raw.userId ?? '').slice(0, 64);
  if (!userId) return null;
  const ev = {
    type: raw.type,
    userId,
    username: String(raw.username ?? userId).slice(0, 40),
    nickname: String(raw.nickname ?? raw.username ?? userId).slice(0, 40),
    ts: Number(raw.ts) || Date.now(),
  };
  if (raw.type === 'chat') ev.text = String(raw.text ?? '').slice(0, 200);
  if (raw.type === 'like') ev.count = Math.max(1, Number(raw.count) || 1);
  if (raw.type === 'gift') {
    const g = raw.gift ?? {};
    const streakable = g.giftType === 1;
    if (streakable && !g.repeatEnd) return null; // mid-streak update: ignore
    ev.gift = {
      name: String(g.name ?? 'Gift').slice(0, 30),
      diamonds: Math.max(0, Number(g.diamonds) || 0),
      count: Math.max(1, Number(g.count ?? g.repeatCount) || 1),
    };
  }
  return ev;
}
