// Bảng "Cài đặt thông báo": bật/tắt từng loại, chọn tiếng, tải tiếng và nhạc nền của bạn lên.
import * as sound from './sound.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mb = n => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';

function voiceOptions(cur) {
  const builtIn = Object.entries(sound.VOICES).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const mine = sound.files.map(f => `<option value="file:${esc(f.name)}"${'file:' + f.name === cur ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
  return `<optgroup label="Có sẵn">${builtIn}</optgroup>` + (mine ? `<optgroup label="Tệp của bạn">${mine}</optgroup>` : '');
}

function render() {
  const st = sound.settings;
  $('#set-muted').checked = !st.muted;
  $('#set-sfx').value = Math.round(st.sfx * 100);
  $('#set-desktop').checked = st.desktop;
  $('#set-music').checked = st.musicOn;
  $('#set-music-vol').value = Math.round(st.music * 100);
  $('#set-shuffle').checked = st.shuffle;
  for (const r of document.querySelectorAll('[name=set-src]')) r.checked = r.value === st.musicSource;

  $('#set-events').innerHTML = Object.entries(sound.EVENTS).map(([k, e]) => {
    const c = st.events[k];
    return `<tr data-ev="${k}">
      <td>${esc(e.label)}</td>
      <td><input type="checkbox" data-k="toast"${c.toast ? ' checked' : ''} aria-label="Hiện thông báo"></td>
      <td><input type="checkbox" data-k="sound"${c.sound ? ' checked' : ''} aria-label="Kêu"></td>
      <td><select data-k="voice"${c.sound ? '' : ' disabled'}>${voiceOptions(c.voice)}</select></td>
      <td><button class="mini" data-try="${k}" title="Nghe thử">▶</button></td></tr>`;
  }).join('');

  $('#set-files').innerHTML = sound.files.length ? sound.files.map(f => `
    <li><label title="Cho vào danh sách nhạc nền"><input type="checkbox" data-pl="${esc(f.name)}"${st.playlist.includes(f.name) ? ' checked' : ''}>
      <span class="fn">${esc(f.name)}</span></label><span class="sz">${mb(f.size)}</span>
      <button class="mini" data-play="${esc(f.name)}" title="Nghe thử">▶</button>
      <button class="mini no" data-del="${esc(f.name)}" title="Xoá tệp">✕</button></li>`).join('')
    : '<li class="empty">Chưa có tệp nào. Bấm "Tải tệp lên" để thêm nhạc lo-fi hoặc tiếng báo của bạn.</li>';
  const np = sound.nowPlaying();
  $('#set-now').textContent = st.musicSource === 'files'
    ? (st.playlist.length ? (np ? 'Đang phát: ' + np : 'Bấm vào trang một lần để bắt đầu phát') : 'Chưa chọn bài nào: tích ô trước tên tệp ở dưới')
    : 'Đang dùng nhạc lo-fi tự tạo';
}

export function initSettings() {
  sound.onChange(render);
  render();
  $('#set-muted').onchange = e => sound.set('muted', !e.target.checked);
  $('#set-sfx').oninput = e => sound.set('sfx', e.target.value / 100);
  $('#set-sfx').onchange = () => sound.playVoice('chuong');
  $('#set-desktop').onchange = async e => {
    const ok = e.target.checked ? await sound.askDesktop() : false;
    if (e.target.checked && !ok) alert('Trình duyệt chưa cho phép hiện thông báo. Bấm biểu tượng ổ khoá cạnh địa chỉ trang › Thông báo › Cho phép, rồi bật lại.');
    sound.set('desktop', ok);
  };
  $('#set-music').onchange = e => sound.set('musicOn', e.target.checked);
  $('#set-music-vol').oninput = e => sound.set('music', e.target.value / 100);
  $('#set-shuffle').onchange = e => sound.set('shuffle', e.target.checked);
  for (const r of document.querySelectorAll('[name=set-src]')) r.onchange = () => sound.set('musicSource', r.value);
  $('#set-next').onclick = () => sound.nextTrack();

  $('#set-events').addEventListener('change', e => {
    const row = e.target.closest('[data-ev]'), k = e.target.dataset.k;
    if (!row || !k) return;
    sound.setEvent(row.dataset.ev, k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    if (k === 'voice') sound.playVoice(e.target.value);
  });
  $('#settings').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.try) sound.playVoice(sound.settings.events[b.dataset.try].voice);
    if (b.dataset.play) sound.playVoice('file:' + b.dataset.play);
    if (b.dataset.del && confirm(`Xoá tệp "${b.dataset.del}"?`)) await sound.remove(b.dataset.del);
  });
  $('#set-files').addEventListener('change', e => {
    const n = e.target.dataset.pl;
    if (!n) return;
    const pl = new Set(sound.settings.playlist);
    e.target.checked ? pl.add(n) : pl.delete(n);
    sound.set('playlist', [...pl]);
    if (e.target.checked && sound.settings.musicSource !== 'files') sound.set('musicSource', 'files');
  });

  // Tải tệp: bấm nút hoặc kéo thả tệp vào bảng
  const up = async list => {
    const msg = $('#set-upmsg');
    for (const f of list) {
      msg.textContent = `Đang tải lên ${f.name}…`;
      try { await sound.upload(f); msg.textContent = `Đã tải lên ${f.name}`; }
      catch (err) { msg.textContent = `${f.name}: ${err.message}`; }
    }
  };
  $('#set-upload').onclick = () => $('#set-file').click();
  $('#set-file').onchange = e => { up([...e.target.files]); e.target.value = ''; };
  const box = $('#settings');
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drop'); });
  box.addEventListener('dragleave', () => box.classList.remove('drop'));
  box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drop'); up([...e.dataTransfer.files]); });
  $('#settings-close').onclick = () => toggleSettings(false);
  $('#settings-back').onclick = () => toggleSettings(false);
}

export function toggleSettings(show) {
  const open = show ?? $('#settings-wrap').classList.contains('hidden');
  $('#settings-wrap').classList.toggle('hidden', !open);
  document.querySelector('[data-act=sound]')?.classList.toggle('on', open);
}
