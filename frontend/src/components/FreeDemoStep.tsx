import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Pause, Play, RefreshCw, Upload } from 'lucide-react';
import { UserButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import { brandDemos } from '../lib/brandDemos';
import type { GenerationJob, ProjectSnapshot } from '../types/domain';

// Add curated examples here with a video URL, thumbnail, and recording takeaway.
const demoExamples = [
  {
    src: 'https://res.cloudinary.com/duwcbwqe5/video/upload/v1789404402/contentlane/demo-examples/brand-demo2-20260914.mp4',
    poster: 'https://res.cloudinary.com/duwcbwqe5/video/upload/so_0/v1789404402/contentlane/demo-examples/brand-demo2-20260914.jpg',
    title: 'Product demo',
    description: 'A close-up walkthrough that keeps the app and its main action in focus.',
  },
  {
    src: 'https://res.cloudinary.com/duwcbwqe5/video/upload/v1789404755/contentlane/demo-examples/brand-demo1-20260914.webm',
    poster: 'https://res.cloudinary.com/duwcbwqe5/video/upload/so_0/v1789404755/contentlane/demo-examples/brand-demo1-20260914.jpg',
    title: 'Product demo · another approach',
    description: 'Another product demo to inspire your recording.',
  },
  {
    src: '/assets/landing/demo1.mp4',
    poster: '/assets/landing/demo1.jpg',
    title: 'Cal AI · creator-led Reel',
    description: 'See how a creator introduces the product in a finished Reel.',
  },

];

function DemoExampleStack() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % demoExamples.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, reducedMotion]);

  useEffect(() => {
    const currentVideos = videos.current;
    currentVideos.forEach((video, index) => {
      if (!video) return;
      if (index !== active || reducedMotion) {
        video.pause();
        return;
      }
      video.muted = true;
      void video.play().catch(() => {
        // Native controls remain available when the browser blocks autoplay.
      });
    });
    return () => currentVideos.forEach((video) => video?.pause());
  }, [active, reducedMotion]);

  function showExample(index: number) {
    videos.current.forEach((video) => video?.pause());
    setActive((index + demoExamples.length) % demoExamples.length);
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Product demo and Reel examples"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="min-w-0"
    >
      <div className="relative mx-auto mt-4 aspect-[9/16] w-[calc(100%-1.5rem)] max-w-[280px]">
        {demoExamples.map((example, index) => {
          const position = (index - active + demoExamples.length) % demoExamples.length;
          const isActive = position === 0;
          return (
            <article
              key={example.src}
              aria-hidden={!isActive}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${demoExamples.length}: ${example.title}`}
              className={`absolute inset-0 overflow-hidden rounded-[24px] border border-black/10 bg-white p-1.5 shadow-[0_12px_36px_rgba(20,30,10,.09)] transition-[transform,opacity] duration-700 ease-in-out motion-reduce:transition-none ${isActive ? '' : 'pointer-events-none'}`}
              style={{
                zIndex: demoExamples.length - position,
                transform: position === 0 ? 'translateY(0) rotate(0deg)' : `translateY(${position * 9}px) rotate(${position === 1 ? -3 : 3}deg) scale(${1 - position * 0.025})`,
              }}
            >
              <video
                ref={(element) => { videos.current[index] = element; }}
                src={example.src}
                poster={example.poster}
                controls={isActive}
                tabIndex={isActive ? 0 : -1}
                playsInline
                muted
                loop
                preload={isActive ? 'metadata' : 'none'}
                aria-label={example.title}
                className="h-full w-full rounded-[18px] bg-black object-cover"
              />
              <div className="pointer-events-none absolute inset-x-1.5 top-1.5 rounded-t-[18px] bg-gradient-to-b from-black/75 to-transparent px-5 pb-12 pt-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/80">{index < 2 ? 'Product demo example' : 'Finished Reel example'}</p>
                <h3 className="mt-1.5 text-lg font-bold tracking-[-.03em]">{example.title}</h3>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-9 flex items-center justify-center gap-4">
        <button type="button" onClick={() => showExample(active - 1)} aria-label="Previous example" className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white hover:bg-[#eaf0e4] focus-visible:outline-2 focus-visible:outline-[#15803d]"><ArrowLeft size={17}/></button>
        <button type="button" onClick={() => showExample(active + 1)} aria-label="Next example" className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white hover:bg-[#eaf0e4] focus-visible:outline-2 focus-visible:outline-[#15803d]"><ArrowRight size={17}/></button>
        {!reducedMotion && <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume automatic shuffle' : 'Pause automatic shuffle'} aria-pressed={paused} className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white hover:bg-[#eaf0e4] focus-visible:outline-2 focus-visible:outline-[#15803d]">{paused ? <Play size={15}/> : <Pause size={15}/>}</button>}
      </div>
    </div>
  );
}


export default function FreeDemoStep({ project, onProjectChange }: { project: ProjectSnapshot; onProjectChange: (project: ProjectSnapshot) => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<'upload' | 'render' | null>(null);
  const [error, setError] = useState('');
  const demo = brandDemos(project)[0];
  const previewStarted = project.jobs.some((job) => job.type === 'PREVIEW_REELS');

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith('video/')) { setError('Choose a video file.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('Choose a video smaller than 50 MB.'); return; }
    setBusy('upload'); setError('');
    const body = new FormData(); body.append('demo', file);
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${project.id}/brand-demo`, { method: 'POST', body });
      onProjectChange(response.project);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to upload this video.'); }
    finally { setBusy(null); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function generate() {
    if (!demo || busy) return;
    if (previewStarted) { navigate(`/projects/${project.id}/preview`); return; }
    setBusy('render'); setError('');
    try {
      await api<{ job: GenerationJob }>(`/projects/${project.id}/preview-render`, { method: 'POST' });
      navigate(`/projects/${project.id}/preview`);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to start your Reel previews.'); setBusy(null); }
  }

  return <main className="flex min-h-svh flex-col bg-[#f5f6f2] text-[#111]">
    <header className="border-b border-black/5 bg-white/80 backdrop-blur"><div className="mx-auto flex max-w-[1220px] items-center justify-between px-5 py-4 sm:px-8"><p className="text-[13px] uppercase tracking-[.34em]">ContentLane</p><div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"><ArrowLeft size={15}/>Back</button><UserButton /></div></div></header>
    <section className="mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-12 px-5 py-10 sm:px-8 sm:py-12 md:grid-cols-[1.2fr_1fr] md:gap-10 lg:gap-20">
      <div className="flex min-w-0 flex-col gap-7">
      <div className="text-center md:text-left">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#15803d]">Final ingredient</p>
        <h1 className="mt-4 text-[clamp(2.75rem,6vw,4.5rem)] font-black leading-[.98] tracking-[-.065em]">Show us your product.</h1>
        <p className="mx-auto mt-4 max-w-[520px] md:mx-0 text-base leading-7 text-[#62645f]">Add one product demo. We’ll pair it with your 8 hooks to build complete Reel previews.</p>
        <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#15803d]"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#dff7c8]"><Check size={13}/></span>Your 8 hook choices are saved</div>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white p-3 shadow-[0_16px_48px_rgba(20,30,10,.06)] sm:p-4">
        {demo ? <div className="grid gap-6 sm:grid-cols-[180px_1fr] md:grid-cols-1 lg:grid-cols-[180px_1fr] sm:items-center"><video src={demo.url} controls playsInline className="aspect-[9/16] w-full rounded-[24px] bg-black object-contain"/><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#15803d]">Demo ready</p><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">{previewStarted ? 'Your previews are underway.' : 'Use this in all 8 Reels?'}</h2><p className="mt-3 text-sm leading-6 text-[#686868]">{previewStarted ? 'The demo is locked so every Reel stays consistent.' : 'Check the video now. Once rendering starts, this demo is locked to keep every preview consistent.'}</p><div className="mt-6 flex flex-col gap-3"><button onClick={() => void generate()} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50">{busy === 'render' ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none"/> : <Play size={16} fill="currentColor"/>}{busy === 'render' ? 'Starting previews…' : previewStarted ? 'View Reel previews' : 'Generate 8 Reel previews'}</button>{!previewStarted ? <button onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={15}/>Replace video</button> : null}</div></div></div> : <button onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="grid min-h-[240px] sm:min-h-[260px] w-full place-items-center rounded-[26px] border-2 border-dashed border-black/12 bg-[#fafbf8] px-8 text-center transition hover:border-[#15803d]/40 hover:bg-[#f5faef] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#15803d] disabled:opacity-50"><span><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dff7c8] text-[#15803d]">{busy === 'upload' ? <Loader2 className="animate-spin motion-reduce:animate-none"/> : <Upload/>}</span><span className="mt-5 block text-2xl font-black tracking-[-.04em]">{busy === 'upload' ? 'Uploading your demo…' : 'Choose your product demo'}</span><span className="mt-2 block text-sm text-[#777]">MP4, MOV, or WebM · 50 MB maximum</span></span></button>}
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])}/>
        {error ? <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      </div>
      <section aria-labelledby="demo-examples-heading" className="mx-auto w-full min-w-0 max-w-[420px] border-t border-black/10 pt-8 md:border-0 md:pt-0">
        <div className="mb-5 space-y-2 text-center">
          <h2 id="demo-examples-heading" className="text-2xl font-black tracking-[-.04em] sm:text-3xl">Demo & Reel inspiration</h2>
          <p className="text-sm text-[#62645f]">Watch before you upload</p>
        </div>
        <div className="min-w-0">
          <DemoExampleStack />

        </div>
      </section>
    </section>
  </main>;
}
