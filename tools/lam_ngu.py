"""Tách nền ảnh nằm ngủ (vẽ bằng GPT) cho game.

Chạy: python tools/lam_ngu.py <thư mục ảnh gốc> <mã nhân vật> [<mã> ...] [<mã>=<mã giống hệt>]
  Ảnh gốc đặt tên <mã>-ngu.png.
Ra: web/assets/sprites/nv/<mã>-ngu.webp, và mục "sleep" của nhân vật trong sprites.json.
Cần Pillow + numpy.
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lam_buoc_di import cutout, drop_specks, SPR


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    src, ids = sys.argv[1], sys.argv[2:]
    meta_path = os.path.join(SPR, 'sprites.json')
    meta = json.load(open(meta_path, encoding='utf-8'))
    for cid in ids:
        if '=' in cid:
            cid, same = cid.split('=')
            meta['chars'][cid]['sleep'] = dict(meta['chars'][same]['sleep'])
            print(cid, ': dùng chung với', same)
            continue
        p = os.path.join(src, f'{cid}-ngu.png')
        if not os.path.exists(p):
            print(cid, ': không thấy ảnh')
            continue
        im = drop_specks(cutout(Image.open(p)))
        im = im.crop(im.getbbox())
        k = 320 / im.width  # đủ nét khi phóng to, nhẹ khi tải
        im = im.resize((320, round(im.height * k)), Image.LANCZOS)
        rel = f'nv/{cid}-ngu.webp'
        im.save(os.path.join(SPR, rel), quality=90, method=6)
        meta['chars'][cid]['sleep'] = {'file': rel}
        print(cid, ':', rel, im.size)
    json.dump(meta, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
