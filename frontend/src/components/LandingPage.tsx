import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Check, Gauge, Globe2, Loader2, Play, Rocket, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { useAuth } from '../lib/auth';
import { ApiClientError, api, post } from '../lib/api';
import { clearPendingWebsite, getPendingWebsite, savePendingWebsite } from '../lib/onboarding.mjs';
import type { BillingStatus, ProjectResponse } from '../types/domain';
import AdditionalWebsiteUpgradeModal from './AdditionalWebsiteUpgradeModal';

type PreviewCardProps = {
  id: string;
  src: string;
  accent: string;
  className?: string;
  videoClassName?: string;
  mobile?: boolean;
};

type ReelPreview = {
  id: string;
  clip: string;
  hook: string;
  angle: string;
  crop: string;
  delay: number;
  startOffset: number;
  accent: string;
};

function posterFor(src: string) {
  const transformed = src.replace('/video/upload/', '/video/upload/so_0/');
  return transformed.replace(/\.(?:mp4|webm)$/i, '.jpg');
}

function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1279px)');
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isCompact;
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

const navLinks = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const previewCards: PreviewCardProps[] = [
  {
    id: 'skincare-demo',
    src: '/assets/landing/demo1.mp4',
    accent: 'from-amber-100/90 via-white/25 to-white/95',
    className: 'z-10 rotate-[-5deg] translate-y-8 scale-[0.98]',
    videoClassName: 'object-[56%_20%]',
  },
  {
    id: 'workspace-demo',
    src: '/assets/landing/demo2.mp4',
    accent: 'from-stone-100/90 via-white/18 to-white/95',
    className: 'z-20 rotate-[2deg] -translate-y-1 scale-[1.01]',
    videoClassName: 'object-[54%_30%]',
  },
  {
    id: 'team-output-demo',
    src: '/assets/landing/demo3.mp4',
    accent: 'from-emerald-100/90 via-white/18 to-white/95',
    className: 'z-30 rotate-[3deg] translate-y-2 scale-[1.03]',
    videoClassName: 'object-[52%_24%]',
  },
  {
    id: 'productivity-demo',
    src: '/assets/landing/demo4.mp4',
    accent: 'from-zinc-100/90 via-white/18 to-white/95',
    className: 'z-20 rotate-[-1deg] -translate-y-1 scale-[1.01]',
    videoClassName: 'object-[50%_36%]',
  },
  {
    id: 'automation-demo',
    src: '/assets/landing/demo5.mp4',
    accent: 'from-neutral-100/90 via-white/18 to-white/95',
    className: 'z-10 rotate-[4deg] translate-y-7 scale-[0.98]',
    videoClassName: 'object-[60%_20%]',
  },
] as const;

const reelPreviews: ReelPreview[] = [
  { id: 'curiosity', clip: '/assets/landing/1.mp4', angle: 'Curiosity', hook: 'I stopped guessing how many calories I ate.', crop: 'object-[52%_28%]', delay: 0, startOffset: 0.4, accent: '#7c6cff' },
  { id: 'confession', clip: '/assets/landing/2.mp4', angle: 'Confession', hook: 'I was logging my meals completely wrong.', crop: 'object-[50%_38%]', delay: 6, startOffset: 1.8, accent: '#ef7b8d' },
  { id: 'panic', clip: '/assets/landing/3.mp4', angle: 'Pain point', hook: 'POV: your goals reset every Monday.', crop: 'object-[48%_42%]', delay: 12, startOffset: 2.1, accent: '#f3a449' },
  { id: 'before-after', clip: '/assets/landing/4.mp4', angle: 'Before / after', hook: 'From meal photo to macros in seconds.', crop: 'object-[54%_30%]', delay: 18, startOffset: 3.4, accent: '#5d9cff' },
  { id: 'objection', clip: '/assets/landing/5.mp4', angle: 'Objection', hook: '“Calorie tracking takes too long.”', crop: 'object-[46%_50%]', delay: 24, startOffset: 5.2, accent: '#a274df' },
  { id: 'speed', clip: '/assets/landing/6.mp4', angle: 'Speed', hook: 'Log this entire meal in 10 seconds.', crop: 'object-[58%_34%]', delay: 30, startOffset: 3.5, accent: '#40a888' },
  { id: 'pov', clip: '/assets/landing/7.mp4', angle: 'POV', hook: 'POV: your macros finally make sense.', crop: 'object-[52%_44%]', delay: 36, startOffset: 7.1, accent: '#e06cae' },
  { id: 'proof', clip: '/assets/landing/8.mp4', angle: 'Proof', hook: 'The app that made consistency feel easy.', crop: 'object-[44%_30%]', delay: 42, startOffset: 4.7, accent: '#6385da' },
];

const featureCards = [
  {
    icon: Sparkles,
    title: 'Instant brand pull',
    description: 'Turn any website into a brand profile with voice, positioning, visual cues, and content angles.',
  },
  {
    icon: Wand2,
    title: 'Hook-first scripts',
    description: 'Generate multiple short-form openings so you can pick the one most likely to stop the scroll.',
  },
  {
    icon: Play,
    title: 'Demo-led output',
    description: 'Combine generated hooks with product demos to create videos that feel native to social platforms.',
  },
  {
    icon: ShieldCheck,
    title: 'Creator-safe workflows',
    description: 'Keep the editor inside the browser so you can review, adjust, and export without extra tooling.',
  },
  {
    icon: Gauge,
    title: 'Fast iteration',
    description: 'Move from website to content concepts quickly enough to test multiple ad angles in one session.',
  },
  {
    icon: Clock3,
    title: 'Always-on production',
    description: 'Use the same workflow for launches, promos, and paid creative refreshes without rebuilding the stack.',
  },
] as const;

const pricingPlans = [
  { id: 'starter', name: 'Starter', price: '9.99', videos: 30, description: 'A focused lane for consistent publishing.' },
  { id: 'pro', name: 'Pro', price: '19.99', videos: 100, description: 'More room to test, learn, and scale winners.' },
] as const;

const faqs = [
  {
    question: 'What does ContentLane need to start?',
    answer: 'A website URL is enough to generate the first brand profile, hook ideas, and a path into the editor.',
  },
  {
    question: 'Can I edit the output before exporting?',
    answer: 'Yes. The workflow is designed for browser-based review so you can adjust concepts before anything is published.',
  },
  {
    question: 'Is this for one-off videos or ongoing campaigns?',
    answer: 'Both. The page is framed around ongoing marketing content, but it also works for launches and seasonal promos.',
  },
  {
    question: 'Do I need separate tools for scripts and visuals?',
    answer: 'No. The landing page should communicate a single workflow from analysis through generation and export.',
  },
] as const;

function PreviewCard({
  src,
  accent,
  className,
  videoClassName,
  mobile = false,
}: PreviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={`group relative overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.1)] ${mobile ? 'aspect-[9/16] h-auto w-[min(72vw,17rem)]' : `h-[26.5rem] w-[15.5rem] sm:w-[16rem] lg:w-[16.5rem] ${className ?? ''}`}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${accent}`} />
      <video
        src={src}
        poster={posterFor(src)}
        className={`relative h-full w-full object-cover opacity-[0.94] brightness-[1.08] saturate-[1.05] ${videoClassName ?? ''}`}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.01),rgba(255,255,255,0.12)_68%,rgba(255,255,255,0.28)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/18 to-transparent" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/15" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]" />
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ececec] bg-white px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#666666] shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:px-4 sm:text-xs sm:tracking-[0.24em]">
        {eyebrow}
      </div>
      <h2 className="mx-auto mt-5 max-w-[18ch] text-[2.15rem] font-extrabold leading-[1] tracking-[-0.05em] text-[#111111] sm:max-w-none sm:text-[clamp(2rem,4vw,3.3rem)] sm:leading-[0.98] sm:tracking-[-0.06em]">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-[34rem] text-[0.98rem] leading-7 text-[#666666] sm:max-w-2xl sm:text-[1.02rem] sm:leading-8">{description}</p>
    </div>
  );
}

function ReelCard({
  reel,
  index,
  shouldPlay,
  registerVideo,
}: {
  reel: ReelPreview;
  index: number;
  shouldPlay: boolean;
  registerVideo: (index: number, node: HTMLVideoElement | null) => void;
}) {
  const animationStyle = {
    '--reel-delay': `${-reel.delay}s`,
    animationPlayState: shouldPlay ? 'running' : 'paused',
  } as CSSProperties;

  return (
    <article
      className="production-reel absolute left-0 z-[2] h-[18rem] w-[10.125rem] overflow-hidden rounded-[23px] border-[3px] border-[#191919] bg-[#191919] shadow-[0_18px_38px_rgba(0,0,0,0.2)]"
      style={animationStyle}
      aria-label={`${reel.angle} Reel: ${reel.hook}`}
      >
      <video
        ref={(node) => registerVideo(index, node)}
        data-reel-preview={reel.id}
        src={reel.clip}
        poster={posterFor(reel.clip)}
        className={`h-full w-full object-cover ${reel.crop}`}
        muted
        autoPlay={shouldPlay}
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = reel.startOffset;
        }}
      />
    </article>
  );
}

const reelWallCardHeight = 344;

function ReelWallCard({
  reel,
  shouldPlay,
}: {
  reel: ReelPreview;
  shouldPlay: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVisible = useInView(cardRef, { amount: 0.6 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay && isVisible) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [isVisible, shouldPlay]);

  return (
    <article
      ref={cardRef}
      className="reel-wall-card relative w-[10.125rem] shrink-0 overflow-hidden rounded-[24px] border border-white/15 bg-[#17171b] shadow-[0_24px_55px_rgba(0,0,0,0.34)] sm:w-[11rem]"
      style={{ height: `${reelWallCardHeight}px` }}
      aria-label={`${reel.angle} Reel: ${reel.hook}`}
    >
      <video
        ref={videoRef}
        src={reel.clip}
        poster={posterFor(reel.clip)}
        className={`h-full w-full object-cover ${reel.crop}`}
        muted
        autoPlay={shouldPlay && isVisible}
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = reel.startOffset;
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,9,0.04)_48%,rgba(7,7,9,0.42)_100%)]" />
    </article>
  );
}

function ReelWall({ reducedMotion }: { reducedMotion: boolean | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionVisible = useInView(sectionRef, { amount: 0.12 });
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');
  const [creatorReels, setCreatorReels] = useState<ReelPreview[] | null>(null);
  const isMobileViewport = useMobileViewport();
  const shouldPlay = sectionVisible && tabVisible && reducedMotion !== true;

  useEffect(() => {
    let active = true;
    void api<{ clips: Array<{ url: string; title: string | null; tags: string[]; creatorName: string }> }>('/creator-showcase')
      .then(({ clips }) => {
        if (!active || clips.length === 0) return;
        setCreatorReels(clips.map((clip, index) => ({
          id: `creator-showcase-${index}`,
          clip: clip.url,
          hook: clip.title ?? `${clip.creatorName} creator clip`,
          angle: clip.tags[0] ?? clip.creatorName,
          crop: 'object-center',
          delay: index * 6,
          startOffset: 0,
          accent: '#a99cff',
        })));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateTabVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateTabVisibility);
    return () => document.removeEventListener('visibilitychange', updateTabVisibility);
  }, []);

  const wallSource = creatorReels ?? reelPreviews;
  const wallCards = isMobileViewport
    ? wallSource
    : Array.from({ length: Math.max(16, wallSource.length) }, (_, index) => wallSource[index % wallSource.length]);
  const wallGroups = isMobileViewport ? [0] : [0, 1];

  return (
    <section ref={sectionRef} aria-labelledby="reel-wall-title" className="reel-wall relative isolate overflow-hidden py-20 text-[#111111] sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#9a8cff]/10 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#72b8ff]/10 blur-[110px]" />
      <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e8e8] bg-white px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#777777] shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:px-4 sm:text-xs sm:tracking-[0.24em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7667ff] shadow-[0_0_0_4px_rgba(118,103,255,0.1)]" />
            UGC clip library
          </div>
          <h2 id="reel-wall-title" className="mx-auto mt-5 max-w-[17ch] text-[2.15rem] font-extrabold leading-[1] tracking-[-0.05em] text-[#111111] sm:max-w-none sm:text-[clamp(2.25rem,5vw,4rem)] sm:leading-[0.96] sm:tracking-[-0.065em]">
            A library of UGC clips, ready for your next Reel.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.02rem] leading-7 text-[#666666]">
            Browse creator-led footage built for hooks, product stories, and scroll-stopping campaigns.
          </p>
        </div>
      </div>

      <div className={`reel-wall-viewport relative z-10 mt-10 sm:mt-14 ${reducedMotion ? 'reel-wall-reduced-motion' : ''}`} aria-label="Generated Reel examples">
        <div className="reel-wall-track mx-auto flex w-max">
          {wallGroups.map((groupIndex) => (
            <div key={`reel-wall-group-${groupIndex}`} className="reel-wall-group flex items-center gap-4 pr-4 sm:gap-5 sm:pr-5 lg:gap-6 lg:pr-6">
              {wallCards.map((reel, index) => (
                <ReelWallCard key={`${groupIndex}-${reel.id}-${index}`} reel={reel} shouldPlay={shouldPlay} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductionLane({ reducedMotion }: { reducedMotion: boolean | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const productVideoRef = useRef<HTMLVideoElement | null>(null);
  const reelVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const sectionVisible = useInView(sectionRef, { amount: 0.08 });
  const isCompactViewport = useCompactViewport();
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');
  const shouldPlayProductDemo = sectionVisible && tabVisible;
  const shouldAnimateReels = shouldPlayProductDemo && reducedMotion !== true && !isCompactViewport;

  useEffect(() => {
    const updateTabVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateTabVisibility);
    return () => document.removeEventListener('visibilitychange', updateTabVisibility);
  }, []);

  const resumeProductDemo = useCallback(() => {
    const productVideo = productVideoRef.current;
    if (!productVideo || !shouldPlayProductDemo) return;

    if (productVideo.ended || productVideo.currentTime >= productVideo.duration - 0.05) {
      productVideo.currentTime = 0;
    }

    void productVideo.play().catch(() => undefined);
  }, [shouldPlayProductDemo]);

  useEffect(() => {
    const productVideo = productVideoRef.current;
    if (productVideo) {
      if (shouldPlayProductDemo) {
        resumeProductDemo();
      } else {
        productVideo.pause();
      }
    }

    const reelVideos = reelVideoRefs.current.filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    for (const video of reelVideos) {
      if (shouldAnimateReels) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }
  }, [resumeProductDemo, shouldAnimateReels, shouldPlayProductDemo]);

  const registerVideo = (index: number, node: HTMLVideoElement | null) => {
    reelVideoRefs.current[index] = node;
  };

  return (
    <section ref={sectionRef} id="workflow" className="mx-auto w-full max-w-[1440px] scroll-mt-8 px-5 pb-10 pt-20 sm:px-8 sm:pb-12 sm:pt-16 lg:px-12 lg:pb-20 lg:pt-24">
      <SectionHeading
        eyebrow="Your always-on content lane"
        title="One website. One demo. Infinite Reels."
        description="ContentLane learns your brand, writes fresh hook angles, and pairs each one with the product footage you already have."
      />

      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 24 }}
        whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="relative mx-auto mt-10 max-w-[1320px] sm:mt-12"
      >
        <div className="grid gap-5 xl:grid-cols-[18rem_6rem_17rem_minmax(0,1fr)] xl:items-center xl:gap-0">
          <div className="grid justify-items-center gap-4 sm:gap-5 xl:h-[31rem] xl:grid-rows-[auto_1fr] xl:content-between xl:justify-items-start xl:gap-7">
            <article className="flex w-full max-w-[11rem] items-center gap-3 rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.06)] xl:ml-6 xl:max-w-[10rem]" aria-label="Website URL: calai.app">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#6d58d6]">
                <Globe2 size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-[#999999]">Website</span>
                <span className="mt-0.5 block truncate text-[0.95rem] font-semibold tracking-[-0.035em] text-[#111111]">calai.app</span>
              </span>
            </article>

            <article className="flex aspect-[3/4] w-full max-w-[18rem] flex-col overflow-hidden rounded-[26px] border border-[#e5e5e5] bg-white p-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.055)] sm:min-h-[23rem] sm:max-w-[15rem] xl:h-[25rem] xl:min-h-[25rem]">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#666]">Your product demo</span>
                <Play size={11} fill="currentColor" />
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[19px] bg-[#ececec] sm:min-h-[19rem]">
                <video
                  ref={productVideoRef}
                  className="absolute inset-0 h-full w-full object-cover object-[52%_35%]"
                  poster="/assets/landing/calai.jpg"
                  muted
                  autoPlay={shouldPlayProductDemo}
                  loop
                  playsInline
                  preload="auto"
                  onCanPlay={resumeProductDemo}
                  onEnded={resumeProductDemo}
                  onPause={resumeProductDemo}
                >
                  <source src="/assets/landing/calai.mp4" type="video/mp4" />
                  <source src="/assets/landing/calai.webm" type="video/webm" />
                </video>
              </div>
            </article>
          </div>

          <div className="relative hidden h-[31rem] xl:block" aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 96 496" fill="none">
              <path d="M-96 31 C-55 31 -18 111 96 224" stroke="#cfcfcf" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M-48 328 C-7 304 22 258 96 224" stroke="#cfcfcf" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="95" cy="224" r="3" fill="#8b75e8" />
            </svg>
          </div>

          <div className="relative z-20 mx-auto flex min-h-[15rem] w-full max-w-[28rem] flex-col rounded-[24px] border border-white/10 bg-[#111111] p-5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.14)] before:absolute before:-top-5 before:left-1/2 before:h-5 before:w-px before:bg-[#d2d2d2] xl:h-[19rem] xl:max-w-none xl:before:hidden">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">ContentLane engine</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#9b88ff] shadow-[0_0_0_4px_rgba(155,136,255,0.1)]" />
              </div>
              <p className="mt-4 text-[1.2rem] font-semibold leading-[1.08] tracking-[-0.04em]">One campaign.<br />New angles on repeat.</p>
            </div>
            <ol className="mt-5 divide-y divide-white/10 border-y border-white/10 text-[0.82rem]">
              {['Learn brand', 'Write hooks', 'Build Reels'].map((stage, index) => (
                <li key={stage} className="flex items-center gap-3 py-3">
                  <span className="w-5 font-mono text-[9px] text-white/40">0{index + 1}</span>
                  <span className="font-medium text-white/82">{stage}</span>
                  <Check className="ml-auto text-[#ad9cff]" size={12} strokeWidth={2.25} />
                </li>
              ))}
            </ol>
            <span className="production-output-port pointer-events-none absolute right-0 top-1/2 hidden xl:block" aria-hidden="true" />
          </div>

          <div className="production-reel-lane relative z-10 h-[21rem] min-w-0 overflow-hidden rounded-[26px] border border-[#e7e7e7] bg-[linear-gradient(90deg,#f0f0f0_0%,#fafafa_24%,#f4f2ff_100%)] sm:h-[22rem] sm:rounded-[28px] xl:-ml-10" aria-label="Sample Reels generated for calai.app">
            <div className="production-output-trail pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden xl:block" aria-hidden="true">
              <span className="production-output-dot" />
              <span className="production-output-dot" />
              <span className="production-output-dot" />
            </div>
            {reducedMotion || isCompactViewport ? (
              <div className="production-reel-static absolute inset-0 z-[2] flex snap-x snap-mandatory items-center gap-4 overflow-x-auto px-5 pb-4 pt-8 sm:px-8 sm:pt-10">
                {reelPreviews.map((reel, index) => (
                  <div key={reel.id} className="relative h-[18rem] w-[10.125rem] shrink-0 snap-center">
                    <ReelCard reel={reel} index={index} shouldPlay={false} registerVideo={registerVideo} />
                  </div>
                ))}
              </div>
            ) : reelPreviews.map((reel, index) => (
              <ReelCard key={reel.id} reel={reel} index={index} shouldPlay={shouldAnimateReels} registerVideo={registerVideo} />
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export default function LandingPage() {
  const [website, setWebsite] = useState(() => getPendingWebsite() ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [upgradeWebsite, setUpgradeWebsite] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const isCompactViewport = useCompactViewport();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') { setBilling(null); return; }
    let active = true;
    api<BillingStatus>('/billing/status').then((value) => { if (active) setBilling(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [status]);

  const startProject = async () => {
    const value = website.trim();
    if (!value || loading) return;
    const pendingWebsite = savePendingWebsite(value);
    if (!pendingWebsite) { setError('Enter a valid website URL'); return; }
    if (status !== 'authenticated') {
      navigate('/signup', { state: { from: { pathname: '/onboarding' } } });
      return;
    }
    setLoading(true);
    setError('');
    setMessage('Starting analysis');

    try {
      const analysisResponse = await post<ProjectResponse>('/projects', { website: pendingWebsite });
      clearPendingWebsite();
      navigate(`/projects/${analysisResponse.project.id}/hooks`);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'ADDITIONAL_PROJECT_REQUIRES_SUBSCRIPTION') {
        setUpgradeWebsite(pendingWebsite);
        setUpgradeError('');
        return;
      }
      if (caught instanceof ApiClientError && (caught.code === 'SUBSCRIPTION_REQUIRED' || caught.code === 'UPGRADE_REQUIRED')) {
        navigate('/billing');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Unable to start project');
    } finally {
      setLoading(false);
    }
  };

  const startAdditionalWebsiteTrial = async () => {
    setUpgradeBusy(true);
    setUpgradeError('');
    navigate('/billing?plan=starter');
  };

  const dismissUpgrade = () => {
    if (upgradeBusy) return;
    setUpgradeWebsite('');
    setUpgradeError('');
  };

  const scrollToHero = () => {
    const input = document.getElementById('website');
    input?.focus();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#fcfcfc] text-[#111111]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(48,128,255,0.11),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[18rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(17,17,17,0.06),transparent_68%)] blur-3xl" />
        <div className="absolute inset-x-0 top-[56rem] h-[40rem] bg-[linear-gradient(180deg,transparent,rgba(17,17,17,0.02),transparent)]" />
      </div>

      <header className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-y-3 px-5 pt-5 sm:flex sm:justify-between sm:px-8 lg:px-12">
        <div className="min-w-0 text-[12px] font-normal uppercase tracking-[0.3em] text-[#111111] sm:text-[13px] sm:tracking-[0.34em]" aria-label="ContentLane">
          ContentLane
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-sm font-medium text-[#666666] md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-[#111111]">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {user?.role === 'ADMIN' ? (
            <button
              onClick={() => navigate('/admin')}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2.5 text-xs font-medium text-[#111111] transition hover:border-black sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm"
            >
              Admin panel
            </button>
          ) : null}
          {status === 'authenticated' ? (
            <button onClick={() => navigate(billing?.hasAccess ? '/projects' : billing?.freeAccess.projectId ? `/projects/${billing.freeAccess.projectId}/hooks` : '/onboarding')} className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2.5 text-xs font-medium text-[#111111] transition hover:border-black sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm">
              {billing?.hasAccess ? 'Dashboard' : 'Continue free hooks'}
            </button>
          ) : null}
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="min-h-11 flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black sm:min-h-0 sm:flex-none">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="min-h-11 flex-1 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfcfc] sm:min-h-0 sm:flex-none">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <section
        className="mx-auto flex w-full max-w-[1440px] flex-col px-5 pt-12 sm:min-h-[calc(100vh-72px)] sm:px-8 sm:pt-14 lg:px-12 lg:pt-16"
      >
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={reducedMotion ? undefined : { duration: 0.7, ease: 'easeOut' }}
          className="mx-auto flex w-full max-w-5xl flex-col items-center text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ececec] bg-white px-3.5 py-2 text-[0.78rem] font-medium text-[#666666] shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:px-4 sm:text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
            Demo-led content for SaaS founders
          </div>

          <h1 className="mt-6 max-w-[12ch] cursor-default text-[2.7rem] font-extrabold leading-[0.96] tracking-[-0.052em] text-[#111111] min-[390px]:text-[2.85rem] sm:mt-7 sm:text-[clamp(3.55rem,7vw,5.15rem)] sm:leading-[0.94] sm:tracking-[-0.06em]">
            Generate your first viral SaaS Reel in under a minute.
          </h1>

          <p className="mt-5 max-w-[35rem] text-[0.98rem] leading-7 text-[#666666] sm:mt-6 sm:max-w-2xl sm:text-[1.08rem] sm:leading-8">
            Paste your website. ContentLane creates the first few seconds that stop the scroll, then combines them with your real product demo.
          </p>

          <div className="mt-7 w-full max-w-[41rem] rounded-[26px] border border-[#ececec] bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.07)] sm:mt-8 sm:rounded-[30px]">
            <label className="sr-only" htmlFor="website">
              Website URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="website"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourcompany.com"
                className="min-h-12 min-w-0 flex-1 rounded-[22px] border-0 bg-transparent px-4 py-3 text-[0.95rem] font-medium text-[#111111] outline-none placeholder:text-[#999999] focus:ring-0 sm:rounded-[24px] sm:px-5 sm:py-4"
              />
              <button
                type="button"
                onClick={() => void startProject()}
                disabled={loading || !website.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Wand2 size={17} />}
                Generate 24 free hooks
              </button>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-[#666666]">No subscription required. Choose up to 8, then start your free trial when you’re ready to make Reels.</p>

          <ol className="mt-5 grid w-full max-w-[22rem] text-left sm:hidden" aria-label="How ContentLane creates a Reel">
            {['Creator hook first', 'Product demo second', 'Ready-to-post ad after approval'].map((step, index) => (
              <li key={step} className="relative flex min-h-11 items-center gap-3 pl-1 text-[0.82rem] font-medium text-[#666666] not-last:after:absolute not-last:after:bottom-[-0.35rem] not-last:after:left-[0.9rem] not-last:after:top-[2.45rem] not-last:after:w-px not-last:after:bg-[#dedede]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#e5e5e5] bg-white font-mono text-[0.62rem] text-[#777777] shadow-[0_6px_18px_rgba(0,0,0,0.04)]">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-5 hidden flex-wrap items-center justify-center gap-4 text-sm text-[#666666] sm:flex">
            <span>Creator hook first</span>
            <span className="hidden text-[#b0b0b0] sm:inline">-&gt;</span>
            <span>Product demo second</span>
            <span className="hidden text-[#b0b0b0] sm:inline">-&gt;</span>
            <span>Ready-to-post ad after approval</span>
          </div>

          {status === 'authenticated' && billing?.hasAccess ? (
            <button type="button" onClick={() => navigate('/projects')} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#666666] underline decoration-black/20 underline-offset-4 transition hover:text-[#111111]">
              Choose an existing website <ArrowRight size={14} />
            </button>
          ) : null}

          {(message || error) && (
            <div className="mt-5 min-h-6 text-sm" role={error ? 'alert' : 'status'}>
              <span className={error ? 'text-[#b42318]' : 'text-[#666666]'}>{error || message}</span>
            </div>
          )}
        </motion.div>

        <div className="relative isolate mt-10 flex items-end justify-center overflow-hidden pb-10 pt-2 sm:mt-8 sm:flex-1 sm:pb-24 sm:pt-4">
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 18, filter: 'blur(10px)' }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative z-10 flex w-full items-end justify-center px-2 sm:px-4"
          >
            {isCompactViewport ? (
              <div className="flex w-full flex-col items-center gap-4">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={previewCards[activePreviewIndex].id}
                    initial={reducedMotion ? undefined : { opacity: 0, x: 18 }}
                    animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: -18 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                    className="landing-preview-card"
                    drag={reducedMotion ? false : 'x'}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.14}
                    onDragEnd={(_, info) => {
                      if (Math.abs(info.offset.x) < 45 && Math.abs(info.velocity.x) < 350) return;
                      const direction = info.offset.x < 0 || info.velocity.x < -350 ? 1 : -1;
                      setActivePreviewIndex((current) => (current + direction + previewCards.length) % previewCards.length);
                    }}
                  >
                    <PreviewCard {...previewCards[activePreviewIndex]} mobile />
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center" role="tablist" aria-label="Preview videos">
                  {previewCards.map((card, index) => (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-label={`Show preview ${index + 1}`}
                      aria-selected={activePreviewIndex === index}
                      onClick={() => setActivePreviewIndex(index)}
                      className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                    >
                      <span className={`h-1.5 rounded-full transition-all ${activePreviewIndex === index ? 'w-6 bg-[#111111]' : 'w-1.5 bg-black/20'}`} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative flex max-w-full items-end justify-center gap-0 px-3 sm:px-0">
                {previewCards.map((card) => (
                  <div key={card.id} className="shrink-0 -ml-12 first:ml-0">
                    <PreviewCard {...card} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-[linear-gradient(to_bottom,transparent_0%,transparent_38%,rgba(252,252,252,0.82)_72%,#fcfcfc_100%)] sm:h-24"
          />
        </div>
      </section>

      <ProductionLane reducedMotion={reducedMotion} />

      <ReelWall reducedMotion={reducedMotion} />

      <section id="features" className="mx-auto w-full max-w-[1440px] px-5 pb-8 pt-20 sm:px-8 sm:pt-10 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="Features"
          title="Everything needed to turn a website into a campaign"
          description="The page should communicate a clear funnel: find the brand, shape the hooks, generate the visuals, and hand it to the editor."
        />

        <div className="mt-9 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: index * 0.04, ease: 'easeOut' }}
                className="rounded-[24px] border border-[#ececec] bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.045)] sm:rounded-[28px] sm:p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111111] text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)]">
                  <Icon size={18} />
                </div>
                <h3 className="mt-5 text-[1.15rem] font-semibold tracking-[-0.04em] text-[#111111]">{feature.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-[#666666]">{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-[1440px] px-5 pb-8 pt-20 sm:px-8 sm:pt-10 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="Pricing"
          title="Choose how much you want to ship"
          description="Every plan includes unlimited hook generation. Your render capacity resets with each billing period."
        />

        <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
          {pricingPlans.map((plan, planIndex) => <motion.article key={plan.id} initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: .5, delay: planIndex * .08 }} className={`overflow-hidden rounded-[26px] p-6 sm:rounded-[30px] sm:p-10 ${plan.id === 'pro' ? 'bg-[#111] text-white shadow-[0_22px_55px_rgba(0,0,0,.18)]' : 'border border-black/10 bg-white text-[#111]'}`}>
            <div className="flex flex-col items-start gap-4 min-[390px]:flex-row min-[390px]:justify-between"><div><h3 className="text-2xl font-black tracking-[-.05em]">{plan.name}</h3><p className={`mt-2 text-sm ${plan.id === 'pro' ? 'text-white/60' : 'text-[#666]'}`}>{plan.description}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] ${plan.id === 'pro' ? 'bg-[#b8f36b] text-[#111]' : 'bg-[#f0f0eb]'}`}>7-day trial</span></div>
            <p className="mt-7 text-[2.75rem] font-black tracking-[-.07em] sm:mt-8 sm:text-5xl">${plan.price}<span className={`ml-1 text-sm font-medium tracking-normal ${plan.id === 'pro' ? 'text-white/55' : 'text-[#777]'}`}>/ month</span></p>
            <div className="mt-7 flex h-12 items-end gap-1" aria-hidden="true">{Array.from({ length: plan.id === 'pro' ? 10 : 6 }, (_, index) => <span key={index} className={`flex-1 rounded-t-sm ${plan.id === 'pro' ? 'bg-[#b8f36b]' : 'bg-[#111]'}`} style={{ height: `${30 + index * 7}%` }} />)}</div>
            <ul className="mt-7 space-y-3 text-sm"><li className="flex gap-3"><Check size={16} />Unlimited hook generation</li><li className="flex gap-3"><Check size={16} />{plan.videos} rendered videos per billing period</li><li className="flex gap-3"><Check size={16} />Website analysis, editing, and exports</li></ul>
            <button type="button" onClick={() => navigate(status === 'authenticated' ? `/billing?plan=${plan.id}` : '/signup', status === 'authenticated' ? undefined : { state: { from: { pathname: '/billing', search: `?plan=${plan.id}` } } })} className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black transition hover:-translate-y-1 ${plan.id === 'pro' ? 'bg-white text-[#111]' : 'bg-[#111] text-white'}`}>Choose {plan.name}<ArrowRight size={16} /></button>
          </motion.article>)}
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-20 sm:px-8 sm:pt-10 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="FAQ"
          title="Answers to the questions buyers ask before they start"
          description="A short FAQ keeps the page from feeling vague and gives the product a cleaner, more complete sales story."
        />

        <div className="mx-auto mt-10 grid max-w-5xl gap-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-[22px] border border-[#ececec] bg-white p-5 shadow-[0_10px_26px_rgba(0,0,0,0.035)] sm:rounded-[24px] sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[1.02rem] font-semibold tracking-[-0.03em] text-[#111111]">
                {faq.question}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ececec] bg-[#fcfcfc] text-[#666666] transition group-open:rotate-45">
                  <Sparkles size={15} />
                </span>
              </summary>
              <p className="mt-4 max-w-3xl text-[0.98rem] leading-7 text-[#666666]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-16 lg:px-12">
        <div className="rounded-[30px] bg-[#111111] px-5 py-8 text-white shadow-[0_22px_54px_rgba(0,0,0,0.16)] sm:rounded-[36px] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Final CTA</p>
              <h2 className="mt-4 text-[2.15rem] font-extrabold leading-[1] tracking-[-0.05em] sm:text-[clamp(2rem,4vw,3.15rem)] sm:leading-[0.98] sm:tracking-[-0.06em]">
                Start from one website and turn it into a content system.
              </h2>
              <p className="mt-4 max-w-xl text-[1rem] leading-7 text-white/72">
                Keep the page focused on the simple promise: paste a URL, generate the creative path, and move into the editor.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToHero}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#111111] transition hover:-translate-y-0.5 hover:bg-[#f4f4f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] sm:w-auto"
            >
              Generate 24 free hooks
              <Rocket size={16} />
            </button>
          </div>
        </div>
      </section>
      {upgradeWebsite ? (
        <AdditionalWebsiteUpgradeModal
          website={upgradeWebsite}
          busy={upgradeBusy}
          error={upgradeError}
          onStartTrial={() => void startAdditionalWebsiteTrial()}
          onContinueFreeProject={() => {
            const projectId = billing?.freeAccess.projectId;
            if (projectId) navigate(`/projects/${projectId}/hooks`);
          }}
          onDismiss={dismissUpgrade}
        />
      ) : null}
    </main>
  );
}
