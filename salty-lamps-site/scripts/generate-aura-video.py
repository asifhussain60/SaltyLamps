#!/usr/bin/env python3
"""Generate the Aura Collection hero video via the Gemini API (Veo 3.1).

Five ~8s scenes: three presenter-led (conditioned on reference frames of the
home-gifts presenter for face consistency) and two product close-up inserts
(first-frame conditioned on the real product photos). Clips are stitched with
ffmpeg into public/media/video/collection/aura-collection-hero-16x9.mp4 and a
poster frame is extracted, matching the naming of the four existing hero videos.

API key comes from the macOS Keychain item `gemini_api_key`.
Copy stays claim-free: ambience, craftsmanship, uniqueness, sizes only.
"""

import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

MODEL = "veo-3.1-generate-preview"
BASE = "https://generativelanguage.googleapis.com/v1beta"
SITE = Path(__file__).resolve().parent.parent
OUT_DIR = SITE / "public" / "media" / "video" / "collection"
REF_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else SITE / "scripts" / "video-refs"
WORK = OUT_DIR / "_aura_work"

STYLE = (
    "Cinematic commercial footage, warm golden colour grading, soft lighting, "
    "slow deliberate camera movement, premium interior-brand aesthetic. "
)
PRESENTER = (
    "The presenter is the same woman as in the reference image: a British woman in "
    "her late 30s with shoulder-length wavy brown hair, warm neutral clothing, "
    "speaking directly to camera in a calm, warm English accent. "
)

SCENES = [
    {
        "name": "01-living-room",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + (
            "She stands in an elegant evening living room beside a large framed "
            "backlit Himalayan salt wall panel glowing amber on the wall. She says: "
            "\"Some artwork is admired. Some transforms the atmosphere.\" "
            "The room is warm and inviting, sofa and plants softly lit by the panel."
        ),
    },
    {
        "name": "02-salt-macro",
        "first_frame": "insert-salt-surface.jpg",
        "prompt": STYLE + (
            "Extreme close-up macro shot slowly panning across a glowing backlit "
            "Himalayan salt panel, rich amber and pale pink mineral veining, texture "
            "detail. A soft female British voiceover says: \"Carved from ancient "
            "Himalayan rock salt — every panel is unique in its mineral veining.\""
        ),
    },
    {
        "name": "03-frame-craft",
        "first_frame": "insert-frame-corner.jpg",
        "prompt": STYLE + (
            "Slow close-up camera move along the mitred corner of a hand-finished "
            "solid walnut wood frame holding a glowing salt panel, wood grain detail. "
            "A soft female British voiceover says: \"Each frame is finished by hand — "
            "crafted to last.\""
        ),
    },
    {
        "name": "04-studio",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + (
            "She stands in a bright, calm yoga studio with a tall framed backlit "
            "Himalayan salt panel glowing on the wall behind her. She says: "
            "\"A warm, calming presence — wherever it hangs.\" Yoga mats and soft "
            "daylight in the background."
        ),
    },
    {
        "name": "05-reception-close",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + (
            "She stands in an elegant hotel reception area with three framed backlit "
            "Himalayan salt panels on a wood feature wall behind her. She says: "
            "\"From a single accent panel to a full statement wall. Nature. "
            "Simplicity. Timeless beauty.\" She smiles warmly as the camera slowly "
            "pushes in on the glowing panels."
        ),
    },
]


def api_key():
    return subprocess.run(
        ["security", "find-generic-password", "-w", "-s", "gemini_api_key"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def b64_image(path):
    return {"bytesBase64Encoded": base64.b64encode(path.read_bytes()).decode(),
            "mimeType": "image/jpeg"}


def post_json(url, body, key):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def get_json(url, key):
    req = urllib.request.Request(url, headers={"x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def generate_scene(scene, key):
    instance = {"prompt": scene["prompt"]}
    if "reference" in scene:
        instance["referenceImages"] = [
            {"image": b64_image(REF_DIR / scene["reference"]), "referenceType": "asset"}
        ]
    if "first_frame" in scene:
        instance["image"] = b64_image(REF_DIR / scene["first_frame"])
    body = {
        "instances": [instance],
        "parameters": {"aspectRatio": "16:9", "resolution": "720p"},
    }
    op = post_json(f"{BASE}/models/{MODEL}:predictLongRunning", body, key)
    op_name = op["name"]
    print(f"  operation {op_name}", flush=True)
    while True:
        time.sleep(15)
        status = get_json(f"{BASE}/{op_name}", key)
        if status.get("done"):
            if "error" in status:
                raise RuntimeError(f"scene {scene['name']}: {status['error']}")
            resp = status["response"]
            samples = (resp.get("generateVideoResponse", {}).get("generatedSamples")
                       or resp.get("generatedVideos") or [])
            video = samples[0]["video"]
            uri = video.get("uri")
            out = WORK / f"{scene['name']}.mp4"
            if uri:
                req = urllib.request.Request(uri, headers={"x-goog-api-key": key})
                with urllib.request.urlopen(req, timeout=600) as r:
                    out.write_bytes(r.read())
            else:
                out.write_bytes(base64.b64decode(video["bytesBase64Encoded"]))
            print(f"  saved {out.name} ({out.stat().st_size // 1024} KB)", flush=True)
            return out
        print("  ...rendering", flush=True)


def main():
    key = api_key()
    WORK.mkdir(parents=True, exist_ok=True)
    clips = []
    for scene in SCENES:
        existing = WORK / f"{scene['name']}.mp4"
        if existing.exists() and existing.stat().st_size > 0:
            print(f"scene {scene['name']}: cached, skipping")
            clips.append(existing)
            continue
        print(f"scene {scene['name']}: generating...", flush=True)
        clips.append(generate_scene(scene, key))

    concat_list = WORK / "concat.txt"
    concat_list.write_text("".join(f"file '{c.name}'\n" for c in clips))
    final = OUT_DIR / "aura-collection-hero-16x9.mp4"
    # Re-encode (not stream-copy) so slight per-clip encoder differences can't
    # corrupt playback; normalize to the site's 1280x720 H.264/AAC baseline.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", str(concat_list),
         "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24",
         "-c:v", "libx264", "-crf", "20", "-preset", "medium",
         "-c:a", "aac", "-b:a", "128k", str(final)],
        check=True, cwd=WORK,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", "1", "-i", str(final),
         "-frames:v", "1", "-q:v", "3",
         str(OUT_DIR / "aura-collection-hero-poster-16x9.jpg")],
        check=True,
    )
    print(f"done: {final}")


if __name__ == "__main__":
    main()
