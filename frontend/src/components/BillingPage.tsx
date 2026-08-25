import { AlertTriangle, ArrowRight, Check, CreditCard, Loader2, ShieldCheck, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, post } from '../lib/api';
import { clearPendingWebsite, getPendingWebsite } from '../lib/onboarding.mjs';
import type { BillingStatus, ProjectResponse } from '../types/domain';

type PlanId = 'starter' | 'pro';

const fallbackPlans: BillingStatus['plans'] = [
  { id: 'starter', name: 'Starter', price: 9.99, currency: 'USD', interval: 'month', videoLimit: 30 },
  { id: 'pro', name: 'Pro', price: 19.99, currency: 'USD', interval: 'month', videoLimit: 100 },
];

export default function BillingPage({ success = false }: { success?: boolean }) {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(searchParams.get('plan') === 'pro' ? 'pro' : 'starter');
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const status = await api<BillingStatus>('/billing/status');
    setBilling(status);
    return status;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    let syncAttempted = false;
    const check = async () => {
      try {
        if (success && !syncAttempted) {
          syncAttempted = true;
          const subscriptionId = searchParams.get('subscription_id');
          if (subscriptionId) await post('/billing/sync', { subscriptionId });
        }
        const status = await refresh();
        if (cancelled) return;
        if (success && status.hasAccess) {
          const projectId = searchParams.get('projectId');
          if (projectId) return navigate(`/projects/${projectId}/hooks?unlocked=1`, { replace: true });
          const pendingWebsite = getPendingWebsite();
          if (pendingWebsite) {
            const response = await post<ProjectResponse>('/projects', { website: pendingWebsite });
            if (cancelled) return;
            clearPendingWebsite();
            return navigate(`/projects/${response.project.id}/hooks`, { replace: true });
          }
          navigate('/', { replace: true });
          return;
        }
        if (success && attempts++ < 40) timer = window.setTimeout(() => void check(), 3000);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load billing');
          if (success && attempts++ < 40) timer = window.setTimeout(() => void check(), 3000);
        }
      }
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [navigate, refresh, searchParams, success]);

  const plans = billing?.plans.length ? billing.plans : fallbackPlans;
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const waiting = success && !billing?.hasAccess;
  const capacityPercent = billing?.videoUsage.limit
    ? Math.min(100, ((billing.videoUsage.consumed + billing.videoUsage.reserved) / billing.videoUsage.limit) * 100)
    : 0;

  const openCheckout = async () => {
    setLoading(true); setError('');
    try {
      const projectId = searchParams.get('projectId');
      const { url } = await post<{ url: string }>('/billing/checkout', { planId: selectedPlanId, ...(projectId ? { projectId } : {}) });
      window.location.assign(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to open checkout'); setLoading(false); }
  };

  const openPortal = async () => {
    setLoading(true); setError('');
    try { const { url } = await post<{ url: string }>('/billing/portal'); window.location.assign(url); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to open billing'); setLoading(false); }
  };

  const changePlan = async (planId: PlanId) => {
    setLoading(true); setError(''); setNotice('');
    try {
      const result = await post<{ effectiveAt: 'immediately' | 'next_billing_date' }>('/billing/change-plan', { planId });
      await refresh();
      setNotice(result.effectiveAt === 'immediately' ? 'Your upgrade is being activated.' : 'Your plan will change at the next billing date.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to change plan'); }
    finally { setLoading(false); }
  };

  const cancelSubscription = async () => {
    setLoading(true); setError('');
    try { await post('/billing/cancel'); setShowCancel(false); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to cancel subscription'); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#f4f4f0] px-5 py-10 text-[#111] sm:px-8 sm:py-16">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#777]">ContentLane plans</p><h1 className="mt-3 max-w-2xl text-4xl font-black tracking-[-.06em] sm:text-6xl">Hooks stay unlimited. Choose your render capacity.</h1></div>
          <button type="button" onClick={() => navigate('/')} className="text-sm font-bold text-[#666] hover:text-black">Back to ContentLane</button>
        </div>

        {billing?.hasAccess ? (
          <section className="mt-9 overflow-hidden rounded-[32px] bg-[#111] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,.18)] sm:p-9">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8f36b]">{billing.planName} plan{billing.isLegacyPlan ? ' · legacy price retained' : ''}</p><p className="mt-3 text-3xl font-black tracking-[-.05em]">{billing.videoUsage.remaining ?? 'Unlimited'} renders remaining</p><p className="mt-2 text-sm text-white/60">Resets {billing.videoUsage.periodEnd ? new Date(billing.videoUsage.periodEnd).toLocaleDateString() : 'with your next billing period'}.</p></div>
              <button type="button" onClick={() => void openPortal()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"><CreditCard size={16} />Manage payment</button>
            </div>
            {billing.videoUsage.limit ? <div className="mt-8"><div className="h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#b8f36b] transition-[width]" style={{ width: `${capacityPercent}%` }} /></div><div className="mt-3 flex justify-between text-xs text-white/55"><span>{billing.videoUsage.consumed} completed{billing.videoUsage.reserved ? ` · ${billing.videoUsage.reserved} rendering` : ''}</span><span>{billing.videoUsage.limit} per period</span></div></div> : null}
            {billing.scheduledPlanId ? <p className="mt-6 rounded-2xl bg-white/10 p-4 text-sm">Your {plans.find((plan) => plan.id === billing.scheduledPlanId)?.name} plan starts on the next billing date.</p> : null}
          </section>
        ) : null}

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const active = billing?.planId === plan.id && billing.hasAccess;
            const selected = selectedPlanId === plan.id;
            return <article key={plan.id} className={`relative overflow-hidden rounded-[30px] border p-7 transition sm:p-9 ${active || (!billing?.hasAccess && selected) ? 'border-[#111] bg-white shadow-[0_20px_60px_rgba(0,0,0,.1)]' : 'border-black/10 bg-[#fafaf8]'}`}>
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black tracking-[-.04em]">{plan.name}</h2><p className="mt-2 text-sm text-[#666]">For {plan.id === 'starter' ? 'a steady monthly publishing rhythm' : 'teams testing creative at higher volume'}.</p></div>{active ? <span className="rounded-full bg-[#b8f36b] px-3 py-1 text-xs font-black">Current</span> : null}</div>
              <p className="mt-8 text-5xl font-black tracking-[-.07em]">${plan.price}<span className="ml-1 text-sm font-medium tracking-normal text-[#777]">/ month</span></p>
              <div className="mt-7 flex h-12 items-end gap-1" aria-hidden="true">{Array.from({ length: plan.id === 'starter' ? 6 : 10 }, (_, index) => <span key={index} className={`flex-1 rounded-t-sm ${plan.id === 'pro' ? 'bg-[#111]' : 'bg-[#b8f36b]'}`} style={{ height: `${28 + index * 7}%` }} />)}</div>
              <ul className="mt-7 space-y-3 text-sm"><li className="flex gap-2"><Check size={16} />Unlimited hook generation</li><li className="flex gap-2"><Video size={16} />{plan.videoLimit} rendered videos per billing period</li><li className="flex gap-2"><ShieldCheck size={16} />7-day free trial for new subscribers</li></ul>
              {!billing?.hasAccess ? <button type="button" aria-pressed={selected} onClick={() => setSelectedPlanId(plan.id)} className={`mt-8 w-full rounded-full px-5 py-3 text-sm font-black ${selected ? 'bg-[#111] text-white' : 'border border-black/15 bg-white'}`}>{selected ? 'Selected' : `Choose ${plan.name}`}</button> : !active ? <button type="button" disabled={loading || Boolean(billing.scheduledPlanId)} onClick={() => void changePlan(plan.id)} className="mt-8 w-full rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black disabled:opacity-40">{plan.videoLimit > (billing.videoUsage.limit ?? 0) ? 'Upgrade now' : 'Switch at renewal'}</button> : null}
            </article>;
          })}
        </div>

        {error ? <p role="status" className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#8b2f1f]">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 rounded-2xl bg-[#e8f8d4] px-4 py-3 text-sm font-semibold text-[#315016]">{notice}</p> : null}
        {waiting ? <div className="mt-7 flex items-center justify-center gap-3 rounded-2xl bg-white p-5 font-bold"><Loader2 className="animate-spin" size={18} />Confirming your subscription with Dodo Payments</div> : null}
        {!billing?.hasAccess && !waiting ? <button type="button" disabled={loading || !billing} onClick={() => void openCheckout()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(0,0,0,.18)] disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}Start {selectedPlan.name} free trial</button> : null}

        {billing?.hasAccess && !billing.cancelAtPeriodEnd ? <button type="button" onClick={() => setShowCancel(true)} className="mx-auto mt-7 block text-sm font-medium text-[#777] underline">Cancel subscription</button> : null}
        {billing?.cancelAtPeriodEnd ? <p className="mt-7 text-center text-sm text-[#666]">Cancellation scheduled. Access continues until {billing.renewalDate ? new Date(billing.renewalDate).toLocaleDateString() : 'the end of the billing period'}.</p> : null}
        {showCancel ? <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-[#f0d9d2] bg-[#fff8f5] p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-[#b5472d]" size={18} /><div><p className="font-bold">Cancel at the end of this billing period?</p><p className="mt-1 text-sm text-[#6d5148]">You keep access until your renewal date and will not be charged again.</p><div className="mt-4 flex gap-3"><button type="button" disabled={loading} onClick={() => void cancelSubscription()} className="rounded-full bg-[#b5472d] px-4 py-2 text-sm font-bold text-white">Confirm cancellation</button><button type="button" onClick={() => setShowCancel(false)} className="rounded-full border px-4 py-2 text-sm font-bold">Keep plan</button></div></div></div></div> : null}
      </section>
    </main>
  );
}
