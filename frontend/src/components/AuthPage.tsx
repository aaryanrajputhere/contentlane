import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';

type AuthMode = 'login' | 'signup';

const inputClass = 'w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#9a9a9a] focus:border-black focus:ring-2 focus:ring-black/5';
const buttonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50';

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
  const isSignup = mode === 'signup';

  const submit = async () => {
    if (!email.trim() || !password.trim() || (isSignup && !name.trim())) return;
    setBusy(true);
    setError('');
    try {
      if (isSignup) {
        await signup({ email, password, name });
      } else {
        await login({ email, password });
      }
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#f7f6f2] px-6 py-12 text-[#111111]">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)]" />
      <div className="relative w-full max-w-[28rem] rounded-[32px] border border-black/8 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fafaf8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#666666]">
          <Sparkles size={14} />
          Private beta
        </div>
        <h1 className="mt-6 text-[2.3rem] font-extrabold tracking-[-0.06em]">
          {isSignup ? 'Create your beta account' : 'Sign in to ReelSwarm'}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#666666]">
          {isSignup ? 'Only approved beta emails can create accounts.' : 'Use the email address that has been approved for the beta.'}
        </p>

        <div className="mt-8 space-y-4">
          {isSignup ? (
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#666666]">Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Your name" />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#666666]">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} type="email" placeholder="you@company.com" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#666666]">Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} type="password" placeholder="At least 8 characters" />
          </label>
          {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <button type="button" onClick={() => void submit()} disabled={busy} className={buttonClass}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
            {isSignup ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <p className="mt-6 text-sm text-[#666666]">
          {isSignup ? 'Already have access?' : 'Need beta access first?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-[#111111] underline underline-offset-4">
            {isSignup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </main>
  );
}
