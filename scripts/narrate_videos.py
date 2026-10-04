#!/usr/bin/env python3
"""Align recorded synthetic narration to the 56-second edited walkthroughs.

Run after rendering the current picture: python3 scripts/narrate_videos.py demo
or tech. Public local narration files and their hashes are the inputs; no API
call or credential is required. Speech is never cut off to fit a chapter.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'media'


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def stamp(seconds):
    return f'00:{seconds // 60:02d}:{seconds % 60:02d},000'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=['demo', 'tech'])
    args = parser.parse_args()
    manifest = json.loads((MEDIA / 'narration' / f'{args.kind}.json').read_text())
    assert sum(c['seconds'] for c in manifest['chapters']) == 56
    output = MEDIA / f'lawdiff-{args.kind}.mp4'
    pending = output.with_name(output.stem + '.narrating.mp4')
    inputs, filters, receipts, captions = [], [], [], []
    cursor = 0
    for i, chapter in enumerate(manifest['chapters'], 1):
        audio = MEDIA / 'narration' / chapter['file']
        assert audio.parent == MEDIA / 'narration'
        assert hashlib.sha256(audio.read_bytes()).hexdigest() == chapter['sha256']
        probe = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(audio)]))
        duration = float(probe['format']['duration'])
        speed = max(1, duration / (chapter['seconds'] - 0.65))
        if speed > 1.2:
            raise ValueError(f'Chapter {i} needs a new recording or timing; speech will not be truncated.')
        delay = round((cursor + 0.30) * 1000)
        inputs.extend(['-i', str(audio)])
        filters.append(f'[{i}:a]asetpts=PTS-STARTPTS,atempo={speed:.7f},adelay={delay}:all=1[a{i}]')
        receipts.append({'chapter': i, 'start_seconds': cursor + 0.30,
                         'source_seconds': duration, 'tempo': speed,
                         'file': chapter['file'], 'sha256': chapter['sha256']})
        captions.append(f'{i}\n{stamp(cursor)} --> {stamp(cursor + chapter["seconds"])}\n{chapter["text"]}\n')
        cursor += chapter['seconds']
    labels = ''.join(f'[a{i}]' for i in range(1, len(receipts) + 1))
    filters.append(labels + f'amix=inputs={len(receipts)}:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,apad=whole_dur=56,atrim=duration=56[voice]')
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(output), *inputs,
         '-filter_complex', ';'.join(filters), '-map', '0:v:0', '-map', '[voice]',
         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', '56',
         '-movflags', '+faststart', '-metadata', f'title=LawDiff — {args.kind} walkthrough',
         '-metadata', 'comment=Edited walkthrough with English captions and a synthetic preset narrator. No voice cloning or live-model-run claim.', str(pending)])
    final = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(pending)]))
    video = [s for s in final['streams'] if s['codec_type'] == 'video']
    audio = [s for s in final['streams'] if s['codec_type'] == 'audio']
    assert len(video) == len(audio) == 1 and audio[0]['codec_name'] == 'aac'
    assert (video[0]['width'], video[0]['height'], video[0]['codec_name']) == (1920, 1080, 'h264')
    assert abs(float(final['format']['duration']) - 56) < 0.05
    assert video[0]['nb_frames'] == '1680'
    pending.replace(output)
    final['format']['filename'] = str(output)
    final['narration'] = {'synthetic': True, 'preset_voice': manifest['voice'],
                          'provider': manifest['provider'], 'chapters': receipts,
                          'voice_cloning': False, 'speech_truncated': False}
    output.with_suffix('.probe.json').write_text(json.dumps(final, indent=2) + '\n')
    output.with_suffix('.srt').write_text('\n'.join(captions))
    print(json.dumps({'file': output.name, 'seconds': 56, 'audio': 'AAC', 'voice': 'synthetic preset',
                      'maximum_tempo_adjustment': max(r['tempo'] for r in receipts)}, indent=2))


if __name__ == '__main__':
    main()
