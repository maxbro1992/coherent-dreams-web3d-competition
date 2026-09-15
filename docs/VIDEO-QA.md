# Demonstration video QA

## Verified media

- **File:** `Coherent-Dreams-Web3D-Demo.mp4`
- **Duration:** 290.021 seconds (4:50.021), inside the required 3–5 minute window
- **Video:** H.264, 1920 × 1080, 30 fps, yuv420p
- **Audio:** AAC, 48 kHz, stereo, 160 kb/s target
- **Audio level:** mean −24.1 dB, peak −5.3 dB
- **File size:** 12,477,243 bytes
- **Captions:** matching English SRT supplied as `Coherent-Dreams-Web3D-Demo.srt`
- **Music:** none
- **Narration:** Microsoft Zira Desktop, generated locally from the included script

Representative frames were extracted at 00:05, 02:02, and 03:25 and visually inspected. They preserve the 1080p slide layout, project UI, section titles, and readable evidence panels without clipping.

## Rebuild

From the project root:

```powershell
python tools/make_video_assets.py
./tools/render_narration.ps1
python tools/render_demo.py
```

The render requires Pillow, FFmpeg/FFprobe, and the Windows `System.Speech` assembly with the Microsoft Zira Desktop voice.
