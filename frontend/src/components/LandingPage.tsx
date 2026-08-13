import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Check, Gauge, Globe2, Loader2, Play, Rocket, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { useAuth } from '../lib/auth';
import { ApiClientError, post } from '../lib/api';
import type { ProjectResponse } from '../types/domain';

type PreviewCardProps = {
  id: string;
  src: string;
  accent: string;
  className?: string;
  videoClassName?: string;
};

type ReelPreview = {
  id: string;
  clip: `/assets/landing/${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}.mp4`;
  hook: string;
  angle: string;
  crop: string;
  delay: number;
  startOffset: number;
  accent: string;
};

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

const pricingPlan = {
  name: 'ContentLane',
  originalPrice: 29,
  price: 19,
  period: '/month',
  description: '3-day free trial, then $19 USD per month for the full website-to-video workflow.',
  features: ['Website and brand analysis', 'Hook-first scripts and visuals', 'Browser editing and exports'],
} as const;

function AnimatedPrice({ reducedMotion }: { reducedMotion: boolean | null }) {
  const priceRef = useRef<HTMLSpanElement>(null);
  const priceVisible = useInView(priceRef, { once: true, amount: 0.8 });
  const [priceState, setPriceState] = useState<{ currentPrice: number; showOriginalPrice: boolean }>({
    currentPrice: pricingPlan.originalPrice,
    showOriginalPrice: false,
  });

  useEffect(() => {
    if (reducedMotion) return;
    if (!priceVisible || reducedMotion === null) return;

    let countdown: number | undefined;
    const reveal = window.setTimeout(() => {
      setPriceState({ currentPrice: pricingPlan.originalPrice - 1, showOriginalPrice: true });
      let nextPrice = pricingPlan.originalPrice - 2;

      countdown = window.setInterval(() => {
        setPriceState({ currentPrice: nextPrice, showOriginalPrice: true });
        if (nextPrice === pricingPlan.price) {
          window.clearInterval(countdown);
          countdown = undefined;
        } else {
          nextPrice -= 1;
        }
      }, 145);
    }, 700);

    return () => {
      window.clearTimeout(reveal);
      if (countdown !== undefined) window.clearInterval(countdown);
    };
  }, [priceVisible, reducedMotion]);

  if (reducedMotion) {
    return (
      <span className="relative inline-grid h-[3.75rem] min-w-[5.25rem] items-end" aria-label="3-day free trial, then $19 per month, reduced from $29">
        <span aria-hidden="true" className="absolute left-0 top-0 text-base font-bold leading-none tracking-[-0.03em] text-white/55 line-through decoration-[#ad9cff] decoration-2">
          ${pricingPlan.originalPrice}
        </span>
        <span aria-hidden="true" className="text-[2.5rem] font-extrabold leading-none tracking-[-0.07em]">
          ${pricingPlan.price}
        </span>
      </span>
    );
  }

  return (
    <span
      ref={priceRef}
      className="relative inline-grid h-[3.75rem] min-w-[5.25rem] items-end"
      aria-label="3-day free trial, then $19 per month, reduced from $29"
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ opacity: priceState.showOriginalPrice ? 1 : 0, y: priceState.showOriginalPrice ? 0 : 4 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-0 top-0 text-base font-bold leading-none tracking-[-0.03em] text-white/55 line-through decoration-[#ad9cff] decoration-2"
      >
        ${pricingPlan.originalPrice}
      </motion.span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={priceState.currentPrice}
          aria-hidden="true"
          initial={{ y: -12, opacity: 0, filter: 'blur(2px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: 12, opacity: 0, filter: 'blur(2px)' }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="col-start-1 row-start-1 text-[2.5rem] font-extrabold leading-none tracking-[-0.07em] tabular-nums"
        >
          ${priceState.currentPrice}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

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
}: PreviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={`group relative h-[26.5rem] w-[15.5rem] overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.12)] sm:w-[16rem] lg:w-[16.5rem] ${className ?? ''}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${accent}`} />
      <video
        src={src}
        className={`relative h-full w-full object-cover opacity-[0.94] brightness-[1.08] saturate-[1.05] ${videoClassName ?? ''}`}
        muted
        autoPlay
        loop
        playsInline
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
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ececec] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#666666] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        {eyebrow}
      </div>
      <h2 className="mt-5 text-[clamp(2rem,4vw,3.3rem)] font-extrabold leading-[0.98] tracking-[-0.06em] text-[#111111]">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-[1.02rem] leading-8 text-[#666666]">{description}</p>
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
        className={`h-full w-full object-cover ${reel.crop}`}
        muted
        autoPlay={shouldPlay}
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = reel.startOffset;
        }}
      />
    </article>
  );
}

function ProductionLane({ reducedMotion }: { reducedMotion: boolean | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const productVideoRef = useRef<HTMLVideoElement | null>(null);
  const reelVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const sectionVisible = useInView(sectionRef, { amount: 0.08 });
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');
  const shouldPlayProductDemo = sectionVisible && tabVisible;
  const shouldAnimateReels = shouldPlayProductDemo && reducedMotion === false;

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
    <section ref={sectionRef} id="workflow" className="mx-auto w-full max-w-[1440px] scroll-mt-8 px-6 pb-12 pt-16 sm:px-8 lg:px-12 lg:pb-20 lg:pt-24">
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
        className="relative mx-auto mt-12 max-w-[1320px]"
      >
        <div className="grid gap-5 xl:grid-cols-[18rem_6rem_17rem_minmax(0,1fr)] xl:items-center xl:gap-0">
          <div className="grid justify-items-center gap-5 xl:h-[31rem] xl:grid-rows-[auto_1fr] xl:content-between xl:justify-items-start xl:gap-7">
            <article className="flex w-full max-w-[10rem] items-center gap-3 rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-[0_14px_36px_rgba(0,0,0,0.07)] xl:ml-6" aria-label="Website URL: calai.app">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#6d58d6]">
                <Globe2 size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-[#999999]">Website</span>
                <span className="mt-0.5 block truncate text-[0.95rem] font-semibold tracking-[-0.035em] text-[#111111]">calai.app</span>
              </span>
            </article>

            <article className="flex min-h-[23rem] w-full max-w-[15rem] flex-col overflow-hidden rounded-[26px] border border-[#e5e5e5] bg-white p-2.5 shadow-[0_16px_45px_rgba(0,0,0,0.06)] xl:h-[25rem] xl:min-h-[25rem]">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#666]">Your product demo</span>
                <Play size={11} fill="currentColor" />
              </div>
              <div className="relative min-h-[19rem] flex-1 overflow-hidden rounded-[19px] bg-[#ececec]">
                <video
                  ref={productVideoRef}
                  src="/assets/landing/calai.webm"
                  className="absolute inset-0 h-full w-full object-cover object-[52%_35%]"
                  muted
                  autoPlay={shouldPlayProductDemo}
                  loop
                  playsInline
                  preload="auto"
                  onCanPlay={resumeProductDemo}
                  onEnded={resumeProductDemo}
                  onPause={resumeProductDemo}
                />
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

          <div className="relative z-20 flex min-h-[16rem] flex-col rounded-[24px] border border-white/10 bg-[#111111] p-5 text-white shadow-[0_20px_48px_rgba(0,0,0,0.16)] before:absolute before:-top-5 before:left-1/2 before:h-5 before:w-px before:bg-[#d2d2d2] xl:h-[19rem] xl:before:hidden">
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

          <div className="production-reel-lane relative z-10 h-[22rem] min-w-0 overflow-hidden rounded-[28px] border border-[#e7e7e7] bg-[linear-gradient(90deg,#f0f0f0_0%,#fafafa_24%,#f4f2ff_100%)] xl:-ml-10" aria-label="Sample Reels generated for calai.app">
            <div className="production-output-trail pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden xl:block" aria-hidden="true">
              <span className="production-output-dot" />
              <span className="production-output-dot" />
              <span className="production-output-dot" />
            </div>
            {reducedMotion ? (
              <div className="production-reel-static absolute inset-0 z-[2] flex snap-x snap-mandatory items-center gap-4 overflow-x-auto px-8 pb-4 pt-10">
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
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { status, user } = useAuth();

  const startProject = async () => {
    const value = website.trim();
    if (!value || loading) return;
    if (status !== 'authenticated') {
      navigate('/signup', { state: { from: { pathname: '/billing' } } });
      return;
    }

    setLoading(true);
    setError('');
    setMessage('Starting analysis');

    try {
      const analysisResponse = await post<ProjectResponse>('/projects', { website: value });
      let project = analysisResponse.project;

      if (project.brandProfile && project.concepts.length === 0) {
        setMessage('Generating 8 hooks');
        const hooksResponse = await post<ProjectResponse>(`/projects/${project.id}/concepts`, { count: 8 });
        project = hooksResponse.project;
      }

      navigate(`/projects/${project.id}`);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'SUBSCRIPTION_REQUIRED') {
        navigate('/billing');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Unable to start project');
    } finally {
      setLoading(false);
    }
  };

  const scrollToHero = () => {
    const input = document.getElementById('website');
    input?.focus();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcfcfc] text-[#111111]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(48,128,255,0.11),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[18rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(17,17,17,0.06),transparent_68%)] blur-3xl" />
        <div className="absolute inset-x-0 top-[56rem] h-[40rem] bg-[linear-gradient(180deg,transparent,rgba(17,17,17,0.02),transparent)]" />
      </div>

      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 pt-5 sm:px-8 lg:px-12">
        <div className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]" aria-label="ContentLane">
          ContentLane
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-sm font-medium text-[#666666] md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-[#111111]">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user?.role === 'ADMIN' ? (
            <button
              onClick={() => navigate('/admin')}
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black"
            >
              Admin panel
            </button>
          ) : null}
          {status === 'authenticated' && user?.role !== 'ADMIN' ? (
            <button onClick={() => navigate('/billing')} className="hidden rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black sm:block">
              Manage billing
            </button>
          ) : null}
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfcfc]">
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
        className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1440px] flex-col px-6 pt-14 sm:px-8 lg:px-12 lg:pt-16"
      >
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={reducedMotion ? undefined : { duration: 0.7, ease: 'easeOut' }}
          className="mx-auto flex w-full max-w-5xl flex-col items-center text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ececec] bg-white px-4 py-2 text-sm font-medium text-[#666666] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
            Demo-led content for SaaS founders
          </div>

          <h1 className="mt-7 max-w-[11ch] text-[clamp(3.55rem,7vw,5.15rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-[#111111] sm:max-w-[12ch]">
            Generate your first viral SaaS Reel in under a minute.
          </h1>

          <p className="mt-6 max-w-2xl text-[1.04rem] leading-8 text-[#666666] sm:text-[1.08rem]">
            Paste your website. ContentLane creates the first few seconds that stop the scroll, then combines them with your real product demo.
          </p>

          <div className="mt-8 w-full max-w-[41rem] rounded-[30px] border border-[#ececec] bg-white p-2 shadow-[0_18px_48px_rgba(0,0,0,0.08)]">
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
                className="min-w-0 flex-1 rounded-[24px] border-0 bg-transparent px-5 py-4 text-[0.95rem] font-medium text-[#111111] outline-none placeholder:text-[#999999] focus:ring-0"
              />
              <button
                type="button"
                onClick={() => void startProject()}
                disabled={loading || !website.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Wand2 size={17} />}
                Generate My First Reel
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-[#666666]">
            <span>Creator hook first</span>
            <span className="hidden text-[#b0b0b0] sm:inline">-&gt;</span>
            <span>Product demo second</span>
            <span className="hidden text-[#b0b0b0] sm:inline">-&gt;</span>
            <span>Ready-to-post ad after approval</span>
          </div>

          {(message || error) && (
            <div className="mt-5 min-h-6 text-sm" role={error ? 'alert' : 'status'}>
              <span className={error ? 'text-[#b42318]' : 'text-[#666666]'}>{error || message}</span>
            </div>
          )}
        </motion.div>

        <div className="relative isolate mt-8 flex flex-1 items-end justify-center overflow-hidden pb-20 pt-4 sm:pb-24">
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 18, filter: 'blur(10px)' }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative z-10 flex w-full items-end justify-center px-2 sm:px-4"
          >
            <div className="relative flex items-end justify-center overflow-visible px-3 sm:px-0">
              {previewCards.map((card, index) => (
                <div key={card.id} className={index === 0 ? '' : '-ml-11 sm:-ml-12'}>
                  <PreviewCard {...card} />
                </div>
              ))}
            </div>
          </motion.div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-[linear-gradient(to_bottom,transparent_0%,transparent_38%,rgba(252,252,252,0.82)_72%,#fcfcfc_100%)] sm:h-24"
          />
        </div>
      </section>

      <ProductionLane reducedMotion={reducedMotion} />

      <section id="features" className="mx-auto w-full max-w-[1440px] px-6 pb-8 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="Features"
          title="Everything needed to turn a website into a campaign"
          description="The page should communicate a clear funnel: find the brand, shape the hooks, generate the visuals, and hand it to the editor."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: index * 0.04, ease: 'easeOut' }}
                className="rounded-[28px] border border-[#ececec] bg-white p-6 shadow-[0_14px_38px_rgba(0,0,0,0.05)]"
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

      <section id="pricing" className="mx-auto w-full max-w-[1440px] px-6 pb-8 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="Pricing"
          title="One plan for the whole creative lane"
          description="Start with a 3-day free trial, then continue for $19 USD each month. Cancel anytime before renewal."
        />

        <div className="mx-auto mt-10 max-w-2xl">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              whileHover={reducedMotion ? undefined : { y: -8, scale: 1.012 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[#111111] p-8 text-white shadow-[0_18px_42px_rgba(0,0,0,0.12)] transition-shadow duration-500 hover:shadow-[0_28px_70px_rgba(17,17,17,0.24)] sm:p-10"
            >
              <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[#a99cff]/20 blur-3xl transition duration-700 group-hover:bg-[#a99cff]/35" />
              <div className="pointer-events-none absolute -bottom-32 -left-20 h-56 w-56 rounded-full bg-[#6fe4c0]/10 blur-3xl transition duration-700 group-hover:bg-[#6fe4c0]/20" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#6fe4c0] shadow-[0_0_0_5px_rgba(111,228,192,0.1)]" />
                    <h3 className="text-[1.2rem] font-semibold tracking-[-0.04em]">{pricingPlan.name}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/70">{pricingPlan.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#111111] shadow-[0_8px_20px_rgba(255,255,255,0.08)] transition-transform duration-300 group-hover:rotate-2">3-day free trial</span>
              </div>

              <div className="relative mt-8 flex items-end gap-1">
                <AnimatedPrice reducedMotion={reducedMotion} />
                <span className="pb-1 text-sm text-white/70">{pricingPlan.period}</span>
              </div>
              <p className="relative mt-2 text-xs font-medium uppercase tracking-[0.16em] text-[#6fe4c0]">Nothing charged today</p>

              <ul className="relative mt-7 space-y-3">
                {pricingPlan.features.map((feature, index) => (
                  <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-white/90 transition-transform duration-300 group-hover:translate-x-1" style={{ transitionDelay: `${index * 35}ms` }}>
                    <Check size={16} className="mt-0.5 shrink-0 text-white" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => navigate(status === 'authenticated' ? '/billing' : '/signup', status === 'authenticated' ? undefined : { state: { from: { pathname: '/billing' } } })}
                className="relative mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#111111] transition duration-300 hover:-translate-y-1 hover:bg-[#f3f3f3] hover:shadow-[0_12px_28px_rgba(255,255,255,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
              >
                Start 3-day free trial
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </motion.div>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="FAQ"
          title="Answers to the questions buyers ask before they start"
          description="A short FAQ keeps the page from feeling vague and gives the product a cleaner, more complete sales story."
        />

        <div className="mx-auto mt-10 grid max-w-5xl gap-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-[24px] border border-[#ececec] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
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

      <section className="mx-auto w-full max-w-[1440px] px-6 pb-16 sm:px-8 lg:px-12">
        <div className="rounded-[36px] bg-[#111111] px-6 py-8 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Final CTA</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.15rem)] font-extrabold leading-[0.98] tracking-[-0.06em]">
                Start from one website and turn it into a content system.
              </h2>
              <p className="mt-4 max-w-xl text-[1rem] leading-7 text-white/72">
                Keep the page focused on the simple promise: paste a URL, generate the creative path, and move into the editor.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToHero}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#111111] transition hover:-translate-y-0.5 hover:bg-[#f4f4f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
            >
              Generate My First Reel
              <Rocket size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
