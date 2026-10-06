"""Kafa görselinden Android başlatıcı simgelerini üretir (PIL gerekir)."""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
head = Image.open(os.path.join(ROOT, 'web', 'head.png')).convert('RGBA')
SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}

def icon(n):
    S = 512
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bg = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(58 + 120 * t), int(169 + 60 * t), int(230 + 18 * t), 255))
    # zemin şeridi
    d.rectangle([0, S * 0.84, S, S], fill=(116, 196, 66, 255))
    d.rectangle([0, S * 0.84, S, S * 0.85], fill=(60, 109, 31, 255))
    # şişe boyunları
    for x, top in ((40, True), (472, False)):
        w = 70
        if top:
            d.rounded_rectangle([x - w / 2, -20, x + w / 2, 150], 18, fill=(110, 53, 16, 255), outline=(27, 11, 2, 255), width=8)
        else:
            d.rounded_rectangle([x - w / 2, 330, x + w / 2, 540], 18, fill=(28, 115, 48, 255), outline=(4, 25, 10, 255), width=8)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], 110, fill=255)
    img.paste(bg, (0, 0), mask)
    # kafa + koyu dış çizgi
    h = int(S * 0.8)
    w = int(h * head.width / head.height)
    hd = head.resize((w, h), Image.LANCZOS)
    sil = Image.new('RGBA', hd.size, (42, 22, 8, 255))
    sil.putalpha(hd.getchannel('A').filter(ImageFilter.MaxFilter(13)))
    shadow = Image.new('RGBA', hd.size, (0, 0, 0, 90))
    shadow.putalpha(hd.getchannel('A').filter(ImageFilter.GaussianBlur(10)).point(lambda a: a * 0.4))
    ox, oy = (S - w) // 2, int(S * 0.09)
    img.alpha_composite(shadow, (ox + 10, oy + 14))
    img.alpha_composite(sil, (ox, oy))
    img.alpha_composite(hd, (ox, oy))
    # ağızda sigara
    cd = ImageDraw.Draw(img)
    mx, my = ox + int(w * 0.75), oy + int(h * 0.722)
    cd.line([(mx, my), (mx + 30, my + 6)], fill=(227, 154, 59, 255), width=16)
    cd.line([(mx + 30, my + 6), (mx + 112, my + 24)], fill=(248, 248, 242, 255), width=16)
    cd.ellipse([mx + 104, my + 14, mx + 124, my + 34], fill=(255, 87, 34, 255))
    return img.resize((n, n), Image.LANCZOS)

for name, n in SIZES.items():
    out = os.path.join(ROOT, 'android', 'res', 'mipmap-' + name)
    os.makedirs(out, exist_ok=True)
    icon(n).save(os.path.join(out, 'ic_launcher.png'), optimize=True)
icon(512).save(os.path.join(ROOT, 'web', 'icon.png'), optimize=True)
print('ok', file=sys.stderr)
