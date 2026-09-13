#!/usr/bin/env python3
"""Bounded, resumable Veo repair. Run submit SCENE or poll; never auto-retry a render.

Original, generated clips and operation ledger stay outside public/ in the ignored
cache. Review clips before assembly. Credentials are read only from macOS Keychain.
Two submissions per scene maximum, including ambiguous/failed submissions.
"""
import json
import hashlib
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CACHE = SITE / '.manufacturing-render-cache'
BASE = 'https://generativelanguage.googleapis.com/v1beta'
MODEL = 'veo-3.1-generate-preview'
STYLE = ('Photorealistic industrial documentary, Himalayan pink salt processing factory in '
         'Pakistan, warm amber sunlight through high warehouse windows, muted golden colour '
         'grade, realistic solid machinery, 16:9, a single continuous slow camera shot. ')
PROMPTS = {
    'warehouse': STYLE + (
        'Wide three-quarter side view showing a large heavy-duty industrial forklift with '
        'a seated adult trained operator in hard hat and high visibility vest. Its two steel '
        'forks are visibly fully inserted beneath a heavy steel pallet carrying ONE huge '
        'irregular rose-pink salt boulder, roughly one cubic metre, securely strapped to '
        'the pallet. The boulder is solid and extremely heavy. The hydraulic mast slowly '
        'raises the supported pallet only 15 centimetres off the floor, then the forklift '
        'moves forward slowly one metre with the load low. The forks and pallet visibly '
        'support the weight for every frame, the boulder stays rigidly fixed to the pallet. '
        'A second adult worker wearing hard hat, high visibility vest and safety boots '
        'observes from behind a yellow pedestrian safety barrier several metres away. '
        'Stacks of pink salt boulders remain stationary in the background. All people '
        'remain clear of the load and forks. Natural quiet motor and warehouse sounds, '
        'no dialogue, no narration, no music, no titles or readable text.'),
    'cutting': STYLE + (
        'Medium wide three-quarter view of a modern industrial enclosed stone-cutting '
        'machine. A pink salt block about 40 centimetres across is rigidly secured by '
        'two visible metal clamps to a motorized steel cutting bed inside the machine. '
        'A closed transparent safety enclosure separates the machine from the operator. '
        'A guarded circular stone saw mounted on a rigid mechanical gantry slowly '
        'traverses a straight cut through the stationary clamped block, with extraction '
        'keeping airborne dust minimal. One adult operator in safety glasses and hearing '
        'protection stands well outside the closed enclosure with hands on an external '
        'control console, watching the machine. The block remains clamped and completely '
        'stationary throughout; the machine performs the cut. Emphasize the transparent '
        'closed barrier, mechanical blade guard and secured workpiece. Natural quiet '
        'machine sound, no dialogue, no narration, no music, no titles or readable text.'),
}
NEGATIVE = ('manual lifting, person carrying boulder, person touching load, floating rock, '
            'unsupported load, moving straps, morphing objects, changing machinery, '
            'hands near blade, unguarded blade, holding rock by hand, clouds of dust, '
            'extra limbs, distorted hands, cartoon, captions, logos, jump cuts')

WAREHOUSE_RETRY = STYLE + (
    'A locked-off wide side view. A large heavy-duty industrial forklift is PARKED '
    'motionless on a flat concrete floor in a salt warehouse. Its wheels remain '
    'completely stationary for the entire eight-second shot. Its mast is vertical. '
    'The two steel forks are fully inserted under a low strong steel pallet with '
    'one massive rough pink salt boulder firmly held by two tight black cargo straps. '
    'At the start the pallet rests flat on the concrete. The seated adult operator '
    'wearing a hard hat and high visibility vest uses the hydraulic control to '
    'raise the pallet VERY SLIGHTLY, just ten centimetres above the concrete floor, '
    'then holds it steady for the remainder of the shot. The pallet stays below '
    'the centres of the forklift wheels at all times. The boulder stays rigid and '
    'strapped to its pallet, supported continuously by the forks. No driving, '
    'no travel, no steering, no high lifting, no camera movement. No pedestrians '
    'and no other people anywhere in the shot. The only movement is the tiny '
    'initial hydraulic lift. Background stacks of pink salt on pallets are '
    'stationary. Warm amber warehouse light. No text, logos, dialogue or music.')


def save(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(path)


def request(url, key, body=None):
    headers = {'x-goog-api-key': key}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers=headers)
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def main():
    CACHE.mkdir(exist_ok=True)
    if sys.argv[1] == 'energize':
        # Natural-speed picture; preserve every narration word with pitch-preserving
        # audio tempo adjustment. No new provider requests and no repeated shots.
        inputs = [CACHE / 'original.mp4', CACHE / 'warehouse-2.mp4', CACHE / 'cutting-1.mp4']
        # Input index, in-frame, out-frame. All cuts are on the 24fps grid.
        cuts = [(0, 0, 384), (1, 12, 60), (0, 582, 918), (2, 12, 150),
                (0, 1110, 1266), (0, 1272, 1344), (0, 1347, 1422), (0, 1428, 1530)]
        duration = sum(end - start for _, start, end in cuts) / 24
        filters = []
        for i, (source, start, end) in enumerate(cuts):
            filters.append(f'[{source}:v]fps=24,trim=start_frame={start}:end_frame={end},'
                           f'setpts=PTS-STARTPTS,setsar=1[v{i}]')
        filters.append(''.join(f'[v{i}]' for i in range(len(cuts))) +
                       f'concat=n={len(cuts)}:v=1:a=0[v]')
        filters.append(f'[0:a]atempo={64.021 / duration:.9f},apad,atrim=duration={duration},'
                       f'afade=t=out:st={duration - 0.12}:d=0.12[a]')
        command = ['ffmpeg', '-y', '-v', 'error']
        for source in inputs:
            command += ['-i', str(source)]
        output = CACHE / 'energetic.mp4'
        subprocess.run(command + ['-filter_complex', ';'.join(filters), '-map', '[v]',
                       '-map', '[a]', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow',
                       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                       '-movflags', '+faststart', str(output)], check=True)
        save(CACHE / 'energetic-edit.json', {'cuts': cuts, 'duration': duration,
             'audio_tempo': 64.021 / duration, 'all_narration_retained': True,
             'video_speed': 1, 'generation_requests': 0,
             'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
        print(f'Assembled energetic review cut: {duration:.3f} seconds')
        return
    if sys.argv[1] == 'assemble':
        # Only call after reviewing both chosen clips. Never publish automatically.
        original = CACHE / 'original.mp4'
        warehouse, cutting = [CACHE / name for name in sys.argv[2:4]]
        output = CACHE / 'repaired.mp4'
        filters = (
            '[0:v]fps=24,split=3[o0][o1][o2];'
            '[o0]trim=start_frame=0:end_frame=384,setpts=PTS-STARTPTS[a];'
            '[1:v]fps=24,scale=1280:720,setsar=1,trim=end_frame=192,setpts=PTS-STARTPTS[b];'
            '[o1]trim=start_frame=576:end_frame=924,setpts=PTS-STARTPTS[c];'
            '[2:v]fps=24,scale=1280:720,setsar=1,trim=end_frame=180,setpts=PTS-STARTPTS[d];'
            '[o2]trim=start_frame=1104:end_frame=1536,setpts=PTS-STARTPTS[e];'
            '[a][b][c][d][e]concat=n=5:v=1:a=0[v]'
        )
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(original),
                        '-i', str(warehouse), '-i', str(cutting),
                        '-filter_complex', filters, '-map', '[v]', '-map', '0:a:0',
                        '-c:v', 'libx264', '-crf', '23', '-preset', 'slow',
                        '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart',
                        str(output)], check=True)
        def sha(path):
            return hashlib.sha256(path.read_bytes()).hexdigest()
        save(CACHE / 'assembly.json', {
            'original_sha256': sha(original), 'repaired_sha256': sha(output),
            'warehouse_clip': warehouse.name, 'cutting_clip': cutting.name,
            'replaced_seconds': [[16, 24], [38.5, 46]],
            'video_frames': 1536, 'fps': 24, 'audio': 'original stream copied without re-encoding',
            'filter': filters,
        })
        print('Assembled review copy; public film has not been overwritten')
        return
    key = subprocess.run(['security', 'find-generic-password', '-w', '-s', 'gemini_api_key'],
                         capture_output=True, text=True, check=True).stdout.strip()
    ledger = CACHE / 'operations.json'
    operations = json.loads(ledger.read_text()) if ledger.exists() else []
    if sys.argv[1] == 'submit':
        scene = sys.argv[2]
        attempts = sum(op['scene'] == scene for op in operations)
        if attempts >= 2:
            raise SystemExit('Approved attempt limit reached')
        prompt = WAREHOUSE_RETRY if scene == 'warehouse' and attempts else PROMPTS[scene]
        body = {'instances': [{'prompt': prompt}], 'parameters': {
            'aspectRatio': '16:9', 'resolution': '720p', 'durationSeconds': 8,
            'negativePrompt': NEGATIVE, 'sampleCount': 1}}
        record = {'scene': scene, 'attempt': attempts + 1, 'state': 'submitting', 'request': body}
        operations.append(record)
        save(ledger, operations)  # Reserve attempt before network call; no blind retries.
        response = request(f'{BASE}/models/{MODEL}:predictLongRunning', key, body)
        record.update(operation=response['name'], state='pending')
        save(ledger, operations)
        print(scene + ': submitted attempt ' + str(attempts + 1))
    elif sys.argv[1] == 'poll':
        for record in operations:
            if record['state'] != 'pending':
                print(record['scene'] + ': ' + record['state'])
                continue
            response = request(BASE + '/' + record['operation'], key)
            if not response.get('done'):
                print(record['scene'] + ': rendering')
                continue
            result = response.get('response', {}).get('generateVideoResponse', {})
            samples = result.get('generatedSamples', [])
            if not samples:
                record['state'] = 'failed'
                record['reason'] = response.get('error', result)
                save(ledger, operations)
                print(record['scene'] + ': failed; inspect local ledger')
                continue
            uri = samples[0]['video']['uri']
            parsed = urllib.parse.urlparse(uri)
            if parsed.scheme != 'https' or parsed.hostname != 'generativelanguage.googleapis.com':
                raise SystemExit('Unexpected download host; refusing credential forwarding')
            out = CACHE / (record['scene'] + '-' + str(record['attempt']) + '.mp4')
            req = urllib.request.Request(uri, headers={'x-goog-api-key': key})
            with urllib.request.urlopen(req, timeout=45) as response:
                out.write_bytes(response.read())
            record.update(state='downloaded', file=out.name)
            save(ledger, operations)
            print(record['scene'] + ': downloaded')


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        print('Provider returned HTTP ' + str(error.code) + '; no automatic resubmission', file=sys.stderr)
        sys.exit(1)
