"""Even out a clip's cadence. Some Seedance clips are made at 18 unique frames a second and padded
to 24 by repeating one frame in four (the phase drifts), which shows as a stutter on fast motion
such as the door swing. This drops the repeated frames, spaces the rest evenly through each stretch
of motion, and lets ffmpeg's motion interpolation make a steady 24fps again. First and last frames
are kept as they are (the walk hands over on them).

Usage: python3 tools/knock_cadence.py in.mp4 out.mp4      (reports the repeated frames it found)
"""
import os, subprocess, sys, tempfile
import numpy as np, imageio_ffmpeg as ff

FF = ff.get_ffmpeg_exe()

def frames(path):
    r = ff.read_frames(path); m = next(r); w, h = m['size']
    return [np.frombuffer(x, np.uint8).reshape(h, w, 3) for x in r], (w, h)

def repeats(F):
    s = [f[::2, ::2].astype(np.int16) for f in F]
    d = np.array([0.] + [np.abs(s[i] - s[i - 1]).mean() for i in range(1, len(s))])
    rep = [i for i in range(1, len(d) - 1) if d[i - 1] > .8 and d[i + 1] > .8 and d[i] < .35 * min(d[i - 1], d[i + 1])]
    return rep, d

def main(src, dst):
    F, (w, h) = frames(src); rep, d = repeats(F); print('repeated frames:', rep)
    keep = [i for i in range(len(F)) if i not in set(rep)]
    # time of each kept frame (in 24fps frame units): evenly spaced inside each stretch between two
    # frames that are not next to a repeat (those stay where they were)
    t = {i: float(i) for i in keep}; R = set(rep); k = 0
    while k < len(keep):
        j = k
        while j + 1 < len(keep) and any(x in R for x in range(keep[j] + 1, keep[j + 1])): j += 1
        if j > k:
            a, b = keep[k], keep[j]
            for n, i in enumerate(keep[k:j + 1]): t[i] = a + (b - a) * n / (j - k)
        k = j + 1
    tmp = tempfile.mkdtemp(prefix='cadence-')
    lst = open(os.path.join(tmp, 'list.txt'), 'w')
    for n, i in enumerate(keep):
        p = os.path.join(tmp, f'{n:04d}.png'); subprocess.run([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-i', '-', p], input=F[i].tobytes(), check=True)
        nxt = t[keep[n + 1]] if n + 1 < len(keep) else t[i] + 1
        lst.write(f"file '{p}'\nduration {(nxt - t[i]) / 24:.6f}\n")
    lst.write(f"file '{p}'\n"); lst.close()
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst.name,
                    '-vf', 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1', '-frames:v', str(len(F)),
                    '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', dst], check=True)
    G, _ = frames(dst); r2, _ = repeats(G)
    print('out', len(G), 'frames; repeated frames left:', r2)
    import shutil; shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
