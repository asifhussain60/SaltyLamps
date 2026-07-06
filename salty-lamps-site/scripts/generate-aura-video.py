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
# Render cache lives OUTSIDE public/ so Vite never publishes the intermediate
# clips (public/ is copied verbatim into dist/ on build).
WORK = SITE / ".aura-render-cache"

STYLE = (
    "Cinematic commercial footage, warm golden colour grading, soft lighting, "
    "slow deliberate camera movement, premium interior-brand aesthetic. "
)
PRESENTER = (
    "The presenter is the same woman as in the reference image: a British woman in "
    "her late 30s with shoulder-length wavy brown hair, warm neutral clothing, "
    "speaking directly to camera in a calm, warm English accent. "
)

# Each scene is ONE stable location — the woman speaking a single, short,
# complete line. The change of location happens between clips as a crossfade
# (see stitch_crossfade), so the film flows scene-to-scene instead of hard-
# cutting. PACE keeps her consistent and, critically, tells her to finish the
# line with a calm pause before the shot ends — so the 8s clip boundary never
# clips a word (the "there was more to the sentence" problem).
PACE = (
    "She stays centre-frame in the same cream wrap over a satin blouse, warm "
    "light on her face, speaking directly and unhurried to camera. She begins "
    "after a brief beat and finishes the line a clear moment before the shot "
    "ends, holding a calm, natural pause — never rushing, never cut off. "
)

SCENES = [
    {
        # Sajni's opening beat: a dark ordinary room transformed by the light.
        "name": "01-open-transform",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "The setting is a dark, ordinary, dimly lit living room. As she "
            "begins to speak, the large framed backlit Himalayan salt wall panel "
            "behind her illuminates and the whole room warms to a soft amber "
            "glow — a sofa, plants and candles emerging from the shadows. She "
            "says: \"Some artwork is admired. Some transforms the atmosphere.\""
        ),
    },
    {
        "name": "02-materials",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "The setting is a warm, amber-lit living room; a glowing framed "
            "Himalayan salt panel rests on the wall beside her, its pink-and-"
            "amber mineral veining catching the light. She says: \"Carved from "
            "ancient Himalayan salt — no two are ever alike.\""
        ),
    },
    {
        "name": "03-craft",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "The setting is a warm interior beside the panel's hand-finished "
            "solid walnut frame, the wood grain and clean mitred corner glowing "
            "next to her. She says: \"Framed in solid wood, and finished by "
            "hand.\""
        ),
    },
    {
        "name": "04-studio",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "The setting is a bright, calm wellness studio — a tall framed "
            "backlit salt panel on the wall, soft daylight, plants and linen. "
            "She says: \"A warm, calming presence in any room.\""
        ),
    },
    {
        "name": "05-reception",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "The setting is an elegant hotel reception, three framed backlit "
            "Himalayan salt panels on a rich wood feature wall behind her. She "
            "says: \"From a single accent panel to a full statement wall.\""
        ),
    },
    {
        # Explicit call to action — the beat the original video lacked.
        "name": "06-cta",
        "reference": "presenter-home-mid.jpg",
        "prompt": STYLE + PRESENTER + PACE + (
            "She stands before a glowing feature wall of framed Himalayan salt "
            "panels as the camera slowly, gently pushes in and the amber glow "
            "deepens. She smiles warmly and says: \"The Aura Collection. Nature. "
            "Simplicity. Discover yours.\""
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


def _generate_once(scene, key):
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
                raise RuntimeError(status["error"])
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


def generate_scene(scene, key, attempts=4):
    """Generate one scene, retrying transient Veo failures (code 13 / internal
    server errors are common on long runs) with a short back-off before giving
    up. Cached earlier scenes let a hard failure resume without re-spending."""
    for attempt in range(1, attempts + 1):
        try:
            return _generate_once(scene, key)
        except RuntimeError as err:
            transient = "'code': 13" in str(err) or "internal" in str(err).lower()
            if attempt == attempts or not transient:
                raise RuntimeError(f"scene {scene['name']}: {err}")
            wait = 30 * attempt
            print(f"  transient error on {scene['name']} "
                  f"(attempt {attempt}/{attempts}); retrying in {wait}s: {err}",
                  flush=True)
            time.sleep(wait)


def probe_dur(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


NORM_V = ("scale=1280:720:force_original_aspect_ratio=decrease,"
          "pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p,"
          "setsar=1,settb=AVTB")


def stitch_crossfade(clips, final, xdur=0.6):
    """Concatenate clips with a crossfade (xfade + acrossfade) at every join so
    scenes flow into one another instead of hard-cutting. Each input is first
    normalized to the site's 1280x720/24fps baseline so xfade's inputs match.
    """
    durs = [probe_dur(c) for c in clips]
    inputs = []
    for c in clips:
        inputs += ["-i", str(c)]

    fc = []
    for i in range(len(clips)):
        fc.append(f"[{i}:v]{NORM_V}[v{i}]")
        fc.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
                  f"asetpts=PTS-STARTPTS[a{i}]")

    # Chain the crossfades. offset for each join = running output length minus
    # the crossfade duration (transition starts xdur before the current tail).
    cur_v, cur_a = "[v0]", "[a0]"
    prev_dur = durs[0]
    for k in range(1, len(clips)):
        off = prev_dur - xdur
        out_v = "[vout]" if k == len(clips) - 1 else f"[vx{k}]"
        out_a = "[aout]" if k == len(clips) - 1 else f"[ax{k}]"
        fc.append(f"{cur_v}[v{k}]xfade=transition=fade:duration={xdur}:"
                  f"offset={off:.3f}{out_v}")
        fc.append(f"{cur_a}[a{k}]acrossfade=d={xdur}{out_a}")
        cur_v, cur_a = out_v, out_a
        prev_dur = prev_dur + durs[k] - xdur

    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", *inputs,
         "-filter_complex", ";".join(fc),
         "-map", "[vout]", "-map", "[aout]",
         "-c:v", "libx264", "-crf", "20", "-preset", "medium",
         "-c:a", "aac", "-b:a", "128k", str(final)],
        check=True,
    )


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

    final = OUT_DIR / "aura-collection-hero-16x9.mp4"
    poster = OUT_DIR / "aura-collection-hero-poster-16x9.jpg"

    # Back up the current video and poster before overwriting, so a weaker
    # render can be reverted (cp -> *.bak, only if an original exists).
    for asset in (final, poster):
        if asset.exists():
            backup = asset.with_suffix(asset.suffix + ".bak")
            backup.write_bytes(asset.read_bytes())
            print(f"backed up {asset.name} -> {backup.name}", flush=True)

    stitch_crossfade(clips, final)
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
