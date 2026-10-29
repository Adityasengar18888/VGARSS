def lum(h):
    h = h.lstrip('#')
    rgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

def cr(c1, c2):
    l1, l2 = lum(c1), lum(c2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)

items = [
    ('ink-primary (#f8fafc) on bg-canvas (#020617)', '#f8fafc', '#020617'),
    ('ink-primary (#f8fafc) on bg-surface (#0f172a)', '#f8fafc', '#0f172a'),
    ('ink-primary (#f8fafc) on bg-elevated (#1e293b)', '#f8fafc', '#1e293b'),
    ('ink-subtle (#cbd5e1) on bg-canvas (#020617)', '#cbd5e1', '#020617'),
    ('ink-subtle (#cbd5e1) on bg-surface (#0f172a)', '#cbd5e1', '#0f172a'),
    ('ink-subtle (#cbd5e1) on bg-elevated (#1e293b)', '#cbd5e1', '#1e293b'),
    ('ink-muted (#94a3b8) on bg-canvas (#020617)', '#94a3b8', '#020617'),
    ('ink-muted (#94a3b8) on bg-surface (#0f172a)', '#94a3b8', '#0f172a'),
    ('ink-muted (#94a3b8) on bg-elevated (#1e293b)', '#94a3b8', '#1e293b'),
    ('ink-disabled (#64748b) on bg-canvas (#020617)', '#64748b', '#020617'),
    ('ink-disabled (#64748b) on bg-surface (#0f172a)', '#64748b', '#0f172a'),
    ('ink-disabled (#64748b) on bg-elevated (#1e293b)', '#64748b', '#1e293b'),
    ('white (#ffffff) on brand-primary (#0284c7)', '#ffffff', '#0284c7'),
    ('canvas (#020617) on brand-focus (#38bdf8)', '#020617', '#38bdf8')
]

for label, fg, bg in items:
    r = cr(fg, bg)
    status = 'PASS (>=4.5:1)' if r >= 4.5 else ('PASS Large (>=3.0:1)' if r >= 3.0 else 'FAIL (<3.0:1)')
    print(f'{label:48} | Ratio: {r:5.2f}:1 | {status}')

