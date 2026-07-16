#!/usr/bin/env python3
"""Convert AI-generated map and sprite-sheet images into reusable PNG assets."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def largest_component(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    source = bytearray(1 if value else 0 for value in mask.getdata())
    visited = bytearray(width * height)
    largest: list[int] = []
    for start, enabled in enumerate(source):
        if not enabled or visited[start]:
            continue
        component: list[int] = []
        queue = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for neighbor in (index - 1 if x else None, index + 1 if x + 1 < width else None,
                             index - width if y else None, index + width if y + 1 < height else None):
                if neighbor is not None and source[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) > len(largest):
            largest = component
    result = bytearray(width * height)
    for index in largest:
        result[index] = 255
    return Image.frombytes("L", (width, height), bytes(result))


def remove_green_background(image: Image.Image, threshold: int, keep_all_foreground: bool) -> Image.Image:
    rgba = image.convert("RGBA")
    values = []
    for red, green, blue, _alpha in rgba.getdata():
        is_green = green > threshold and green > red * 1.16 and green > blue * 1.06
        values.append(0 if is_green else 255)
    mask = Image.new("L", rgba.size)
    mask.putdata(values)
    if not keep_all_foreground:
        mask = largest_component(mask)
    mask = mask.filter(ImageFilter.GaussianBlur(0.65))
    pixels = []
    for (red, green, blue, _alpha), alpha in zip(rgba.getdata(), mask.getdata()):
        if alpha:
            green = min(green, int(max(red, blue) * 1.08))
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def process_sheet(source: Path, output_dir: Path, columns: int, rows: int, frame_size: int, green_threshold: int, frame_prefix: str, keep_all_foreground: bool) -> list[Path]:
    sheet = Image.open(source).convert("RGBA")
    if sheet.width % columns or sheet.height % rows:
        raise ValueError(f"Sheet dimensions {sheet.size} are not divisible by {columns}x{rows}.")
    cell_width, cell_height = sheet.width // columns, sheet.height // rows
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for row in range(rows):
        for column in range(columns):
            index = row * columns + column
            cell = sheet.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
            output = output_dir / f"{frame_prefix}{index}.png"
            remove_green_background(cell, green_threshold, keep_all_foreground).resize((frame_size, frame_size), Image.Resampling.LANCZOS).save(output, optimize=True)
            outputs.append(output)
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Process an optional background image and green-screen sprite sheet.")
    parser.add_argument("--background", type=Path)
    parser.add_argument("--background-output", type=Path)
    parser.add_argument("--background-size", type=int, nargs=2, metavar=("WIDTH", "HEIGHT"))
    parser.add_argument("--sprite-sheet", type=Path)
    parser.add_argument("--frames-output-dir", type=Path)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--frame-size", type=int, default=256)
    parser.add_argument("--frame-prefix", default="frame-", help="Output filename prefix (default: frame-)")
    parser.add_argument("--green-threshold", type=int, default=75)
    parser.add_argument("--keep-all-foreground", action="store_true", help="Keep detached foreground effects instead of only the largest connected subject")
    args = parser.parse_args()

    has_background = args.background is not None or args.background_output is not None
    has_sheet = args.sprite_sheet is not None or args.frames_output_dir is not None
    if has_background and (args.background is None or args.background_output is None):
        parser.error("--background and --background-output must be supplied together.")
    if has_sheet and (args.sprite_sheet is None or args.frames_output_dir is None):
        parser.error("--sprite-sheet and --frames-output-dir must be supplied together.")
    if not has_background and not has_sheet:
        parser.error("Supply a background pair, a sprite-sheet pair, or both.")
    if args.columns < 1 or args.rows < 1 or args.frame_size < 1:
        parser.error("--columns, --rows, and --frame-size must be positive.")

    if has_background:
        background = Image.open(args.background).convert("RGB")
        if args.background_size:
            background = background.resize(tuple(args.background_size), Image.Resampling.LANCZOS)
        args.background_output.parent.mkdir(parents=True, exist_ok=True)
        background.save(args.background_output, optimize=True)
        print(args.background_output)
    if has_sheet:
        for output in process_sheet(args.sprite_sheet, args.frames_output_dir, args.columns, args.rows, args.frame_size, args.green_threshold, args.frame_prefix, args.keep_all_foreground):
            print(output)


if __name__ == "__main__":
    main()
