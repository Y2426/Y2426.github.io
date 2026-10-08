"""Bounded YouTube discovery, H.264/AAC conversion and word-level ASR.
Called by worker.mjs; writes results to files, never emits credentials.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess


def run(args):
    subprocess.run(args, check=True, timeout=1800, stdout=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['scan', 'prepare'])
    parser.add_argument('url')
    parser.add_argument('output')
    parser.add_argument('--limit', type=int, default=15)
    parser.add_argument('--min-duration', type=float, default=20)
    parser.add_argument('--max-duration', type=float, default=600)
    args = parser.parse_args()
    import yt_dlp
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    base = {'quiet': True, 'no_warnings': True, 'noprogress': True, 'socket_timeout': 30,
            'retries': 3, 'noplaylist': args.mode != 'scan',
            'file_access_retries': 10, 'retry_sleep_functions': {'file_access': lambda n: min(n, 5)},
            'js_runtimes': {'node': {'path': 'node'}}}
    if args.mode == 'scan':
        with yt_dlp.YoutubeDL({**base, 'extract_flat': 'in_playlist',
                              'playlistend': args.limit, 'skip_download': True}) as dl:
            info = dl.extract_info(args.url, download=False)
        entries = info.get('entries') or [info]
        result = [{'id': x.get('id'), 'title': x.get('title'), 'duration': x.get('duration')}
                  for x in entries if x and x.get('id')]
        (output / 'scan.json').write_text(json.dumps(result), encoding='utf-8')
        return
    with yt_dlp.YoutubeDL(base) as dl:
        info = dl.extract_info(args.url, download=False)
    duration = info.get('duration') or 0
    if info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming', 'post_live'):
        raise ValueError('直播或尚未完成的视频不导入')
    if not args.min_duration <= duration <= args.max_duration:
        raise ValueError('视频时长不在采集范围内')
    # Only these fields leave the downloader: signed URLs/cookies are never saved.
    meta = {key: info.get(key) for key in ['id', 'title', 'duration', 'channel', 'upload_date', 'webpage_url']}
    with yt_dlp.YoutubeDL({**base, 'format': 'bv*[height<=720]+ba/b[height<=720]',
                          'merge_output_format': 'mp4', 'max_filesize': 200 * 1024 * 1024,
                          'continuedl': False,
                          'outtmpl': str(output / 'source.%(ext)s')}) as dl:
        dl.download([args.url])
    sources = [p for p in output.glob('source.*') if p.suffix in ('.mp4', '.mkv', '.webm', '.mov')]
    if len(sources) != 1:
        raise ValueError('未找到唯一的视频下载结果')
    # Reserve headroom below the existing private bucket's 50 MiB limit.
    kbps = min(1400, int(46 * 1024 * 1024 * 8 / duration / 1000) - 96)
    if kbps < 250:
        raise ValueError('视频过长，无法在存储限制内保证画质')
    video = output / 'lesson.mp4'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(sources[0]),
         '-map', '0:v:0', '-map', '0:a:0', '-vf', 'scale=-2:480',
         '-c:v', 'libx264', '-preset', 'fast', '-b:v', f'{kbps}k',
         '-maxrate', f'{kbps}k', '-bufsize', f'{kbps * 2}k', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', str(video)])
    if video.stat().st_size > 50 * 1024 * 1024:
        raise ValueError('转码结果超过 50 MiB，不上传')
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                            '-of', 'json', str(video)], capture_output=True, text=True, check=True, timeout=60)
    meta['duration'] = float(json.loads(probe.stdout)['format']['duration'])
    from faster_whisper import WhisperModel
    model = WhisperModel(os.getenv('WHISPER_MODEL', 'small'), device='cpu', compute_type='int8')
    segments, detected = model.transcribe(str(video), word_timestamps=True, vad_filter=True,
                                          beam_size=5, condition_on_previous_text=False)
    words = []
    for segment in segments:
        for word in segment.words or []:
            if word.word.strip():
                words.append({'start': word.start, 'end': word.end, 'text': word.word.strip(),
                              'probability': word.probability})
    if detected.language != 'en' or not words:
        raise ValueError('当前管线仅接受可识别的英语音轨')
    (output / 'transcript.json').write_text(json.dumps({'metadata': meta, 'words': words}), encoding='utf-8')


if __name__ == '__main__':
    main()
