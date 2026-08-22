import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError, api, post } from '../lib/api';
import { clearPendingWebsite, getPendingWebsite } from '../lib/onboarding.mjs';
import type { BillingStatus, ProjectResponse } from '../types/domain';
import AdditionalWebsiteUpgradeModal from './AdditionalWebsiteUpgradeModal';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [upgradeWebsite, setUpgradeWebsite] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  useEffect(() => {
    let active = true;
    const resume = async () => {
      try {
        const billingStatus = await api<BillingStatus>('/billing/status');
        if (!active) return;
        setBilling(billingStatus);
        const website = getPendingWebsite();
        if (!website && billingStatus.freeAccess.projectId) {
          navigate(`/projects/${billingStatus.freeAccess.projectId}/hooks`, { replace: true });
          return;
        }
        if (!website) {
          navigate('/', { replace: true });
          return;
        }
        const response = await post<ProjectResponse>('/projects', { website });
        if (!active) return;
        clearPendingWebsite();
        navigate(`/projects/${response.project.id}/hooks`, { replace: true });
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ApiClientError && caught.code === 'ADDITIONAL_PROJECT_REQUIRES_SUBSCRIPTION') {
          const website = getPendingWebsite();
          if (website) setUpgradeWebsite(website);
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Unable to start your free hooks');
      }
    };
    void resume();
    return () => { active = false; };
  }, [attempt, navigate]);

  const startTrial = async () => {
    setUpgradeBusy(true);
    setUpgradeError('');
    try {
      const { url } = await post<{ url: string }>('/billing/checkout');
      window.location.assign(url);
    } catch (caught) {
      setUpgradeError(caught instanceof Error ? caught.message : 'Unable to start checkout');
      setUpgradeBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#111111]">
      <section className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.08)]">
        {error ? <RotateCcw className="mx-auto" size={28} /> : <Loader2 className="mx-auto animate-spin motion-reduce:animate-none" size={28} />}
        <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{error ? 'Let’s try that again' : 'Preparing your 24 free hooks'}</h1>
        <p className="mt-3 text-sm leading-6 text-[#666666]">{error || 'We’re saving your website and starting the brand analysis.'}</p>
        {error ? <button type="button" onClick={() => { setError(''); setAttempt((value) => value + 1); }} className="mt-6 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white">Retry</button> : null}
      </section>
      {upgradeWebsite ? (
        <AdditionalWebsiteUpgradeModal
          website={upgradeWebsite}
          busy={upgradeBusy}
          error={upgradeError}
          onStartTrial={() => void startTrial()}
          onContinueFreeProject={() => {
            const projectId = billing?.freeAccess.projectId;
            if (projectId) navigate(`/projects/${projectId}/hooks`, { replace: true });
          }}
          onDismiss={() => navigate('/', { replace: true })}
        />
      ) : null}
    </main>
  );
}
