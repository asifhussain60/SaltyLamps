#!/usr/bin/env python3
"""Generate the social-share card from the brand emblem.

    python3 scripts/generate-brand-assets.py

WHY THIS EXISTS. The emblem (public/salty-lamp-logo.jpeg) is a 1254x1254 SQUARE
with a solid black field. That is fine wherever CSS clips it to a circle — the
site header and the admin sidebar both do — but a social card cannot rely on CSS.
Facebook, WhatsApp, Slack and X all want a landscape image around 1200x630, and
they render whatever pixels you give them. Handing them the square emblem yields
either heavy letterboxing or a centre-crop that decapitates the wordmark.

So this composites the emblem onto a landscape field in the brand's own dark tone,
with the black corners masked away and a soft amber bloom behind it that echoes
--amber-glow from src/styles/saltylamps.css.

Committed as a script rather than a one-off command because the output is a binary
asset in the repo: without this, nobody can tell how it was made or reproduce it
when the emblem changes.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "salty-lamp-logo.jpeg"
OUT = ROOT / "public" / "media" / "salty-lamps-og-card.jpg"

# Brand tokens, from src/styles/saltylamps.css
INK = (31, 25, 21)        # --ink  #1f1915
AMBER = (216, 138, 53)    # --amber #d88a35

CARD = (1200, 630)        # the size every major platform crops toward
EMBLEM = 470              # leaves generous margin; keeps the curved wordmark legible


def circular(image: Image.Image, size: int) -> Image.Image:
    """Square emblem -> circle with transparent corners.

    The emblem is drawn as a circle inside its square, so masking to a circle
    removes only black field, never artwork — and it means the card needs no
    background colour match with the JPEG's black.
    """
    art = image.convert("RGB").resize((size, size), Image.LANCZOS)
    # 4x supersampled mask, then downsampled: a mask drawn at final size has
    # visibly stepped edges against a flat background.
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    art.putalpha(mask.resize((size, size), Image.LANCZOS))
    return art


def bloom(size: int, spread: int) -> Image.Image:
    """A soft amber halo, standing in for the site's --amber-glow box-shadow."""
    layer = Image.new("RGBA", (size + spread * 2,) * 2, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        (spread * 0.7, spread * 0.7, layer.width - spread * 0.7, layer.height - spread * 0.7),
        fill=(*AMBER, 80),
    )
    return layer.filter(ImageFilter.GaussianBlur(spread * 0.55))


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing {SOURCE.relative_to(ROOT)}")

    card = Image.new("RGB", CARD, INK)
    halo = bloom(EMBLEM, 90)
    card.paste(halo, ((CARD[0] - halo.width) // 2, (CARD[1] - halo.height) // 2), halo)

    emblem = circular(Image.open(SOURCE), EMBLEM)
    card.paste(emblem, ((CARD[0] - EMBLEM) // 2, (CARD[1] - EMBLEM) // 2), emblem)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"wrote {OUT.relative_to(ROOT)}  {CARD[0]}x{CARD[1]}  {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
