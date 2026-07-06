#!/usr/bin/env python3
"""Generate the Aura Collection hero video via the Gemini API (Veo 3.1).

Six ~8s presenter-led scenes forming one continuous piece: the same British
woman speaks to camera throughout while the background morphs cinematically
through the locations she describes (living room -> salt macro -> workshop frame
-> wellness studio -> hotel reception -> aspirational close), ending on an
explicit call to action. Every scene is conditioned on the presenter reference
frame (scripts/video-refs/presenter-home-mid.jpg) for a consistent face,
wardrobe and framing — that reference is extracted from the surviving
home-gifts hero video (the source the presenter originated from) and committed
so this generator is self-sufficient.

Design note — why reference (asset) conditioning on every clip rather than
last-frame chaining: asset conditioning is the proven path for a *speaking*
presenter with generated audio; first-frame (image) conditioning is only proven
for the silent product inserts and risks suppressing her speech. Continuity is
instead delivered by (a) the same reference on every clip and (b) morph-aligned
prompts where each clip's background flows from the previous clip's end state.
This also lets scene 1 open on a dark room that warms as the panel ignites.

Clips are stitched with ffmpeg into
public/media/video/collection/aura-collection-hero-16x9.mp4 and a warm poster
frame is extracted, matching the naming of the existing hero videos. The prior
video and poster are backed up to *.bak before overwrite.

API key comes from the macOS Keychain item `gemini_api_key`.
Copy stays claim-free: ambience, craftsmanship, uniqueness, sizes only —
no medical or health claims.
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

# One continuous take: she never stops speaking; only the world behind her
# changes. This directive is appended to every scene so the woman is held
# constant and the location shift reads as a cinematic dissolve, not a cut.
HOLD = (
    "She stays centre-frame, same wardrobe and the same warm light on her face, "
    "speaking to camera without pause. The change happens only behind her, as a "
    "single smooth cinematic dissolve — never a hard cut, never a jump. "
)

SCENES = [
    {
        # Sajni's opening beat: a dark ordinary room transformed by the light.
        "name": "01-open-transform",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + HOLD + (
            "The shot opens in a dark, ordinary, dimly lit living room. As she "
            "begins to speak, the large framed backlit Himalayan salt wall panel "
            "on the wall behind her slowly illuminates and the whole room warms "
            "to a soft amber glow — a sofa, plants and candles emerging gently "
            "from the shadows. She says: \"Some artwork is admired. Some "
            "transforms the atmosphere.\""
        ),
    },
    {
        "name": "02-materials",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + HOLD + (
            "She stands in the warm, amber-lit living room, the glowing framed "
            "salt panel beside her. Behind her the wall dissolves into an extreme "
            "close view of glowing Himalayan salt — rich amber and pale-pink "
            "mineral veining, natural texture — then eases back to a full backlit "
            "panel. She says: \"Carved from Himalayan rock salt formed over "
            "millions of years — no two panels are ever alike.\""
        ),
    },
    {
        "name": "03-craft",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + HOLD + (
            "Behind her the setting dissolves from the living room into a warm "
            "artisan workshop: a close view of a hand-finished solid walnut frame "
            "and its clean mitred corner, wood grain catching the light beside "
            "her. She says: \"Set in a solid-wood frame, finished by hand — "
            "mitred corner to mitred corner.\""
        ),
    },
    {
        "name": "04-studio",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + HOLD + (
            "Behind her the workshop dissolves into a bright, calm wellness "
            "studio — a tall framed backlit salt panel on the wall, soft "
            "daylight, plants, linen and pale wood. She says: \"A warm, calming "
            "presence that settles a room — beside wood, stone, linen and green.\""
        ),
    },
    {
        "name": "05-reception",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + HOLD + (
            "Behind her the studio dissolves into an elegant hotel reception with "
            "three framed backlit Himalayan salt panels on a rich wood feature "
            "wall. She says: \"From a single accent panel to a full statement "
            "wall — at home, in the studio, or in reception.\""
        ),
    },
    {
        # Explicit call to action — the beat the original video lacked.
        "name": "06-cta",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + (
            "She stands before the glowing feature wall of framed Himalayan salt "
            "panels as the camera slowly pushes in and the amber glow deepens — "
            "refined, aspirational, timeless. She smiles warmly and says: \"The "
            "Aura Collection. Nature. Simplicity. Timeless beauty. Discover "
            "yours.\""
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
    poster = OUT_DIR / "aura-collection-hero-poster-16x9.jpg"

    # Back up the current video and poster before overwriting, so a weaker
    # render can be reverted (cp -> *.bak, only if an original exists).
    for asset in (final, poster):
        if asset.exists():
            backup = asset.with_suffix(asset.suffix + ".bak")
            backup.write_bytes(asset.read_bytes())
            print(f"backed up {asset.name} -> {backup.name}", flush=True)

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
    # Poster from ~4s: scene 1 opens dark and warms, so grab a frame once the
    # room is fully lit rather than the black opening.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", "4", "-i", str(final),
         "-frames:v", "1", "-q:v", "3", str(poster)],
        check=True,
    )
    print(f"done: {final}")


if __name__ == "__main__":
    main()
