// 在瀏覽器裡把動畫匯出成 MP4（H.264 + AAC），不經過伺服器。
// 畫面逐格畫在 canvas 上交給 WebCodecs 編碼；配樂整段算好後編碼；mp4-muxer 封裝（moov 放檔頭，手機與 LINE 可直接播）。
import { ArrayBufferTarget, Muxer } from '../vendor/mp4-muxer.mjs';

export const canExportMp4 = () => 'VideoEncoder' in window && 'VideoFrame' in window;

async function pickVideoConfig(width, height, fps) {
  const level = width * height > 1280 * 720 ? '28' : '1f';
  for (const profile of ['6400', '4d00', '4200']) {
    const config = { codec: `avc1.${profile}${level}`, width, height, bitrate: width >= 1920 ? 8_000_000 : 4_500_000, framerate: fps, avc: { format: 'avc' } };
    const res = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (res?.supported) return config;
  }
  throw new Error('這個瀏覽器不支援 H.264 編碼，請改用最新版 Chrome 或 Edge');
}

async function pickAudioConfig() {
  if (!('AudioEncoder' in window)) return null;
  for (const [codec, name] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const config = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 160_000 };
    const res = await AudioEncoder.isConfigSupported(config).catch(() => null);
    if (res?.supported) return { config, codec: name };
  }
  return null;
}

const checkAbort = (signal) => { if (signal?.aborted) throw new DOMException('已取消匯出', 'AbortError'); };

/**
 * @param {{ draw:(t:number)=>void, source:HTMLCanvasElement, frames:number, fps:number, score?:()=>Promise<{left:Float32Array,right:Float32Array}>,
 *           width:number, height:number, signal?:AbortSignal, onProgress?:(pct:number,label:string)=>void }} o
 */
export async function exportMp4(o) {
  const { draw, source, frames, fps, score, width, height, signal, onProgress } = o;
  const videoConfig = await pickVideoConfig(width, height, fps);
  const audio = score ? await pickAudioConfig() : null;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width, height, frameRate: fps },
    ...(audio ? { audio: { codec: audio.codec, sampleRate: 48000, numberOfChannels: 2 } } : {}),
  });
  let failure = null;
  const fail = (e) => { failure = e instanceof Error ? e : new Error(String(e)); };

  if (audio) {
    onProgress?.(2, '合成配樂…');
    const s = await score();
    checkAbort(signal);
    const enc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: fail });
    enc.configure(audio.config);
    for (let i = 0; i < s.left.length; i += 48000) {
      const n = Math.min(48000, s.left.length - i), planar = new Float32Array(n * 2);
      planar.set(s.left.subarray(i, i + n), 0); planar.set(s.right.subarray(i, i + n), n);
      const data = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / 48000) * 1e6), data: planar });
      enc.encode(data); data.close();
    }
    await enc.flush(); enc.close();
  }
  if (failure) throw failure;

  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: fail });
  enc.configure(videoConfig);
  const scaled = width !== source.width || height !== source.height;
  const stage = scaled ? new OffscreenCanvas(width, height) : null;
  const g = stage?.getContext('2d');
  const fd = 1e6 / fps;
  for (let i = 0; i < frames; i++) {
    checkAbort(signal);
    if (failure) throw failure;
    draw(i / fps);
    if (g) g.drawImage(source, 0, 0, width, height);
    const frame = new VideoFrame(stage ?? source, { timestamp: Math.round(i * fd), duration: Math.round(fd) });
    enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
    if (i % 6 === 0) { onProgress?.(5 + Math.round((i / frames) * 93), `繪製畫面 ${i} / ${frames}`); await new Promise((r) => setTimeout(r, 0)); }
  }
  onProgress?.(99, '封裝影片…');
  await enc.flush(); enc.close();
  if (failure) throw failure;
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), audio: audio?.codec ?? 'none' };
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
