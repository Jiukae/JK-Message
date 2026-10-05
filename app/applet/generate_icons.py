#!/usr/bin/env python3
import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def create_base_icon(size=1024):
    # Create image in RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # 1. Background Gradient (Rich Electric Indigo to Royal Violet / Deep Purple)
    # 1024x1024
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    # Draw diagonal linear gradient
    c1 = (29, 78, 216)    # Vibrant Blue #1D4ED8
    c2 = (109, 40, 217)   # Deep Violet #6D28D9
    c3 = (147, 51, 234)   # Royal Purple #9333EA
    c4 = (192, 38, 211)   # Magenta/Violet #C026D3
    
    for y in range(size):
        for x in range(size):
            # normalized diagonal t: 0.0 at (0,0) to 1.0 at (size, size)
            t = (x + y) / (2.0 * size)
            if t < 0.35:
                sub_t = t / 0.35
                r = int(c1[0] + (c2[0] - c1[0]) * sub_t)
                g = int(c1[1] + (c2[1] - c1[1]) * sub_t)
                b = int(c1[2] + (c2[2] - c1[2]) * sub_t)
            elif t < 0.7:
                sub_t = (t - 0.35) / 0.35
                r = int(c2[0] + (c3[0] - c2[0]) * sub_t)
                g = int(c2[1] + (c3[1] - c2[1]) * sub_t)
                b = int(c2[2] + (c3[2] - c2[2]) * sub_t)
            else:
                sub_t = (t - 0.7) / 0.3
                r = int(c3[0] + (c4[0] - c3[0]) * sub_t)
                g = int(c3[1] + (c4[1] - c3[1]) * sub_t)
                b = int(c3[2] + (c4[2] - c3[2]) * sub_t)
            bg.putpixel((x, y), (r, g, b, 255))
            
    # Subtle top-down lighting curve
    highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    h_draw = ImageDraw.Draw(highlight)
    h_draw.ellipse((-size*0.2, -size*0.4, size*1.2, size*0.45), fill=(255, 255, 255, 45))
    highlight = highlight.filter(ImageFilter.GaussianBlur(size // 18))
    bg = Image.alpha_composite(bg, highlight)

    # 2. Drop Shadow for Central Speech Bubble
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    
    # Bubble coordinates (Safe central zone: 180 to 844)
    bx0, by0, bx1, by1 = 180, 190, 844, 760
    radius = 160
    
    # Shadow rounded rect + tail
    s_draw.rounded_rectangle((bx0, by0 + 28, bx1, by1 + 28), radius=radius, fill=(15, 8, 45, 160))
    # Tail shadow
    s_tail = [(230, by1 - 40 + 28), (170, by1 + 130 + 28), (380, by1 + 28)]
    s_draw.polygon(s_tail, fill=(15, 8, 45, 160))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(32))
    
    bg = Image.alpha_composite(bg, shadow_layer)

    # 3. Pure Crisp White Speech Bubble
    bubble_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(bubble_layer)
    
    # Draw bubble tail first
    tail_pts = [(240, by1 - 50), (180, by1 + 120), (390, by1)]
    b_draw.polygon(tail_pts, fill=(255, 255, 255, 255))
    # Smooth round cap on tail tip
    b_draw.circle((185, by1 + 115), radius=22, fill=(255, 255, 255, 255))
    
    # Draw bubble body (solid bright white with smooth corners)
    b_draw.rounded_rectangle((bx0, by0, bx1, by1), radius=radius, fill=(255, 255, 255, 255))
    
    bg = Image.alpha_composite(bg, bubble_layer)

    # 4. Inside the Speech Bubble:
    # Left: Golden Lightning Bolt (⚡)
    # Right: Bold Indigo "JK" typography
    content_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(content_layer)
    
    # Load bold font
    font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        
    font_jk = ImageFont.truetype(font_path, 340)
    
    # Draw "JK" in dark royal indigo
    # Center text horizontally on the right side of the bubble
    text_color = (49, 46, 129, 255) # #312E81 deep indigo
    c_draw.text((455, 275), "JK", font=font_jk, fill=text_color)
    
    # Draw dynamic golden yellow lightning bolt on the left side
    # Coordinates centered around x=330, y=475
    # Lightning bolt polygon points:
    # Top tip -> mid right inner -> mid outer right -> bottom tip -> mid inner left -> upper left outer
    bolt_pts = [
        (335, 260), # Top point
        (255, 455), # Mid-left inner corner
        (335, 455), # Mid-right step
        (280, 680), # Bottom point
        (415, 420), # Mid-right outer corner
        (340, 420), # Mid-left step
    ]
    
    # Bolt glow/shadow
    bolt_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bs_draw = ImageDraw.Draw(bolt_shadow)
    bs_draw.polygon(bolt_pts, fill=(245, 158, 11, 140))
    bolt_shadow = bolt_shadow.filter(ImageFilter.GaussianBlur(12))
    bg = Image.alpha_composite(bg, bolt_shadow)
    
    # Draw solid gold bolt
    c_draw.polygon(bolt_pts, fill=(251, 191, 36, 255)) # Vibrant Gold #FBBF24
    
    # Outline / bevel for 3D lightning bolt
    c_draw.line(bolt_pts + [bolt_pts[0]], fill=(217, 119, 6, 255), width=8)
    
    # Inner bright lightning core
    core_pts = [
        (332, 290),
        (275, 450),
        (340, 450),
        (300, 640),
        (395, 430),
        (342, 430),
    ]
    c_draw.polygon(core_pts, fill=(254, 240, 138, 255)) # Bright yellow core #FEF08A

    bg = Image.alpha_composite(bg, content_layer)
    
    return bg

def make_round_icon(base_icon):
    size = base_icon.size[0]
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    
    round_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_img.paste(base_icon, (0, 0), mask)
    return round_img

def main():
    print("Generating 1024x1024 master icon with PIL...")
    master = create_base_icon(1024)
    master.save("/app/applet/public/master-icon.png", "PNG")
    
    res_base = "/app/applet/android-src/res"
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    
    for folder, px in densities.items():
        target_dir = os.path.join(res_base, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        # Standard icon
        icon_standard = master.resize((px, px), Image.Resampling.LANCZOS)
        icon_standard.save(os.path.join(target_dir, "ic_launcher.png"), "PNG")
        
        # Round icon (circle masked)
        round_master = make_round_icon(master)
        icon_round = round_master.resize((px, px), Image.Resampling.LANCZOS)
        icon_round.save(os.path.join(target_dir, "ic_launcher_round.png"), "PNG")
        
        print(f"Saved {folder} ({px}x{px}): ic_launcher.png, ic_launcher_round.png")

    # Also update Web PWA icons
    master.resize((512, 512), Image.Resampling.LANCZOS).save("/app/applet/public/icon-512.png", "PNG")
    master.resize((192, 192), Image.Resampling.LANCZOS).save("/app/applet/public/icon-192.png", "PNG")
    master.resize((32, 32), Image.Resampling.LANCZOS).save("/app/applet/public/favicon.ico", "ICO")
    print("All icons successfully generated in high resolution PNG!")

if __name__ == "__main__":
    main()
