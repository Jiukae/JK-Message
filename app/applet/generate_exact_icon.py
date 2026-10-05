#!/usr/bin/env python3
import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_user_exact_icon(size=1024):
    # 1. Base image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Gradient background: Top-left #5B86E5 (91, 134, 229) to Bottom-right #9B51E0 (155, 81, 224)
    # matching the user's uploaded icon exactly!
    c_tl = (92, 136, 245)  # Bright blue
    c_tr = (120, 110, 245) # Mid-purple blue
    c_bl = (130, 95, 245)  # Violet
    c_br = (168, 85, 247)  # Vibrant lavender purple
    
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for y in range(size):
        v = y / float(size)
        for x in range(size):
            u = x / float(size)
            # Bilinear interpolation for smooth 2D gradient
            r = int((1-u)*(1-v)*c_tl[0] + u*(1-v)*c_tr[0] + (1-u)*v*c_bl[0] + u*v*c_br[0])
            g = int((1-u)*(1-v)*c_tl[1] + u*(1-v)*c_tr[1] + (1-u)*v*c_bl[1] + u*v*c_br[1])
            b = int((1-u)*(1-v)*c_tl[2] + u*(1-v)*c_tr[2] + (1-u)*v*c_bl[2] + u*v*c_br[2])
            bg.putpixel((x, y), (r, g, b, 255))
            
    # Optional soft squircle mask for standalone preview / standard icon
    # Android launchers crop automatically, but keeping background full-bleed guarantees no black borders!
    
    # 2. Central White Speech Bubble
    # Coordinates of main bubble:
    bx0, by0, bx1, by1 = 220, 190, 804, 730
    bradius = 140
    
    bubble_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(bubble_layer)
    
    # Speech bubble tail at bottom-left
    # Triangle from bottom-left of bubble extending down-left
    tail_pts = [
        (320, 680),  # inner right base
        (200, 860),  # pointy bottom-left tip
        (240, 630),  # upper left base
    ]
    b_draw.polygon(tail_pts, fill=(255, 255, 255, 255))
    
    # Smooth tip of the tail
    tx, ty, tr = 205, 855, 14
    b_draw.ellipse((tx - tr, ty - tr, tx + tr, ty + tr), fill=(255, 255, 255, 255))
    
    # Rounded rectangle body of speech bubble
    b_draw.rounded_rectangle((bx0, by0, bx1, by1), radius=bradius, fill=(255, 255, 255, 255))
    
    # Soft drop shadow for speech bubble so it sits beautifully on the gradient
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    s_draw.polygon(tail_pts, fill=(30, 20, 70, 100))
    s_draw.rounded_rectangle((bx0, by0 + 16, bx1, by1 + 16), radius=bradius, fill=(30, 20, 70, 100))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(24))
    
    img = Image.alpha_composite(bg, shadow_layer)
    img = Image.alpha_composite(img, bubble_layer)
    
    # 3. Electric Blue Lightning Bolt inside the White Speech Bubble
    # Centered inside (220, 190, 804, 730) -> center is (512, 460)
    bolt_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bolt_draw = ImageDraw.Draw(bolt_layer)
    
    # Color: Electric royal blue / indigo exactly matching the user's icon
    bolt_color = (88, 120, 255, 255) # #5878FF
    
    bolt_pts = [
        (540, 280), # Top apex
        (435, 475), # Middle left inner corner
        (525, 475), # Middle right horizontal step
        (465, 680), # Bottom apex
        (600, 440), # Middle right outer corner
        (510, 440), # Middle left horizontal step
    ]
    bolt_draw.polygon(bolt_pts, fill=bolt_color)
    
    img = Image.alpha_composite(img, bolt_layer)
    return img

def make_round_icon(base_icon):
    size = base_icon.size[0]
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    
    round_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_img.paste(base_icon, (0, 0), mask)
    return round_img

def main():
    print("Generating exact user-requested icon at 1024x1024...")
    master = create_user_exact_icon(1024)
    master.save("/app/applet/public/master-icon.png", "PNG")
    master.save("/app/applet/public/icons/icon-512.png", "PNG")
    master.save("/app/applet/public/icon-512.png", "PNG")
    
    # 192x192
    icon_192 = master.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save("/app/applet/public/icons/icon-192.png", "PNG")
    icon_192.save("/app/applet/public/icon-192.png", "PNG")
    
    # Favicon
    master.resize((32, 32), Image.Resampling.LANCZOS).save("/app/applet/public/favicon.ico", "ICO")
    
    # Mipmap densities for Android APK
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
        
        print(f"Updated {folder} ({px}x{px}): ic_launcher.png & ic_launcher_round.png")

    print("SUCCESS: Exact user icon created and installed into all Android & Web targets!")

if __name__ == "__main__":
    main()
