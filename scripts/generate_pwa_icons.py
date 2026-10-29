"""Generates high-fidelity PWA icons and SVG assets for VGARSS.

Produces:
- public/icons/icon.svg (Vector brand icon)
- public/icons/icon-192x192.png
- public/icons/icon-192x192-maskable.png
- public/icons/icon-512x512.png
- public/icons/icon-512x512-maskable.png
- public/icons/apple-touch-icon.png (180x180)
- public/favicon.ico (Multi-size ICO)
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "icons")
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
os.makedirs(ICONS_DIR, exist_ok=True)

# Brand Colors
BG_BRAND = (64, 85, 168)       # #4055A8
BG_DARK = (45, 62, 130)        # Darker gradient tone
INK_WHITE = (255, 255, 255)
CYAN_ACCENT = (56, 189, 248)   # #38BDF8
EMERALD_ACCENT = (22, 128, 93) # #16805D
AMBER_ACCENT = (183, 121, 31)  # #B7791F

def draw_vgarss_icon(size: int, is_maskable: bool = False, scale: int = 4) -> Image.Image:
    """Renders high-resolution VGARSS iconography using 4x supersampling for ultra-crisp antialiasing."""
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = canvas_size / 2.0
    
    # 1. Background
    if is_maskable:
        # Full bleed square for maskable (safe zone is inner 80%)
        # Linear gradient background
        for y in range(canvas_size):
            factor = y / float(canvas_size)
            r = int(BG_BRAND[0] + (BG_DARK[0] - BG_BRAND[0]) * factor)
            g = int(BG_BRAND[1] + (BG_DARK[1] - BG_BRAND[1]) * factor)
            b = int(BG_BRAND[2] + (BG_DARK[2] - BG_BRAND[2]) * factor)
            draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))
        content_radius = canvas_size * 0.36
    else:
        # Rounded squircle for standard icons
        corner_radius = int(canvas_size * 0.22)
        # Draw rounded rectangle
        draw.rounded_rectangle(
            [(0, 0), (canvas_size - 1, canvas_size - 1)],
            radius=corner_radius,
            fill=BG_BRAND
        )
        content_radius = canvas_size * 0.38

    # 2. Outer Synchronization Track Rings
    ring_width = max(int(canvas_size * 0.024), 2)
    ring_radius = content_radius * 0.95
    draw.ellipse(
        [
            center - ring_radius, center - ring_radius,
            center + ring_radius, center + ring_radius
        ],
        outline=(255, 255, 255, 45),
        width=ring_width
    )

    # 3. Synchronized Nodes (4 Satellite Process / Resource Nodes)
    # Angles: 45, 135, 225, 315 degrees
    node_radius = content_radius * 0.16
    nodes = []
    for deg in [45, 135, 225, 315]:
        rad = math.radians(deg)
        nx = center + ring_radius * math.cos(rad)
        ny = center + ring_radius * math.sin(rad)
        nodes.append((nx, ny))
        # Draw connection bus line to center
        draw.line([(center, center), (nx, ny)], fill=(255, 255, 255, 140), width=int(ring_width * 0.9))

    # 4. Central CPU Microkernel Shield / Die
    core_radius = content_radius * 0.44
    draw.rounded_rectangle(
        [
            center - core_radius, center - core_radius,
            center + core_radius, center + core_radius
        ],
        radius=int(core_radius * 0.35),
        fill=(255, 255, 255, 255),
        outline=CYAN_ACCENT,
        width=int(ring_width * 1.2)
    )

    # 5. Core Monogram "V" in central die
    v_w = core_radius * 0.65
    v_h = core_radius * 0.75
    v_pts = [
        (center - v_w, center - v_h * 0.7),
        (center - v_w * 0.3, center - v_h * 0.7),
        (center, center + v_h * 0.5),
        (center + v_w * 0.3, center - v_h * 0.7),
        (center + v_w, center - v_h * 0.7),
        (center + v_w * 0.25, center + v_h * 0.75),
        (center - v_w * 0.25, center + v_h * 0.75),
    ]
    draw.polygon(v_pts, fill=BG_BRAND)

    # 6. Satellite Nodes with distinct role colors (Ready, Running, Waiting, Mutex)
    node_colors = [
        EMERALD_ACCENT,  # Running (green)
        CYAN_ACCENT,     # Network / Telemetry (cyan)
        AMBER_ACCENT,    # Ready / Scheduling (amber)
        (255, 255, 255), # Synchronization Lock (white)
    ]
    for (nx, ny), col in zip(nodes, node_colors):
        # Outer glow ring
        draw.ellipse(
            [nx - node_radius, ny - node_radius, nx + node_radius, ny + node_radius],
            fill=col,
            outline=(255, 255, 255, 220),
            width=int(ring_width * 0.8)
        )
        # Inner dot
        inner_r = node_radius * 0.45
        draw.ellipse(
            [nx - inner_r, ny - inner_r, nx + inner_r, ny + inner_r],
            fill=(255, 255, 255) if col != (255, 255, 255) else BG_BRAND
        )

    # Resample with Lanczos filter for high quality output
    return img.resize((size, size), Image.Resampling.LANCZOS)

def generate_svg() -> str:
    """Generates crisp scalable SVG vector icon."""
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4055A8"/>
      <stop offset="100%" stop-color="#2D3E82"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Base Rounded Container -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>

  <!-- Synchronous Orbital Track -->
  <circle cx="256" cy="256" r="172" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-opacity="0.2" stroke-dasharray="8 6"/>

  <!-- Bus Lines connecting center to nodes -->
  <line x1="256" y1="256" x2="378" y2="134" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.6"/>
  <line x1="256" y1="256" x2="134" y2="134" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.6"/>
  <line x1="256" y1="256" x2="134" y2="378" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.6"/>
  <line x1="256" y1="256" x2="378" y2="378" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.6"/>

  <!-- Central Microkernel Die / Shield -->
  <rect x="180" y="180" width="152" height="152" rx="36" fill="#FFFFFF" stroke="#38BDF8" stroke-width="6" filter="url(#softShadow)"/>

  <!-- VGARSS Monogram 'V' -->
  <polygon points="208,206 230,206 256,278 282,206 304,206 270,306 242,306" fill="#4055A8"/>

  <!-- Synchronized Satellite Nodes -->
  <!-- 1. Running (Emerald) -->
  <circle cx="378" cy="134" r="26" fill="#16805D" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="378" cy="134" r="10" fill="#FFFFFF"/>

  <!-- 2. Telemetry (Cyan) -->
  <circle cx="134" cy="134" r="26" fill="#38BDF8" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="134" cy="134" r="10" fill="#FFFFFF"/>

  <!-- 3. Scheduling / Ready (Amber) -->
  <circle cx="134" cy="378" r="26" fill="#B7791F" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="134" cy="378" r="10" fill="#FFFFFF"/>

  <!-- 4. Mutex / Lock (White) -->
  <circle cx="378" cy="378" r="26" fill="#FFFFFF" stroke="#4055A8" stroke-width="4"/>
  <circle cx="378" cy="378" r="10" fill="#4055A8"/>
</svg>"""

def main():
    print("Generating VGARSS PWA Assets...")
    
    # 1. SVG
    svg_path = os.path.join(ICONS_DIR, "icon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(generate_svg())
    print(f"[OK] Wrote {svg_path}")

    # Copy to public/favicon.svg as well
    favicon_svg = os.path.join(PUBLIC_DIR, "favicon.svg")
    with open(favicon_svg, "w", encoding="utf-8") as f:
        f.write(generate_svg())
    print(f"[OK] Wrote {favicon_svg}")

    # 2. Standard & Maskable PNGs
    targets = [
        ("icon-192x192.png", 192, False),
        ("icon-192x192-maskable.png", 192, True),
        ("icon-512x512.png", 512, False),
        ("icon-512x512-maskable.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]

    for filename, size, maskable in targets:
        out_path = os.path.join(ICONS_DIR, filename)
        img = draw_vgarss_icon(size=size, is_maskable=maskable, scale=4)
        img.save(out_path, format="PNG", optimize=True)
        print(f"[OK] Generated {out_path} ({size}x{size}, maskable={maskable})")

    # 3. Multi-resolution Favicon ICO
    fav_16 = draw_vgarss_icon(16, False, scale=8)
    fav_32 = draw_vgarss_icon(32, False, scale=4)
    fav_48 = draw_vgarss_icon(48, False, scale=4)
    fav_path = os.path.join(PUBLIC_DIR, "favicon.ico")
    fav_48.save(fav_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"[OK] Generated {fav_path} (16, 32, 48px)")

    print("\n--- ALL PWA ASSETS GENERATED SUCCESSFULLY ---")

if __name__ == "__main__":
    main()

