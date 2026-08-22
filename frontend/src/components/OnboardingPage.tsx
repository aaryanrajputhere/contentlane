import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, post } from '../lib/api';
import { PENDING_WEBSITE_KEY } from '../lib/onboarding.mjs';
import type { BillingStatus, ProjectResponse } from '../types/domain';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const resume = async () => {
      try {
        const billing = await api<BillingStatus>('/billing/status');
        if (!active) return;
        if (billing.freeAccess.projectId) {
          navigate(`/projects/${billing.freeAccess.projectId}/hooks`, { replace: true });
          return;
        }
        const website = sessionStorage.getItem(PENDING_WEBSITE_KEY);
        if (!website) {
          navigate('/', { replace: true });
          return;
        }
        const response = await post<ProjectResponse>('/projects', { website });
        if (!active) return;
        sessionStorage.removeItem(PENDING_WEBSITE_KEY);
        navigate(`/projects/${response.project.id}/hooks`, { replace: true });
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to start your free hooks');
      }
    };
    void resume();
    return () => { active = false; };
  }, [attempt, navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#111111]">
      <section className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.08)]">
        {error ? <RotateCcw className="mx-auto" size={28} /> : <Loader2 className="mx-auto animate-spin motion-reduce:animate-none" size={28} />}
        <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{error ? 'Let’s try that again' : 'Preparing your 24 free hooks'}</h1>
        <p className="mt-3 text-sm leading-6 text-[#666666]">{error || 'We’re saving your website and starting the brand analysis.'}</p>
        {error ? <button type="button" onClick={() => { setError(''); setAttempt((value) => value + 1); }} className="mt-6 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white">Retry</button> : null}
      </section>
    </main>
  );
}
