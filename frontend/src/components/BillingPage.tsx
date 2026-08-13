import { Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, post } from '../lib/api';

export type BillingStatus = {
  plan: string;
  price: number;
  currency: string;
  status: string;
  hasAccess: boolean;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
};

export default function BillingPage({ success = false }: { success?: boolean }) {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
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
    const check = async () => {
      try {
        const status = await refresh();
        if (cancelled) return;
        if (success && status.hasAccess) {
          navigate('/', { replace: true });
          return;
        }
        if (success && attempts++ < 40) timer = window.setTimeout(() => void check(), 3000);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load billing');
      }
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [navigate, refresh, success]);

  const openHostedPage = async (kind: 'checkout' | 'portal') => {
    setLoading(true);
    setError('');
    try {
      const { url } = await post<{ url: string }>(`/billing/${kind}`);
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open billing');
      setLoading(false);
    }
  };

  const waiting = success && !billing?.hasAccess;
  return (
    <main className="grid min-h-screen place-items-center bg-[#fcfcfc] px-6 py-12 text-[#111111]">
      <section className="w-full max-w-3xl overflow-hidden rounded-[36px] border border-[#e8e8e8] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.08)]">
        <div className="grid md:grid-cols-[0.92fr_1.08fr]">
          <div className="bg-[#111111] p-8 text-white sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">3-day free trial. Full access.</p>
            <div className="mt-8 flex items-end gap-2">
              <span className="text-6xl font-extrabold tracking-[-0.08em]">${billing?.price ?? 19}</span>
              <span className="pb-2 text-sm text-white/60">USD / month after trial</span>
            </div>
            <ul className="mt-10 space-y-4 text-sm text-white/80">
              {['Brand and website analysis', 'Hook-first scripts and visuals', 'Browser editing and exports'].map((item) => (
                <li key={item} className="flex gap-3"><Check size={17} className="shrink-0 text-white" />{item}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <ShieldCheck size={28} />
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.05em]">
              {waiting ? 'Confirming your subscription' : billing?.hasAccess ? 'Your plan is active' : 'Unlock ContentLane'}
            </h1>
            <p className="mt-3 leading-7 text-[#666666]">
              {waiting
                ? 'Payment received. We are waiting for secure confirmation from Dodo Payments.'
                : billing?.hasAccess
                  ? billing.cancelAtPeriodEnd ? 'Your access remains active until the end of the current billing period.' : 'You have full access to every ContentLane workflow.'
                  : 'Start with 3 days free. You will be charged $19/month after the trial unless you cancel.'}
            </p>
            {searchParams.get('cancelled') ? <p className="mt-4 rounded-2xl bg-[#f5f5f5] p-4 text-sm">Checkout was cancelled. You have not been charged.</p> : null}
            {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              disabled={loading || waiting || billing === null}
              onClick={() => void openHostedPage(billing?.hasAccess ? 'portal' : 'checkout')}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading || waiting ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
              {waiting ? 'Confirming payment' : billing?.hasAccess ? 'Manage billing' : 'Start 3-day free trial'}
            </button>
            <button type="button" onClick={() => navigate('/')} className="mt-4 text-sm font-medium text-[#666666] hover:text-[#111111]">Back to ContentLane</button>
          </div>
        </div>
      </section>
    </main>
  );
}
