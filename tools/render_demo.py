from __future__ import annotations

import json
import re
import subprocess
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "video-assets"
SLIDES = ASSETS / "slides"
VOICE = ASSETS / "voice"
SEGMENTS = ASSETS / "segments"
OUTPUT = ASSETS / "Coherent-Dreams-Web3D-Demo.mp4"
SUBTITLES = ASSETS / "Coherent-Dreams-Web3D-Demo.srt"
MANIFEST = ASSETS / "video-manifest.json"
FPS = 30
VOICE_DELAY = 1.0


def run(args: list[str]) -> None:
    print(" ".join(args[:5]), "…", flush=True)
    subprocess.run(args, check=True)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]


def write_subtitles(entries: list[dict], audio_durations: dict[str, float]) -> None:
    blocks: list[str] = []
    index = 1
    section_start = 0.0
    for entry in entries:
        sentences = split_sentences(entry["narration"])
        counts = [max(1, len(re.findall(r"\b[\w'-]+\b", sentence))) for sentence in sentences]
        voice_duration = audio_durations[entry["id"]]
        usable = max(1.0, min(voice_duration, entry["plannedSeconds"] - VOICE_DELAY - 0.5))
        cursor = section_start + VOICE_DELAY
        total_words = sum(counts)
        for sentence, words in zip(sentences, counts):
            length = usable * words / total_words
            end = min(section_start + entry["plannedSeconds"] - 0.25, cursor + length)
            wrapped = "\n".join(textwrap.wrap(sentence, width=68))
            blocks.append(f"{index}\n{timestamp(cursor)} --> {timestamp(end)}\n{wrapped}\n")
            index += 1
            cursor = end
        section_start += entry["plannedSeconds"]
    SUBTITLES.write_text("\n".join(blocks), encoding="utf-8")


def main() -> None:
    entries = json.loads((ASSETS / "narration.json").read_text(encoding="utf-8"))
    SEGMENTS.mkdir(parents=True, exist_ok=True)
    audio_durations = {entry["id"]: probe_duration(VOICE / f"{entry['id']}.wav") for entry in entries}

    manifest_entries = []
    for entry in entries:
        duration = float(entry["plannedSeconds"])
        if audio_durations[entry["id"]] + VOICE_DELAY > duration:
            raise RuntimeError(f"Narration exceeds the planned shot: {entry['id']}")
        slide = SLIDES / f"{entry['id']}.png"
        voice = VOICE / f"{entry['id']}.wav"
        segment = SEGMENTS / f"{entry['id']}.mp4"
        fade_out = max(0.0, duration - 0.55)
        video_filter = (
            "[0:v]scale=1920:1080,"
            "zoompan=z='min(zoom+0.000012,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,"
            f"fade=t=in:st=0:d=0.55,fade=t=out:st={fade_out:.3f}:d=0.55,format=yuv420p[v];"
            f"[1:a]adelay={round(VOICE_DELAY * 1000)}:all=1,apad=whole_dur={duration:.3f},"
            f"atrim=end={duration:.3f},aformat=sample_rates=48000:channel_layouts=stereo[a]"
        )
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-loop", "1", "-framerate", str(FPS), "-i", str(slide),
            "-i", str(voice),
            "-filter_complex", video_filter,
            "-map", "[v]", "-map", "[a]", "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", str(segment),
        ])
        manifest_entries.append({
            "id": entry["id"],
            "title": entry["title"],
            "shotSeconds": duration,
            "narrationSeconds": round(audio_durations[entry["id"]], 3),
        })

    concat_file = SEGMENTS / "concat.txt"
    concat_file.write_text(
        "\n".join(f"file '{(SEGMENTS / (entry['id'] + '.mp4')).as_posix()}'" for entry in entries),
        encoding="utf-8",
    )
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c", "copy", "-movflags", "+faststart",
        "-metadata", "title=Coherent Dreams — AI Morphology Explorer",
        "-metadata", "artist=Maxime Brodeur / NexusHub Studio",
        "-metadata", "comment=AI & Web3D Innovation Competition demo",
        str(OUTPUT),
    ])

    write_subtitles(entries, audio_durations)
    manifest = {
        "title": "Coherent Dreams — AI Morphology Explorer",
        "fps": FPS,
        "resolution": "1920x1080",
        "durationSeconds": sum(entry["plannedSeconds"] for entry in entries),
        "narrator": "Microsoft Zira Desktop (local system voice)",
        "music": None,
        "sections": manifest_entries,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Rendered {OUTPUT}")
    print(f"Duration: {probe_duration(OUTPUT):.3f} seconds")


if __name__ == "__main__":
    main()
