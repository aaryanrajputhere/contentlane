import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, VideoHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Download,
  Globe2,
  Loader2,
  Play,
  Rocket,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  type Variants,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import "@fontsource/instrument-serif/400-italic.css";
import { useAuth } from "../lib/auth";
import { ApiClientError, api, post } from "../lib/api";
import {
  clearPendingWebsite,
  getPendingWebsite,
  savePendingWebsite,
} from "../lib/onboarding.mjs";
import type { BillingStatus, ProjectResponse } from "../types/domain";
import AdditionalWebsiteUpgradeModal from "./AdditionalWebsiteUpgradeModal";

type PreviewCardProps = {
  id: string;
  src: string;
  className?: string;
  videoClassName?: string;
  mobile?: boolean;
  featured?: boolean;
  reducedMotion?: boolean | null;
  pageVisible?: boolean;
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

type LazyVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "autoPlay" | "preload" | "src"
> & {
  src: string;
  playWhenVisible: boolean;
  startOffset?: number;
};

function LazyVideo({
  src,
  playWhenVisible,
  startOffset = 0,
  onCanPlay,
  onLoadedMetadata,
  ...videoProps
}: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldLoad = useInView(videoRef, {
    once: true,
    margin: "600px 0px",
  });
  const isVisible = useInView(videoRef, { amount: 0.2 });
  const shouldPlay = shouldLoad && isVisible && playWhenVisible;

  const playIfEligible = useCallback((video: HTMLVideoElement) => {
    if (shouldPlay) void video.play().catch(() => undefined);
  }, [shouldPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [shouldPlay]);

  return (
    <video
      {...videoProps}
      ref={videoRef}
      src={shouldLoad ? src : undefined}
      autoPlay={shouldPlay}
      preload={shouldLoad ? "metadata" : "none"}
      onCanPlay={(event) => {
        onCanPlay?.(event);
        playIfEligible(event.currentTarget);
      }}
      onLoadedMetadata={(event) => {
        if (startOffset > 0 && event.currentTarget.duration > startOffset) {
          event.currentTarget.currentTime = startOffset;
        }
        onLoadedMetadata?.(event);
      }}
    />
  );
}

function posterFor(src: string) {
  const transformed = src.replace("/video/upload/", "/video/upload/so_0/");
  return transformed.replace(/\.(?:mp4|webm)$/i, ".jpg");
}

function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompact;
}

function usePreviewSequenceCopies() {
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    const update = () => {
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const cardWidth = Math.min(
        18 * rootFontSize,
        Math.max(15 * rootFontSize, window.innerWidth * 0.14),
      );
      const cardStep = cardWidth + 2 * rootFontSize;
      const sequenceWidth = previewCards.length * cardStep;
      const edgeBuffer = cardStep;
      setCopies(
        Math.max(1, Math.ceil((window.innerWidth + edgeBuffer) / sequenceWidth)),
      );
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return copies;
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

const navLinks = [
  { label: "Workflow", href: "#workflow" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const heroContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.09,
    },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: "easeOut" },
  },
};

const previewCards: PreviewCardProps[] = [
  {
    id: "street-walk",
    src: "/assets/landing/1.mp4",
    videoClassName: "object-[52%_30%]",
  },
  {
    id: "phone-reaction",
    src: "/assets/landing/2.mp4",
    videoClassName: "object-[50%_36%]",
  },
  {
    id: "sunlit-portrait",
    src: "/assets/landing/3.mp4",
    videoClassName: "object-[48%_35%]",
  },
  {
    id: "surprised-creator",
    src: "/assets/landing/4.mp4",
    videoClassName: "object-[50%_32%]",
  },
] as const;

const reelPreviews: ReelPreview[] = [
  {
    id: "curiosity",
    clip: "/assets/landing/1.mp4",
    angle: "Curiosity",
    hook: "I stopped guessing how many calories I ate.",
    crop: "object-[52%_28%]",
    delay: 0,
    startOffset: 0.4,
    accent: "#7c6cff",
  },
  {
    id: "confession",
    clip: "/assets/landing/2.mp4",
    angle: "Confession",
    hook: "I was logging my meals completely wrong.",
    crop: "object-[50%_38%]",
    delay: 6,
    startOffset: 1.8,
    accent: "#ef7b8d",
  },
  {
    id: "panic",
    clip: "/assets/landing/3.mp4",
    angle: "Pain point",
    hook: "POV: your goals reset every Monday.",
    crop: "object-[48%_42%]",
    delay: 12,
    startOffset: 2.1,
    accent: "#f3a449",
  },
  {
    id: "before-after",
    clip: "/assets/landing/4.mp4",
    angle: "Before / after",
    hook: "From meal photo to macros in seconds.",
    crop: "object-[54%_30%]",
    delay: 18,
    startOffset: 3.4,
    accent: "#5d9cff",
  },
  {
    id: "objection",
    clip: "/assets/landing/5.mp4",
    angle: "Objection",
    hook: "“Calorie tracking takes too long.”",
    crop: "object-[46%_50%]",
    delay: 24,
    startOffset: 5.2,
    accent: "#a274df",
  },
  {
    id: "speed",
    clip: "/assets/landing/6.mp4",
    angle: "Speed",
    hook: "Log this entire meal in 10 seconds.",
    crop: "object-[58%_34%]",
    delay: 30,
    startOffset: 3.5,
    accent: "#40a888",
  },
  {
    id: "pov",
    clip: "/assets/landing/7.mp4",
    angle: "POV",
    hook: "POV: your macros finally make sense.",
    crop: "object-[52%_44%]",
    delay: 36,
    startOffset: 7.1,
    accent: "#e06cae",
  },
  {
    id: "proof",
    clip: "/assets/landing/8.mp4",
    angle: "Proof",
    hook: "The app that made consistency feel easy.",
    crop: "object-[44%_30%]",
    delay: 42,
    startOffset: 4.7,
    accent: "#6385da",
  },
];

const processSteps = [
  {
    icon: Globe2,
    title: "Paste your website URL",
    description:
      "ContentLane analyzes your website to learn your brand, audience, positioning, and visual style.",
  },
  {
    icon: Sparkles,
    title: "Swipe through your hooks",
    description:
      "Review generated openings one at a time, save the strongest ideas, and skip the rest.",
  },
  {
    icon: Upload,
    title: "Upload your product demo",
    description:
      "Add the product footage that should follow each hook and choose your default demo.",
  },
  {
    icon: Download,
    title: "Render, download, and post",
    description:
      "Turn your saved hooks and demo into finished vertical Reels, download the MP4s, and post them anywhere.",
  },
] as const;

const pricingPlans = [
  {
    id: "starter",
    name: "Starter",
    price: "9.99",
    videos: 30,
    description: "A focused lane for consistent publishing.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "19.99",
    videos: 100,
    description: "More room to test, learn, and scale winners.",
  },
] as const;

const faqs = [
  {
    question: "What does ContentLane need to start?",
    answer:
      "A website URL is enough to generate the first brand profile, hook ideas, and a path into the editor.",
  },
  {
    question: "Can I edit the output before exporting?",
    answer:
      "Yes. The workflow is designed for browser-based review so you can adjust concepts before anything is published.",
  },
  {
    question: "Is this for one-off videos or ongoing campaigns?",
    answer:
      "Both. The page is framed around ongoing marketing content, but it also works for launches and seasonal promos.",
  },
  {
    question: "Do I need separate tools for scripts and visuals?",
    answer:
      "No. The landing page should communicate a single workflow from analysis through generation and export.",
  },
] as const;

function PreviewCard({
  src,
  className,
  videoClassName,
  mobile = false,
  featured = false,
  reducedMotion = false,
  pageVisible = true,
}: PreviewCardProps) {
  return (
    <motion.div
      initial={
        reducedMotion
          ? false
          : { opacity: 0, y: 24, scale: 0.96, filter: "blur(8px)" }
      }
      whileInView={
        reducedMotion
          ? undefined
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-[22px] border bg-white ${featured || mobile ? "border-[#7c6cff]/25 shadow-[0_28px_80px_rgba(124,108,255,0.2)]" : "border-[#d8d4e9] shadow-[0_18px_45px_rgba(31,25,68,0.08)]"} ${mobile ? "aspect-[9/16] h-auto w-[min(72vw,17rem)]" : `aspect-[9/16] h-auto w-[clamp(15rem,14vw,18rem)] ${className ?? ""}`}`}
    >
      <LazyVideo
        src={src}
        poster={posterFor(src)}
        className={`relative h-full w-full object-cover ${videoClassName ?? ""}`}
        muted
        playWhenVisible={pageVisible && !reducedMotion}
        loop
        playsInline
      />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/15" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]" />
    </motion.div>
  );
}

function ReelCard({
  reel,
  shouldPlay,
}: {
  reel: ReelPreview;
  shouldPlay: boolean;
}) {
  const animationStyle = {
    "--reel-delay": `${-reel.delay}s`,
    animationPlayState: shouldPlay ? "running" : "paused",
  } as CSSProperties;

  return (
    <article
      className="production-reel absolute left-0 z-[2] h-[18rem] w-[10.125rem] overflow-hidden rounded-[23px] border-[3px] border-[#191919] bg-[#191919] shadow-[0_18px_38px_rgba(0,0,0,0.2)]"
      style={animationStyle}
      aria-label={`${reel.angle} Reel: ${reel.hook}`}
    >
      <LazyVideo
        data-reel-preview={reel.id}
        src={reel.clip}
        poster={posterFor(reel.clip)}
        className={`h-full w-full object-cover ${reel.crop}`}
        muted
        playWhenVisible={shouldPlay}
        loop
        playsInline
        startOffset={reel.startOffset}
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

  return (
    <article
      ref={cardRef}
      className="reel-wall-card relative w-[10.125rem] shrink-0 overflow-hidden rounded-[24px] border border-[#ddd7f4] bg-[#17171b] shadow-[0_24px_55px_rgba(43,35,84,0.2)] sm:w-[11rem]"
      style={{ height: `${reelWallCardHeight}px` }}
      aria-label={`${reel.angle} Reel: ${reel.hook}`}
    >
      <LazyVideo
        src={reel.clip}
        poster={posterFor(reel.clip)}
        className={`h-full w-full object-cover ${reel.crop}`}
        muted
        playWhenVisible={shouldPlay}
        loop
        playsInline
        startOffset={reel.startOffset}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/15" />
    </article>
  );
}

function ReelWall({
  reducedMotion,
  pageVisible,
}: {
  reducedMotion: boolean | null;
  pageVisible: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionVisible = useInView(sectionRef, { amount: 0.12 });
  const shouldFetchCreatorReels = useInView(sectionRef, {
    once: true,
    margin: "800px 0px",
  });
  const [creatorReels, setCreatorReels] = useState<ReelPreview[] | null>(null);
  const isMobileViewport = useMobileViewport();
  const shouldPlay = sectionVisible && pageVisible && reducedMotion !== true;

  useEffect(() => {
    if (!shouldFetchCreatorReels) return;
    const controller = new AbortController();
    void api<{
      clips: Array<{
        url: string;
        title: string | null;
        tags: string[];
        creatorName: string;
      }>;
    }>("/creator-showcase", { signal: controller.signal })
      .then(({ clips }) => {
        if (clips.length === 0) return;
        setCreatorReels(
          clips.map((clip, index) => ({
            id: `creator-showcase-${index}`,
            clip: clip.url,
            hook: clip.title ?? `${clip.creatorName} creator clip`,
            angle: clip.tags[0] ?? clip.creatorName,
            crop: "object-center",
            delay: index * 6,
            startOffset: 0,
            accent: "#a99cff",
          })),
        );
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [shouldFetchCreatorReels]);

  const wallSource = creatorReels ?? reelPreviews;
  const wallCards = isMobileViewport
    ? wallSource
    : Array.from(
        { length: Math.max(16, wallSource.length) },
        (_, index) => wallSource[index % wallSource.length],
      );
  const wallGroups = isMobileViewport ? [0] : [0, 1];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="reel-wall-title"
      className="reel-wall relative isolate overflow-hidden py-20 text-[#111111] sm:py-24 lg:py-28"
    >
      <div className="pointer-events-none absolute bottom-[-13rem] left-1/2 -z-10 h-[38rem] w-[min(92vw,76rem)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.22)_0%,rgba(166,151,255,0.1)_46%,rgba(124,108,255,0)_72%)] blur-2xl" />
      <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold tracking-[0.02em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
            UGC clip library
          </div>
          <h2
            id="reel-wall-title"
            className="mx-auto mt-5 max-w-[18ch] text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.058em] text-[#111111] sm:mt-6 sm:max-w-[20ch] sm:text-[clamp(3rem,5.5vw,4.5rem)] sm:leading-[0.9] sm:tracking-[-0.065em]"
          >
            A library of UGC clips,
            <span className="block">
              ready for your <em className="landing-editorial-accent">next Reel.</em>
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-[39rem] text-[0.98rem] leading-7 text-[#686872] sm:text-[1.05rem] sm:leading-8">
            Browse creator-led footage built for hooks, product stories, and
            scroll-stopping campaigns.
          </p>
        </div>
      </div>

      <div
        className={`reel-wall-viewport relative z-10 mt-10 sm:mt-16 ${reducedMotion ? "reel-wall-reduced-motion" : ""}`}
        aria-label="Generated Reel examples"
      >
        <div className="reel-wall-track mx-auto flex w-max">
          {wallGroups.map((groupIndex) => (
            <div
              key={`reel-wall-group-${groupIndex}`}
              className="reel-wall-group flex items-center gap-4 pr-4 sm:gap-5 sm:pr-5 lg:gap-6 lg:pr-6"
            >
              {wallCards.map((reel, index) => (
                <ReelWallCard
                  key={`${groupIndex}-${reel.id}-${index}`}
                  reel={reel}
                  shouldPlay={shouldPlay}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductionLane({
  reducedMotion,
  pageVisible,
}: {
  reducedMotion: boolean | null;
  pageVisible: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionVisible = useInView(sectionRef, { amount: 0.08 });
  const isCompactViewport = useCompactViewport();
  const shouldPlayProductDemo = sectionVisible && pageVisible;
  const shouldAnimateReels =
    shouldPlayProductDemo && reducedMotion !== true && !isCompactViewport;

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="relative isolate mx-auto w-full max-w-[1440px] scroll-mt-8 overflow-hidden px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-28"
    >
      <div className="pointer-events-none absolute left-1/2 top-20 -z-10 h-[32rem] w-[min(90vw,72rem)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.12),rgba(124,108,255,0)_70%)] blur-2xl" />

      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold tracking-[0.02em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
          Your always-on content lane
        </div>
        <h2 className="mx-auto mt-5 max-w-[18ch] text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.058em] text-[#111111] sm:mt-6 sm:max-w-none sm:text-[clamp(3rem,5.5vw,4.5rem)] sm:leading-[0.9] sm:tracking-[-0.065em]">
          One website. One demo.
          <span className="block">
            <em className="landing-editorial-accent">Infinite Reels.</em>
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-[39rem] text-[0.98rem] leading-7 text-[#686872] sm:text-[1.05rem] sm:leading-8">
          ContentLane learns your brand, writes fresh hook angles, and pairs
          each one with the product footage you already have.
        </p>
      </div>

      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 24 }}
        whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="relative mx-auto mt-10 max-w-[1320px] rounded-[32px] border border-[#e5e1f3] bg-white/72 p-4 shadow-[0_28px_90px_rgba(67,54,125,0.1)] backdrop-blur-sm sm:mt-14 sm:rounded-[38px] sm:p-6 xl:p-8"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]" aria-hidden="true">
          <div className="absolute -bottom-36 right-0 h-[28rem] w-[52rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.16),rgba(124,108,255,0)_70%)]" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[18rem_6rem_17rem_minmax(0,1fr)] xl:items-center xl:gap-0">
          <div className="grid justify-items-center gap-4 sm:gap-5 xl:h-[31rem] xl:grid-rows-[auto_1fr] xl:content-between xl:justify-items-start xl:gap-7">
            <article
              className="flex w-full max-w-[11rem] items-center gap-3 rounded-[20px] border border-[#e2dff0] bg-white/95 p-3 shadow-[0_12px_30px_rgba(43,35,84,0.08)] xl:ml-6 xl:max-w-[10rem]"
              aria-label="Website URL: calai.app"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#7c6cff]">
                <Globe2 size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-[#999999]">
                  Website
                </span>
                <span className="mt-0.5 block truncate text-[0.95rem] font-semibold tracking-[-0.035em] text-[#111111]">
                  calai.app
                </span>
              </span>
            </article>

            <article className="flex aspect-[3/4] w-full max-w-[18rem] flex-col overflow-hidden rounded-[26px] border border-[#e2dff0] bg-white p-2.5 shadow-[0_18px_46px_rgba(43,35,84,0.09)] sm:min-h-[23rem] sm:max-w-[15rem] xl:h-[25rem] xl:min-h-[25rem]">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#666]">
                  Your product demo
                </span>
                <Play size={11} fill="currentColor" />
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[19px] bg-[#ececec] sm:min-h-[19rem]">
                <LazyVideo
                  className="absolute inset-0 h-full w-full object-cover object-[52%_35%]"
                  src="/assets/landing/calai.mp4"
                  poster="/assets/landing/calai.jpg"
                  muted
                  playWhenVisible={shouldPlayProductDemo}
                  loop
                  playsInline
                />
              </div>
            </article>
          </div>

          <div
            className="relative hidden h-[31rem] xl:block"
            aria-hidden="true"
          >
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 96 496"
              fill="none"
            >
              <path
                d="M-96 31 C-55 31 -18 111 96 224"
                stroke="#d8d1ff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M-48 328 C-7 304 22 258 96 224"
                stroke="#d8d1ff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="95" cy="224" r="3" fill="#8b75e8" />
            </svg>
          </div>

          <div className="relative z-20 mx-auto flex min-h-[15rem] w-full max-w-[28rem] flex-col rounded-[26px] border border-[#332c5c] bg-[#111111] p-5 text-white shadow-[0_24px_60px_rgba(50,39,105,0.22)] before:absolute before:-top-5 before:left-1/2 before:h-5 before:w-px before:bg-[#d8d1ff] xl:h-[19rem] xl:max-w-none xl:before:hidden">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  ContentLane engine
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#9b88ff] shadow-[0_0_0_4px_rgba(155,136,255,0.1)]" />
              </div>
              <p className="mt-4 text-[1.2rem] font-semibold leading-[1.08] tracking-[-0.04em]">
                One campaign.
                <br />
                New angles on repeat.
              </p>
            </div>
            <ol className="mt-5 divide-y divide-white/10 border-y border-white/10 text-[0.82rem]">
              {["Learn brand", "Write hooks", "Build Reels"].map(
                (stage, index) => (
                  <li key={stage} className="flex items-center gap-3 py-3">
                    <span className="w-5 font-mono text-[9px] text-white/40">
                      0{index + 1}
                    </span>
                    <span className="font-medium text-white/82">{stage}</span>
                    <Check
                      className="ml-auto text-[#ad9cff]"
                      size={12}
                      strokeWidth={2.25}
                    />
                  </li>
                ),
              )}
            </ol>
            <span
              className="production-output-port pointer-events-none absolute right-0 top-1/2 hidden xl:block"
              aria-hidden="true"
            />
          </div>

          <div
            className="production-reel-lane relative z-10 h-[21rem] min-w-0 overflow-hidden rounded-[26px] border border-[#ded8f5] bg-[linear-gradient(105deg,#f7f5ff_0%,#ffffff_42%,#eeeaff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:h-[22rem] sm:rounded-[28px] xl:-ml-10"
            aria-label="Sample Reels generated for calai.app"
          >
            <div
              className="production-output-trail pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden xl:block"
              aria-hidden="true"
            >
              <span className="production-output-dot" />
              <span className="production-output-dot" />
              <span className="production-output-dot" />
            </div>
            {reducedMotion || isCompactViewport ? (
              <div className="production-reel-static absolute inset-0 z-[2] flex snap-x snap-mandatory items-center gap-4 overflow-x-auto px-5 pb-4 pt-8 sm:px-8 sm:pt-10">
                {reelPreviews.map((reel) => (
                  <div
                    key={reel.id}
                    className="relative h-[18rem] w-[10.125rem] shrink-0 snap-center"
                  >
                    <ReelCard
                      reel={reel}
                      shouldPlay={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              reelPreviews.map((reel) => (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  shouldPlay={shouldAnimateReels}
                />
              ))
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export default function LandingPage() {
  const [website, setWebsite] = useState(() => getPendingWebsite() ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [upgradeWebsite, setUpgradeWebsite] = useState("");
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const isCompactViewport = useCompactViewport();
  const previewSequenceCopies = usePreviewSequenceCopies();
  const { status, user } = useAuth();
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  );

  useEffect(() => {
    const updatePageVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setBilling(null);
      return;
    }
    let active = true;
    api<BillingStatus>("/billing/status")
      .then((value) => {
        if (active) setBilling(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status]);

  const startProject = async () => {
    const value = website.trim();
    if (!value || loading) return;
    const pendingWebsite = savePendingWebsite(value);
    if (!pendingWebsite) {
      setError("Enter a valid website URL");
      return;
    }
    if (status !== "authenticated") {
      navigate("/signup", { state: { from: { pathname: "/onboarding" } } });
      return;
    }
    setLoading(true);
    setError("");
    setMessage("Starting analysis");

    try {
      const analysisResponse = await post<ProjectResponse>("/projects", {
        website: pendingWebsite,
      });
      clearPendingWebsite();
      navigate(`/projects/${analysisResponse.project.id}/hooks`);
    } catch (caught) {
      if (
        caught instanceof ApiClientError &&
        caught.code === "ADDITIONAL_PROJECT_REQUIRES_SUBSCRIPTION"
      ) {
        setUpgradeWebsite(pendingWebsite);
        setUpgradeError("");
        return;
      }
      if (
        caught instanceof ApiClientError &&
        (caught.code === "SUBSCRIPTION_REQUIRED" ||
          caught.code === "UPGRADE_REQUIRED")
      ) {
        navigate("/billing");
        return;
      }
      setError(
        caught instanceof Error ? caught.message : "Unable to start project",
      );
    } finally {
      setLoading(false);
    }
  };

  const startAdditionalWebsiteTrial = async () => {
    setUpgradeBusy(true);
    setUpgradeError("");
    navigate("/billing?plan=starter");
  };

  const dismissUpgrade = () => {
    if (upgradeBusy) return;
    setUpgradeWebsite("");
    setUpgradeError("");
  };

  const scrollToHero = () => {
    const input = document.getElementById("website");
    input?.focus();
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#fafafc] text-[#111111]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(124,108,255,0.1),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[18rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(124,108,255,0.055),transparent_68%)] blur-3xl" />
        <div className="absolute inset-x-0 top-[56rem] h-[40rem] bg-[linear-gradient(180deg,transparent,rgba(17,17,17,0.02),transparent)]" />
      </div>

      <header className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-y-3 px-5 pt-5 sm:flex sm:justify-between sm:px-8 lg:px-12">
        <div
          className="flex min-w-0 items-center gap-2.5 text-[12px] font-normal uppercase tracking-[0.3em] text-[#111111] sm:text-[13px] sm:tracking-[0.34em]"
          aria-label="ContentLane"
        >
          <span className="relative block h-4 w-4 shrink-0" aria-hidden="true">
            <span className="absolute left-[2px] top-[3px] h-[10px] w-px -rotate-[18deg] rounded-full bg-[#7c6cff]" />
            <span className="absolute right-[2px] top-[3px] h-[10px] w-px rotate-[18deg] rounded-full bg-[#7c6cff]" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c6cff] shadow-[0_0_0_3px_rgba(124,108,255,0.1)]" />
          </span>
          ContentLane
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-sm font-medium text-[#666666] md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-[#111111]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {user?.role === "ADMIN" ? (
            <button
              onClick={() => navigate("/admin")}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2.5 text-xs font-medium text-[#111111] transition hover:border-black sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm"
            >
              Admin panel
            </button>
          ) : null}
          {status === "authenticated" ? (
            <button
              onClick={() =>
                navigate(
                  billing?.hasAccess
                    ? "/projects"
                    : billing?.freeAccess.projectId
                      ? `/projects/${billing.freeAccess.projectId}/hooks`
                      : "/onboarding",
                )
              }
              className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2.5 text-xs font-medium text-[#111111] transition hover:border-black sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm"
            >
              {billing?.hasAccess ? "Dashboard" : "Continue free hooks"}
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

      <section className="relative mx-auto flex w-full max-w-[1440px] flex-col px-5 pt-10 sm:min-h-[calc(100vh-72px)] sm:px-8 sm:pt-11 lg:px-12 lg:pt-12">
        <motion.div
          variants={heroContainerVariants}
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center text-center"
        >
          <motion.div variants={heroItemVariants} className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold tracking-[0.02em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
            Stop putting off your marketing.
          </motion.div>

          <motion.h1 variants={heroItemVariants} className="mt-5 w-full max-w-[16ch] cursor-default text-[2.72rem] font-extrabold leading-[0.93] tracking-[-0.058em] text-[#111111] min-[390px]:text-[2.9rem] sm:mt-6 sm:max-w-none sm:text-[clamp(3.25rem,6.3vw,4.9rem)] sm:leading-[0.89] sm:tracking-[-0.065em]">
            <span className="block sm:whitespace-nowrap">
              Create <em className="landing-editorial-accent">30 days</em> of viral
            </span>
            <span className="block sm:whitespace-nowrap">
              content in <em className="landing-editorial-accent">30 seconds.</em>
            </span>
          </motion.h1>

          <motion.p variants={heroItemVariants} className="mt-5 max-w-[35rem] text-[0.98rem] leading-7 text-[#686872] sm:max-w-2xl sm:text-[1.05rem] sm:leading-8">
            Paste your website. ContentLane creates the first few seconds that
            stop the scroll, then combines them with your real product demo.
          </motion.p>

          <motion.div variants={heroItemVariants} className="mt-6 w-full max-w-[41rem] rounded-[24px] border border-[#e2dff0] bg-white/94 p-2 shadow-[0_16px_38px_rgba(43,35,84,0.08)] transition duration-300 focus-within:border-[#7c6cff]/55 focus-within:shadow-[0_18px_46px_rgba(124,108,255,0.14)] sm:mt-7 sm:rounded-[28px]">
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
                className="min-h-12 min-w-0 flex-1 rounded-[20px] border-0 bg-transparent px-4 py-3 text-[0.95rem] font-medium text-[#111111] outline-none placeholder:text-[#96949d] focus:ring-0 sm:rounded-[22px] sm:px-5 sm:py-4"
              />
              <button
                type="button"
                onClick={() => void startProject()}
                disabled={loading || !website.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,17,17,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#7c6cff] hover:shadow-[0_12px_28px_rgba(124,108,255,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6cff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-[#dedce5] disabled:text-[#77757f] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:bg-[#dedce5]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Wand2 size={17} />
                )}
                Generate free hooks
              </button>
            </div>
          </motion.div>

          <motion.p variants={heroItemVariants} className="mt-3.5 max-w-xl text-sm leading-6 text-[#686872]">
            Free · No card required · Ready in about 30 seconds
          </motion.p>

          {(message || error) && (
            <div
              className="mt-5 min-h-6 text-sm"
              role={error ? "alert" : "status"}
            >
              <span className={error ? "text-[#b42318]" : "text-[#666666]"}>
                {error || message}
              </span>
            </div>
          )}
        </motion.div>

        <div className="relative left-1/2 isolate mt-9 flex w-screen -translate-x-1/2 items-start justify-center overflow-hidden pb-16 pt-2 sm:mt-10 sm:pb-28 sm:pt-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-8rem] left-1/2 z-0 h-[24rem] w-[min(108vw,76rem)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.24)_0%,rgba(166,151,255,0.13)_46%,rgba(124,108,255,0)_76%)] blur-2xl sm:bottom-[-10rem] sm:h-[31rem]"
          />
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.78, delay: 0.52, ease: "easeOut" }}
            className="relative z-10 flex w-full items-start justify-center"
          >
            {isCompactViewport ? (
              <div className="flex w-full flex-col items-center gap-4">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={previewCards[activePreviewIndex].id}
                    initial={reducedMotion ? undefined : { opacity: 0, x: 18 }}
                    animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: -18 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="landing-preview-card"
                    drag={reducedMotion ? false : "x"}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.14}
                    onDragEnd={(_, info) => {
                      if (
                        Math.abs(info.offset.x) < 45 &&
                        Math.abs(info.velocity.x) < 350
                      )
                        return;
                      const direction =
                        info.offset.x < 0 || info.velocity.x < -350 ? 1 : -1;
                      setActivePreviewIndex(
                        (current) =>
                          (current + direction + previewCards.length) %
                          previewCards.length,
                      );
                    }}
                  >
                    <PreviewCard
                      {...previewCards[activePreviewIndex]}
                      mobile
                      reducedMotion={reducedMotion}
                      pageVisible={pageVisible}
                    />
                  </motion.div>
                </AnimatePresence>
                <div
                  className="flex items-center"
                  role="tablist"
                  aria-label="Preview videos"
                >
                  {previewCards.map((card, index) => (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-label={`Show preview ${index + 1}`}
                      aria-selected={activePreviewIndex === index}
                      onClick={() => setActivePreviewIndex(index)}
                      className="grid h-10 w-10 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                    >
                      <span
                        className={`h-1.5 rounded-full transition-all ${activePreviewIndex === index ? "w-6 bg-[#111111]" : "w-1.5 bg-black/20"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`landing-preview-viewport w-full ${reducedMotion ? "landing-preview-reduced-motion" : ""}`}
              >
                <div
                  className="landing-preview-track flex w-max items-start"
                  style={
                    {
                      "--landing-preview-duration": `${52 * previewSequenceCopies}s`,
                    } as CSSProperties
                  }
                >
                  {[0, 1].map((groupIndex) => (
                    <div
                      key={`landing-preview-group-${groupIndex}`}
                      className="landing-preview-group flex items-start gap-8 pr-8"
                      aria-hidden={groupIndex === 1 ? "true" : undefined}
                    >
                      {Array.from(
                        { length: previewSequenceCopies },
                        (_, sequenceIndex) =>
                          previewCards.map((card) => (
                            <div
                              key={`${groupIndex}-${sequenceIndex}-${card.id}`}
                              className="shrink-0"
                            >
                              <PreviewCard
                                {...card}
                                reducedMotion={reducedMotion}
                                pageVisible={pageVisible}
                              />
                            </div>
                          )),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <ProductionLane
        reducedMotion={reducedMotion}
        pageVisible={pageVisible}
      />

      <section
        id="features"
        className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 sm:py-28 lg:px-12 lg:py-32"
      >
        <motion.div
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 18, filter: "blur(8px)" }
          }
          whileInView={
            reducedMotion
              ? undefined
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.68, ease: "easeOut" }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
            How it works
          </div>
          <h2 className="mx-auto mt-5 max-w-[17ch] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.058em] text-[#111111] sm:mt-6 sm:max-w-none sm:text-[clamp(3rem,5.4vw,4.45rem)] sm:leading-[0.9] sm:tracking-[-0.065em]">
            <span className="block sm:whitespace-nowrap">
              From your <em className="landing-editorial-accent">website</em> to
            </span>
            <span className="block sm:whitespace-nowrap">
              ready-to-post <em className="landing-editorial-accent">Reels</em>
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-[39rem] text-[0.98rem] leading-7 text-[#686872] sm:text-[1.05rem] sm:leading-8">
            One URL and your existing product footage are all you need. Follow
            four simple steps from first idea to finished video.
          </p>
        </motion.div>

        <div className="mt-14 border-y border-[#d9d6e2] sm:mt-16">
          <div
            aria-hidden="true"
            className="h-8 border-b border-[#e4e1e9] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_47px,rgba(104,104,114,0.14)_47px,rgba(104,104,114,0.14)_48px)] sm:h-10 sm:bg-[repeating-linear-gradient(90deg,transparent_0,transparent_71px,rgba(104,104,114,0.14)_71px,rgba(104,104,114,0.14)_72px)]"
          />
          <div>
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.article
                  key={step.title}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  whileInView={reducedMotion ? undefined : { opacity: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: index * 0.035 }}
                  className="group relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-b border-[#e4e1e9] px-1 py-7 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-6 sm:px-4 sm:py-8 lg:grid-cols-[5rem_minmax(15rem,0.8fr)_minmax(24rem,1.2fr)_4rem] lg:items-center lg:gap-x-8 lg:px-6 lg:py-7"
                >
                  <div className="row-span-2 flex h-full flex-col items-center lg:row-span-1">
                    <span className="font-mono text-[0.67rem] font-semibold tracking-[0.14em] text-[#96939d]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-3 w-px flex-1 bg-[#ddd9e5] transition-colors duration-300 group-hover:bg-[#7c6cff]/45 lg:hidden"
                    />
                  </div>

                  <div className="flex min-w-0 items-center gap-3.5">
                    <Icon
                      className="shrink-0 text-[#7c6cff]"
                      size={19}
                      strokeWidth={2}
                    />
                    <h3 className="text-[1.18rem] font-bold tracking-[-0.04em] text-[#111111] sm:text-[1.25rem]">
                      {step.title}
                    </h3>
                  </div>

                  <p className="col-start-2 mt-3 max-w-[38rem] text-[0.95rem] leading-7 text-[#686872] sm:mt-3 lg:col-start-3 lg:mt-0">
                    {step.description}
                  </p>

                  <div
                    aria-hidden="true"
                    className="hidden items-center justify-end lg:flex"
                  >
                    <span className="h-px w-5 bg-[#c8c4d1] transition-all duration-300 group-hover:w-8 group-hover:bg-[#7c6cff]" />
                    <span className="h-1.5 w-1.5 rounded-full border border-[#aaa6b2] bg-[#fafafc] transition-colors duration-300 group-hover:border-[#7c6cff] group-hover:bg-[#7c6cff]" />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <ReelWall reducedMotion={reducedMotion} pageVisible={pageVisible} />

      <section
        id="pricing"
        className="relative mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 sm:py-28 lg:px-12 lg:py-32"
      >
        <motion.div
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 18, filter: "blur(8px)" }
          }
          whileInView={
            reducedMotion
              ? undefined
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.68, ease: "easeOut" }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
            Pricing
          </div>
          <h2 className="mx-auto mt-5 max-w-[15ch] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.058em] text-[#111111] sm:mt-6 sm:max-w-none sm:text-[clamp(3rem,5.4vw,4.45rem)] sm:leading-[0.9] sm:tracking-[-0.065em]">
            Choose how much you want to{" "}
            <em className="landing-editorial-accent">ship</em>
          </h2>
          <p className="mx-auto mt-5 max-w-[39rem] text-[0.98rem] leading-7 text-[#686872] sm:text-[1.05rem] sm:leading-8">
            Every plan includes unlimited hook generation. Your render capacity
            resets with each billing period.
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-[1040px] gap-5 sm:mt-16 lg:grid-cols-2 lg:gap-6">
          {pricingPlans.map((plan, planIndex) => (
            <motion.article
              key={plan.id}
              initial={
                reducedMotion ? false : { opacity: 0, y: 22, scale: 0.985 }
              }
              whileInView={
                reducedMotion
                  ? undefined
                  : { opacity: 1, y: 0, scale: 1 }
              }
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.58, delay: planIndex * 0.09 }}
              className={`group relative flex min-h-[31rem] flex-col overflow-hidden rounded-[26px] border p-6 transition-[border-color,box-shadow,transform] duration-300 sm:p-8 lg:hover:-translate-y-1 ${plan.id === "pro" ? "border-[#c9c1ff] bg-[#f4f1ff] shadow-[0_24px_65px_rgba(86,71,190,0.13)]" : "border-[#dedbe5] bg-white shadow-[0_20px_55px_rgba(17,17,17,0.055)] hover:border-[#cac6d3]"}`}
            >
              <div
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-9 border-b ${plan.id === "pro" ? "border-[#d7d1ff] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_54px,rgba(124,108,255,0.2)_54px,rgba(124,108,255,0.2)_55px)]" : "border-[#e8e5ec] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_54px,rgba(104,104,114,0.13)_54px,rgba(104,104,114,0.13)_55px)]"}`}
              />

              <div className="mt-9 flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${plan.id === "pro" ? "bg-[#7c6cff] shadow-[0_0_0_5px_rgba(124,108,255,0.1)]" : "border border-[#aaa6b2]"}`}
                    />
                    <h3 className="text-[1.55rem] font-bold tracking-[-0.05em] text-[#111111]">
                      {plan.name}
                    </h3>
                  </div>
                  <p className="mt-2 max-w-[19rem] text-sm leading-6 text-[#686872]">
                    {plan.description}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.15em] text-[#85828c]">
                  0{planIndex + 1}
                </span>
              </div>

              <div className="mt-9 flex items-end gap-2 border-b border-[#dedbe5] pb-7">
                <p className="text-[3.55rem] font-extrabold leading-[0.82] tracking-[-0.075em] text-[#111111] sm:text-[4rem]">
                  ${plan.price}
                </p>
                <p className="pb-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[#85828c]">
                  / month
                </p>
              </div>

              <div className="flex flex-1 flex-col pt-7">
                <p className="mb-4 font-mono text-[0.67rem] font-semibold uppercase tracking-[0.15em] text-[#85828c]">
                  Included in this lane
                </p>
                <ul className="grid gap-3 text-sm leading-6 text-[#34333a]">
                  <li className="flex items-start gap-3">
                    <Check
                      className="mt-1 shrink-0 text-[#7c6cff]"
                      size={15}
                    />
                    Unlimited hook generation
                  </li>
                  <li className="flex items-start gap-3">
                    <Check
                      className="mt-1 shrink-0 text-[#7c6cff]"
                      size={15}
                    />
                    {plan.videos} rendered videos per billing period
                  </li>
                  <li className="flex items-start gap-3">
                    <Check
                      className="mt-1 shrink-0 text-[#7c6cff]"
                      size={15}
                    />
                    Website analysis, editing, and exports
                  </li>
                </ul>

                <div className="mt-auto pt-8">
                  <p className="mb-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#85828c]">
                    7-day trial · cancel anytime
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        status === "authenticated"
                          ? `/billing?plan=${plan.id}`
                          : "/signup",
                        status === "authenticated"
                          ? undefined
                          : {
                              state: {
                                from: {
                                  pathname: "/billing",
                                  search: `?plan=${plan.id}`,
                                },
                              },
                            },
                      )
                    }
                    className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border px-4 py-3 text-sm font-bold transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6cff]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafc] active:scale-[0.99] ${plan.id === "pro" ? "border-[#7c6cff] bg-[#7c6cff] text-white shadow-[0_10px_24px_rgba(124,108,255,0.24)] hover:border-[#6756e8] hover:bg-[#6756e8]" : "border-[#cbc7d2] bg-[#111111] text-white hover:bg-[#29282d]"}`}
                  >
                    Choose {plan.name}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section
        id="faq"
        className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 sm:py-28 lg:px-12 lg:py-32"
      >
        <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <motion.div
            initial={
              reducedMotion
                ? false
                : { opacity: 0, y: 18, filter: "blur(8px)" }
            }
            whileInView={
              reducedMotion
                ? undefined
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="lg:pt-3"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e6f0] bg-white/88 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#686872] shadow-[0_6px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm sm:px-4 sm:text-[0.78rem]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7c6cff] shadow-[0_0_0_4px_rgba(124,108,255,0.09)]" />
              FAQ
            </div>
            <h2 className="mt-6 max-w-[10ch] text-[2.65rem] font-extrabold leading-[0.94] tracking-[-0.058em] text-[#111111] sm:text-[clamp(3rem,5vw,4.1rem)] sm:leading-[0.91] sm:tracking-[-0.065em]">
              Know before you{" "}
              <em className="landing-editorial-accent">start.</em>
            </h2>
            <p className="mt-6 max-w-[25rem] text-[0.98rem] leading-7 text-[#686872] sm:text-[1.02rem] sm:leading-8">
              Clear answers about the workflow, editing, and what you need to
              make your first campaign.
            </p>
          </motion.div>

          <div className="overflow-hidden rounded-[26px] border border-[#dedbe5] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.055)]">
            {faqs.map((faq, faqIndex) => (
              <details
                key={faq.question}
                className="group border-b border-[#e6e3ea] px-5 py-1 last:border-b-0 open:bg-[#f7f5ff] sm:px-7"
              >
                <summary className="flex min-h-[5.2rem] cursor-pointer list-none items-center gap-4 text-left text-[1rem] font-semibold tracking-[-0.025em] text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7c6cff]/35 sm:gap-6 sm:text-[1.05rem]">
                  <span className="font-mono text-[0.64rem] font-semibold tracking-[0.12em] text-[#9a97a1] group-open:text-[#7c6cff]">
                    0{faqIndex + 1}
                  </span>
                  <span className="flex-1">{faq.question}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dcd8e4] text-lg font-light leading-none text-[#686872] transition-[border-color,color,transform] duration-300 group-open:rotate-45 group-open:border-[#bdb4ff] group-open:text-[#7c6cff]">
                    +
                  </span>
                </summary>
                <p className="pb-6 pl-[2.15rem] pr-10 text-[0.95rem] leading-7 text-[#686872] sm:pl-[2.85rem] sm:pr-14 sm:text-[0.98rem]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-8 sm:pb-28 lg:px-12 lg:pb-32">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.68, ease: "easeOut" }}
          className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[28px] border border-[#cfc8ff] bg-[#eeeafe] shadow-[0_28px_75px_rgba(86,71,190,0.15)] sm:rounded-[32px]"
        >
          <div
            aria-hidden="true"
            className="h-10 border-b border-[#d6d0ff] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_63px,rgba(124,108,255,0.2)_63px,rgba(124,108,255,0.2)_64px)] sm:h-12 sm:bg-[repeating-linear-gradient(90deg,transparent_0,transparent_79px,rgba(124,108,255,0.2)_79px,rgba(124,108,255,0.2)_80px)]"
          />
          <div className="grid gap-10 px-6 py-9 sm:px-10 sm:py-11 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16 lg:px-14 lg:py-14">
            <div>
              <p className="font-mono text-[0.67rem] font-semibold uppercase tracking-[0.16em] text-[#68627d]">
                One URL → 24 hooks
              </p>
              <h2 className="mt-5 max-w-[13ch] text-[2.55rem] font-extrabold leading-[0.93] tracking-[-0.06em] text-[#111111] sm:text-[clamp(3rem,5vw,4.35rem)] sm:leading-[0.9] sm:tracking-[-0.07em]">
                Turn one website into your{" "}
                <em className="landing-editorial-accent">content system.</em>
              </h2>
              <p className="mt-5 max-w-[33rem] text-[0.98rem] leading-7 text-[#5f5b6c] sm:text-[1.02rem] sm:leading-8">
                Paste your URL, choose the strongest creative direction, and
                move straight into the editor.
              </p>
            </div>

            <div className="rounded-[20px] border border-[#cfc8f0] bg-white/70 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#dcd7ef] pb-4 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-[#777184]">
                <span>Website</span>
                <ArrowRight size={13} className="text-[#7c6cff]" />
                <span>Hooks</span>
                <ArrowRight size={13} className="text-[#7c6cff]" />
                <span>Editor</span>
              </div>
              <button
                type="button"
                onClick={scrollToHero}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-[#111111] bg-[#111111] px-6 py-3.5 text-sm font-bold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#29282d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6cff]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eeeafe] active:translate-y-0"
              >
                Generate 24 free hooks
                <Rocket size={16} />
              </button>
              <p className="mt-3 text-center text-xs text-[#777184]">
                Free · No card required
              </p>
            </div>
          </div>
        </motion.div>
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
