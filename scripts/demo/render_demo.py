"""Locally crop and caption an existing Cap export; never capture or upload video.

The capture framing is specific to the verified 1920x1080 Qadam recording.
Install Pillow and imageio-ffmpeg, or use the project's ignored demo-tools copy.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
BUNDLED_PACKAGES = ROOT / "data" / "runtime" / "demo-tools" / "python"
if BUNDLED_PACKAGES.is_dir():
    sys.path.insert(0, str(BUNDLED_PACKAGES))

import imageio_ffmpeg  # noqa: E402


WIDTH = 1920
CAPTION_HEIGHT = 132
BACKGROUND = "#142d2b"
TEXT_COLOR = "#ffffff"


def read_cues(path: Path, duration: float) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise ValueError("Captions must be a nonempty JSON list.")
    cues = []
    previous_end = 0.0
    for cue in raw:
        if not isinstance(cue, dict):
            raise ValueError("Each caption must be an object.")
        start, end, text = cue.get("start"), cue.get("end"), cue.get("text")
        if (
            isinstance(start, bool)
            or isinstance(end, bool)
            or not isinstance(start, (int, float))
            or not isinstance(end, (int, float))
            or not math.isfinite(start)
            or not math.isfinite(end)
            or start < previous_end
            or end <= start
            or not isinstance(text, str)
            or not text.strip()
        ):
            raise ValueError("Invalid caption text, timing or overlapping cues.")
        previous_end = end
        if start < duration:
            cues.append({"start": float(start), "end": min(float(end), duration), "text": text.strip()})
    return cues


def timestamp(seconds: float) -> str:
    total = round(seconds * 1000)
    hours, total = divmod(total, 3_600_000)
    minutes, total = divmod(total, 60_000)
    seconds, milliseconds = divmod(total, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def write_srt(path: Path, cues: list[dict]) -> None:
    lines = []
    for index, cue in enumerate(cues, 1):
        lines.extend([
            str(index),
            f"{timestamp(cue['start'])} --> {timestamp(cue['end'])}",
            cue["text"],
            "",
        ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def caption_image(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, CAPTION_HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    attribution_font = ImageFont.truetype(font.path, size=18)
    draw.text(
        (WIDTH / 2, 116),
        "Map: © OpenStreetMap contributors · Walking routes: FOSSGIS / Valhalla",
        font=attribution_font, fill="#b8cfca", anchor="mm",
    )
    if not text:
        return canvas
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= 1760:
            current = candidate
        else:
            if not current or draw.textlength(word, font=font) > 1760:
                raise ValueError("Caption contains a word too wide for the strip.")
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > 2:
        raise ValueError("Caption exceeds two lines at 32px Segoe UI.")
    label = "\n".join(lines)
    box = draw.multiline_textbbox((0, 0), label, font=font, spacing=10, align="center")
    position = ((WIDTH - (box[2] - box[0])) / 2 - box[0], (104 - (box[3] - box[1])) / 2 - box[1])
    draw.multiline_text(position, label, fill=TEXT_COLOR, font=font, spacing=10, align="center")
    return canvas


def render(input_path: Path, output_path: Path, cues_path: Path, duration: float) -> None:
    if not input_path.is_file():
        raise ValueError("Input video does not exist.")
    if input_path.resolve() == output_path.resolve():
        raise ValueError("Output must differ from the original recording.")
    if output_path.exists():
        raise ValueError("Output already exists; select a new output filename.")
    if output_path.suffix.lower() != ".mp4":
        raise ValueError("Output must use an .mp4 extension.")
    cues = read_cues(cues_path, duration)
    font_path = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / "segoeui.ttf"
    font = ImageFont.truetype(str(font_path), size=32)

    frames = imageio_ffmpeg.read_frames(str(input_path))
    try:
        metadata = next(frames)
    finally:
        frames.close()
    if tuple(metadata["source_size"]) != (1920, 1080):
        raise ValueError("Expected the verified 1920x1080 capture framing.")
    source_duration = metadata.get("duration", 0)
    if source_duration and source_duration < duration - 0.1:
        raise ValueError(f"Input is only {source_duration:.2f}s, shorter than requested {duration:.2f}s.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Temporary assets stay beside the private output and are removed afterward.
    with tempfile.TemporaryDirectory(prefix="caption-render-", dir=output_path.parent) as temporary:
        temp = Path(temporary)
        segments: list[tuple[float, str]] = []
        position = 0.0
        for cue in cues:
            if cue["start"] > position:
                segments.append((cue["start"] - position, ""))
            segments.append((cue["end"] - cue["start"], cue["text"]))
            position = cue["end"]
        if position < duration:
            segments.append((duration - position, ""))
        concat = ["ffconcat version 1.0"]
        for index, (length, text) in enumerate(segments):
            name = f"caption_{index:03}.png"
            caption_image(text, font).save(temp / name)
            concat.extend([f"file '{name}'", f"duration {length:.9f}"])
        # The concat demuxer needs a final repeated frame to honor the last duration.
        concat.append(f"file 'caption_{len(segments) - 1:03}.png'")
        concat_path = temp / "captions.ffconcat"
        concat_path.write_text("\n".join(concat) + "\n", encoding="utf-8")
        filters = (
            "[0:v]crop=1920:948:0:72,setpts=PTS-STARTPTS,fps=30,setsar=1[screen];"
            f"[1:v]fps=30,trim=duration={duration:.9f},setpts=PTS-STARTPTS,setsar=1[captions];"
            "[screen][captions]vstack=inputs=2:shortest=1,format=yuv420p[output]"
        )
        command = [
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "warning", "-n",
            "-i", str(input_path.resolve()), "-f", "concat", "-safe", "1", "-i", str(concat_path.resolve()),
            "-filter_complex", filters, "-map", "[output]", "-an", "-t", str(duration),
            "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output_path.resolve()),
        ]
        subprocess.run(command, check=True, shell=False)
    write_srt(output_path.with_suffix(".srt"), cues)
    print(f"Saved {output_path} and {output_path.with_suffix('.srt')} ({duration:g} seconds).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--captions", required=True, type=Path)
    parser.add_argument("--duration", type=float, default=280)
    args = parser.parse_args()
    if not math.isfinite(args.duration) or args.duration <= 0:
        parser.error("--duration must be a positive finite number.")
    try:
        render(args.input, args.output, args.captions, args.duration)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Render failed: {error}\n")


if __name__ == "__main__":
    main()
