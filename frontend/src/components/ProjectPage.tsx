import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Loader2,
  Play,
  Upload,
  Video,
  Sparkles,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
  RotateCcw,
  LayoutDashboard,
} from 'lucide-react';
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { UserButton } from '@clerk/react';
import { api, post } from '../lib/api';
import { creatorToCharacter } from '../lib/creatorLibrary';
import { getCaptionStyle } from '../lib/captionStyle';
import { assignCreatorsToConcepts, effectiveCreatorSelection, eligibleCreators } from '../lib/creatorAssignments';
import { isFreeConversionRequired } from '../lib/onboarding.mjs';
import BrandProfileConfirmationModal from './BrandProfileConfirmationModal';
import type { BrandProfileConfirmation } from './BrandProfileConfirmationModal';
import { requiresBrandProfileConfirmation } from '../lib/brand-profile-confirmation.mjs';
import type { BillingStatus, ConceptCard, CreatorClipRecord, GenerationLanguage, ProjectSnapshot, CreatorRecord, ProjectResponse } from '../types/domain';

const AI_STEPS = [
  'Reading homepage...',
  'Understanding audience',
  'Finding competitors',
  'Detecting strongest pain point',
  'Choosing creator',
  'Building your brand profile'
];

const HOOK_SELECTION_TARGET = 8;
const HOOK_PREFETCH_SELECTION_THRESHOLD = 5;
const HOOK_PREFETCH_REMAINING_THRESHOLD = 3;
const MAX_HOOKS_PER_PROJECT = 96;
const GENERATION_LANGUAGES: GenerationLanguage[] = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi', 'Arabic', 'Japanese', 'Korean'];

type HookRetryFailure = {
  phase: 'feedback' | 'generation';
  message: string;
};

function LanguageSelector({
  value,
  onChange,
  saving,
  message,
  dark = false,
}: {
  value: GenerationLanguage;
  onChange: (language: GenerationLanguage) => void;
  saving: boolean;
  message: string;
  dark?: boolean;
}) {
  return (
    <div className={`rounded-[22px] border p-4 ${dark ? 'border-white/15 bg-white/10' : 'border-black/8 bg-white'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-[#b8f36b]' : 'text-[#15803d]'}`}>Content language</p>
          <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-[#666]'}`}>Future hooks and demo overlays will use this language.</p>
        </div>
        <label className="sr-only" htmlFor="generation-language">Content language</label>
        <select
          id="generation-language"
          value={value}
          onChange={(event) => onChange(event.target.value as GenerationLanguage)}
          disabled={saving}
          className={`rounded-full border px-4 py-2.5 text-sm font-bold outline-none transition focus:ring-2 ${dark ? 'border-white/20 bg-[#222] text-white focus:border-white focus:ring-white/20' : 'border-black/10 bg-[#fafaf8] text-[#222] focus:border-black focus:ring-black/10'}`}
        >
          {GENERATION_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
        </select>
      </div>
      <p className={`mt-2 min-h-5 text-xs font-semibold ${message.startsWith('Unable') ? 'text-red-400' : dark ? 'text-white/60' : 'text-[#4b8125]'}`} role="status" aria-live="polite">
        {saving ? 'Saving language…' : message}
      </p>
    </div>
  );
}

function GenerationExperience() {
  const [currentStep, setCurrentStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    document.body.classList.add('project-generation-active');

    return () => {
      document.body.classList.remove('project-generation-active');
    };
  }, []);

  useEffect(() => {
    if (currentStep >= AI_STEPS.length - 1) return;

    const timer = setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, 1800);

    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-6">
      <div
        className="relative h-[21rem] w-full max-w-2xl overflow-hidden sm:h-[24rem]"
        aria-live="polite"
        aria-label="Website analysis progress"
      >
        {AI_STEPS.map((step, index) => {
          const isPast = index < currentStep;
          const isCurrent = index === currentStep;
          const distanceFromCurrent = Math.abs(index - currentStep);
          const rowOffset = (index - currentStep) * (prefersReducedMotion ? 3.5 : 4.25);
          const opacity = isCurrent ? 1 : Math.max(0.2, 0.62 - (distanceFromCurrent - 1) * 0.14);
          const blur = isCurrent ? 0 : Math.min(2.5, distanceFromCurrent * 0.9);
          const scale = isCurrent ? 1 : Math.max(0.94, 1 - distanceFromCurrent * 0.025);

          return (
            <motion.div
              key={step}
              initial={false}
              animate={{
                opacity,
                scale,
                y: rowOffset * 16,
                filter: `blur(${blur}px)`,
              }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`absolute left-0 right-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-4 text-center text-[1.05rem] sm:text-lg ${isCurrent ? 'font-semibold text-[#111111]' : 'font-normal text-[#8c8c8c]'}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center" aria-hidden="true">
                {isPast ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-white">
                    <Check size={14} />
                  </span>
                ) : (
                  <Loader2 size={17} className={isCurrent ? 'animate-spin text-[#111111]' : 'text-[#8c8c8c]'} />
                )}
              </span>
              <span>{step}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ReelPreviewCard({
  concept,
  creator,
  clip,
  selected,
  onToggle,
  compact = false,
}: {
  concept: ConceptCard;
  creator: CreatorRecord | undefined;
  clip: CreatorClipRecord | null;
  selected: boolean;
  onToggle?: () => void;
  compact?: boolean;
}) {
  const captionStyle = getCaptionStyle(concept.sortOrder);
  const usesSnapchatCaptions = captionStyle === 'SNAPCHAT';
  const fallbackBackgrounds = [
    'from-[#171717] via-[#344c42] to-[#9b765e]',
    'from-[#17171f] via-[#4c3f63] to-[#c09278]',
    'from-[#101820] via-[#29475b] to-[#7b9ca5]',
    'from-[#231814] via-[#684839] to-[#bd8b62]',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      aria-pressed={onToggle ? selected : undefined}
      aria-label={onToggle ? `${selected ? 'Deselect' : 'Select'} hook: ${concept.hookText}` : concept.hookText}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (onToggle && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onToggle();
        }
      }}
      className={`relative group aspect-[9/16] overflow-hidden ${compact ? 'rounded-[22px]' : 'rounded-[28px]'} border bg-white shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-4 ${selected ? 'border-[#111111] ring-4 ring-[#111111]/10' : 'border-black/5'}`}
    >
      {clip ? (
        <video
          src={clip.url}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${fallbackBackgrounds[concept.sortOrder % fallbackBackgrounds.length]}`}>
          <div className="absolute -right-10 top-[18%] h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-12 bottom-[12%] h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <Sparkles className="absolute left-1/2 top-[28%] -translate-x-1/2 text-white/25" size={compact ? 32 : 46} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      <div className={`absolute flex items-start justify-between ${compact ? 'left-3 right-3 top-3 gap-1.5' : 'left-5 right-5 top-5'}`}>
        <div className={`flex items-center bg-black/40 text-white font-semibold shadow-sm backdrop-blur-md ${compact ? 'gap-1.5 rounded-full px-2 py-1 text-[10px]' : 'gap-2 rounded-full px-3 py-1.5 text-xs'}`}>
          {creator?.baseImageUrl ? (
            <img src={creator.baseImageUrl} alt="" className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} rounded-full object-cover`} />
          ) : (
            <div className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} rounded-full bg-white/20`} />
          )}
          {creator?.name || 'Creator'}
        </div>
        <div className={`flex shrink-0 items-center bg-[#dcfce7] font-bold text-[#15803d] shadow-sm ${compact ? 'gap-1 rounded-full px-2 py-1 text-[10px]' : 'gap-1.5 rounded-full px-3 py-1.5 text-xs'}`}>
          <Sparkles size={compact ? 10 : 12} />
          {concept.score} Score
        </div>
      </div>

      {!compact ? <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 hover:bg-white/30 transition">
          <Play size={28} className="ml-1" fill="currentColor" />
        </button>
      </div> : null}

      <div className={`absolute top-1/2 -translate-y-1/2 text-center ${usesSnapchatCaptions ? `left-0 right-0 bg-black/60 ${compact ? 'px-3 py-1.5' : 'px-5 py-1.5'}` : compact ? 'left-3 right-3' : 'left-6 right-6'}`}>
        <p className={`text-white ${usesSnapchatCaptions ? `${compact ? 'text-[0.7rem]' : 'text-[0.875rem]'} font-medium leading-[1.25]` : `${compact ? 'text-[0.78rem] sm:text-sm' : 'text-base'} font-extrabold leading-[1.12] [paint-order:stroke_fill] [-webkit-text-stroke:2px_rgba(0,0,0,0.92)] drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]`}`}>
          {concept.hookText}
        </p>
      </div>
    </motion.div>
  );
}

function SwipeReview({
  assignments,
  onDecision,
}: {
  assignments: Array<{ concept: ConceptCard; creator: CreatorRecord | undefined; clip: CreatorClipRecord | null }>;
  onDecision: (conceptId: string, decision: 'LIKED' | 'REJECTED') => Promise<boolean>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const current = assignments[0];
  const dragX = useMotionValue(0);
  const controls = useAnimationControls();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionLock = useRef(false);
  const rotate = useTransform(dragX, [-180, 0, 180], [-8, 0, 8]);
  const keepOpacity = useTransform(dragX, [20, 120], [0, 1]);
  const rejectOpacity = useTransform(dragX, [-120, -20], [1, 0]);
  const keepTint = useTransform(dragX, [0, 140], [0, 0.28]);
  const rejectTint = useTransform(dragX, [-140, 0], [0.28, 0]);

  useEffect(() => {
    dragX.set(0);
    controls.set({ x: 0, opacity: 1, scale: 1, y: 0 });
    transitionLock.current = false;
    setIsTransitioning(false);
  }, [controls, current?.concept.id, dragX]);

  const decide = useCallback(async (decision: 'LIKED' | 'REJECTED') => {
    if (!current || transitionLock.current) return;
    transitionLock.current = true;
    setIsTransitioning(true);
    if (!prefersReducedMotion) {
      await controls.start({
        x: decision === 'LIKED' ? window.innerWidth : -window.innerWidth,
        opacity: 0,
        rotate: decision === 'LIKED' ? 12 : -12,
        transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
      });
    }
    const saved = await onDecision(current.concept.id, decision);
    if (!saved) {
      controls.set({ x: 0, opacity: 1, scale: 1, y: 0, rotate: 0 });
      dragX.set(0);
      transitionLock.current = false;
      setIsTransitioning(false);
    }
  }, [controls, current, dragX, onDecision, prefersReducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      void decide(event.key === 'ArrowRight' ? 'LIKED' : 'REJECTED');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decide]);

  if (!current) return null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-[0.16em]" aria-hidden="true">
        <span className="text-[#b91c1c]">← Swipe to reject</span>
        <span className="text-[#15803d]">Swipe to keep →</span>
      </div>
      <div
        className="relative mx-auto aspect-[9/16] w-full max-w-[360px]"
        style={{ width: 'min(360px, calc((100dvh - 15rem) * 9 / 16), calc(100vw - 2rem))' }}
      >
        <div className="absolute inset-3 translate-y-5 scale-[.94] rounded-[30px] bg-[#e8e4dc]" aria-hidden="true" />
        <motion.div
          key={current.concept.id}
          animate={controls}
          style={{ x: dragX, rotate }}
          drag={isTransitioning ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragEnd={(_, info) => {
            const distance = info.offset.x;
            if (Math.abs(distance) >= 100 || Math.abs(info.velocity.x) >= 600) {
              void decide(distance >= 0 ? 'LIKED' : 'REJECTED');
            }
          }}
          initial={false}
          className={`relative z-10 h-full w-full ${isTransitioning ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          whileTap={prefersReducedMotion ? undefined : { scale: 1.015 }}
        >
          <ReelPreviewCard concept={current.concept} creator={current.creator} clip={current.clip} selected={false} onToggle={() => undefined} />
          <motion.div style={{ opacity: keepTint }} className="pointer-events-none absolute inset-0 rounded-[28px] bg-[#22c55e]" />
          <motion.div style={{ opacity: rejectTint }} className="pointer-events-none absolute inset-0 rounded-[28px] bg-[#ef4444]" />
          <motion.div style={{ opacity: keepOpacity }} className="pointer-events-none absolute left-5 top-5 -rotate-6 rounded-lg border-2 border-white bg-[#166534] px-4 py-2 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-lg">Keep</motion.div>
          <motion.div style={{ opacity: rejectOpacity }} className="pointer-events-none absolute right-5 top-5 rotate-6 rounded-lg border-2 border-white bg-[#991b1b] px-4 py-2 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-lg">Reject</motion.div>
        </motion.div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
        <button type="button" onClick={() => void decide('REJECTED')} disabled={isTransitioning} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-[#fecaca] bg-white px-6 py-3.5 text-sm font-bold text-[#b91c1c] shadow-[0_10px_30px_rgba(185,28,28,0.1)] transition hover:-translate-y-0.5 hover:bg-[#fef2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c]/30 disabled:pointer-events-none disabled:opacity-50">
          <span aria-hidden="true">←</span>
          <ThumbsDown size={22} />
          Reject
        </button>
        <button type="button" onClick={() => void decide('LIKED')} disabled={isTransitioning} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full border border-[#bbf7d0] bg-white px-6 py-3.5 text-sm font-bold text-[#15803d] shadow-[0_10px_30px_rgba(21,128,61,0.1)] transition hover:-translate-y-0.5 hover:bg-[#f0fdf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803d]/30 disabled:pointer-events-none disabled:opacity-50">
          <ThumbsUp size={22} />
          Keep <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-[#8c8c8c]">Drag the card or use your arrow keys</p>
    </div>
  );
}

export default function ProjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brandConfirmationError, setBrandConfirmationError] = useState('');
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [creatorLibraryLoading, setCreatorLibraryLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [regenerationMessage, setRegenerationMessage] = useState('');
  const [languageMessage, setLanguageMessage] = useState('');
  const [hookRetryFailure, setHookRetryFailure] = useState<HookRetryFailure | null>(null);
  const [acceptedHookOrder, setAcceptedHookOrder] = useState<string[]>([]);
  const [isUploadSectionVisible, setIsUploadSectionVisible] = useState(false);
  const automaticGenerationAttempt = useRef<string | null>(null);
  const automaticCreatorSelectionAttempt = useRef<string | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const isFreeFlow = Boolean(billing && !billing.hasAccess && billing.freeAccess.projectId === id);
  const hookCap = isFreeFlow ? 24 : MAX_HOOKS_PER_PROJECT;

  const load = useCallback(async () => {
    const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}`);
    setProject(response.project);
    const latestAnalysis = response.project.jobs.find((job) => job.type === 'ANALYZE_WEBSITE');
    if (latestAnalysis?.status === 'FAILED') {
      setError(latestAnalysis.errorMessage ?? 'Website analysis failed. Please try again.');
    } else if (latestAnalysis?.status === 'ACTIVE' || latestAnalysis?.status === 'QUEUED') {
      setError((current) => current.startsWith('Website analysis failed') ? '' : current);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([load(), api<BillingStatus>('/billing/status').then(setBilling)])
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load project'))
      .finally(() => setLoading(false));
  }, [load]);

  // Poll project state while jobs are running
  useEffect(() => {
    if (!project) return;
    const hasPendingJobs = project.jobs.some(j => ['QUEUED', 'ACTIVE'].includes(j.status));
    if (!hasPendingJobs) return;

    const interval = setInterval(() => {
      void load();
    }, 2000);
    return () => clearInterval(interval);
  }, [project, load]);

  useEffect(() => {
    let active = true;
    void api<{ creators: CreatorRecord[] }>('/creators')
      .then((response) => {
        if (active) {
          setCreatorLibrary(response.creators.map((c) => ({ ...c, character: creatorToCharacter(c) })));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCreatorLibraryLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const uploadSection = uploadSectionRef.current;
    if (!uploadSection) {
      setIsUploadSectionVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsUploadSectionVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(uploadSection);
    return () => observer.disconnect();
  }, [project]);

  useEffect(() => {
    if (!billing?.hasAccess || searchParams.get('unlocked') !== '1') return;
    if (project?.concepts.filter((concept) => concept.reviewDecision === 'LIKED').length !== HOOK_SELECTION_TARGET) return;
    const frame = window.requestAnimationFrame(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      navigate(`/projects/${id}/hooks`, { replace: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [billing?.hasAccess, id, navigate, prefersReducedMotion, project, searchParams]);

  const generateHooks = useCallback(async (forceRegenerate: boolean, append = false) => {
    if (busy) return;
    const hasDependentWork = Boolean(
      project?.exportState
      || project?.mediaAssets.some((asset) => asset.metadata?.kind !== 'brand-demo')
      || project?.concepts.some((concept) => concept.generatedImageUrl || concept.generatedVideoUrl),
    );
    if (forceRegenerate && hasDependentWork && !window.confirm('Regenerating will remove hook media and export settings. Your website analysis, creator, and product demo will stay. Continue?')) {
      return;
    }
    setBusy('Generating hooks');
    setError('');
    setRegenerationMessage('');
    setHookRetryFailure(null);
    try {
      let response: ProjectResponse;
      try {
        response = await post<ProjectResponse>(`/projects/${id}/concepts`, {
          count: 8,
          forceRegenerate,
          useHookPreferences: true,
          append,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Invalid generation request';
        setHookRetryFailure({ phase: 'generation', message });
        return;
      }
      setProject(response.project);
      setHookRetryFailure(null);
      setRegenerationMessage(
        append && !response.cached
          ? `8 more hooks generated.`
          : '',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate similar hooks');
    } finally {
      setBusy(null);
    }
  }, [busy, id, project]);

  const decideHook = useCallback(async (conceptId: string, decision: 'LIKED' | 'REJECTED') => {
    setHookRetryFailure(null);
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/concepts/${conceptId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      setProject(response.project);
      if (decision === 'LIKED') {
        setAcceptedHookOrder((current) => [conceptId, ...current.filter((id) => id !== conceptId)]);
      }
      return true;
    } catch (caught) {
      setHookRetryFailure({ phase: 'feedback', message: caught instanceof Error ? caught.message : 'The decision could not be saved. Try again.' });
      return false;
    }
  }, [id]);

  const retryAnalysis = useCallback(async () => {
    if (busy) return;
    setBusy('Analyzing website');
    setError('');
    try {
      const response = await post<ProjectResponse>(`/projects/${id}/analyze`, { forceRegenerate: false });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to analyze website');
    } finally {
      setBusy(null);
    }
  }, [busy, id]);

  const confirmBrandProfile = useCallback(async (profile: BrandProfileConfirmation, language: GenerationLanguage) => {
    if (busy) return;
    setBusy('Confirming brand');
    setBrandConfirmationError('');
    try {
      await api<{ project: ProjectSnapshot }>(`/projects/${id}/language`, {
        method: 'PATCH',
        body: JSON.stringify({ language }),
      });
      const response = await post<ProjectResponse>(`/projects/${id}/brand-profile/confirm`, profile);
      setProject(response.project);
      automaticGenerationAttempt.current = null;
    } catch (caught) {
      setBrandConfirmationError(caught instanceof Error ? caught.message : 'Unable to save the brand profile');
    } finally {
      setBusy(null);
    }
  }, [busy, id]);

  useEffect(() => {
    if (
      !project?.brandProfile
      || !project.brandProfileConfirmedAt
      || project.concepts.length > 0
      || busy
      || project.jobs.some((job) => job.type === 'GENERATE_CONCEPTS' && ['QUEUED', 'ACTIVE'].includes(job.status))
      || automaticGenerationAttempt.current === project.id
    ) {
      return;
    }

    automaticGenerationAttempt.current = project.id;
    void generateHooks(false);
  }, [busy, generateHooks, project]);

  useEffect(() => {
    if (!project || busy) return;
    const likedCount = project.concepts.filter((concept) => concept.reviewDecision === 'LIKED').length;
    const unreviewedCount = project.concepts.filter((concept) => concept.reviewDecision === null).length;
    const attemptKey = `${project.id}:${project.concepts.length}`;
    const shouldAppendHooks = likedCount < HOOK_SELECTION_TARGET
      && project.concepts.length < hookCap
      && (
        unreviewedCount === 0
        || (likedCount >= HOOK_PREFETCH_SELECTION_THRESHOLD && unreviewedCount <= HOOK_PREFETCH_REMAINING_THRESHOLD)
      );
    if (shouldAppendHooks && automaticGenerationAttempt.current !== attemptKey) {
      automaticGenerationAttempt.current = attemptKey;
      void generateHooks(false, true);
    }
  }, [busy, generateHooks, hookCap, project]);

  // New campaigns start with a mixed roster whenever at least two creators have clips.
  useEffect(() => {
    const availableCreators = eligibleCreators(creatorLibrary);
    if (
      project
      && !isFreeFlow
      && !project.creatorSelection
      && !project.selectedCharacter
      && availableCreators.length > 0
      && !busy
      && automaticCreatorSelectionAttempt.current !== project.id
    ) {
      automaticCreatorSelectionAttempt.current = project.id;
      const selection = availableCreators.length >= 2
        ? { mode: 'mix' as const }
        : { mode: 'single' as const, creatorId: availableCreators[0].id };
      api<{ project: ProjectSnapshot }>(`/projects/${id}/character`, {
        method: 'PATCH',
        body: JSON.stringify({ selection }),
      }).then((response) => setProject(response.project)).catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Unable to choose creators');
      });
    }
  }, [project, creatorLibrary, busy, id, isFreeFlow]);

  const selectCreators = async (selection: { mode: 'mix' } | { mode: 'single'; creatorId: string }) => {
    if (!project || busy) return;
    const hasDependentWork = Boolean(
      project.exportState
      || project.mediaAssets.some((asset) => asset.metadata?.kind !== 'brand-demo')
      || project.concepts.some((concept) => concept.generatedImageUrl || concept.generatedVideoUrl),
    );
    if (hasDependentWork && !window.confirm('Changing creators will remove generated hook media and export settings. Your hooks and product demo will stay. Continue?')) {
      return;
    }
    setBusy('Selecting creators');
    setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/character`, {
        method: 'PATCH',
        body: JSON.stringify({ selection }),
      });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to change creators');
    } finally {
      setBusy(null);
    }
  };

  const uploadBrandDemo = async (file: File | undefined | null) => {
    if (!project || !file) return;
    setBusy('Uploading demo');
    try {
      const formData = new FormData();
      formData.append('demo', file);
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/brand-demo`, {
        method: 'POST',
        body: formData,
      });
      setProject(response.project);
      navigate(`/projects/${id}/render`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload brand demo');
    } finally {
      setBusy(null);
    }
  };

  const saveGenerationLanguage = async (language: GenerationLanguage) => {
    if (!project || busy) return;
    setBusy('Saving language');
    setLanguageMessage('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/language`, {
        method: 'PATCH',
        body: JSON.stringify({ language }),
      });
      setProject(response.project);
      setLanguageMessage('Language saved.');
    } catch (caught) {
      setLanguageMessage(caught instanceof Error ? `Unable to save language: ${caught.message}` : 'Unable to save language.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !project) {
    return <div className="grid min-h-screen place-items-center bg-[#fafaf8] text-[#111111]">Loading...</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#fafaf8] p-8 text-[#111111]">{error || 'Project not found.'}</div>;
  }

  const isGeneratingHooks = busy === 'Generating hooks' || project.jobs.some(j => j.type === 'GENERATE_CONCEPTS' && ['QUEUED', 'ACTIVE'].includes(j.status));

  if (requiresBrandProfileConfirmation(project)) {
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
        <header className="relative z-[80] border-b border-black/5 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
            <p className="text-[13px] font-normal uppercase tracking-[0.34em]">ContentLane</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition hover:bg-[#f3f3f3]"><ArrowLeft size={16} /> Back</button>
              <UserButton />
            </div>
          </div>
        </header>
        <BrandProfileConfirmationModal profile={project.brandProfile!} language={project.hookPreferences?.language ?? 'English'} busy={busy === 'Confirming brand'} error={brandConfirmationError} onConfirm={confirmBrandProfile} />
      </main>
    );
  }

  if (!project.concepts.length) {
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111] flex flex-col">
        {error ? (
          <header className="mx-auto flex w-full max-w-[1400px] items-center justify-end px-6 pt-5 sm:px-8 lg:px-12">
            <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-[#f3f3f3]">
              <ArrowLeft size={16} /> Back
            </button>
          </header>
        ) : null}
        {error ? (
          <div className="grid flex-1 place-items-center px-6 py-16">
            <div className="w-full max-w-lg rounded-[28px] border border-black/8 bg-white p-8 text-center shadow-[0_24px_70px_rgba(36,29,77,0.08)]">
              <h1 className="text-3xl font-extrabold tracking-[-0.04em]">We couldn’t generate your hooks.</h1>
              <p role="alert" className="mt-4 text-sm leading-6 text-[#686868]">{error}</p>
              <button type="button" onClick={() => void retryAnalysis()} disabled={busy !== null} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-3.5 text-sm font-bold text-white disabled:opacity-50">
                <Sparkles size={16} /> {busy === 'Analyzing website' ? 'Analyzing…' : 'Try again'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <GenerationExperience />
          </div>
        )}
      </main>
    );
  }

  const availableCreators = eligibleCreators(creatorLibrary);
  const creatorSelection = effectiveCreatorSelection(project, creatorLibrary);
  const likedConcepts = project.concepts
    .filter((concept) => concept.reviewDecision === 'LIKED')
    .sort((a, b) => {
      const aIndex = acceptedHookOrder.indexOf(a.id);
      const bIndex = acceptedHookOrder.indexOf(b.id);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.sortOrder - b.sortOrder;
    })
    .slice(0, 8);
  const unreviewedConcepts = project.concepts.filter((concept) => concept.reviewDecision === null);
  const displayConcepts = likedConcepts;
  const brandDemoAsset = project.mediaAssets.find(
    (asset) => asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo',
  );
  const creatorAssignments = assignCreatorsToConcepts(displayConcepts, creatorLibrary, creatorSelection);
  // Match the full accumulated pool before choosing the visible card. Matching
  // only the current card resets clip de-duplication after every swipe and
  // repeatedly selects the same highest-scoring UGC clip.
  const assignmentByConceptId = new Map(
    assignCreatorsToConcepts(project.concepts, creatorLibrary, creatorSelection)
      .map((assignment) => [assignment.concept.id, assignment]),
  );
  const nextUnreviewedAssignment = unreviewedConcepts.length > 0
    ? assignmentByConceptId.get(unreviewedConcepts[0].id)
    : undefined;
  const reviewAssignments = nextUnreviewedAssignment ? [nextUnreviewedAssignment] : [];
  const reviewComplete = likedConcepts.length === HOOK_SELECTION_TARGET;
  const reviewedCount = project.concepts.length - unreviewedConcepts.length;
  const hookLimitReached = project.concepts.length >= hookCap;
  const reviewedAllFreeHooks = hookLimitReached && reviewedCount >= project.concepts.length;
  const freeConversionRequired = isFreeConversionRequired({
    isFreeFlow,
    ended: billing?.freeAccess.ended ?? false,
    selected: likedConcepts.length,
    generated: project.concepts.length,
    reviewed: reviewedCount,
    limit: hookCap,
  });
  const resetReviews = async () => {
    const hasDependentWork = Boolean(project.exportState || project.mediaAssets.some((asset) => asset.metadata?.kind !== 'brand-demo') || project.concepts.some((concept) => concept.generatedImageUrl || concept.generatedVideoUrl));
    if (hasDependentWork && !window.confirm('Reviewing again will remove generated hook media and render settings. Your analysis, creators, product demo, and generated hooks will stay. Continue?')) return;
    setBusy('Resetting review');
    setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/concepts/review/reset`, { method: 'PATCH', body: JSON.stringify({ clearDependentOutputs: hasDependentWork }) });
      setProject(response.project);
      setAcceptedHookOrder([]);
      automaticGenerationAttempt.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to restart review');
    } finally {
      setBusy(null);
    }
  };
  const startTrial = async () => {
    setBusy('Starting trial');
    setError('');
    navigate(`/billing?plan=starter&projectId=${encodeURIComponent(id)}`);
  };

  if (freeConversionRequired) {
    const conversionHeadline = reviewComplete
      ? 'Your 8 hooks are ready to become Reels.'
      : reviewedAllFreeHooks
        ? 'You’ve reviewed all 24 free hooks.'
        : 'Unlock your saved hooks and keep creating.';
    const conversionAssignments = likedConcepts.map((concept) => (
      assignmentByConceptId.get(concept.id) ?? { concept, creator: undefined, clip: null }
    ));
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
        <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8">
            <p className="text-[13px] uppercase tracking-[0.34em]">ContentLane</p>
            <div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"><ArrowLeft size={16} /> Back</button><UserButton /></div>
          </div>
        </header>
        <section className="mx-auto grid w-full max-w-[1480px] items-start gap-10 px-5 py-10 sm:px-8 sm:py-14 xl:grid-cols-[minmax(320px,0.68fr)_minmax(0,1.55fr)] xl:gap-14 xl:py-16">
          <div className="xl:sticky xl:top-32">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803d]">Your Reel lineup is ready</p>
            <h1 className="mt-4 max-w-xl text-[clamp(2.7rem,5vw,4.8rem)] font-extrabold leading-[0.94] tracking-[-0.065em]">
              {conversionHeadline}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#666666]">Your hooks are already paired with creator footage. Choose a plan, add one product demo, and turn this lineup into finished Reels.</p>
            <ul className="mt-7 grid max-w-lg gap-3 text-sm font-semibold text-[#333333] sm:grid-cols-3 xl:grid-cols-1">
              {['Upload your product demo', `Render ${Math.max(likedConcepts.length, 1)} ready-to-post Reels`, 'Generate more winning hooks'].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#dcfce7] text-[#15803d]"><Check size={14} strokeWidth={3} /></span>{benefit}</li>
              ))}
            </ul>
            {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
            <div className="mt-6">
              <LanguageSelector
                value={project.hookPreferences?.language ?? 'English'}
                onChange={(language) => void saveGenerationLanguage(language)}
                saving={busy === 'Saving language'}
                message={languageMessage}
              />
            </div>
            <button type="button" onClick={() => void startTrial()} disabled={busy !== null} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-7 py-4 text-sm font-bold text-white shadow-[0_16px_35px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(0,0,0,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-4 disabled:opacity-50 sm:w-auto">
              {busy === 'Starting trial' ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={18} />}
              Choose a plan
            </button>
            <p className="mt-3 text-xs leading-5 text-[#777777]">Continue with these exact hooks—your selections and progress stay saved.</p>
          </div>
          <div className="rounded-[32px] border border-black/10 bg-white p-4 shadow-[0_28px_90px_rgba(36,29,77,0.1)] sm:p-5">
            <div className="flex items-end justify-between gap-4 px-1 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c8c8c]">Your saved hooks</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.035em]">Preview the Reels you’ll unlock</h2>
              </div>
              {likedConcepts.length > 0 ? <span className="shrink-0 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-bold text-[#15803d]">{likedConcepts.length} selected</span> : null}
            </div>
            {conversionAssignments.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Saved hook Reel previews">
                {conversionAssignments.map((assignment) => (
                  <ReelPreviewCard
                    key={assignment.concept.id}
                    concept={assignment.concept}
                    creator={assignment.creator}
                    clip={assignment.clip}
                    selected={false}
                    compact
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] bg-[#f7f6f2] px-5 py-10 text-center text-sm leading-6 text-[#666666]">Your review decisions are saved. Start the trial to generate a fresh Reel lineup.</div>
            )}
          </div>
        </section>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
          <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition hover:bg-[#f3f3f3]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          {!isFreeFlow ? <button
            onClick={() => navigate(`/projects/${id}/dashboard`)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition hover:bg-[#f3f3f3]"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button> : <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[#15803d]">Free hooks</span><UserButton /></div>}
        </div>
      </header>

      <section className={`mx-auto w-full max-w-[1200px] px-4 sm:px-8 lg:px-12 ${reviewComplete ? 'pb-24 pt-10 sm:pt-12' : 'flex min-h-[calc(100dvh-79px)] flex-col py-4 sm:py-5'}`}>
        {reviewComplete && (
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.045em] text-[#111111]">
            Your hooks are ready.
          </h1>
          {hookRetryFailure && reviewComplete && (
            <button
              type="button"
              onClick={() => void generateHooks(true)}
              disabled={isGeneratingHooks}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold text-[#111111] transition hover:border-black/20 hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 sm:self-auto"
            >
              {isGeneratingHooks ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGeneratingHooks ? 'Generating…' : 'Retry similar hooks'}
            </button>
          )}
        </div>
        )}
        {(regenerationMessage || hookRetryFailure || error) && (
          <div className={reviewComplete ? 'mb-8' : 'mb-3 text-center'}>
          {regenerationMessage && (
            <p role="status" className="inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-semibold text-[#15803d]">
              <Check size={15} /> {regenerationMessage}
            </p>
          )}
          {hookRetryFailure && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {hookRetryFailure.phase === 'feedback'
                ? `Review complete. Feedback is pending: ${hookRetryFailure.message}`
                : `Feedback saved, but similar hook generation failed: ${hookRetryFailure.message}`}
            </p>
          )}
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {reviewComplete ? (
        <div className="mb-8 rounded-[20px] border border-black/8 bg-white p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.035)] sm:flex sm:items-center sm:gap-3 sm:p-3">
          <div className="mb-2 px-2 sm:mb-0 sm:min-w-28">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8c8c8c]">Creators</p>
            <p className="mt-1 text-sm font-semibold text-[#111111]">Choose the cast</p>
          </div>
          {creatorLibraryLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-[#666]">
              <Loader2 size={16} className="animate-spin" />
              Loading creators…
            </div>
          ) : availableCreators.length > 0 ? (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Choose creators for this campaign">
              <button
                type="button"
                onClick={() => void selectCreators({ mode: 'mix' })}
                disabled={availableCreators.length < 2 || busy === 'Selecting creators'}
                aria-pressed={creatorSelection?.mode === 'mix'}
                title={availableCreators.length < 2 ? 'Add clips to another creator to use Mix' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${creatorSelection?.mode === 'mix' ? 'border-black bg-black text-white' : 'border-black/10 bg-[#fafaf8] text-[#444] hover:border-black/25'}`}
              >
                <span className="flex -space-x-2" aria-hidden="true">
                  {availableCreators.slice(0, 3).map((creator) => (
                    <img key={creator.id} src={creator.baseImageUrl} alt="" className="h-7 w-7 rounded-full border-2 border-current object-cover" />
                  ))}
                </span>
                <Shuffle size={14} />
                Mix
              </button>
              {availableCreators.map((creator) => {
                const selected = creatorSelection?.mode === 'single' && creatorSelection.characters[0]?.id === creator.id;
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => void selectCreators({ mode: 'single', creatorId: creator.id })}
                    disabled={busy === 'Selecting creators'}
                    aria-pressed={selected}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${selected ? 'border-black bg-black text-white' : 'border-black/10 bg-[#fafaf8] text-[#444] hover:border-black/25'}`}
                  >
                    <img src={creator.baseImageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    {creator.name}
                  </button>
                );
              })}
              {busy === 'Selecting creators' ? <Loader2 size={18} className="my-auto ml-1 shrink-0 animate-spin text-[#666]" aria-label="Updating creators" /> : null}
            </div>
          ) : (
            <p className="px-2 py-2 text-sm text-[#666]">No creators have clips yet. Ask an admin to add creator footage.</p>
          )}
        </div>
        ) : null}

        {!reviewComplete ? (
          <section aria-labelledby="hook-review-title" className="flex flex-1 flex-col items-center justify-center py-2">
            <h1 id="hook-review-title" className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8c8c8c]">
              {isFreeFlow ? `${likedConcepts.length} of 8 selected · ${reviewedCount} of 24 reviewed` : `${likedConcepts.length} of 8 hooks selected · ${unreviewedConcepts.length} cards remaining`}
            </h1>
            <div className="mb-4 flex gap-1.5" role="img" aria-label={`${likedConcepts.length} of 8 hooks selected`}>
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} className={`h-1.5 w-7 rounded-full transition-colors ${index < likedConcepts.length ? 'bg-[#15803d]' : 'bg-black/10'}`} />
              ))}
            </div>
            {isGeneratingHooks && unreviewedConcepts.length === 0 ? (
              <div role="status" aria-live="polite" className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
                <Loader2 size={28} className="animate-spin motion-reduce:animate-none" />
                <p className="font-semibold">Building eight more hooks from your choices…</p>
              </div>
            ) : unreviewedConcepts.length === 0 && hookLimitReached ? (
              <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="font-semibold">You’ve reviewed the maximum of {hookCap} hooks.</p>
                <p className="max-w-md text-sm text-[#666]">Open the campaign dashboard to choose a fresh batch from your hook library.</p>
                {!isFreeFlow ? <button type="button" onClick={() => void resetReviews()} disabled={busy !== null} className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold disabled:opacity-50">
                  <RotateCcw size={16} /> Review all 24 again
                </button> : null}
              </div>
            ) : <SwipeReview assignments={reviewAssignments} onDecision={decideHook} />}
            {hookRetryFailure?.phase === 'generation' && unreviewedConcepts.length === 0 && !hookLimitReached ? (
              <button type="button" onClick={() => void generateHooks(false, true)} disabled={busy !== null} className="mt-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold disabled:opacity-50">
                <Sparkles size={16} /> Retry next batch
              </button>
            ) : null}
          </section>
        ) : (
          <section aria-labelledby="review-summary-title" className="mb-14 rounded-[30px] border border-[#bbf7d0] bg-[#f0fdf4] p-5 sm:flex sm:items-center sm:justify-between sm:px-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#15803d]">Review complete</p>
              <h2 id="review-summary-title" className="mt-1 text-xl font-extrabold tracking-[-0.03em]">Your direction is saved for this batch.</h2>
              <p className="mt-1 text-sm text-[#4b6854]">Liked hooks guide the next generation; rejected hooks mark the patterns to avoid.</p>
            </div>
            <button type="button" onClick={() => void resetReviews()} disabled={busy !== null} className="mt-4 inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#86efac] bg-white px-4 py-2.5 text-sm font-bold text-[#166534] transition hover:bg-[#dcfce7] disabled:opacity-50 sm:mt-0">
              <RotateCcw size={15} /> Review again
            </button>
          </section>
        )}

        {reviewComplete && (
        <>
        <div className={`grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${!reviewComplete ? 'opacity-50' : ''}`} aria-label="Hook grid reference">
          {creatorAssignments.map((assignment) => (
            <ReelPreviewCard
              key={assignment.concept.id}
              concept={assignment.concept}
              creator={assignment.creator}
              clip={assignment.clip}
              selected
            />
          ))}
        </div>

        <div className="mb-24 mt-10 flex items-center justify-center gap-2 text-sm font-medium text-[#666666]">
          <Check size={16} className="text-[#15803d]" />
          All 8 selected hooks are ready to render
        </div>

        <div ref={uploadSectionRef} className="relative scroll-mt-28 overflow-hidden rounded-[40px] bg-[#111111] p-8 text-white shadow-2xl md:p-14">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="grid md:grid-cols-[1fr_0.8fr] gap-12 items-center relative z-10">
            <div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold mb-5 leading-[1.1] tracking-[-0.04em]">Make it yours.</h2>
              <p className="text-white/70 mb-10 text-[1.1rem] leading-[1.6] max-w-md">
                Upload your product demo and we’ll render all {displayConcepts.length} Reels. Each one plays its matched hook first, followed by your full demo.
              </p>
              <div className="mb-6">
                <LanguageSelector
                  value={project.hookPreferences?.language ?? 'English'}
                  onChange={(language) => void saveGenerationLanguage(language)}
                  saving={busy === 'Saving language'}
                  message={languageMessage}
                  dark
                />
              </div>
              
              <div className="flex flex-wrap gap-3">
                {brandDemoAsset ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${id}/render`)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-[#111111] shadow-xl transition hover:scale-[1.02] hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                  >
                    <Play size={20} fill="currentColor" />
                    Render {displayConcepts.length} Reels
                  </button>
                ) : null}
                <label className={`cursor-pointer inline-flex items-center gap-2 rounded-full px-8 py-4 font-bold transition hover:scale-[1.02] ${brandDemoAsset ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10' : 'bg-white text-[#111111] shadow-xl hover:bg-[#f3f3f3]'} ${busy === 'Uploading demo' ? 'cursor-wait opacity-60' : ''}`}>
                  {busy === 'Uploading demo' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  {busy === 'Uploading demo' ? 'Uploading...' : brandDemoAsset ? 'Replace demo' : 'Upload your demo'}
                  <input type="file" className="hidden" accept="video/*" onChange={e => uploadBrandDemo(e.target.files?.[0])} disabled={busy === 'Uploading demo'} />
                </label>
              </div>
              
              {brandDemoAsset && (
                <div className="mt-6 flex items-center gap-2 text-[#dcfce7]">
                  <Check size={16} />
                  <span className="text-sm font-medium">Demo ready. Render your {displayConcepts.length} finished cuts.</span>
                </div>
              )}
              {error && (
                <div className="mt-4 text-red-400 text-sm">{error}</div>
              )}
            </div>
            
            <div className="relative aspect-[9/16] bg-white/5 rounded-[28px] overflow-hidden flex items-center justify-center border border-white/10 backdrop-blur-sm">
               {brandDemoAsset ? (
                 <video src={brandDemoAsset.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
               ) : (
                 <div className="text-center text-white/40 px-6">
                   <Video size={48} className="mx-auto mb-4 opacity-50" />
                   <p className="font-semibold text-lg mb-1">Placeholder Section</p>
                   <p className="text-sm">Your product goes here</p>
                 </div>
               )}
            </div>
          </div>
        </div>
        </>
        )}
      </section>

      {reviewComplete && !brandDemoAsset && !isUploadSectionVisible ? (
        <aside
          aria-label="Next step"
          className="fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col gap-3 rounded-[18px] border border-black/10 bg-white/95 p-3 shadow-[0_16px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:bottom-6"
        >
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#15803d]">Next step</p>
            <p className="mt-0.5 text-sm font-extrabold tracking-[-0.02em] text-[#111111]">
              Add your product demo
              <span className="hidden font-normal tracking-normal text-[#777777] sm:inline"> · Pair it with all {displayConcepts.length} hooks</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => uploadSectionRef.current?.scrollIntoView({
              behavior: prefersReducedMotion ? 'auto' : 'smooth',
              block: 'start',
            })}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#111111] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2"
          >
            <Upload size={14} /> Upload demo
          </button>
        </aside>
      ) : null}
    </main>
  );
}
