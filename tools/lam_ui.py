"""Cắt ảnh giao diện (vẽ bằng GPT) thành từng mảnh cho web.

Chạy: python tools/lam_ui.py <thư mục ảnh gốc>
  Cần ui-icons.png (lưới 4x4), ui-panels.png (4 khung), ui-buttons.png (lưới 4x4 nút).
Ra: web/assets/ui/*.webp và in ra số đo để đặt border-image trong style.css.

Ảnh gốc có kênh trong suốt nhưng kèm quầng sáng mờ: bỏ phần mờ, bóng đổ do CSS vẽ lại.
Cần Pillow + numpy.
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'assets', 'ui')

ICONS = ['play', 'drift', 'name', 'bubble',
         'map', 'log', 'home', 'bell',
         'ok', 'no', 'warn', 'error',
         'sound', 'mute', 'music', 'mail']
PANELS = ['panel', 'card', 'toast', 'plate']  # trên-trái, trên-phải, dưới-trái, dưới-phải
COLORS = ['green', 'cream', 'amber', 'red']
STATES = ['normal', 'hover', 'pressed', 'disabled']


def clean(im, cut):
    """Bỏ quầng mờ: alpha dưới ngưỡng thành 0, phần còn lại kéo về đặc."""
    a = np.array(im.convert('RGBA'))
    al = a[..., 3].astype(np.float32)
    al = np.clip((al - cut) / (255 - cut) * 255 * 1.6, 0, 255)
    # Viền trắng kiểu nhãn dán quanh mảnh: gọt dần từ ngoài vào, nét viền nâu sẽ chặn lại
    rgb = a[..., :3].astype(np.int16)
    whitish = (rgb.min(-1) > 205) & (rgb.max(-1) - rgb.min(-1) < 28)
    for _ in range(40):
        empty = al < 8
        near = np.zeros_like(empty)
        near[1:] |= empty[:-1]; near[:-1] |= empty[1:]
        near[:, 1:] |= empty[:, :-1]; near[:, :-1] |= empty[:, 1:]
        kill = near & ~empty & whitish
        if not kill.any():
            break
        al[kill] = 0
    a[..., 3] = al.astype(np.uint8)
    return Image.fromarray(a)


def boxes(im, cut):
    """Các khung bao của từng mảnh (tìm theo hàng rồi theo cột trống)."""
    al = np.array(im)[..., 3] > cut
    def runs(v, gap=6):
        out, s = [], None
        for i, c in enumerate(list(v) + [False]):
            if c and s is None: s = i
            if not c and s is not None:
                if out and s - out[-1][1] < gap: out[-1] = (out[-1][0], i)
                else: out.append((s, i))
                s = None
        return [r for r in out if r[1] - r[0] > 20]
    res = []
    for y0, y1 in runs(al.any(1)):
        for x0, x1 in runs(al[y0:y1].any(0)):
            sub = al[y0:y1, x0:x1]
            ys = np.flatnonzero(sub.any(1))
            res.append((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
    return res


def save(im, name, scale=1.0):
    if scale != 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), quality=92, method=6)
    print(f'{name}.webp {im.width}x{im.height}')


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    # Icon: chia đều lưới 4x4, mỗi icon đặt giữa một ô vuông 128px
    im = clean(Image.open(os.path.join(src, 'ui-icons.png')), 60)
    cw, ch = im.width // 4, im.height // 4
    for i, n in enumerate(ICONS):
        cell = im.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        cell = cell.crop(cell.getbbox())
        k = 116 / max(cell.size)
        cell = cell.resize((round(cell.width * k), round(cell.height * k)), Image.LANCZOS)
        sq = Image.new('RGBA', (128, 128))
        sq.alpha_composite(cell, ((128 - cell.width) // 2, (128 - cell.height) // 2))
        save(sq, 'icon-' + n)
    # Khung bảng
    im = clean(Image.open(os.path.join(src, "ui-panels.png")), 120)
    bs = boxes(im, 100)
    if len(bs) != 4:
        raise SystemExit(f'ui-panels: tìm được {len(bs)} khung, cần 4')
    for n, b in zip(PANELS, bs):
        save(im.crop(b), n, 0.5)
    # Nút: 4 màu x 4 trạng thái
    im = clean(Image.open(os.path.join(src, "ui-buttons.png")), 120)
    bs = boxes(im, 100)
    if len(bs) != 16:
        raise SystemExit(f'ui-buttons: tìm được {len(bs)} nút, cần 16')
    for i, b in enumerate(bs):
        save(im.crop(b), f'btn-{COLORS[i // 4]}-{STATES[i % 4]}', 0.5)


if __name__ == '__main__':
    main()
