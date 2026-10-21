// Đổi Markdown (câu trả lời của Calm) sang HTML để đọc dễ: tiêu đề, đậm, nghiêng, danh sách,
// bảng, khối mã, trích dẫn, đường kẻ, liên kết. Thoát HTML trước nên không chạy được mã lạ.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

export function md(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  let out = '', i = 0;
  const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    // Khối mã
    const fence = l.match(/^\s*```(\S*)/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`;
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,6})\s+(.*)/);
    if (h) { const n = Math.min(6, h[1].length + 2); out += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    // Bảng
    if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(l);
      i += 2;
      let rows = '';
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows += '<tr>' + cells(lines[i]).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
        i++;
      }
      out += `<div class="tbl"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
      continue;
    }
    // Trích dẫn
    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out += `<blockquote>${md(buf.join('\n'))}</blockquote>`;
      continue;
    }
    // Danh sách (có thụt lề lồng nhau)
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const items = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)/);
        if (m) items.push({ ind: m[1].length, ol: /\d/.test(m[2]), num: parseInt(m[2]), text: m[3] });
        else items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      out += list(items);
      continue;
    }
    // Đoạn văn
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|>|([-*+]|\d+[.)])\s+)/.test(lines[i])
      && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) buf.push(lines[i++]);
    out += `<p>${buf.map(inline).join('<br>')}</p>`;
  }
  return out;
}

function list(items) {
  if (!items.length) return '';
  const base = items[0].ind, ol = items[0].ol;
  let html = ol ? `<ol${items[0].num > 1 ? ` start="${items[0].num}"` : ''}>` : '<ul>';
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    const kids = [];
    while (k + 1 < items.length && items[k + 1].ind > base) kids.push(items[++k]);
    html += `<li>${inline(it.text)}${list(kids)}</li>`;
  }
  return html + (ol ? '</ol>' : '</ul>');
}
