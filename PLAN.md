# Plan: Interactive TikTok LIVE Crowd Game

Goal: an original crowd scene for TikTok LIVE where viewers become avatars on screen.
- Typing a keyword in chat makes your avatar join the scene.
- Sending a gift moves your avatar to a special spot.
- Following triggers an effect.

The game runs on your PC. OBS (or TikTok LIVE Studio) captures the window and streams it.

> This plan was reviewed with the Fable advisor. Facts marked **[unverified]** come from third-party sources only, not from TikTok's official docs.

---

## Rule #1: Offline-first (user requirement)

**Everything must be fully testable without TikTok.**
- M1–M5 have **zero TikTok dependency**: `tiktok-live-connector` is not installed and there are no network calls to TikTok.
- `config.json` defaults to `"source": "simulator"`.
- The dev panel in the browser can fire every event type by hand: chat with any text, each gift tier, follow, like, share. It also has a "chaos" mode that sends random users at an adjustable rate.
- Recorded event logs can be replayed, so real-looking bursts can be tested offline.
- TikTok is added only at M6, as an optional plug-in. If it fails, the game still runs on the simulator.

---

## 0. Things to know first (risks and limits)

| Topic | What I found | Impact |
|---|---|---|
| **Chat and gift data** | It comes through unofficial, reverse-engineered libraries: `tiktok-live-connector` (Node) and `TikTokLive` (Python). Connecting needs a "signing" service, by default **Euler Stream**. That service has a free shared tier, and an API key gives you your own quota. | It can break without warning. There were reports of widespread breakage in Sept 2026 **[unverified, the report came from a competing vendor]**. Wrap the library so it can be swapped. |
| **Going LIVE** | About **1,000 followers**, and age 18+ to receive gifts. The minimum age to go live is reported as 16 in some sources and 18 in others. **[unverified, varies by region]** | Development must not depend on a real LIVE. That is why the simulator exists (section 2). |
| **Streaming from a PC** | **TikTok LIVE Studio** (Windows) needs no stream key. OBS needs a stream key, which not every account gets. | Default to LIVE Studio with a window capture, and use OBS only if a key is available. |
| **Platform policy** | TikTok restricts content that begs for gifts and may restrict "interactive game" LIVEs. **[not verified]** | Use a respectful, original theme. Don't make gifting feel mandatory. Read the current LIVE guidelines before going public. |
| **Account risk** | Third-party connectors read public data only and never log in as you. | The risk is low, but not zero. |

---

## 1. Architecture (one Node.js process)

```
┌────────────── server (Node.js) ──────────────┐
│  EventSource (pick one):                     │
│    • SimulatorSource   – fake events         │
│    • PublicLiveSource  – any public LIVE     │──► normalize ──► GameState ──► WebSocket ──┐
│    • OwnLiveSource     – your @username      │                (rules,                    │
│  + static file server (serves /client)       │                 queue,                    │
└──────────────────────────────────────────────┘                 limits)                   │
                                                                                           ▼
                                      ┌──────── client (browser, Three.js) ────────┐
                                      │ renders scene 1080×1920, avatars, names,   │
                                      │ effects; dev panel to fire fake events     │
                                      └────────────────────────────────────────────┘
                                                        ▲ captured by LIVE Studio / OBS
```

**Why one process and one language:** fewer moving parts, and it runs with a single `Start.bat`.
- **Server:** Node 20+, `tiktok-live-connector`, `ws`, `express`.
- **Client:** plain HTML and Three.js loaded from a CDN, no build step.

### Folder layout
```
tiktok-live-game/
  server/
    index.js            # boot: pick source, start ws + static server
    sources/simulator.js
    sources/tiktok.js   # wraps tiktok-live-connector (only file touching it)
    normalize.js        # raw → standard events
    game.js             # state, rules engine, queue, limits
  client/
    index.html  main.js  scene.js  avatars.js  hud.js
    assets/             # CC0 models, fonts, sounds
  themes/
    default.json        # keywords, gift rules, text, colors, scene
  config.json           # username, source, limits, sign key (gitignored)
  Start.bat
```

---

## 2. Event sources (all three are interchangeable)

1. **SimulatorSource:** generates random users and fires chat, gift, follow, like and share events at a rate you set. It also exposes a hotkey panel in the browser. **All development happens here.**
2. **PublicLiveSource:** connects read-only to *any* public LIVE, such as a big streamer. This tests real ingest without needing your own account.
3. **OwnLiveSource:** your own stream, used on the actual day.

Each source exposes `start()` and `stop()` and emits **normalized events**.

### Normalized event schema
```json
{ "type": "chat|gift|follow|like|share|join",
  "userId": "stable unique id",
  "username": "@handle", "nickname": "display name",
  "avatarUrl": "...",
  "text": "chat text (chat only)",
  "gift": { "name": "Rose", "diamonds": 1, "count": 5 },
  "ts": 1731900000000 }
```

### Gift streaks (important)
TikTok sends repeated updates while a gift combo is in progress. Only the **final** event counts: in the library, that is the one with `repeatEnd` true, or a gift type that cannot streak. Without this rule, a single streak of 10 Roses would be counted 10 times or more. Unit-test it with recorded events.

---

## 3. Rules engine (driven by the theme file)

The theme is a JSON file, so you can make a new "game" without touching code:

```json
{
  "title": "The Great Parade",
  "scene": "plaza",
  "rules": [
    { "on": "chat",   "match": "JOIN",          "do": "spawn" },
    { "on": "chat",   "match": ["BLUE","RED"],  "do": "setTeam" },
    { "on": "gift",   "minDiamonds": 1,          "do": "promote", "slot": "front" },
    { "on": "gift",   "minDiamonds": 100,        "do": "promote", "slot": "hero", "effect": "fireworks" },
    { "on": "follow",                            "do": "effect",  "effect": "confetti" },
    { "on": "like",   "every": 500,              "do": "effect",  "effect": "cheer" }
  ],
  "hud": ["Type JOIN to enter", "Send 🌹 to move to the front"]
}
```

Actions: `spawn`, `setTeam` / `setModel`, `promote` (to a named slot), `effect`, `say` (speech bubble), `remove`.

---

## 4. Scale and safety limits

- **One avatar per `userId`.** Chatting again refreshes the avatar instead of duplicating it.
- **Avatar cap** (default 150). When full, remove the least-recently-active non-gifter avatar. Gifters stay for N minutes.
- **Spawn queue:** at most about 5 spawns per second, so chat bursts don't freeze the scene.
- **Per-user rate limit** on chat-triggered actions.
- **Performance:** InstancedMesh or shared geometry and materials. Name labels go on one canvas-texture atlas or use troika-text. Target 60 fps with 150 avatars on a mid-range PC.

### Usernames on screen
- Render names as **text only, never as HTML**, which blocks injection.
- Truncate long names to about 14 characters.
- Use a font that covers Unicode, including Turkish, emoji fallback and Arabic.
- Keep a **blocklist** of words and usernames, plus a "hide name" hotkey.

---

## 5. Screen layout

- **Canvas:** 1080×1920 portrait.
- **Safe zones:** keep important elements out of TikTok's own overlays.
  - top 12%: profile and viewer count
  - bottom 25%: chat and gift area
  - right 15%: like and share buttons
- **HUD:** title plus 2–3 instruction lines near the top of the safe zone, a "latest gifter" banner and a top-supporters board.

---

## 6. Resilience

- Auto-reconnect with backoff (2s → 30s). An on-screen dot shows the connection status, visible only in the dev overlay.
- Game state lives on the server. A browser refresh or a dropped connection resyncs from the server, and nothing is lost.
- Optional: save state to `state.json` every 30 seconds so it survives a crash.
- Log the raw events to a file for debugging and replay. The simulator can replay logs.

---

## 7. Assets

- **Characters:** CC0 low-poly packs such as Kenney "Mini Characters" or Quaternius characters (GLB with idle and walk animations). Keep a record of each pack's licence.
- **Scene:** Kenney or Quaternius environment kits.
- **Sound:** CC0 effects for join, gift and confetti. Keep levels low.
- **Theme:** original, not a copy of the funeral stream.

---

## 8. Milestones (each with a "done" check)

| # | Milestone | Done when… |
|---|---|---|
| M1 | Skeleton | `Start.bat` opens the server, the browser shows an empty 1080×1920 scene, and the WS connects |
| M2 | Simulator and schema | the dev panel fires chat, gift and follow events, which show up in the server log as normalized events |
| M3 | Avatars | a fake chat with "JOIN" spawns a named avatar, with no duplicates for the same user |
| M4 | Rules and theme | gift and follow rules work from `default.json`, and editing the JSON changes the behavior without code changes |
| M5 | Limits | the simulator at 50 events per second holds about 60 fps for 10 minutes, and the cap and eviction work |
| M6 | Real ingest | PublicLiveSource on a busy public LIVE spawns real usernames, and gift streaks are counted once |
| M7 | HUD and polish | instructions, gift banner, leaderboard, sounds and safe zones are all checked in a phone mock-up |
| M8 | Capture | LIVE Studio or OBS window capture looks right in portrait |
| M9 | Dry run | a private or test LIVE on your account runs for 30 minutes without crashes |

Rough effort: M1–M5 about 1–2 days, M6–M9 about 1–2 days.

---

## 9. Alternative: the no-code route

**TikFinity** or **Streamer.bot** with ready-made overlays can map gifts and chat to actions without code. They are faster to start but less custom, and some features are paid. The custom build above gives you a unique look and full control.

---

## 10. Decisions for you (defaults in brackets)

1. **Theme:** [an original, light theme such as a parade, a stadium crowd or a castle army]
2. **LIVE-eligible account?** 1,000+ followers and 18+ for gifts. [Build and test with the simulator and a public LIVE regardless]
3. **Custom build vs TikFinity:** [custom build]
4. **Euler Stream API key:** [free tier first, add a key if rate-limited]
