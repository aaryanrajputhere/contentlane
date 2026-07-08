import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { creatorToCharacter } from '../lib/creatorLibrary';
import type { CreatorRecord, MediaAsset, ProjectSnapshot } from '../types/domain';

const pageShellClass = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const panelClass = 'rounded-[32px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]';
const blackButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] disabled:cursor-not-allowed disabled:opacity-50';
const whiteButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-black/20 hover:bg-[#fcfcfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50';
function isBrandDemoAsset(asset: MediaAsset) {
  if (asset.conceptId !== null || asset.type !== 'VIDEO' || !asset.metadata || typeof asset.metadata !== 'object') {
    return false;
  }
  return (asset.metadata as Record<string, unknown>).kind === 'brand-demo';
}

function pickRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || currentLine.length === 0) {
      currentLine = nextLine;
      continue;
    }
    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawVideoCover(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
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

  const paddingX = 52;
  const maxTextWidth = width - paddingX * 2;
  const lines = wrapText(context, overlayText, maxTextWidth);
  const lineHeight = 50;
  const startY = Math.max(92, height * 0.13);

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
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
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Unable to load video: ${url}`));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('error', handleError);
    video.src = url;
    video.load();
  });

  return video;
}

async function renderSegment(options: {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  video: HTMLVideoElement;
  overlayText: string;
  signal: AbortSignal;
}) {
  const { canvas, context, video, overlayText, signal } = options;
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
        reject(error instanceof Error ? error : new Error('Unable to draw the video frame'));
        return;
      }

      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= duration || video.ended) {
        finish();
        return;
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
  });
}

export default function ProjectRenderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderAbortRef = useRef<AbortController | null>(null);
  const autoRenderAttemptedRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'done'>('idle');
  const [renderMessage, setRenderMessage] = useState('Preparing render');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    autoRenderAttemptedRef.current = false;

    void Promise.all([
      api<{ project: ProjectSnapshot }>(`/projects/${id}`),
      api<{ creators: CreatorRecord[] }>('/creators'),
    ])
      .then(([projectResponse, creatorResponse]) => {
        if (!active) return;
        setProject(projectResponse.project);
        setCreatorLibrary(creatorResponse.creators.map((creator) => ({ ...creator, character: creatorToCharacter(creator) })));
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load render data');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      renderAbortRef.current?.abort();
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  const exportSettings = project?.exportState?.settings ?? null;
  const selectedCreator = creatorLibrary.find((creator) => creator.id === (exportSettings?.selectedCharacterId ?? project?.selectedCharacterId ?? '')) ?? null;
  const selectedClip = selectedCreator?.clips.find((clip) => clip.id === exportSettings?.selectedCreatorClipId) ?? selectedCreator?.clips[0] ?? null;
  const brandDemoAsset = project?.mediaAssets.find(isBrandDemoAsset) ?? null;
  const selectedConcept = project?.concepts.find((concept) => concept.id === (exportSettings?.selectedConceptId ?? project?.selectedConceptId ?? '')) ?? null;
  const renderOverlayText = exportSettings?.overlayText ?? selectedConcept?.hookText ?? 'Selected hook preview';

  useEffect(() => {
    if (loading || !project || !selectedClip || !brandDemoAsset || renderStatus !== 'idle' || renderedVideoUrl || autoRenderAttemptedRef.current) {
      return;
    }
    autoRenderAttemptedRef.current = true;
    void startRender();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, project, selectedClip, brandDemoAsset, renderStatus, renderedVideoUrl]);

  async function startRender() {
    const canvas = canvasRef.current;
    if (!canvas || !selectedClip || !brandDemoAsset) {
      setError('Select a creator clip and upload a brand demo before rendering.');
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      setError('Canvas rendering is not available in this browser.');
      return;
    }

    const mimeType = pickRecordingMimeType();
    if (!mimeType || typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      setError('This browser cannot record the combined video.');
      return;
    }

    renderAbortRef.current?.abort();
    const abortController = new AbortController();
    renderAbortRef.current = abortController;

    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setRenderedVideoUrl(null);
    setRenderStatus('rendering');
    setError('');
    setRenderMessage('Loading creator clip');
    drawPlaceholder(context, canvas, 'Loading render');

    let creatorVideo: HTMLVideoElement | null = null;
    let brandDemoVideo: HTMLVideoElement | null = null;
    let recorder: MediaRecorder | null = null;
    let stopPromise: Promise<void> | null = null;

    try {
      creatorVideo = await loadVideo(selectedClip.url).catch((caught) => {
        throw caught instanceof Error ? caught : new Error('Unable to load the selected creator clip');
      });
      brandDemoVideo = await loadVideo(brandDemoAsset.url).catch((caught) => {
        throw caught instanceof Error ? caught : new Error('Unable to load the uploaded brand demo');
      });

      const chunks: Blob[] = [];
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType });
      stopPromise = new Promise<void>((resolve) => {
        recorder?.addEventListener('stop', () => resolve(), { once: true });
      });

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.start();
      setRenderMessage('Rendering creator clip');
      await renderSegment({ canvas, context, video: creatorVideo, overlayText: renderOverlayText, signal: abortController.signal });

      if (!abortController.signal.aborted) {
        setRenderMessage('Rendering brand demo');
        await renderSegment({ canvas, context, video: brandDemoVideo, overlayText: renderOverlayText, signal: abortController.signal });
      }

      recorder.stop();
      await stopPromise;

      if (abortController.signal.aborted) {
        setRenderStatus('idle');
        setRenderMessage('Render cancelled');
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      const nextUrl = URL.createObjectURL(blob);
      resultUrlRef.current = nextUrl;
      setRenderedVideoUrl(nextUrl);
      setRenderStatus('done');
      setRenderMessage('Render complete');
    } catch (caught) {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        if (stopPromise) {
          await stopPromise;
        }
      }
      setRenderStatus('idle');
      setRenderMessage('Render failed');
      setError(caught instanceof Error ? caught.message : 'Unable to render the combined video');
    } finally {
      creatorVideo?.pause();
      brandDemoVideo?.pause();
      creatorVideo?.removeAttribute('src');
      brandDemoVideo?.removeAttribute('src');
      creatorVideo?.load();
      brandDemoVideo?.load();
    }
  }

  function downloadRenderedVideo() {
    if (!renderedVideoUrl) return;
    const link = document.createElement('a');
    link.href = renderedVideoUrl;
    link.download = `${id}-combined-render.webm`;
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
            <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
            <p className="mt-2 text-sm text-[#666666]">Creator clip first, uploaded brand demo second.</p>
          </div>
          <button onClick={() => navigate(-1)} className={whiteButtonClass}>
            <ArrowLeft size={16} />
            Back to creator
          </button>
        </div>
      </header>

      <section className={`${pageShellClass} pt-12`}>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
            Browser render
          </div>
          <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
            Combined video render
          </h1>
          <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">This page records the selected creator clip and the uploaded brand demo into one browser-rendered video.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`${panelClass} p-5 lg:p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Render canvas</p>
                <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">Live composition</h2>
              </div>
              <div className="rounded-full bg-[#111111] px-3 py-1.5 text-sm font-medium text-white">{renderMessage}</div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] bg-[#111111] p-4">
              <canvas ref={canvasRef} width={540} height={960} className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-[24px] bg-black object-cover" />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void startRender()} disabled={!selectedClip || !brandDemoAsset || renderStatus === 'rendering'} className={blackButtonClass}>
                {renderStatus === 'rendering' ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={16} />}
                {renderStatus === 'rendering' ? 'Rendering' : 'Render again'}
              </button>
              <button type="button" onClick={downloadRenderedVideo} disabled={!renderedVideoUrl} className={whiteButtonClass}>
                <Download size={16} />
                Download video
              </button>
            </div>
            {error ? <p className="mt-4 text-sm text-[#b42318]">{error}</p> : null}
          </div>

          <div className="space-y-5">
            <div className={`${panelClass} p-5 lg:p-6`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Segment 1</p>
              <h2 className="mt-2 text-[1.2rem] font-bold tracking-[-0.03em] text-[#111111]">Creator clip</h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">{selectedClip?.title?.trim() || 'Selected creator clip'}</p>
              <div className="mt-4 overflow-hidden rounded-[24px] bg-[#111111]">
                {selectedClip ? <video src={selectedClip.url} className="aspect-[9/16] w-full object-cover" muted playsInline controls preload="metadata" /> : <div className="grid aspect-[9/16] place-items-center text-sm text-white/70">Missing creator clip</div>}
              </div>
              <p className="mt-4 rounded-[20px] bg-[#f6f3ee] px-4 py-3 text-sm font-medium text-[#111111]">{renderOverlayText}</p>
            </div>

            <div className={`${panelClass} p-5 lg:p-6`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Segment 2</p>
              <h2 className="mt-2 text-[1.2rem] font-bold tracking-[-0.03em] text-[#111111]">Brand demo</h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">Uploaded brand demo video from the earlier step.</p>
              <div className="mt-4 overflow-hidden rounded-[24px] bg-[#111111]">
                {brandDemoAsset ? <video src={brandDemoAsset.url} className="aspect-[9/16] w-full object-cover" muted playsInline controls preload="metadata" /> : <div className="grid aspect-[9/16] place-items-center text-sm text-white/70">Missing brand demo</div>}
              </div>
              <p className="mt-4 rounded-[20px] bg-[#f6f3ee] px-4 py-3 text-sm font-medium text-[#111111]">{renderOverlayText}</p>
            </div>

            <div className={`${panelClass} p-5 lg:p-6`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Output</p>
              <h2 className="mt-2 text-[1.2rem] font-bold tracking-[-0.03em] text-[#111111]">Rendered preview</h2>
              {renderedVideoUrl ? (
                <video src={renderedVideoUrl} className="mt-4 aspect-[9/16] w-full overflow-hidden rounded-[24px] bg-black object-cover" controls playsInline />
              ) : (
                <div className="mt-4 grid aspect-[9/16] place-items-center rounded-[24px] border border-dashed border-black/10 bg-[#fcfcfb] text-sm text-[#666666]">
                  The combined render will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
