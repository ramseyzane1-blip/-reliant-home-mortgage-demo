"""Encode the chosen knock clips for the site (H.264 MP4 with fast start, plus VP9 WebM; no audio, a keyframe every second so
seeking is quick), at the sizes the walk picks from (KNOCK in js/engines.js).

Usage: python3 tools/knock_encode.py wide.mp4 tall.mp4
"""
import os, subprocess, sys
import imageio_ffmpeg as ff

OUT = os.path.join(os.path.dirname(__file__), '..', 'demo', 'site', 'images', 'knock')
SIZES = {'wide': [('knock-1920.mp4', '1920:1080', 22), ('knock-1280.mp4', '1280:720', 22)],
         'tall': [('knock-tall-1080.mp4', '1080:1920', 23), ('knock-tall-720.mp4', '720:1280', 23)]}

def main(wide, tall):
    os.makedirs(OUT, exist_ok=True)
    for src, key in ((wide, 'wide'), (tall, 'tall')):
        for name, size, crf in SIZES[key]:
            f = os.path.join(OUT, name)
            subprocess.run([ff.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', src, '-vf', f'scale={size}:flags=lanczos', '-c:v', 'libx264',
                            '-preset', 'veryslow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '24',
                            '-movflags', '+faststart', '-an', f], check=True)
            print(name, f'{os.path.getsize(f) / 1e6:.2f} MB')
            # VP9 WebM, for browsers without H.264 (and headless Chromium in the tests)
            w = f[:-4] + '.webm'
            subprocess.run([ff.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', src, '-vf', f'scale={size}:flags=lanczos', '-c:v', 'libvpx-vp9',
                            '-crf', str(crf + 5), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', '24',
                            '-pix_fmt', 'yuv420p', '-an', w], check=True)
            print(os.path.basename(w), f'{os.path.getsize(w) / 1e6:.2f} MB')

if __name__ == '__main__':
    main(*sys.argv[1:3])
