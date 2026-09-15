from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "video-assets"
SLIDES = ASSETS / "slides"
WIDTH, HEIGHT = 1920, 1080
BG = "#020b13"
CYAN = "#67daf6"
MUTED = "#90a9b8"
WHITE = "#f1f7fa"
PINK = "#ff4fc3"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


FONT_LABEL = font("seguisb.ttf", 24)
FONT_TITLE = font("seguisb.ttf", 38)
FONT_TAKEAWAY = font("segoeui.ttf", 24)
FONT_HERO = font("seguisb.ttf", 84)
FONT_HERO_SMALL = font("segoeui.ttf", 32)
FONT_META = font("seguisb.ttf", 26)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    ratio = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    ratio = min(size[0] / image.width, size[1] / image.height)
    return image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def screenshot_slide(source: Path, label: str, title: str, takeaway: str) -> Image.Image:
    original = Image.open(source).convert("RGB")
    background = cover(original, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(38))
    background = ImageEnhance.Brightness(background).enhance(0.13)
    canvas = background.convert("RGBA")
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (2, 11, 19, 142))
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)

    draw.text((54, 25), label, font=FONT_LABEL, fill=CYAN)
    draw.text((54, 55), title, font=FONT_TITLE, fill=WHITE)

    fitted = fit(original, (1812, 852)).convert("RGBA")
    x = (WIDTH - fitted.width) // 2
    y = 120 + (852 - fitted.height) // 2
    shadow = Image.new("RGBA", (fitted.width + 28, fitted.height + 28), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((14, 14, fitted.width + 14, fitted.height + 14), radius=22, fill=(0, 0, 0, 210))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    canvas.alpha_composite(shadow, (x - 14, y - 7))
    canvas.paste(fitted, (x, y), rounded_mask(fitted.size, 16))
    draw.rounded_rectangle((x - 1, y - 1, x + fitted.width, y + fitted.height), radius=17, outline=(83, 182, 220, 110), width=2)

    draw.text((54, 1015), takeaway, font=FONT_TAKEAWAY, fill=MUTED, anchor="ls")
    draw.text((1866, 1015), "COHERENT DREAMS", font=FONT_LABEL, fill=(255, 79, 195, 210), anchor="rs")
    return canvas.convert("RGB")


def hero_slide(art: Image.Image, label: str, title: str, takeaway: str, end: bool = False) -> Image.Image:
    background = cover(art, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(22))
    background = ImageEnhance.Contrast(background).enhance(1.1)
    background = ImageEnhance.Brightness(background).enhance(0.32)
    canvas = background.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (WIDTH, HEIGHT), (0, 7, 13, 120)))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((92, 110, 118, 970), radius=13, fill=PINK)
    draw.text((165, 250 if not end else 306), label, font=FONT_META, fill=CYAN)
    draw.text((165, 310 if not end else 368), title, font=FONT_HERO, fill=WHITE)
    draw.multiline_text((170, 430 if not end else 495), takeaway, font=FONT_HERO_SMALL, fill=(205, 225, 235), spacing=12)
    if not end:
        draw.text((170, 830), "WebGPU · explainable local AI · reproducible provenance", font=FONT_META, fill=(255, 255, 255, 190))
    else:
        draw.text((170, 820), "Maxime Brodeur  /  NexusHub Studio", font=FONT_META, fill=(255, 255, 255, 205))
    return canvas.convert("RGB")


def main() -> None:
    SLIDES.mkdir(parents=True, exist_ok=True)
    entries = json.loads((ASSETS / "narration.json").read_text(encoding="utf-8"))
    art = Image.open(ASSETS / "art.png").convert("RGB")
    for entry in entries:
        slide_path = SLIDES / f"{entry['id']}.png"
        if entry["id"] == "00-title":
            image = hero_slide(art, entry["label"], entry["title"], entry["takeaway"])
        elif entry["id"] == "07-end":
            image = hero_slide(art, entry["label"], entry["title"], entry["takeaway"], end=True)
        else:
            image = screenshot_slide(ASSETS / f"{entry['id']}.png", entry["label"], entry["title"], entry["takeaway"])
        image.save(slide_path, optimize=True)
        print(slide_path.name)


if __name__ == "__main__":
    main()
