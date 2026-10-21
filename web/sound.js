// Âm thanh của thị trấn: tiếng báo và nhạc nền, tạo bằng Web Audio nên không cần tệp.
// Muốn thay bằng tệp thật (vd. Kenney CC0) thì đặt vào web/assets/sound/ và khai báo
// trong FILES bên dưới, tệp sẽ được dùng thay cho tiếng tổng hợp.
const FILES = {
  // notify: 'assets/sound/notify.ogg',
};

const KEY = 'town-sound';
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
export const settings = { muted: false, sfx: 0.7, music: 0.35, musicOn: true, ...saved };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} };

let ctx = null, master, sfxBus, musicBus, verb;
const buffers = {};

// Trình duyệt chỉ cho phát tiếng sau lần bấm đầu tiên
function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  // Vang nhẹ cho tiếng đỡ khô
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  sfxBus.connect(master); musicBus.connect(master);
  sfxBus.connect(verb); musicBus.connect(verb); verb.connect(wet); wet.connect(master);
  master.connect(ctx.destination);
  applyVolumes();
  for (const [k, url] of Object.entries(FILES)) {
    fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(b => b && ctx.decodeAudioData(b)).then(b => { if (b) buffers[k] = b; }).catch(() => {});
  }
  if (settings.musicOn) startMusic();
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  const n = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, n, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx, n, 0.05);
  musicBus.gain.setTargetAtTime(settings.musicOn ? settings.music * 0.5 : 0, n, 0.3);
}

export function set(k, v) {
  settings[k] = v; save();
  if (k === 'musicOn' && v) { ensure(); startMusic(); }
  applyVolumes();
}

// Một nốt: dao động + đường bao âm lượng
function tone(freq, at, dur, { type = 'sine', vol = 0.3, attack = 0.005, bus = sfxBus, detune = 0, glide } = {}) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at); o.detune.value = detune;
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur);
  gn.gain.setValueAtTime(0, at);
  gn.gain.linearRampToValueAtTime(vol, at + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(gn); gn.connect(bus);
  o.start(at); o.stop(at + dur + 0.05);
}
// Tiếng chuông gỗ / chuông nhỏ: nốt chính + bồi âm cao tắt nhanh
function bell(freq, at, vol = 0.25, dur = 0.9) {
  tone(freq, at, dur, { vol });
  tone(freq * 2.01, at, dur * 0.4, { vol: vol * 0.35 });
  tone(freq * 3.98, at, dur * 0.15, { vol: vol * 0.12 });
}
function noise(at, dur, { vol = 0.2, from = 800, to = 3000, q = 1.5 } = {}) {
  const len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, at); gn.gain.linearRampToValueAtTime(vol, at + dur * 0.3); gn.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(f); f.connect(gn); gn.connect(sfxBus);
  src.start(at);
}

const N = m => 440 * Math.pow(2, (m - 69) / 12); // số nốt MIDI -> tần số
const SFX = {
  // Có tin mới (bắt đầu việc): hai nốt nhẹ đi lên
  notify: n => { bell(N(84), n, 0.16, 0.6); bell(N(91), n + 0.09, 0.14, 0.7); },
  // Cần bạn duyệt: ba nốt rõ, lặp lại cho dễ nghe thấy
  alert: n => { for (const [i, m] of [[0, 81], [1, 85], [2, 88]]) bell(N(m), n + i * 0.11, 0.22, 0.7); for (const [i, m] of [[0, 81], [1, 85], [2, 88]]) bell(N(m), n + 0.5 + i * 0.11, 0.15, 0.6); },
  // Lỗi: hai nốt trầm đi xuống, hơi đục
  error: n => { tone(N(64), n, 0.35, { type: 'triangle', vol: 0.3 }); tone(N(58), n + 0.17, 0.5, { type: 'triangle', vol: 0.3 }); tone(N(46), n + 0.17, 0.5, { type: 'sine', vol: 0.2 }); },
  // Xong việc: hợp âm rải trưởng, sáng sủa
  done: n => { [72, 76, 79, 84].forEach((m, i) => bell(N(m), n + i * 0.075, 0.17, 1.1)); },
  // Bàn giao: tiếng giấy sột soạt + "pốp" nhỏ
  handoff: n => { noise(n, 0.22, { vol: 0.12, from: 1500, to: 5000 }); tone(N(79), n + 0.18, 0.18, { type: 'sine', vol: 0.22, glide: N(86) }); },
  // Được duyệt: hai nốt ấm
  ok: n => { bell(N(76), n, 0.15, 0.6); bell(N(83), n + 0.08, 0.15, 0.8); },
  // Bấm nút
  click: n => { tone(N(96), n, 0.05, { vol: 0.06, type: 'triangle' }); },
};
const lastAt = {};
export function play(name) {
  if (settings.muted || !ensure()) return;
  const n = ctx.currentTime;
  if (lastAt[name] && n - lastAt[name] < 0.25) return; // nhiều sự kiện cùng lúc thì kêu một lần
  lastAt[name] = n;
  if (buffers[name]) {
    const s = ctx.createBufferSource(); s.buffer = buffers[name]; s.connect(sfxBus); s.start(n);
  } else SFX[name]?.(n + 0.01);
}

// ---------- Nhạc nền: lo-fi chậm, tự sinh, không lặp y hệt ----------
// Vòng hợp âm Fmaj7 – Em7 – Dm7 – Cmaj7, nền pad êm + vài nốt piano ngũ cung rơi ngẫu nhiên
let musicTimer = null, nextBar = 0, bar = 0;
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const SCALE = [72, 74, 76, 79, 81, 84, 86];
const BAR = 4.2; // giây mỗi hợp âm

function startMusic() {
  if (!ctx || musicTimer) return;
  nextBar = ctx.currentTime + 0.3;
  musicTimer = setInterval(scheduleMusic, 400);
  scheduleMusic();
}
function pad(freq, at, dur) {
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 900;
    gn.gain.setValueAtTime(0, at);
    gn.gain.linearRampToValueAtTime(0.05, at + 1.2);
    gn.gain.setValueAtTime(0.05, at + dur - 1);
    gn.gain.linearRampToValueAtTime(0, at + dur + 0.6);
    o.connect(f); f.connect(gn); gn.connect(musicBus);
    o.start(at); o.stop(at + dur + 0.7);
  }
}
function keyNote(freq, at, vol) {
  tone(freq, at, 1.6, { vol, bus: musicBus, attack: 0.01 });
  tone(freq * 2, at, 0.5, { vol: vol * 0.25, bus: musicBus });
}
function scheduleMusic() {
  if (!ctx) return;
  if (!settings.musicOn) { clearInterval(musicTimer); musicTimer = null; return; }
  if (document.hidden) { nextBar = Math.max(nextBar, ctx.currentTime + 0.3); return; } // tab ẩn thì nghỉ
  while (nextBar < ctx.currentTime + 1.5) {
    const ch = CHORDS[bar % CHORDS.length], at = nextBar;
    for (const m of ch) pad(N(m), at, BAR);
    tone(N(ch[0] - 12), at, BAR * 0.9, { type: 'sine', vol: 0.09, bus: musicBus, attack: 0.08 }); // bass
    // vài nốt "piano" lệch nhịp nhẹ cho có hồn
    const beats = [0, 1, 1.5, 2.5, 3];
    for (const bt of beats) if (Math.random() < 0.45) {
      keyNote(N(SCALE[Math.floor(Math.random() * SCALE.length)] - 12), at + bt * (BAR / 4) + Math.random() * 0.04, 0.05 + Math.random() * 0.03);
    }
    nextBar += BAR; bar++;
  }
}

// Bật âm thanh ở lần chạm / bấm đầu tiên
addEventListener('pointerdown', () => ensure(), { once: true });
addEventListener('keydown', () => ensure(), { once: true });
