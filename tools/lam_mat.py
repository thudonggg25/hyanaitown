"""Cắt ảnh chân dung (đầu và vai) từ dáng đứng thẳng của mỗi nhân vật, dùng cho thẻ nhân vật.

Chạy: python tools/lam_mat.py   Ra: web/assets/sprites/nv/<mã>-mat.webp (vuông 160px, nền trong suốt)
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'web', 'assets', 'sprites')
meta = json.load(open(os.path.join(SPR, 'sprites.json'), encoding='utf-8'))
for cid, c in meta['chars'].items():
    im = Image.open(os.path.join(SPR, c['file'])).convert('RGBA')
    cell = im.crop((0, 0, c['cellW'], c['cellH']))  # dáng đứng thẳng là ô đầu tiên
    box = cell.getbbox()
    top, cx = box[1], (box[0] + box[2]) / 2
    side = round((box[3] - box[1]) * 0.56)  # đầu + vai chiếm khoảng nửa trên người
    sq = cell.crop((round(cx - side / 2), top - 4, round(cx + side / 2), top - 4 + side))
    sq.resize((160, 160), Image.LANCZOS).save(os.path.join(SPR, 'nv', f'{cid}-mat.webp'), quality=90, method=6)
    c['face'] = f'nv/{cid}-mat.webp'
    print(cid)
json.dump(meta, open(os.path.join(SPR, 'sprites.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
