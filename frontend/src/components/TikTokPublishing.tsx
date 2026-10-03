import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Clipboard, Download, ExternalLink, Loader2, Music2, Pause, Play, RefreshCw, Search, Send, SlidersHorizontal, Smartphone, TrendingUp, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import type { SocialAccount, SocialPublication, TikTokMusicTrack } from '../types/domain';

export interface PublishableReel {
  url: string;
  conceptId: string;
  renderJobId: string;
}

interface RenderedTikTokLibraryProps {
  projectId: string;
  rendered: PublishableReel[];
  titleForConcept: (conceptId: string) => string;
}

interface TikTokInteractionSetting {
  enabled: boolean;
  required: boolean;
  default: boolean;
  label: string;
}

interface TikTokPublishingOptions {
  postingLimits?: {
    maxVideoDurationSec?: number;
    interactionSettings?: Partial<Record<'allow_comment' | 'allow_duet' | 'allow_stitch', TikTokInteractionSetting>>;
  };
  commercialContentTypes?: Array<{ value: string; label: string }>;
}

const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#111] transition hover:bg-[#e7ff73] disabled:cursor-wait disabled:opacity-50';
const darkButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#222] transition hover:border-black/25 hover:bg-[#f3f3f0] disabled:opacity-50';
const field = 'w-full rounded-2xl border border-black/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10';

function localCountryCode() {
  const match = navigator.language.match(/[-_]([A-Za-z]{2})$/);
  return match?.[1]?.toUpperCase() ?? 'US';
}

function metricValue(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  for (const candidate of Object.values(record)) {
    const nested = metricValue(candidate, keys);
    if (nested !== null) return nested;
  }
  return null;
}

function formatMetric(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function PublicationStrip({ publication, onRefresh }: { publication: SocialPublication; onRefresh: (publication: SocialPublication) => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const statusClass = publication.status === 'PUBLISHED' ? 'bg-[#e7ff73] text-[#243000]' : publication.status === 'DELIVERED_TO_TIKTOK' ? 'bg-[#dceeff] text-[#123e68]' : publication.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';
  const statusLabel = publication.status === 'DELIVERED_TO_TIKTOK' ? 'Sent to TikTok' : publication.status.toLowerCase();
  const metrics = [
    ['Views', metricValue(publication.analytics, ['views', 'viewCount', 'view_count'])],
    ['Likes', metricValue(publication.analytics, ['likes', 'likeCount', 'like_count'])],
    ['Comments', metricValue(publication.analytics, ['comments', 'commentCount', 'comment_count'])],
    ['Shares', metricValue(publication.analytics, ['shares', 'shareCount', 'share_count'])],
  ] as const;

  return <div className="border-t border-white/10 bg-[#1b1b1b] px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${statusClass}`}>{statusLabel}</span>
      <div className="flex items-center gap-1">
        {publication.status === 'PUBLISHED' ? <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white" title="Refresh TikTok analytics" aria-label="Refresh TikTok analytics" disabled={refreshing} onClick={() => { setRefreshing(true); void onRefresh(publication).finally(() => setRefreshing(false)); }}>{refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button> : null}
        {publication.platformPostUrl ? <a href={publication.platformPostUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white" title="Open on TikTok" aria-label="Open on TikTok"><ExternalLink size={14} /></a> : null}
      </div>
    </div>
    {publication.status === 'PUBLISHED' ? <div className="mt-3 grid grid-cols-4 gap-2">{metrics.map(([label, value]) => <div key={label}><p className="text-sm font-black">{formatMetric(value)}</p><p className="text-[9px] font-bold uppercase tracking-[.1em] text-white/45">{label}</p></div>)}</div> : null}
    {publication.status === 'DELIVERED_TO_TIKTOK' ? <p className="mt-2 text-xs leading-5 text-blue-100">Open the TikTok mobile app—not TikTok Studio on the web. Go to Inbox → System notifications and open the uploaded video.</p> : null}
    {publication.status === 'FAILED' ? <p className="mt-2 text-xs leading-5 text-red-200">{publication.errorMessage ?? 'TikTok could not publish this video.'}</p> : null}
  </div>;
}

export function RenderedTikTokLibrary({ projectId, rendered, titleForConcept }: RenderedTikTokLibraryProps) {
  const navigate = useNavigate();
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [publications, setPublications] = useState<SocialPublication[]>([]);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [selected, setSelected] = useState<PublishableReel | null>(null);
  const [error, setError] = useState('');
  const publicationByOutput = useMemo(() => {
    const result = new Map<string, SocialPublication>();
    for (const publication of publications) {
      const key = `${publication.renderJobId}:${publication.conceptId}`;
      if (!result.has(key)) result.set(key, publication);
    }
    return result;
  }, [publications]);
  const hasPendingPublication = publications.some((publication) => publication.status === 'VALIDATING' || publication.status === 'PUBLISHING');

  const load = async () => {
    try {
      const [accountsResponse, publicationsResponse] = await Promise.all([
        api<{ accounts: SocialAccount[] }>('/social/accounts'),
        api<{ publications: SocialPublication[] }>(`/projects/${projectId}/publications`),
      ]);
      setAccount(accountsResponse.accounts.find((item) => item.connectionStatus === 'CONNECTED') ?? null);
      setPublications(publicationsResponse.publications);
      setFeatureAvailable(true);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 404) {
        setFeatureAvailable(false);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'TikTok publishing could not be loaded.');
    }
  };

  useEffect(() => { void load(); }, [projectId]);
  useEffect(() => {
    if (!hasPendingPublication) return;
    const timer = window.setInterval(() => { void load(); }, 8_000);
    return () => window.clearInterval(timer);
  }, [hasPendingPublication, projectId]);

  const refreshAnalytics = async (publication: SocialPublication) => {
    try {
      const response = await api<{ analytics: Record<string, unknown>; syncedAt: string }>(`/social/publications/${publication.id}/analytics`);
      setPublications((current) => current.map((item) => item.id === publication.id ? { ...item, analytics: response.analytics, analyticsSyncedAt: response.syncedAt } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analytics are not ready yet.');
    }
  };

  if (!rendered.length) return <div className="rounded-[30px] border border-dashed border-black/15 bg-white p-10 text-center"><p className="font-black">No rendered saved content yet.</p><p className="mt-2 text-sm text-[#777]">Render a saved hook, then publish it from here.</p></div>;

  return <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888]">Rendered videos</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Your finished content</h2><p className="mt-2 text-sm text-[#666]">Download a file or send it straight to TikTok.</p></div>
      {featureAvailable && !account ? <button type="button" className={secondaryButton} onClick={() => navigate('/social-accounts')}><Send size={15} />Connect TikTok</button> : null}
      {account ? <div className="flex items-center gap-2 rounded-full bg-[#f2f2ee] px-3 py-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-[#6fae32]" />@{account.username ?? account.displayName ?? 'TikTok connected'}</div> : null}
    </div>
    {error ? <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rendered.map((output, index) => {
      const title = titleForConcept(output.conceptId);
      const publication = publicationByOutput.get(`${output.renderJobId}:${output.conceptId}`);
      return <article key={`${output.renderJobId}-${output.conceptId}`} className="overflow-hidden rounded-[26px] border border-black/10 bg-[#111] text-white">
        <video src={output.url} className="aspect-[9/16] w-full object-cover" controls muted playsInline preload="metadata" />
        <div className="min-h-[106px] p-4"><p className="line-clamp-2 text-sm font-bold">{title}</p><div className="mt-3 flex gap-2">
          {featureAvailable && account && (!publication || publication.status === 'FAILED') ? <button type="button" className={primaryButton} onClick={() => setSelected(output)}><Send size={14} />{publication?.status === 'FAILED' ? 'Try again' : 'Publish'}</button> : null}
          <a href={output.url} download={`content-${index + 1}.mp4`} aria-label={`Download ${title}`} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"><Download size={15} /></a>
        </div></div>
        {publication ? <PublicationStrip publication={publication} onRefresh={refreshAnalytics} /> : null}
      </article>;
    })}</div>
    {selected && account ? <TikTokPublishSheet projectId={projectId} output={selected} title={titleForConcept(selected.conceptId)} account={account} onClose={() => setSelected(null)} onPublished={(publication) => { setPublications((current) => [publication, ...current]); if (publication.deliveryMode === 'DIRECT' || publication.status !== 'DELIVERED_TO_TIKTOK') setSelected(null); }} /> : null}
  </section>;
}

function TikTokPublishSheet({ projectId, output, title, account, onClose, onPublished }: { projectId: string; output: PublishableReel; title: string; account: SocialAccount; onClose: () => void; onPublished: (publication: SocialPublication) => void }) {
  const [deliveryMode, setDeliveryMode] = useState<'DIRECT' | 'TIKTOK_DRAFT'>('TIKTOK_DRAFT');
  const [tracks, setTracks] = useState<TikTokMusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TikTokMusicTrack | null>(null);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [duration, setDuration] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [caption, setCaption] = useState(title);
  const [musicVolume, setMusicVolume] = useState(50);
  const [originalVolume, setOriginalVolume] = useState(50);
  const [startSeconds, setStartSeconds] = useState(0);
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [commercialContentType, setCommercialContentType] = useState<'brand_organic' | 'brand_content'>('brand_organic');
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(true);
  const [publishingOptions, setPublishingOptions] = useState<TikTokPublishingOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [delivered, setDelivered] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (deliveryMode !== 'DIRECT') {
      setLoadingMusic(false);
      return;
    }
    setLoadingMusic(true);
    setError('');
    const controller = new AbortController();
    void Promise.all([
      api<{ tracks: TikTokMusicTrack[] }>(`/social/accounts/${account.id}/tiktok/music?countryCode=${encodeURIComponent(account.countryCode ?? localCountryCode())}`, { signal: controller.signal }),
      api<{ creator: TikTokPublishingOptions }>(`/social/accounts/${account.id}/tiktok/publishing-options`, { signal: controller.signal }),
    ]).then(([music, options]) => {
      setTracks(music.tracks);
      setPublishingOptions(options.creator);
      const interactions = options.creator.postingLimits?.interactionSettings;
      if (interactions?.allow_comment) setAllowComment(interactions.allow_comment.default);
      if (interactions?.allow_duet) setAllowDuet(interactions.allow_duet.default);
      if (interactions?.allow_stitch) setAllowStitch(interactions.allow_stitch.default);
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'TikTok music could not be loaded.');
    }).finally(() => { if (!controller.signal.aborted) setLoadingMusic(false); });
    return () => controller.abort();
  }, [account.id, account.countryCode, deliveryMode]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      previewAudioRef.current?.pause();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const genres = useMemo(() => Array.from(new Set(tracks.flatMap((track) => track.genres))).sort((a, b) => a.localeCompare(b)), [tracks]);
  const filteredTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tracks.filter((track) => {
      const matchesQuery = !needle || `${track.title} ${track.artist} ${track.genres.join(' ')}`.toLowerCase().includes(needle);
      const matchesGenre = genre === 'All' || track.genres.includes(genre);
      const seconds = track.durationSeconds;
      const matchesDuration = duration === 'all' || seconds === null
        || (duration === 'short' && seconds <= 30)
        || (duration === 'medium' && seconds > 30 && seconds <= 60)
        || (duration === 'long' && seconds > 60);
      return matchesQuery && matchesGenre && matchesDuration;
    }).sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  }, [duration, genre, query, tracks]);
  const playPreview = (track: TikTokMusicTrack) => {
    if (!track.previewUrl) return;
    if (previewingTrackId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewingTrackId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(track.previewUrl);
    previewAudioRef.current = audio;
    setPreviewingTrackId(track.id);
    audio.addEventListener('ended', () => setPreviewingTrackId(null), { once: true });
    void audio.play().catch(() => setPreviewingTrackId(null));
  };
  const interactions = publishingOptions?.postingLimits?.interactionSettings;
  const availableCommercialTypes = new Set(publishingOptions?.commercialContentTypes?.map((item) => item.value) ?? []);
  const commercialTypesKnown = availableCommercialTypes.size > 0;

  const body = {
    deliveryMode,
    requestKey: requestKey.current,
    socialAccountId: account.id,
    renderJobId: output.renderJobId,
    conceptId: output.conceptId,
    caption,
    music: deliveryMode === 'DIRECT' && selectedTrack ? {
      id: selectedTrack.id,
      title: selectedTrack.title,
      artist: selectedTrack.artist,
      durationSeconds: selectedTrack.durationSeconds,
      previewUrl: selectedTrack.previewUrl,
      thumbnailUrl: selectedTrack.thumbnailUrl,
      musicVolume,
      startMs: Math.round(startSeconds * 1000),
      endMs: null,
      originalVolume,
    } : null,
    settings: { allowComment, allowDuet, allowStitch, commercialContentType, contentPreviewConfirmed: previewConfirmed, expressConsentGiven: consentGiven },
  };

  const publish = async () => {
    if (!previewConfirmed || !consentGiven || busy) return;
    setBusy(true); setError('');
    try {
      await api(`/projects/${projectId}/publications/validate`, { method: 'POST', body: JSON.stringify(body) });
      const response = await api<{ publication: SocialPublication }>(`/projects/${projectId}/publications`, { method: 'POST', body: JSON.stringify(body) });
      onPublished(response.publication);
      if (response.publication.deliveryMode === 'TIKTOK_DRAFT' && response.publication.status === 'DELIVERED_TO_TIKTOK') setDelivered(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TikTok could not publish this video.');
    } finally { setBusy(false); }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  if (delivered) return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="tiktok-delivered-title">
    <div className="w-full max-w-lg rounded-t-[32px] bg-[#f6f6f1] p-6 shadow-2xl sm:rounded-[32px] sm:p-8"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#dceeff] text-[#123e68]"><CheckCircle2 size={27} /></div><p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-[#777]">Handoff complete</p><h2 id="tiktok-delivered-title" className="mt-2 text-3xl font-black tracking-[-.05em]">Your video is waiting in the TikTok mobile app.</h2><div className="mt-4 rounded-2xl border border-[#b9d7ee] bg-[#edf7ff] p-4"><p className="flex items-center gap-2 text-sm font-black text-[#123e68]"><Smartphone size={16} />Use your phone to finish</p><p className="mt-2 text-xs leading-5 text-[#526779]">This draft will not appear in TikTok Studio or the Posts page on the web.</p></div><ol className="mt-5 space-y-2 text-sm leading-6 text-[#555]"><li><strong>1.</strong> Open the TikTok mobile app using the connected account.</li><li><strong>2.</strong> Tap <strong>Inbox</strong>, then open <strong>System notifications</strong> or <strong>From TikTok</strong>.</li><li><strong>3.</strong> Tap the notification that says your uploaded video is ready.</li><li><strong>4.</strong> Add your sound, paste the caption, and publish.</li></ol><div className="mt-6 rounded-2xl border border-black/8 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#888]">Caption to paste</p><button type="button" onClick={() => void copyCaption()} className="inline-flex items-center gap-1.5 text-xs font-black"><Clipboard size={13} />{copied ? 'Copied' : 'Copy caption'}</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#333]">{caption || 'No caption prepared.'}</p></div><button type="button" className={`${darkButton} mt-6 w-full`} onClick={onClose}>Done</button></div>
  </div>;

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="tiktok-publish-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[32px] bg-[#f6f6f1] shadow-2xl sm:rounded-[32px]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/8 bg-[#f6f6f1]/95 px-5 py-4 backdrop-blur-xl sm:px-7"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#777]">Final broadcast check</p><h2 id="tiktok-publish-title" className="mt-1 text-xl font-black tracking-[-.04em]">Publish to TikTok</h2></div><button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white" onClick={onClose} aria-label="Close publishing window"><X size={17} /></button></div>
      <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[240px_1fr]">
        <div><video src={output.url} className="aspect-[9/16] w-full rounded-[22px] bg-black object-cover" controls muted playsInline /><p className="mt-3 line-clamp-2 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#777]">Publishing as @{account.username ?? account.displayName ?? 'TikTok account'}</p></div>
        <div className="min-w-0 space-y-6">
          <section><p className="text-xs font-black uppercase tracking-[.14em] text-[#666]">How do you want to post?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setDeliveryMode('TIKTOK_DRAFT')} className={`relative overflow-hidden rounded-[22px] border p-4 text-left transition ${deliveryMode === 'TIKTOK_DRAFT' ? 'border-[#2d77b5] bg-[#dceeff] shadow-[0_8px_24px_rgba(45,119,181,.12)]' : 'border-black/8 bg-white hover:border-black/20'}`}><span className="flex items-center gap-2 text-sm font-black"><Smartphone size={17} />Finish in TikTok</span><span className="mt-2 block text-xs leading-5 text-[#526779]">Send to the TikTok mobile app, then add any sound available to your account.</span><span className="mt-3 inline-flex rounded-full bg-[#123e68] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">Mobile app required</span></button><button type="button" onClick={() => setDeliveryMode('DIRECT')} className={`rounded-[22px] border p-4 text-left transition ${deliveryMode === 'DIRECT' ? 'border-[#111] bg-[#111] text-white' : 'border-black/8 bg-white hover:border-black/20'}`}><span className="flex items-center gap-2 text-sm font-black"><Send size={17} />Publish directly</span><span className={`mt-2 block text-xs leading-5 ${deliveryMode === 'DIRECT' ? 'text-white/60' : 'text-[#777]'}`}>Post now using TikTok's commercial music catalogue.</span></button></div></section>
          <label className="block"><span className="text-xs font-black uppercase tracking-[.14em] text-[#666]">{deliveryMode === 'TIKTOK_DRAFT' ? 'Caption to copy into TikTok' : 'Caption'}</span><textarea className={`${field} mt-2 min-h-24 resize-y`} maxLength={2200} value={caption} onChange={(event) => setCaption(event.target.value)} /><span className="mt-1 flex justify-between text-[10px] font-bold text-[#999]"><span>{deliveryMode === 'TIKTOK_DRAFT' ? 'TikTok drafts do not carry captions; we will keep this ready to copy.' : ''}</span><span>{caption.length}/2200</span></span></label>
          {deliveryMode === 'DIRECT' ? <section><div className="flex items-center justify-between gap-4"><div><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.14em] text-[#666]"><TrendingUp size={14} />Trending commercial music</p><p className="mt-1 text-xs text-[#888]">TikTok's current cleared chart for {account.countryCode ?? localCountryCode()} · {tracks.length} tracks available.</p></div>{selectedTrack ? <button type="button" className="shrink-0 text-xs font-bold underline" onClick={() => setSelectedTrack(null)}>No music</button> : null}</div>
            <label className="mt-3 flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3"><Search size={15} className="text-[#888]" /><span className="sr-only">Search music</span><input className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Search song, artist, or genre" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {!loadingMusic && tracks.length ? <div className="mt-3 rounded-2xl border border-black/8 bg-[#ecece7] p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-[#777]"><SlidersHorizontal size={12} />Refine the crate</div><div className="flex gap-2 overflow-x-auto pb-1">{['All', ...genres].map((item) => <button type="button" key={item} onClick={() => setGenre(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${genre === item ? 'bg-[#111] text-white' : 'border border-black/10 bg-white text-[#666]'}`}>{item}</button>)}</div><div className="mt-2 flex flex-wrap gap-2">{([['all', 'Any length'], ['short', '≤ 30 sec'], ['medium', '30–60 sec'], ['long', '60+ sec']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setDuration(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${duration === value ? 'bg-[#e7ff73] text-[#111]' : 'bg-white text-[#777]'}`}>{label}</button>)}</div></div> : null}
            {loadingMusic ? <p className="mt-3 flex items-center gap-2 text-sm text-[#777]"><Loader2 size={15} className="animate-spin" />Loading TikTok music…</p> : <><div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#999]"><span>{filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}</span><span>Ranked by TikTok</span></div><div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">{filteredTracks.map((track) => <div key={track.id} className={`flex w-full items-center gap-3 rounded-2xl border p-3 transition ${selectedTrack?.id === track.id ? 'border-[#111] bg-[#111] text-white' : 'border-black/8 bg-white hover:border-black/20'}`}>
              {track.thumbnailUrl ? <img src={track.thumbnailUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e7ff73] text-[#111]"><Music2 size={17} /></span>}
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedTrack(track)}><span className="block truncate text-sm font-black">{track.rank ? `${track.rank}. ` : ''}{track.title}</span><span className={`block truncate text-xs ${selectedTrack?.id === track.id ? 'text-white/60' : 'text-[#777]'}`}>{track.artist}{track.durationSeconds ? ` · ${Math.round(track.durationSeconds)}s` : ''}</span>{track.genres.length ? <span className={`mt-1 block truncate text-[10px] font-bold uppercase tracking-[.08em] ${selectedTrack?.id === track.id ? 'text-white/40' : 'text-[#aaa]'}`}>{track.genres.join(' · ')}</span> : null}</button>
              {track.previewUrl ? <button type="button" onClick={() => playPreview(track)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${selectedTrack?.id === track.id ? 'bg-white/15 text-white' : 'bg-[#f1f1ed] text-[#111]'}`} aria-label={`${previewingTrackId === track.id ? 'Pause' : 'Preview'} ${track.title}`}>{previewingTrackId === track.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button> : null}
            </div>)}{!filteredTracks.length ? <p className="rounded-2xl border border-dashed border-black/15 p-4 text-center text-sm text-[#777]">No tracks match these filters. Clear a filter or try another search.</p> : null}</div></>}
            {selectedTrack ? <div className="mt-3 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3"><RangeField label="Music" value={musicVolume} onChange={setMusicVolume} /><RangeField label="Original sound" value={originalVolume} onChange={setOriginalVolume} /><label className="text-xs font-bold text-[#666]">Start at<input type="number" min={0} max={Math.min(600, selectedTrack.durationSeconds ?? 600)} step={0.5} className="mt-2 w-full rounded-xl border border-black/10 bg-[#f7f7f3] px-3 py-2 text-sm text-[#111]" value={startSeconds} onChange={(event) => setStartSeconds(Math.min(Math.min(600, selectedTrack.durationSeconds ?? 600), Math.max(0, Number(event.target.value))))} /><span className="mt-1 block text-[10px] text-[#999]">seconds</span></label>{selectedTrack.previewUrl ? <audio className="sm:col-span-3 w-full" controls preload="none" src={selectedTrack.previewUrl} /> : null}</div> : null}
          </section> : <section className="rounded-[22px] border border-[#b9d7ee] bg-[#edf7ff] p-4"><p className="flex items-center gap-2 text-sm font-black text-[#123e68]"><Smartphone size={16} />Continue on the TikTok mobile app</p><ol className="mt-3 space-y-2 text-xs leading-5 text-[#526779]"><li>1. ContentLane sends the video to your TikTok mobile inbox.</li><li>2. On your phone, open TikTok → Inbox → System notifications.</li><li>3. Open the uploaded-video notification, add your sound, paste the caption, and post.</li></ol><p className="mt-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#6f8798]">It will not appear in TikTok Studio on the web · Nothing goes public yet</p></section>}
          {deliveryMode === 'DIRECT' ? <section className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-[.12em] text-[#666]">Disclosure<select className={`${field} mt-2 normal-case tracking-normal`} value={commercialContentType} onChange={(event) => setCommercialContentType(event.target.value as 'brand_organic' | 'brand_content')}><option value="brand_organic">Promoting my own brand</option>{!commercialTypesKnown || availableCommercialTypes.has('brand_content') ? <option value="brand_content">Paid partnership / branded content</option> : null}</select></label><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#666]">Interactions · public post</p><div className="mt-2 flex flex-wrap gap-2"><Toggle label="Comments" checked={allowComment} disabled={interactions?.allow_comment?.enabled === false} onChange={setAllowComment} /><Toggle label="Duet" checked={allowDuet} disabled={interactions?.allow_duet?.enabled === false} onChange={setAllowDuet} /><Toggle label="Stitch" checked={allowStitch} disabled={interactions?.allow_stitch?.enabled === false} onChange={setAllowStitch} /></div></div></section> : null}
          <section className="space-y-3 rounded-2xl border border-black/8 bg-white p-4"><CheckField checked={previewConfirmed} onChange={setPreviewConfirmed}>{deliveryMode === 'TIKTOK_DRAFT' ? 'I previewed this video and confirm it is ready to send to my TikTok inbox.' : 'I previewed this post and confirm it is ready to publish publicly.'}</CheckField><CheckField checked={consentGiven} onChange={setConsentGiven}>I consent to TikTok processing this content.</CheckField></section>
          {error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className={secondaryButton} onClick={onClose}>Cancel</button><button type="button" className={darkButton} disabled={!previewConfirmed || !consentGiven || busy} onClick={() => void publish()}>{busy ? <Loader2 size={16} className="animate-spin" /> : deliveryMode === 'TIKTOK_DRAFT' ? <Smartphone size={16} /> : <Send size={16} />}{busy ? (deliveryMode === 'TIKTOK_DRAFT' ? 'Sending to TikTok…' : 'Checking & publishing…') : deliveryMode === 'TIKTOK_DRAFT' ? 'Send to TikTok' : 'Publish now'}</button></div>
        </div>
      </div>
    </div>
  </div>;
}

function RangeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-bold text-[#666]">{label} · {value}%<input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[#111]" /></label>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`rounded-full border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'border-[#111] bg-[#111] text-white' : 'border-black/10 bg-white text-[#777]'}`}>{checked ? <Check size={12} className="mr-1 inline" /> : null}{label}</button>;
}

function CheckField({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: string }) {
  return <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-[#444]"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#111]" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{children}</span></label>;
}
