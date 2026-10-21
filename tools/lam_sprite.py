"""Tạo sprite nền trong suốt cho web từ ảnh gốc trong assets/art.

Chạy: python3 tools/lam_sprite.py   (cần Pillow + numpy)
Ra:   web/assets/sprites/  (nhà, nhân vật, bản đồ) và sprites.json

Cách xoá nền: loang màu (flood fill) từ mép ảnh với ngưỡng sai màu,
chỉ xoá vùng nền trắng nối liền với mép, rồi làm mềm viền 1px.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets', 'art')
OUT = os.path.join(ROOT, 'web', 'assets', 'sprites')
MAGIC = (255, 0, 254)

BUILDINGS = {  # id phòng -> ảnh nhà
    'tiep-nhan': '01_buu_dien_tiep_nhan.png',
    'san-pham': '02_nha_san_pham.png',
    'thiet-ke': '03_nha_thiet_ke.png',
    'calm': '04_hoi_truong_calm.png',
    'anicca': '05_hoi_truong_anicca.png',
    'coder': '06_xuong_coder.png',
    'qa': '07_thap_qa.png',
}
# Bảng 4 dáng 2x2: trên-trái nhìn thẳng, trên-phải quay lưng,
# dưới-trái nghiêng sang trái, dưới-phải bước đi sang phải.
CHARS = {
    'calm': 'calm_trong_bon_tu_the.png',
    'anicca': 'bang_nhan_vat_anicca_bon_tu_the.png',
    'coder': 'coder_trong_bon_tu_the.png',
    'coder-b': 'cau_trai_hoodie_xanh_bon_goc_nhin.png',
    'thiet-ke': 'bon_dang_nha_thiet_ke_sang_tao.png',
    'san-pham': 'bang_tu_the_nu_tro_ly_y_tuong.png',
    'tiep-nhan': 'nhan_vien_thu_tin_bon_tu_the.png',
    'qa': 'tro_ly_qa_voi_kinh_lup.png',
    'khach': 'cau_dua_thu_bon_goc_nhin.png',
}
POSES = ['front', 'back', 'left', 'walk']
MAP = ('03_Thi_tran_va_ban_do', 'town_map_empty_7_plots_1920x1080.png')


def cut_bg(im, thresh=30):
    """Trả về ảnh RGBA đã xoá nền nối với mép."""
    rgb = im.convert('RGB')
    w, h = rgb.size
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)] + \
            [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    a = np.asarray(rgb)
    for s in seeds:
        px = a[s[1], s[0]]
        if tuple(rgb.getpixel(s)) == MAGIC or px.min() < 200:  # đã loang hoặc không phải nền sáng
            continue
        ImageDraw.floodfill(rgb, s, MAGIC, thresh=thresh)
        a = np.asarray(rgb)
    mask = np.all(a == MAGIC, axis=2)
    alpha = Image.fromarray(np.where(mask, 0, 255).astype('uint8'))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out


def crop(im, pad=4):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save(im, path, q=86):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)


def main():
    meta = {'map': {}, 'buildings': {}, 'chars': {}}
    m = Image.open(os.path.join(ART, *MAP)).convert('RGB')
    save(m, os.path.join(OUT, 'map.webp'), 82)
    meta['map'] = {'file': 'map.webp', 'w': m.width, 'h': m.height}

    for rid, f in BUILDINGS.items():
        im = crop(cut_bg(Image.open(os.path.join(ART, '02_Nha_va_xuong', f))))
        im.thumbnail((640, 640), Image.LANCZOS)
        save(im, os.path.join(OUT, 'nha', rid + '.webp'))
        meta['buildings'][rid] = {'file': f'nha/{rid}.webp', 'w': im.width, 'h': im.height}

    CELL_W, CELL_H = 176, 256
    for cid, f in CHARS.items():
        src = Image.open(os.path.join(ART, '01_Nhan_vat_chibi', f))
        hw, hh = src.width // 2, src.height // 2
        frames = []
        for i, pose in enumerate(POSES):
            q = src.crop(((i % 2) * hw, (i // 2) * hh, (i % 2 + 1) * hw, (i // 2 + 1) * hh))
            frames.append(crop(cut_bg(q)))
        # cùng một tỉ lệ cho cả 4 dáng để nhân vật không đổi cỡ khi đổi dáng
        scale = min(min(CELL_H / fr.height, CELL_W / fr.width) for fr in frames)
        sheet = Image.new('RGBA', (CELL_W * 4, CELL_H), (0, 0, 0, 0))
        for i, fr in enumerate(frames):
            fr = fr.resize((max(1, round(fr.width * scale)), max(1, round(fr.height * scale))), Image.LANCZOS)
            sheet.alpha_composite(fr, (i * CELL_W + (CELL_W - fr.width) // 2, CELL_H - fr.height))
        save(sheet, os.path.join(OUT, 'nv', cid + '.webp'), 88)
        meta['chars'][cid] = {'file': f'nv/{cid}.webp', 'cellW': CELL_W, 'cellH': CELL_H, 'poses': POSES}

    with open(os.path.join(OUT, 'sprites.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(d, x)) for d, _, fs in os.walk(OUT) for x in fs)
    print('xong', len(meta['buildings']), 'nha,', len(meta['chars']), 'nhan vat,', total // 1024, 'KB')


if __name__ == '__main__':
    main()
