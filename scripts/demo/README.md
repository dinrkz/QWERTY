# Local English demo recording

This workflow records the real Qadam interface with Cap and produces a **4 minute 40 second** captioned MP4. It does not upload the recording. Keep all `.cap` projects, video files, screenshots and subtitles under ignored `data/runtime/`; do not add them to Git.

The October 19 local recording contains three successful live AI searches and two pedestrian routes. The final `data/runtime/demo-2026-10-19/qadam-demo-english.mp4` is verified as 280 seconds, 1920×1080, 30 fps, H.264, 25,184,147 bytes. Full decoding passed; sampled frames were visually reviewed. The editable Cap project, raw export, English SRT and verification evidence remain in the same ignored directory. No upload or publication was performed.

## Prerequisites

- Cap CLI installed locally. The current Windows installation is `C:/Users/arlan/AppData/Local/Cap/cap-cli.exe`.
- Python with Pillow available to the selected interpreter, and Windows Segoe UI (`C:/Windows/Fonts/segoeui.ttf`).
- Qadam running with its existing AI configuration, in Chrome, with the interface language set to English. Start the current private setup with `node scripts/app/start-ai.mjs`. Never expose its environment file or credentials on screen.
- An authorized AI allowance for the three scenario submissions. Route selection uses the separate routing provider.

Install the local FFmpeg package once, from the repository root:

```powershell
python -m pip install imageio-ffmpeg --target data/runtime/demo-tools/python
```

The renderer also imports Pillow. If the chosen Python does not already provide it, install `Pillow` in that interpreter's environment. The renderer uses the local `imageio-ffmpeg` package automatically; no global FFmpeg installation or subtitle rendering library is needed.

## Capture the actual interface

Set the Cap executable path and inspect the current capture targets:

```powershell
$capCli = 'C:/Users/arlan/AppData/Local/Cap/cap-cli.exe'
& $capCli targets windows
```

Select the current **Qadam Chrome window ID** from this output; IDs change between sessions. Use a fresh, nonexistent `.cap` path for every take. For example, after replacing `WINDOW_ID` with the actual ID:

```powershell
& $capCli record start --window WINDOW_ID --mode studio --fps 30 --duration 282 --detach --path data/runtime/demo-2026-10-19/new.cap
```

Do not pass `--mic`, `--camera` or `--system-audio`. This is a captioned, silent demonstration. Keep unrelated windows, notifications and secret-bearing developer tools out of the capture.

Use `demo-captions.json` as the timed guide:

1. Introduce the map and sidebar.
2. Run a 60-minute walk near Mega Silk Way; inspect suggestions and select a route.
3. Run a 90-minute first visit near Bayterek; compare the returned alternatives.
4. Run a 45-minute coffee search near Bayterek; select a result and show its route.
5. Explain selected-evidence RAG, provider data sharing and remaining uncertainty.

Adapt captions or timing to what actually appears. Never describe a failed or retrieval-only response as successful live AI. Do not replace visible results with fabricated output. The captions intentionally distinguish source facts, generated activity ideas and estimated routes.

## Validate, export and caption

After the timed recording has finished:

```powershell
& $capCli project validate data/runtime/demo-2026-10-19/new.cap
& $capCli export data/runtime/demo-2026-10-19/new.cap data/runtime/demo-2026-10-19/qadam-demo-raw.mp4 --fps 30 --resolution 1920x1080 --quality maximum
python scripts/demo/render_demo.py --input data/runtime/demo-2026-10-19/qadam-demo-raw.mp4 --output data/runtime/demo-2026-10-19/qadam-demo-english.mp4 --captions scripts/demo/demo-captions.json --duration 280
```

Preserve the original `.cap` project and raw MP4. The renderer refuses to overwrite an existing output or process an input shorter than the requested duration. It creates a separate MP4 and matching `.srt`, discards any source audio, and performs no capture or network upload.

**Framing is specific to the verified 1920×1080 capture:** the renderer crops `x=0, y=72, width=1920, height=948`, then appends a 132-pixel dark caption strip. Inspect a short capture before reusing this crop with a different browser layout, display scale or window size. Exporting at 1920×1080 alone does not guarantee the same content framing. A five-second composition check can use `--duration 5` and a fresh output filename.

The final output uses H.264, 30 fps, YUV420p, CRF 20 and MP4 fast-start. Captions use 32-pixel Segoe UI, centered in at most two lines; oversized cues fail explicitly instead of overflowing. A permanent footer credits OpenStreetMap contributors and FOSSGIS / Valhalla because the capture's taskbar obscures the original map attribution. See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

## Final playback checks

Run the local technical check (use a fresh QA output directory):

```powershell
python scripts/demo/verify_demo.py data/runtime/demo-2026-10-19/qadam-demo-english.mp4 --output-dir data/runtime/demo-2026-10-19/qa-final
```

This checks duration, dimensions, frame rate and full-file decoding, then writes nine sample PNGs plus a JSON report. Visual review is still required.

- Confirm duration is 280 seconds, video is 1920×1080, and playback reaches the final frame.
- Inspect the beginning, each scenario transition, route display and ending. Captions must match the visible actions and real results.
- Verify readable English UI/captions, visible map attribution, and absence of debug banners, taskbar, unrelated windows or secrets.
- Confirm all three actual searches and at least one actual pedestrian route are visible. Preserve clear failure or uncertainty labels where applicable.
- Keep the video local unless the user separately requests publication or upload.
