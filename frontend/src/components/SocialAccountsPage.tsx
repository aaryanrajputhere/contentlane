import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2, Music2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import type { SocialAccount } from '../types/domain';

const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#222] transition hover:border-black/25 hover:bg-[#f3f3f0] disabled:opacity-50';

export default function SocialAccountsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const connectedCallback = new URLSearchParams(location.search).get('connected') === 'tiktok';

  const load = async () => {
    setError('');
    try {
      const response = await api<{ accounts: SocialAccount[] }>('/social/accounts');
      setAccount(response.accounts[0] ?? null);
      setFeatureAvailable(true);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 404) {
        setFeatureAvailable(false);
        setError('TikTok publishing is not enabled for this account yet.');
      } else {
        setError(caught instanceof Error ? caught.message : 'TikTok could not be loaded.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [location.search]);

  const connect = async () => {
    setBusy('connect'); setError('');
    try {
      const response = await api<{ authUrl: string }>('/social/connect/tiktok', { method: 'POST' });
      window.location.assign(response.authUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TikTok connection could not be started.');
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!account || !window.confirm('Disconnect this TikTok account from ContentLane? Existing published posts will stay on TikTok.')) return;
    setBusy('disconnect'); setError('');
    try {
      await api(`/social/accounts/${account.id}`, { method: 'DELETE' });
      setAccount(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TikTok could not be disconnected.');
    } finally { setBusy(''); }
  };

  return <main className="min-h-screen bg-[#f6f6f1] text-[#111]">
    <header className="border-b border-black/8 bg-[#f6f6f1]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[980px] items-center justify-between px-5 py-5 sm:px-8"><button type="button" onClick={() => navigate('/projects')} className="text-[11px] font-bold uppercase tracking-[.24em] text-[#777]">ContentLane</button><button type="button" className={secondaryButton} onClick={() => navigate('/projects')}><ArrowLeft size={15} />Projects</button></div></header>
    <section className="mx-auto max-w-[980px] px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#777]">Distribution</p><h1 className="mt-3 max-w-2xl text-4xl font-black tracking-[-.06em] sm:text-6xl">Your direct line to TikTok.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#666]">Connect once, then choose commercial music and publish every finished ContentLane video without downloading and re-uploading it.</p>
      {connectedCallback && account?.connectionStatus === 'CONNECTED' ? <p className="mt-6 flex items-center gap-2 rounded-2xl bg-[#e7ff73] px-4 py-3 text-sm font-black"><Check size={16} />TikTok is connected and ready.</p> : null}
      {error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <section className="mt-8 overflow-hidden rounded-[30px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(0,0,0,.04)]">
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#111] text-white"><Music2 size={23} /></div><div><div className="flex items-center gap-2"><h2 className="text-xl font-black tracking-[-.04em]">TikTok</h2>{account?.connectionStatus === 'CONNECTED' ? <span className="rounded-full bg-[#e7ff73] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]">Connected</span> : null}</div><p className="mt-1 text-sm text-[#777]">{account?.connectionStatus === 'CONNECTED' ? `@${account.username ?? account.displayName ?? 'Connected account'}` : account?.connectionStatus === 'NEEDS_RECONNECTION' ? 'TikTok needs to be reconnected.' : 'No TikTok account connected.'}</p></div></div>
          <div className="flex flex-wrap gap-2">{loading ? <span className="flex items-center gap-2 text-sm text-[#777]"><Loader2 size={16} className="animate-spin" />Checking…</span> : account?.connectionStatus === 'CONNECTED' ? <><button type="button" className={secondaryButton} disabled={Boolean(busy)} onClick={() => void load()}><RefreshCw size={15} />Refresh</button><button type="button" className={secondaryButton} disabled={Boolean(busy)} onClick={() => void disconnect()}>{busy === 'disconnect' ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}Disconnect</button></> : <button type="button" className={primaryButton} disabled={Boolean(busy) || !featureAvailable} onClick={() => void connect()}>{busy === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}{account?.connectionStatus === 'NEEDS_RECONNECTION' ? 'Reconnect TikTok' : 'Connect TikTok'}</button>}</div>
        </div>
        <div className="grid border-t border-black/8 bg-[#fafaf7] md:grid-cols-3">{[
          { icon: Music2, title: 'Commercial music', copy: 'Choose from TikTok’s region-specific commercial music library before posting.' },
          { icon: ShieldCheck, title: 'You approve every post', copy: 'Nothing publishes until you preview it and provide TikTok’s required consent.' },
          { icon: RefreshCw, title: 'Post analytics', copy: 'Refresh views, likes, comments, and shares from your rendered-video library.' },
        ].map(({ icon: Icon, title, copy }) => <div key={title} className="border-black/8 p-6 md:border-r last:md:border-r-0"><Icon size={18} /><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-[#777]">{copy}</p></div>)}</div>
      </section>
      <p className="mt-5 text-xs leading-5 text-[#888]">TikTok opens its own authorization screen. ContentLane never sees or stores your TikTok password.</p>
    </section>
  </main>;
}
