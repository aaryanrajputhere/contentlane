import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Check, Eye, Gauge, Loader2, Play, Rocket, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../lib/auth';
import { post, waitForJob } from '../lib/api';
import type { ProjectResponse } from '../types/domain';

type PreviewCardProps = {
  src: string;
  title: string;
  metric: string;
  accent: string;
  className?: string;
  videoClassName?: string;
  titleClassName?: string;
  metricClassName?: string;
};

const navLinks = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const previewCards: PreviewCardProps[] = [
  {
    src: '/assets/landing/demo1.mp4',
    title: 'Skincare that\nactually works ✨',
    metric: '12.4K',
    accent: 'from-amber-100/90 via-white/25 to-white/95',
    className: 'z-10 rotate-[-5deg] translate-y-8 scale-[0.98]',
    videoClassName: 'object-[56%_20%]',
    titleClassName: 'max-w-[9.5rem]',
  },
  {
    src: '/assets/landing/demo2.mp4',
    title: 'The minimalist\nworkspace setup.',
    metric: '15.7K',
    accent: 'from-stone-100/90 via-white/18 to-white/95',
    className: 'z-20 rotate-[2deg] -translate-y-1 scale-[1.01]',
    videoClassName: 'object-[54%_30%]',
    titleClassName: 'max-w-[8.5rem] text-white/90',
  },
  {
    src: '/assets/landing/demo3.mp4',
    title: 'Speed up your team\'s output\nby 3x.',
    metric: '9.8K',
    accent: 'from-emerald-100/90 via-white/18 to-white/95',
    className: 'z-30 rotate-[3deg] translate-y-2 scale-[1.03]',
    videoClassName: 'object-[52%_24%]',
    titleClassName: 'max-w-[8.5rem]',
  },
  {
    src: '/assets/landing/demovid.mp4',
    title: 'Your daily\nproductivity boost.',
    metric: '8.2K',
    accent: 'from-zinc-100/90 via-white/18 to-white/95',
    className: 'z-20 rotate-[-1deg] -translate-y-1 scale-[1.01]',
    videoClassName: 'object-[50%_36%]',
    titleClassName: 'max-w-[8.5rem]',
  },
  {
    src: '/assets/landing/demovid.mp4',
    title: 'Stop wasting time on\nmanual work.',
    metric: '10.3K',
    accent: 'from-neutral-100/90 via-white/18 to-white/95',
    className: 'z-10 rotate-[4deg] translate-y-7 scale-[0.98]',
    videoClassName: 'object-[60%_20%]',
    titleClassName: 'max-w-[9rem]',
  },
] as const;

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

const proofPoints = [
  { value: '30 days', label: 'of content ideas from a single website' },
  { value: '3 steps', label: 'to get from analysis to publish-ready assets' },
  { value: '1 browser', label: 'to review, edit, and export without context switching' },
] as const;

const testimonials = [
  {
    quote: 'We stopped rewriting the same offer into ten different formats. The page gives us the structure we need to ship faster.',
    name: 'Growth lead',
    role: 'B2B SaaS',
  },
  {
    quote: 'The hook generation is the useful part. It gives creative teams a first draft that actually feels like a launch concept.',
    name: 'Content strategist',
    role: 'Ecommerce',
  },
] as const;

const pricingPlans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    description: 'For solo founders testing a first content engine.',
    features: ['Website analysis', 'Hook generation', 'Basic export workflow'],
    cta: 'Start free trial',
    featured: false,
  },
  {
    name: 'Growth',
    price: '$149',
    period: '/mo',
    description: 'For teams that need repeatable creative production.',
    features: ['Everything in Starter', 'Priority generation', 'Brand profile and asset library', 'Editor-ready output'],
    cta: 'Choose Growth',
    featured: true,
  },
  {
    name: 'Studio',
    price: 'Custom',
    period: '',
    description: 'For agencies and teams running content at higher volume.',
    features: ['Multi-brand workflows', 'Custom onboarding', 'Collaboration support', 'Volume-based pricing'],
    cta: 'Talk to sales',
    featured: false,
  },
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
  title,
  metric,
  accent,
  className,
  videoClassName,
  titleClassName,
  metricClassName,
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
        className={`relative h-full w-full object-cover opacity-[0.78] saturate-[0.92] blur-[0.45px] ${videoClassName ?? ''}`}
        muted
        autoPlay
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),rgba(255,255,255,0.46)_68%,rgba(255,255,255,0.72)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/42 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-white/45 bg-black/24 text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-sm">
          <Play size={18} fill="currentColor" className="ml-0.5" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className={`whitespace-pre-line text-[1.04rem] font-medium leading-[1.18] tracking-[-0.03em] drop-shadow-[0_1px_10px_rgba(0,0,0,0.22)] ${titleClassName ?? ''}`}>
          {title}
        </p>
        <div className={`mt-3 flex items-center gap-1.5 text-sm font-medium text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.18)] ${metricClassName ?? ''}`}>
          <Eye size={14} />
          <span>{metric}</span>
        </div>
      </div>
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

export default function LandingPage() {
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { status, user, logout } = useAuth();

  const startProject = async () => {
    const value = website.trim();
    if (!value || loading) return;
    if (status !== 'authenticated') {
      navigate('/signup');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('Starting analysis');

    try {
      const response = await post<ProjectResponse>('/projects', { website: value });
      if (response.job) {
        setMessage('Analyzing website');
        await waitForJob(response.job.id, (_progress, note) => {
          setMessage(note ?? 'Analyzing website');
        });
      }
      navigate(`/projects/${response.project.id}`);
    } catch (caught) {
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
              onClick={() => navigate('/admin/creators')}
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black"
            >
              Creator admin
            </button>
          ) : null}
          {status === 'authenticated' ? (
            <button
              onClick={() => void logout()}
              className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfcfc]"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfcfc]"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <section
        id="workflow"
        className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1440px] flex-col px-6 pb-8 pt-14 sm:px-8 lg:px-12 lg:pt-16"
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
            Make 30 days of content on autopilot
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
                {status === 'authenticated' ? 'Generate content' : 'Join beta'}
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

        <div className="mt-8 flex flex-1 items-end justify-center overflow-hidden pb-2 pt-4">
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 18, filter: 'blur(10px)' }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative flex w-full items-end justify-center px-2 pb-2 sm:px-4"
          >
            <div className="absolute inset-x-0 top-1/2 h-[34rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.04),transparent_68%)] blur-3xl" />
            <div className="relative flex items-end justify-center overflow-visible px-3 sm:px-0">
              {previewCards.map((card, index) => (
                <div key={card.title} className={index === 0 ? '' : '-ml-11 sm:-ml-12'}>
                  <PreviewCard {...card} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

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

      <section className="mx-auto w-full max-w-[1440px] px-6 pb-8 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <div className="grid gap-5 rounded-[36px] border border-[#ececec] bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.04)] lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div className="rounded-[30px] bg-[#111111] p-6 text-white shadow-[0_22px_50px_rgba(0,0,0,0.16)] lg:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
              Social proof
            </div>
            <h2 className="mt-5 max-w-xl text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[0.98] tracking-[-0.06em]">
              A landing page that makes the product feel immediate
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div key={point.label} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                  <div className="text-2xl font-semibold tracking-[-0.05em]">{point.value}</div>
                  <p className="mt-2 text-sm leading-6 text-white/70">{point.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="rounded-[30px] border border-[#ececec] bg-[#fcfcfc] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-1 text-[#111111]">
                  <Sparkles size={15} />
                  <Sparkles size={15} />
                  <Sparkles size={15} />
                  <Sparkles size={15} />
                  <Sparkles size={15} />
                </div>
                <p className="mt-4 text-[1.02rem] leading-8 text-[#111111]">&quot;{testimonial.quote}&quot;</p>
                <div className="mt-5">
                  <p className="font-semibold tracking-[-0.03em] text-[#111111]">{testimonial.name}</p>
                  <p className="text-sm text-[#666666]">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-[1440px] px-6 pb-8 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple tiers for testing, scaling, or running at volume"
          description="Keep pricing visible on the page so teams can self-select the right entry point instead of hunting for a sales route."
        />

        <div className="mt-10 grid gap-5 xl:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[30px] border p-6 shadow-[0_18px_42px_rgba(0,0,0,0.05)] ${plan.featured ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#ececec] bg-white text-[#111111]'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[1.2rem] font-semibold tracking-[-0.04em]">{plan.name}</h3>
                  <p className={`mt-2 text-sm leading-6 ${plan.featured ? 'text-white/70' : 'text-[#666666]'}`}>{plan.description}</p>
                </div>
                {plan.featured ? (
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#111111]">
                    Recommended
                  </span>
                ) : null}
              </div>

              <div className="mt-7 flex items-end gap-1">
                <span className="text-[2.5rem] font-extrabold tracking-[-0.07em]">{plan.price}</span>
                <span className={`pb-1 text-sm ${plan.featured ? 'text-white/70' : 'text-[#666666]'}`}>{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className={`flex items-start gap-3 text-sm leading-6 ${plan.featured ? 'text-white/90' : 'text-[#444444]'}`}>
                    <Check size={16} className={`mt-0.5 shrink-0 ${plan.featured ? 'text-white' : 'text-[#111111]'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${plan.featured ? 'bg-white text-[#111111] hover:-translate-y-0.5 hover:bg-[#f3f3f3] focus-visible:ring-white/30 focus-visible:ring-offset-[#111111]' : 'border border-[#111111] bg-white text-[#111111] hover:-translate-y-0.5 hover:bg-[#fafafa] focus-visible:ring-black/20 focus-visible:ring-offset-white'}`}
              >
                {plan.cta}
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
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
              Start with your website
              <Rocket size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
