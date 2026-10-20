"""Check a completed local demo video and save sample frames; no network use."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data/runtime/demo-tools/python"))
import imageio_ffmpeg


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    video = args.video.resolve()
    frames = imageio_ffmpeg.read_frames(str(video))
    try:
        metadata = next(frames)
    finally:
        frames.close()
    if tuple(metadata["source_size"]) != (1920, 1080):
        raise SystemExit("Unexpected dimensions")
    if abs(metadata["fps"] - 30) > 0.01:
        raise SystemExit("Unexpected frame rate")
    if abs(metadata["duration"] - 280) > 0.1:
        raise SystemExit("Expected a 280-second video")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    decoded = subprocess.run(
        [ffmpeg, "-hide_banner", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    if decoded.stderr.strip():
        raise SystemExit(decoded.stderr)
    samples = [0, 55, 100, 150, 170, 215, 230, 250, 279]
    for seconds in samples:
        subprocess.run(
            [ffmpeg, "-hide_banner", "-v", "error", "-n", "-ss", str(seconds), "-i", str(video),
             "-frames:v", "1", str(args.output_dir / f"frame-{seconds:03}.png")],
            check=True,
        )
    result = {
        "video": str(video), "duration_seconds": metadata["duration"],
        "width": 1920, "height": 1080, "fps": metadata["fps"],
        "video_codec": metadata.get("codec"), "full_decode_passed": True,
        "size_bytes": video.stat().st_size, "sample_seconds": samples,
        "visual_review": "Sample frames require human or agent visual review; decoding does not establish privacy or content correctness.",
    }
    (args.output_dir / "verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
