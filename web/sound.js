// Âm thanh của thị trấn: tiếng báo và nhạc nền.
// Tiếng có sẵn được tạo bằng Web Audio (không cần tệp). Người dùng có thể tải tệp riêng
// lên (bảng Cài đặt thông báo): tệp lưu ở server trong data/am-thanh/, dùng làm tiếng báo
// hoặc làm nhạc nền. Cài đặt lưu ở server (data/am-thanh.json) để máy khác mở cũng giống.

// Các loại thông báo, tên hiện trên bảng cài đặt và mặc định
export const EVENTS = {
  alert:   { label: 'Cần bạn duyệt',  toast: true,  sound: true,  voice: 'chuong3' },
  error:   { label: 'Có lỗi',          toast: true,  sound: true,  voice: 'tram' },
  done:    { label: 'Xong một việc',   toast: true,  sound: true,  voice: 'hopam' },
  handoff: { label: 'Bàn giao việc',   toast: false, sound: true,  voice: 'giay' },
  notify:  { label: 'Bắt đầu việc mới', toast: false, sound: true,  voice: 'chuong' },
  ok:      { label: 'Được duyệt',      toast: false, sound: true,  voice: 'am' },
};
// Tiếng tổng hợp có sẵn
export const VOICES = {
  chuong: 'Chuông nhỏ (2 nốt)',
  chuong3: 'Chuông gọi (3 nốt, lặp)',
  hopam: 'Hợp âm vui',
  tram: 'Hai nốt trầm',
  giay: 'Giấy sột soạt + pốp',
  am: 'Hai nốt ấm',
  go: 'Mõ gỗ',
  pop: 'Bong bóng pốp',
  sao: 'Lấp lánh',
  dan: 'Đàn hạc rải',
};

const KEY = 'town-sound';
const defaults = () => ({
  muted: false, sfx: 0.7, music: 0.35, musicOn: true,
  musicSource: 'lofi', playlist: [], shuffle: true, desktop: false,
  events: Object.fromEntries(Object.entries(EVENTS).map(([k, e]) => [k, { toast: e.toast, sound: e.sound, voice: e.voice }])),
});
function merge(base, saved) {
  if (!saved) return base;
  const out = { ...base, ...saved, events: { ...base.events } };
  for (const k of Object.keys(base.events)) out.events[k] = { ...base.events[k], ...(saved.events?.[k] || {}) };
  return out;
}
const local = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } })();
export const settings = merge(defaults(), local);
export let files = []; // tệp đã tải lên: [{ name, size }]
const listeners = new Set();
export const onChange = f => listeners.add(f);
const emit = () => listeners.forEach(f => f());

let saveTimer = null;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fetch('/api/sounds/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }).catch(() => {}), 400);
}

// Lấy cài đặt và danh sách tệp từ server
export async function load() {
  try {
    const r = await fetch('/api/sounds').then(x => x.json());
    files = r.files || [];
    if (r.settings) Object.assign(settings, merge(defaults(), r.settings));
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  } catch {}
  applyVolumes(); syncMusic(); emit();
}
export async function upload(file) {
  const r = await fetch('/api/sounds/upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Không tải lên được');
  files = j.files; emit();
  return j.name;
}
export async function remove(name) {
  const j = await fetch('/api/sounds/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(x => x.json());
  files = j.files || [];
  settings.playlist = settings.playlist.filter(n => n !== name);
  for (const e of Object.values(settings.events)) if (e.voice === 'file:' + name) e.voice = 'chuong';
  delete buffers[name];
  save(); syncMusic(); emit();
}

let ctx = null, master, sfxBus, musicBus, verb;
const buffers = {}; // tên tệp -> AudioBuffer (tiếng báo dạng tệp)

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
  sfxBus.connect(verb); verb.connect(wet); wet.connect(master);
  master.connect(ctx.destination);
  applyVolumes();
  syncMusic();
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
  if (k === 'musicOn' && v) ensure();
  applyVolumes(); syncMusic(); emit();
}
export function setEvent(ev, k, v) { settings.events[ev][k] = v; save(); emit(); }

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
// Tiếng chuông nhỏ: nốt chính + bồi âm cao tắt nhanh
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
const SYNTH = {
  chuong: n => { bell(N(84), n, 0.16, 0.6); bell(N(91), n + 0.09, 0.14, 0.7); },
  chuong3: n => { for (const r of [0, 0.5]) [81, 85, 88].forEach((m, i) => bell(N(m), n + r + i * 0.11, r ? 0.15 : 0.22, 0.7)); },
  tram: n => { tone(N(64), n, 0.35, { type: 'triangle', vol: 0.3 }); tone(N(58), n + 0.17, 0.5, { type: 'triangle', vol: 0.3 }); tone(N(46), n + 0.17, 0.5, { vol: 0.2 }); },
  hopam: n => { [72, 76, 79, 84].forEach((m, i) => bell(N(m), n + i * 0.075, 0.17, 1.1)); },
  giay: n => { noise(n, 0.22, { vol: 0.12, from: 1500, to: 5000 }); tone(N(79), n + 0.18, 0.18, { vol: 0.22, glide: N(86) }); },
  am: n => { bell(N(76), n, 0.15, 0.6); bell(N(83), n + 0.08, 0.15, 0.8); },
  go: n => { [0, 0.14].forEach((d, i) => { tone(N(i ? 79 : 74), n + d, 0.25, { type: 'sine', vol: 0.3 }); tone(N(i ? 79 : 74) * 3.9, n + d, 0.05, { vol: 0.08 }); }); },
  pop: n => { tone(N(72), n, 0.12, { vol: 0.3, glide: N(90) }); noise(n, 0.05, { vol: 0.08, from: 2000, to: 4000 }); },
  sao: n => { [88, 93, 96, 100, 103].forEach((m, i) => bell(N(m), n + i * 0.045, 0.08, 0.5)); },
  dan: n => { [60, 64, 67, 71, 74, 79].forEach((m, i) => tone(N(m), n + i * 0.06, 1.4, { type: 'triangle', vol: 0.09 })); },
  click: n => { tone(N(96), n, 0.05, { vol: 0.06, type: 'triangle' }); },
};

async function fileBuffer(name) {
  if (buffers[name]) return buffers[name];
  const ab = await fetch('/am-thanh/' + encodeURIComponent(name)).then(r => r.arrayBuffer());
  return (buffers[name] = await ctx.decodeAudioData(ab));
}
// Phát một tiếng theo tên (tiếng có sẵn hoặc 'file:<tên tệp>')
export async function playVoice(voice) {
  if (settings.muted || !ensure()) return;
  const n = ctx.currentTime + 0.01;
  if (voice?.startsWith('file:')) {
    try {
      const b = await fileBuffer(voice.slice(5));
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(sfxBus); s.start();
    } catch { SYNTH.chuong(n); }
  } else (SYNTH[voice] || SYNTH.chuong)(n);
}
const lastAt = {};
// Phát tiếng cho một loại sự kiện, theo cài đặt của loại đó
export function play(ev) {
  if (ev === 'click') { if (!settings.muted && ensure()) SYNTH.click(ctx.currentTime); return; }
  const e = settings.events[ev];
  if (!e || !e.sound) return;
  const t = performance.now();
  if (lastAt[ev] && t - lastAt[ev] < 250) return; // nhiều sự kiện cùng lúc thì kêu một lần
  lastAt[ev] = t;
  playVoice(e.voice);
}

// ---------- Nhạc nền ----------
// Nguồn 'lofi': lo-fi tự sinh (Fmaj7 – Em7 – Dm7 – Cmaj7, pad êm + nốt piano ngũ cung ngẫu nhiên).
// Nguồn 'files': phát lần lượt các tệp người dùng chọn trong danh sách phát.
let lofiTimer = null, nextBar = 0, bar = 0;
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const SCALE = [72, 74, 76, 79, 81, 84, 86];
const BAR = 4.2;
let audioEl = null, audioSrc = null, trackIdx = -1;
export const nowPlaying = () => settings.musicSource === 'files' && audioEl && !audioEl.paused ? audioEl.dataset.name : null;

function syncMusic() {
  const on = ctx && settings.musicOn && !settings.muted;
  const useFiles = settings.musicSource === 'files' && settings.playlist.some(n => files.some(f => f.name === n));
  if (on && !useFiles) startLofi(); else stopLofi();
  if (on && useFiles) { if (!audioEl || audioEl.paused) nextTrack(); }
  else if (audioEl) audioEl.pause();
}
export function nextTrack() {
  if (!ensure()) return;
  const list = settings.playlist.filter(n => files.some(f => f.name === n));
  if (!list.length) return;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.crossOrigin = 'anonymous';
    audioSrc = ctx.createMediaElementSource(audioEl);
    audioSrc.connect(musicBus);
    audioEl.addEventListener('ended', () => nextTrack());
    audioEl.addEventListener('play', emit);
  }
  trackIdx = settings.shuffle && list.length > 1
    ? (trackIdx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
    : (trackIdx + 1) % list.length;
  audioEl.src = '/am-thanh/' + encodeURIComponent(list[trackIdx]);
  audioEl.dataset.name = list[trackIdx];
  audioEl.play().catch(() => {});
  emit();
}
function startLofi() {
  if (!ctx || lofiTimer) return;
  nextBar = ctx.currentTime + 0.3;
  lofiTimer = setInterval(scheduleLofi, 400);
  scheduleLofi();
}
function stopLofi() { clearInterval(lofiTimer); lofiTimer = null; }
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
function scheduleLofi() {
  if (document.hidden) { nextBar = Math.max(nextBar, ctx.currentTime + 0.3); return; } // tab ẩn thì nghỉ
  while (nextBar < ctx.currentTime + 1.5) {
    const ch = CHORDS[bar % CHORDS.length], at = nextBar;
    for (const m of ch) pad(N(m), at, BAR);
    tone(N(ch[0] - 12), at, BAR * 0.9, { vol: 0.09, bus: musicBus, attack: 0.08 }); // bass
    for (const bt of [0, 1, 1.5, 2.5, 3]) if (Math.random() < 0.45) {
      keyNote(N(SCALE[Math.floor(Math.random() * SCALE.length)] - 12), at + bt * (BAR / 4) + Math.random() * 0.04, 0.05 + Math.random() * 0.03);
    }
    nextBar += BAR; bar++;
  }
}

// ---------- Báo ra màn hình máy tính khi đang ở tab khác ----------
export async function askDesktop() {
  if (!('Notification' in window)) return false;
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  return p === 'granted';
}
export function desktopNotify(title, body) {
  if (!settings.desktop || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: 'assets/ui/icon-bell.webp', silent: true }); } catch {}
}

// Bật âm thanh ở lần chạm / bấm đầu tiên
addEventListener('pointerdown', () => ensure(), { once: true });
addEventListener('keydown', () => ensure(), { once: true });
load();
