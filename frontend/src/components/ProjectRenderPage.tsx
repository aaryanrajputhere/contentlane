import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Play, RefreshCw, Volume2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { selectMatchedClips } from '../lib/clipMatching';
import { creatorToCharacter } from '../lib/creatorLibrary';
import type { ConceptCard, CreatorClipRecord, CreatorRecord, MediaAsset, ProjectSnapshot } from '../types/domain';

const pageShellClass = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const panelClass = 'rounded-[32px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]';
const blackButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const whiteButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-[#fcfcfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

type RenderStatus = 'pending' | 'rendering' | 'done' | 'failed';

interface RenderItem {
  concept: ConceptCard;
  clip: CreatorClipRecord;
}

interface RenderResult {
  status: RenderStatus;
  url: string | null;
  error: string | null;
}

function isBrandDemoAsset(asset: MediaAsset) {
  return asset.conceptId === null
    && asset.type === 'VIDEO'
    && typeof asset.metadata === 'object'
    && asset.metadata !== null
    && asset.metadata.kind === 'brand-demo';
}

function pickRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawVideoCover(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFrame(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement, overlayText: string) {
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#050505';
  context.fillRect(0, 0, width, height);
  drawVideoCover(context, video, width, height);

  const gradient = context.createLinearGradient(0, 0, 0, height * 0.42);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.font = '700 42px ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(0, 0, 0, 0.92)';
  context.lineWidth = 8;
  context.fillStyle = '#ffffff';
  wrapText(context, overlayText, width - 104).forEach((line, index) => {
    const y = Math.max(92, height * 0.13) + index * 50;
    context.strokeText(line, width / 2, y);
    context.fillText(line, width / 2, y);
  });
}

function drawPlaceholder(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, message: string) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111111';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = '700 34px ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
}

async function loadVideo(url: string) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
    };
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Unable to load a source video. Check its Cloudinary access settings.'));
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('error', handleError);
    video.src = url;
    video.load();
  });
  return video;
}

async function renderSegment(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  overlayText: string,
  signal: AbortSignal,
) {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
  video.currentTime = 0;
  await video.play();
  await new Promise<void>((resolve, reject) => {
    let frameId = 0;
    const startedAt = performance.now();
    const finish = () => {
      cancelAnimationFrame(frameId);
      video.pause();
      resolve();
    };
    const step = () => {
      if (signal.aborted) {
        finish();
        return;
      }
      try {
        drawFrame(context, canvas, video, overlayText);
      } catch (error) {
        cancelAnimationFrame(frameId);
        video.pause();
        reject(error instanceof Error ? error : new Error('Unable to draw a video frame'));
        return;
      }
      if ((performance.now() - startedAt) / 1000 >= duration || video.ended) {
        finish();
      } else {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
  });
}

async function recordReel(options: {
  canvas: HTMLCanvasElement;
  item: RenderItem;
  demo: MediaAsset;
  mimeType: string;
  signal: AbortSignal;
  onMessage: (message: string) => void;
}) {
  const { canvas, item, demo, mimeType, signal, onMessage } = options;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is not available in this browser.');

  onMessage('Loading source clips');
  const [hookVideo, demoVideo] = await Promise.all([loadVideo(item.clip.url), loadVideo(demo.url)]);
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not available in this browser.');
  const audioContext = new AudioContextConstructor();
  const destination = audioContext.createMediaStreamDestination();
  const hookSource = audioContext.createMediaElementSource(hookVideo);
  const demoSource = audioContext.createMediaElementSource(demoVideo);
  hookSource.connect(destination);
  demoSource.connect(destination);

  const canvasStream = canvas.captureStream(30);
  destination.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.addEventListener('error', () => reject(new Error('The browser stopped recording unexpectedly.')), { once: true });
  });

  try {
    await audioContext.resume();
    if (audioContext.state !== 'running') {
      throw new DOMException('Audio playback requires a user gesture.', 'NotAllowedError');
    }
    recorder.start(1000);
    onMessage('Rendering creator hook');
    await renderSegment(canvas, context, hookVideo, item.concept.hookText, signal);
    if (!signal.aborted) {
      onMessage('Rendering product demo');
      await renderSegment(canvas, context, demoVideo, item.concept.demoOverlayText, signal);
    }
    recorder.stop();
    await stopped;
    if (signal.aborted) throw new DOMException('Render cancelled', 'AbortError');
    return new Blob(chunks, { type: mimeType });
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    hookVideo.pause();
    demoVideo.pause();
    hookVideo.removeAttribute('src');
    demoVideo.removeAttribute('src');
    hookVideo.load();
    demoVideo.load();
    canvasStream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
  }
}

function emptyResults(count: number): RenderResult[] {
  return Array.from({ length: count }, () => ({ status: 'pending', url: null, error: null }));
}

function parseRequestedReelCount(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 3 && parsed <= 8 ? parsed : 3;
}

export default function ProjectRenderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReelCount = parseRequestedReelCount(searchParams.get('count'));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoRenderAttemptedRef = useRef(false);
  const resultUrlsRef = useRef<string[]>([]);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [renderMessage, setRenderMessage] = useState(`Preparing ${requestedReelCount} Reels`);
  const [rendering, setRendering] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [results, setResults] = useState<RenderResult[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ project: ProjectSnapshot }>(`/projects/${id}`),
      api<{ creators: CreatorRecord[] }>('/creators'),
    ])
      .then(([projectResponse, creatorResponse]) => {
        if (!active) return;
        setProject(projectResponse.project);
        setCreatorLibrary(creatorResponse.creators.map((creator) => ({
          ...creator,
          character: creatorToCharacter(creator),
        })));
      })
      .catch((caught) => {
        if (active) setPageError(caught instanceof Error ? caught.message : 'Unable to load render data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => () => {
    abortRef.current?.abort();
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const creator = creatorLibrary.find((candidate) => candidate.id === project?.selectedCharacterId)
    ?? creatorLibrary[0]
    ?? null;
  const concepts = useMemo(
    () => project?.concepts.slice(0, requestedReelCount) ?? [],
    [project?.concepts, requestedReelCount],
  );
  const matchedClips = useMemo(
    () => selectMatchedClips(concepts, creator?.clips ?? []),
    [concepts, creator?.clips],
  );
  const renderItems = useMemo(
    () => concepts.flatMap((concept, index) => {
      const clip = matchedClips[index];
      return clip ? [{ concept, clip }] : [];
    }),
    [concepts, matchedClips],
  );
  const demo = project?.mediaAssets.find(isBrandDemoAsset) ?? null;

  async function renderIndexes(indexes: number[], userInitiated: boolean) {
    const canvas = canvasRef.current;
    const mimeType = pickRecordingMimeType();
    if (!canvas || !demo || renderItems.length !== concepts.length || concepts.length === 0) {
      setPageError(`${requestedReelCount} hooks, creator clips, and an uploaded product demo are required before rendering.`);
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      setPageError('Canvas rendering is not available in this browser.');
      return;
    }
    if (!mimeType || typeof canvas.captureStream !== 'function') {
      setPageError('This browser cannot record WebM video. Try the latest Chrome or Edge.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRendering(true);
    setNeedsInteraction(false);
    setPageError('');

    if (results.length !== renderItems.length) {
      setResults(emptyResults(renderItems.length));
    }

    for (const index of indexes) {
      if (controller.signal.aborted) break;
      const item = renderItems[index];
      if (!item) continue;
      setResults((current) => {
        const next = current.length === renderItems.length ? [...current] : emptyResults(renderItems.length);
        if (next[index]?.url) URL.revokeObjectURL(next[index].url);
        next[index] = { status: 'rendering', url: null, error: null };
        return next;
      });
      setRenderMessage(`Rendering Reel ${index + 1} of ${renderItems.length}`);
      drawPlaceholder(context, canvas, `Rendering Reel ${index + 1}`);
      try {
        const blob = await recordReel({
          canvas,
          item,
          demo,
          mimeType,
          signal: controller.signal,
          onMessage: (message) => setRenderMessage(`Reel ${index + 1}: ${message}`),
        });
        const url = URL.createObjectURL(blob);
        resultUrlsRef.current.push(url);
        setResults((current) => {
          const next = [...current];
          next[index] = { status: 'done', url, error: null };
          return next;
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') break;
        const interactionBlocked = caught instanceof DOMException && caught.name === 'NotAllowedError';
        if (interactionBlocked && !userInitiated) {
          setNeedsInteraction(true);
          setResults(emptyResults(renderItems.length));
          setRenderMessage('Ready to render with audio');
          break;
        }
        const message = caught instanceof Error ? caught.message : 'Unable to render this Reel';
        setResults((current) => {
          const next = [...current];
          next[index] = { status: 'failed', url: null, error: message };
          return next;
        });
      }
    }

    setRendering(false);
    if (!controller.signal.aborted) {
      setRenderMessage((current) => current === 'Ready to render with audio' ? current : 'Render queue complete');
    }
  }

  useEffect(() => {
    if (
      loading
      || !demo
      || renderItems.length !== concepts.length
      || concepts.length === 0
      || autoRenderAttemptedRef.current
    ) return;
    autoRenderAttemptedRef.current = true;
    setResults(emptyResults(renderItems.length));
    void renderIndexes(renderItems.map((_, index) => index), false);
    // renderIndexes intentionally starts once after project data resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, demo, renderItems.length, concepts.length]);

  function downloadResult(index: number) {
    const result = results[index];
    if (!result?.url) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `${id}-reel-${index + 1}.webm`;
    link.click();
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#fafaf8] text-[#111111]">Loading render…</div>;
  }

  return (
    <main className="min-h-screen bg-[#fafaf8] pb-16 text-[#111111]">
      <header className="border-b border-black/6 bg-white/95 backdrop-blur-xl">
        <div className={`${pageShellClass} flex items-center justify-between gap-4 py-4`}>
          <div>
            <p className="text-[13px] uppercase tracking-[0.34em]">ContentLane</p>
            <p className="mt-2 text-sm text-[#666666]">{renderItems.length} hooks. One product demo. {renderItems.length} finished cuts.</p>
          </div>
          <button type="button" onClick={() => navigate(-1)} className={whiteButtonClass}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </header>

      <section className={`${pageShellClass} pt-12`}>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium shadow-sm">
            <Volume2 size={15} />
            Browser render with source audio
          </div>
          <h1 className="mx-auto mt-7 max-w-[15ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em]">
            Your {renderItems.length} Reels are taking shape.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[1.05rem] leading-7 text-[#666666]">
            Each matched creator hook flows into your complete product demo, with campaign text composed directly into the frame.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className={`${panelClass} h-fit p-5 lg:sticky lg:top-6 lg:p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Live canvas</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">Render monitor</h2>
              </div>
              {rendering ? <Loader2 className="animate-spin" size={20} /> : null}
            </div>
            <div className="mt-5 overflow-hidden rounded-[28px] bg-[#111111] p-4">
              <canvas ref={canvasRef} width={540} height={960} className="mx-auto aspect-[9/16] w-full max-w-[330px] rounded-[24px] bg-black" />
            </div>
            <p className="mt-4 text-sm font-medium">{renderMessage}</p>
            {needsInteraction ? (
              <button type="button" onClick={() => void renderIndexes(renderItems.map((_, index) => index), true)} className={`${blackButtonClass} mt-4 w-full`}>
                <Play size={16} />
                Start rendering with audio
              </button>
            ) : null}
            {pageError ? <p className="mt-4 text-sm leading-6 text-[#b42318]">{pageError}</p> : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {renderItems.map((item, index) => {
              const result = results[index] ?? { status: 'pending', url: null, error: null };
              return (
                <article key={item.concept.id} className={`${panelClass} overflow-hidden p-4`}>
                  <div className="flex items-center justify-between gap-3 px-1 py-1">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Reel {index + 1}</p>
                      <h2 className="mt-1 line-clamp-2 text-base font-bold leading-5">{item.concept.hookText}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f2f0eb] px-2.5 py-1 text-xs font-medium capitalize">
                      {result.status}
                    </span>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[24px] bg-[#111111]">
                    {result.url ? (
                      <video src={result.url} className="aspect-[9/16] w-full object-cover" controls playsInline />
                    ) : (
                      <video src={item.clip.url} className="aspect-[9/16] w-full object-cover opacity-70" muted loop autoPlay playsInline />
                    )}
                  </div>
                  {result.error ? <p className="mt-3 text-sm leading-5 text-[#b42318]">{result.error}</p> : null}
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => downloadResult(index)} disabled={!result.url} className={`${blackButtonClass} flex-1 px-3`}>
                      <Download size={15} />
                      Download
                    </button>
                    <button
                      type="button"
                      aria-label={`Render Reel ${index + 1} again`}
                      onClick={() => void renderIndexes([index], true)}
                      disabled={rendering}
                      className={whiteButtonClass}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
