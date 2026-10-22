"""Ghép ảnh dáng đi (mỗi ảnh một hàng 6 khung, vẽ bằng GPT) thành bảng sprite cho game.

Chạy: python tools/lam_buoc_di.py <thư mục ảnh gốc> <mã nhân vật> [<mã> ...] [<mã>=<mã giống hệt>]
  Ảnh gốc đặt tên <mã>-xuong.png, <mã>-len.png, <mã>-trai.png, <mã>-phai.png (thiếu cái nào bỏ qua).
Ra: web/assets/sprites/nv/<mã>-walk.webp, và thêm mục "walk" cho nhân vật trong sprites.json.

Cách làm: xoá nền (ảnh có sẵn kênh trong suốt thì lọc vụn, ảnh nền trắng thì loang từ mép),
tách 6 khung theo cột trống, thu nhỏ cho cao bằng nhân vật trong bảng 4 dáng,
đặt chân cùng một đường và căn giữa theo đầu để khung không bị rung.
Cần Pillow + numpy.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'web', 'assets', 'sprites')
ROWS = [('down', 'xuong'), ('up', 'len'), ('left', 'trai'), ('right', 'phai')]
FRAMES = 6
CELL_W, CELL_H = 192, 256   # cùng chiều cao ô với bảng 4 dáng
CHAR_H, FOOT_Y = 238, 252   # nhân vật cao bao nhiêu, chân chạm dòng nào trong ô


def label(mask):
    """Gán nhãn vùng liền nhau (4 hướng). Trả về mảng nhãn và kích thước từng vùng."""
    h, w = mask.shape
    lab = np.full(h * w, -1, np.int32)
    flat = mask.ravel()
    sizes = []
    for s in np.flatnonzero(flat):
        if lab[s] >= 0:
            continue
        L = len(sizes)
        stack = [s]
        lab[s] = L
        n = 0
        while stack:
            i = stack.pop()
            n += 1
            x = i % w
            for j in (i - 1 if x > 0 else -1, i + 1 if x < w - 1 else -1, i - w, i + w):
                if 0 <= j < h * w and flat[j] and lab[j] < 0:
                    lab[j] = L
                    stack.append(j)
        sizes.append(n)
    return lab.reshape(h, w), sizes


def cutout(im):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    al = a[..., 3]
    if (al < 10).mean() > 0.2:
        # Ảnh đã trong suốt nhưng viền mờ lấm tấm màu: cắt ngưỡng cho gọn
        keep = al > 150
    else:
        # Nền trắng: xoá vùng nhạt nối với mép
        rgb = a[..., :3]
        light = (rgb.min(-1) > 215) & (rgb.max(-1) - rgb.min(-1) < 30)
        h, w = light.shape
        bg = np.zeros_like(light)
        stack = [(y, x) for x in range(w) for y in (0, h - 1) if light[y, x]] + \
                [(y, x) for y in range(h) for x in (0, w - 1) if light[y, x]]
        for y, x in stack:
            bg[y, x] = True
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and light[yy, xx] and not bg[yy, xx]:
                    bg[yy, xx] = True
                    stack.append((yy, xx))
        keep = ~bg
    # Bỏ vụn nhỏ
    small = np.array(Image.fromarray((keep * 255).astype(np.uint8)).resize((keep.shape[1] // 4, keep.shape[0] // 4))) > 127
    lab, sizes = label(small)
    if sizes:
        big = max(sizes)
        ok = np.array([s >= big * 0.03 for s in sizes] + [False])
        small = ok[lab]
        grow = Image.fromarray((small * 255).astype(np.uint8)).resize((keep.shape[1], keep.shape[0])).filter(ImageFilter.MaxFilter(9))
        keep &= np.array(grow) > 127
    # Gọt 1px viền rồi làm mềm
    m = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = np.array(im.convert('RGBA'))
    out[..., 3] = np.array(m)
    return Image.fromarray(out)


def split(im):
    al = np.array(im)[..., 3] > 60
    cols = al.sum(0) > 2
    runs, start = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and start is None:
            start = x
        if not c and start is not None:
            runs.append((start, x))
            start = None
    # Gộp các mẩu sát nhau, giữ 6 khúc rộng nhất
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 12:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    merged = sorted(sorted(merged, key=lambda r: r[1] - r[0], reverse=True)[:FRAMES])
    if len(merged) < FRAMES:
        # Hai khung dính nhau (đồ cầm tay chạm khung bên cạnh): chia đều theo bề ngang
        x0, x1 = merged[0][0], merged[-1][1]
        step = (x1 - x0) / FRAMES
        merged = [(round(x0 + i * step), round(x0 + (i + 1) * step)) for i in range(FRAMES)]
    if len(merged) != FRAMES:
        raise ValueError(f'tách được {len(merged)} khung, cần {FRAMES}')
    return [im.crop((x0, 0, x1, im.height)) for x0, x1 in merged]


def drop_specks(f):
    """Bỏ mẩu nhỏ lọt từ khung bên cạnh, chỉ giữ các mảng đủ lớn."""
    a = np.array(f)
    lab, sizes = label(a[..., 3] > 60)
    if sizes:
        big = max(sizes)
        ok = np.array([n >= big * 0.05 for n in sizes] + [False])
        a[..., 3][~ok[lab]] = 0
    return Image.fromarray(a)


def place(frames):
    frames = [drop_specks(f) for f in frames]
    boxes = [f.getbbox() for f in frames]
    hmax = max(b[3] - b[1] for b in boxes)
    k = CHAR_H / hmax  # cùng một tỉ lệ cho cả hàng
    cells = []
    for f, b in zip(frames, boxes):
        f = f.crop(b)
        f = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
        # Căn giữa theo phần đầu (1/3 trên) để người không rung ngang
        al = np.array(f)[..., 3] > 60
        top = al[: max(1, al.shape[0] // 3)]
        xs = np.flatnonzero(top.any(0))
        cx = (xs.min() + xs.max()) / 2 if len(xs) else f.width / 2
        cell = Image.new('RGBA', (CELL_W, CELL_H))
        cell.alpha_composite(f, (round(CELL_W / 2 - cx), FOOT_Y - f.height))
        cells.append(cell)
    return cells


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    src, ids = sys.argv[1], sys.argv[2:]
    meta_path = os.path.join(SPR, 'sprites.json')
    meta = json.load(open(meta_path, encoding='utf-8'))
    for cid in ids:
        if '=' in cid:  # vd. coder-b=coder: nhân vật giống hệt thì dùng chung bảng dáng đi
            cid, same = cid.split('=')
            meta['chars'][cid]['walk'] = dict(meta['chars'][same]['walk'])
            print(cid, ': dùng chung với', same)
            continue
        rows = []
        for key, name in ROWS:
            p = os.path.join(src, f'{cid}-{name}.png')
            if os.path.exists(p):
                try:
                    rows.append((key, place(split(cutout(Image.open(p))))))
                except ValueError as e:
                    print(f'{cid}-{name}.png: {e}, bỏ qua hướng này (vẽ lại ảnh này)')
        if not rows:
            print(cid, ': không thấy ảnh')
            continue
        sheet = Image.new('RGBA', (CELL_W * FRAMES, CELL_H * len(rows)))
        for r, (_, cells) in enumerate(rows):
            for c, cell in enumerate(cells):
                sheet.alpha_composite(cell, (c * CELL_W, r * CELL_H))
        rel = f'nv/{cid}-walk.webp'
        sheet.save(os.path.join(SPR, rel), quality=90, method=6)
        meta['chars'][cid]['walk'] = {'file': rel, 'cols': FRAMES, 'rows': [k for k, _ in rows]}
        print(cid, ':', rel, [k for k, _ in rows])
    json.dump(meta, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
