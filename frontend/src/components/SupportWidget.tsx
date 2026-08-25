import { Check, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';

export default function SupportWidget() {
  const location = useLocation();
  const { status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (status === 'authenticated' && user?.email) setEmail(user.email);
  }, [status, user?.email]);

  useEffect(() => {
    if (!open) return;

    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => openerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (isMobile) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (location.pathname.startsWith('/admin')) return null;
  const lockedEmail = status === 'authenticated' && Boolean(user?.email);
  const landingLauncherPosition = location.pathname === '/'
    ? 'absolute right-4 top-4 sm:fixed sm:bottom-6 sm:right-6 sm:top-auto'
    : 'fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 sm:bottom-6 sm:right-6';

  const closeSupport = () => {
    setOpen(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const trimmed = message.trim();
    if (trimmed.length < 20) {
      setError('Tell us a little more — messages need at least 20 characters.');
      return;
    }
    setState('submitting');
    try {
      const result = await post<{ request?: { id: string } }>('/support', { email, message: trimmed, website });
      if (!result.request?.id) throw new Error('Your message was not saved. Clear any autofilled hidden fields and try again.');
      setState('success');
      setMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your message could not be sent. Try again.');
      setState('idle');
    }
  };

  return (
    <>
      {open ? (
        <div className="support-widget fixed inset-0 z-[80] flex items-end bg-black/20 sm:pointer-events-none sm:items-auto sm:bg-transparent">
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="ContentLane support" className="support-widget pointer-events-auto max-h-[min(82dvh,42rem)] w-full overscroll-contain overflow-y-auto rounded-t-[28px] border border-[#e7e7e7] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.12)] sm:fixed sm:bottom-24 sm:right-6 sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-[24px] sm:p-6 sm:shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a]">Support</p>
                <h2 className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#111]">How can we help?</h2>
              </div>
              <button ref={closeRef} type="button" onClick={closeSupport} aria-label="Close support" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f4f4f4] text-[#555] hover:bg-[#eaeaea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"><X size={17} /></button>
            </div>
            {state === 'success' ? (
              <div className="py-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#111] text-white"><Check size={20} /></span>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em]">Message received</h3>
                <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-6 text-[#666]">Our team will review it and follow up by email.</p>
                <button type="button" onClick={() => { setState('idle'); closeSupport(); }} className="mt-6 min-h-11 rounded-full border border-[#ddd] px-5 py-2.5 text-sm font-semibold">Done</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-[#555]">Email
                  <input type="email" required value={email} readOnly={lockedEmail} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedede] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#111] read-only:bg-[#f5f5f5] read-only:text-[#777]" />
                </label>
                <label className="block text-xs font-semibold text-[#555]">What happened?
                  <textarea required minLength={20} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what you were trying to do and where you got stuck." className="mt-1.5 min-h-32 w-full resize-none rounded-xl border border-[#dedede] px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-[#aaa] focus:border-[#111]" />
                </label>
                <label className="absolute -left-[10000px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
                <div className="flex items-center justify-between gap-4 text-[11px] text-[#999]"><span>{message.length.toLocaleString()} / 4,000</span><span>Replies go to your email</span></div>
                {error ? <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p> : null}
                <button type="submit" disabled={state === 'submitting'} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-55">
                  {state === 'submitting' ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}{state === 'submitting' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
      <button ref={openerRef} type="button" onClick={() => setOpen(true)} aria-label="Open support" className={`support-widget z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-[#111] p-0 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3 ${landingLauncherPosition}`}>
        <MessageCircle size={18} /><span className="hidden sm:inline">Help</span>
      </button>
    </>
  );
}
