import { useEffect, useRef } from 'react';
import { Check, Globe2, Loader2, Sparkles, X } from 'lucide-react';

type AdditionalWebsiteUpgradeModalProps = {
  website: string;
  busy: boolean;
  error: string;
  onStartTrial: () => void;
  onContinueFreeProject: () => void;
  onDismiss: () => void;
};

function websiteLabel(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

export default function AdditionalWebsiteUpgradeModal({
  website,
  busy,
  error,
  onStartTrial,
  onContinueFreeProject,
  onDismiss,
}: AdditionalWebsiteUpgradeModalProps) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  const dismissRef = useRef(onDismiss);
  busyRef.current = busy;
  dismissRef.current = onDismiss;

  useEffect(() => {
    primaryActionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) dismissRef.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="additional-website-title"
        className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/60 bg-[#fcfcfc] shadow-[0_32px_100px_rgba(0,0,0,0.28)]"
      >
        <div className="absolute right-0 top-0 h-52 w-52 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#dcfce7] blur-3xl" aria-hidden="true" />
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          aria-label="Close subscription prompt"
          className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/80 text-[#555555] transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:opacity-50"
        >
          <X size={18} />
        </button>

        <div className="relative p-7 sm:p-10">
          <div className="inline-flex max-w-[calc(100%-3rem)] items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-bold text-[#444444] shadow-sm">
            <Globe2 size={15} className="shrink-0 text-[#15803d]" />
            <span className="truncate">Ready for {websiteLabel(website)}</span>
          </div>
          <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.2em] text-[#15803d]">One website included free</p>
          <h2 id="additional-website-title" className="mt-3 max-w-[12ch] text-[clamp(2.35rem,8vw,3.7rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-[#111111]">
            Your first website was free.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#626262]">
            Choose a plan to build hooks for this website and turn your strongest ideas into finished Reels.
          </p>

          <ul className="mt-6 grid gap-3 text-sm font-semibold text-[#333333] sm:grid-cols-3">
            {['Add more websites', 'Generate more hooks', 'Render full Reels'].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#dcfce7] text-[#15803d]"><Check size={13} strokeWidth={3} /></span>
                {benefit}
              </li>
            ))}
          </ul>

          {error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              ref={primaryActionRef}
              type="button"
              onClick={onStartTrial}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-6 py-3.5 text-sm font-bold text-white shadow-[0_15px_34px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-4 disabled:opacity-50"
            >
              {busy ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={17} />}
              Choose a plan
            </button>
            <button
              type="button"
              onClick={onContinueFreeProject}
              disabled={busy}
              className="rounded-full px-5 py-3 text-sm font-semibold text-[#666666] transition hover:bg-black/5 hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
            >
              Continue with my first website
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#888888]">Your new website is saved and will start automatically after activation.</p>
        </div>
      </section>
    </div>
  );
}
