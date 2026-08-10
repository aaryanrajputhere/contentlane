import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const coreURL = '/ffmpeg/ffmpeg-core.js';
const wasmURL = '/ffmpeg/ffmpeg-core.wasm';

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
const transcodeTimeoutMs = 60_000;

async function getFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  if (!loading) {
    const instance = new FFmpeg();
    loading = instance.load({ coreURL, wasmURL }).then(() => {
      ffmpeg = instance;
      loading = null;
      return instance;
    }).catch((error) => {
      loading = null;
      instance.terminate();
      throw error;
    });
  }
  return loading;
}

export async function transcodeWebmToMp4(
  source: Blob,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const instance = await getFFmpeg();
  const inputName = `contentlane-input-${Date.now()}.webm`;
  const outputName = `${inputName}.mp4`;
  const progressHandler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)));
  instance.on('progress', progressHandler);

  try {
    if (signal.aborted) throw new DOMException('Render cancelled', 'AbortError');
    await instance.writeFile(inputName, await fetchFile(source), { signal });
    const exitCode = await instance.exec([
      '-i', inputName,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputName,
    ], transcodeTimeoutMs, { signal });
    if (exitCode !== 0) throw new Error('FFmpeg could not create an MP4 file.');
    const output = await instance.readFile(outputName, 'binary', { signal });
    if (typeof output === 'string') throw new Error('FFmpeg returned an invalid MP4 file.');
    return new Blob([output], { type: 'video/mp4' });
  } catch (error) {
    if (signal.aborted) terminateMp4Transcoder();
    throw error;
  } finally {
    instance.off('progress', progressHandler);
    await Promise.allSettled([
      instance.deleteFile(inputName),
      instance.deleteFile(outputName),
    ]);
  }
}

export function terminateMp4Transcoder() {
  loading = null;
  ffmpeg?.terminate();
  ffmpeg = null;
}
