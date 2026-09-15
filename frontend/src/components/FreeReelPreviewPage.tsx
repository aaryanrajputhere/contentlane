import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, LockKeyhole, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { UserButton } from '@clerk/react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import { createZip } from '../lib/zip';
import type { BillingStatus, GenerationJob, ProjectResponse, ProjectSnapshot } from '../types/domain';

type ReelOutput = { conceptId: string; creatorName: string; demoName: string; url: string; sortOrder: number };
function outputs(job: GenerationJob | null) {
  if (!job?.result || typeof job.result !== 'object') return [];
  const reels = (job.result as { reels?: unknown }).reels;
  return Array.isArray(reels) ? reels.filter((value): value is ReelOutput => Boolean(value) && typeof value === 'object' && typeof (value as ReelOutput).url === 'string') : [];
}
function sourcePreviewId(job: GenerationJob) { return typeof job.input.sourcePreviewJobId === 'string' ? job.input.sourcePreviewJobId : null; }
function conceptIds(job: GenerationJob) {
  const ids = job.input.conceptIds;
  return Array.isArray(ids) ? ids.filter((value): value is string => typeof value === 'string') : [];
}

export default function FreeReelPreviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [previewJob, setPreviewJob] = useState<GenerationJob | null>(null);
  const [finalJob, setFinalJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingFinal, setStartingFinal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [projectResponse, billingResponse] = await Promise.all([api<ProjectResponse>(`/projects/${id}`), api<BillingStatus>('/billing/status')]);
    const nextProject = projectResponse.project;
    const preview = nextProject.jobs.find((job) => job.type === 'PREVIEW_REELS') ?? null;
    const clean = preview ? nextProject.jobs.find((job) => job.type === 'RENDER_REELS' && sourcePreviewId(job) === preview.id) ?? null : null;
    setProject(nextProject); setBilling(billingResponse); setPreviewJob(preview); setFinalJob(clean);
  }, [id]);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load your previews')).finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    const active = finalJob && ['QUEUED', 'ACTIVE'].includes(finalJob.status) ? finalJob : previewJob && ['QUEUED', 'ACTIVE'].includes(previewJob.status) ? previewJob : null;
    if (!active) return;
    let cancelled = false; let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await api<{ job: GenerationJob }>(`/jobs/${active.id}`);
        if (cancelled) return;
        if (active.type === 'PREVIEW_REELS') setPreviewJob(response.job); else setFinalJob(response.job);
        if (['QUEUED', 'ACTIVE'].includes(response.job.status)) timer = window.setTimeout(() => void poll(), 1200);
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to update render progress'); }
    };
    void poll(); return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [previewJob?.id, previewJob?.status, finalJob?.id, finalJob?.status]);

  useEffect(() => {
    if (!billing?.hasAccess || previewJob?.status !== 'COMPLETED' || finalJob || startingFinal) return;
    setStartingFinal(true); setError('');
    void api<{ job: GenerationJob }>(`/projects/${id}/render`, { method: 'POST', body: JSON.stringify({ sourcePreviewJobId: previewJob.id }) })
      .then((response) => setFinalJob(response.job))
      .catch((caught) => setError(caught instanceof ApiClientError ? caught.message : 'Unable to unlock clean Reels'))
      .finally(() => setStartingFinal(false));
  }, [billing?.hasAccess, finalJob, id, previewJob, startingFinal]);

  const previewOutputs = useMemo(() => outputs(previewJob), [previewJob]);
  const cleanOutputs = useMemo(() => outputs(finalJob), [finalJob]);
  const reelConceptIds = useMemo(() => previewJob ? conceptIds(previewJob) : [], [previewJob]);
  const previewByConcept = useMemo(() => new Map(previewOutputs.map((output) => [output.conceptId, output])), [previewOutputs]);
  const cleanByConcept = useMemo(() => new Map(cleanOutputs.map((output) => [output.conceptId, output])), [cleanOutputs]);
  const cleanReady = finalJob?.status === 'COMPLETED' && cleanOutputs.length === reelConceptIds.length;
  const activeJob = finalJob && ['QUEUED', 'ACTIVE'].includes(finalJob.status) ? finalJob : previewJob;
  const progress = activeJob?.progress ?? 0;

  async function retryPreview() {
    setError('');
    try { const response = await api<{ job: GenerationJob }>(`/projects/${id}/preview-render`, { method: 'POST' }); setPreviewJob(response.job); }
    catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to retry preview rendering'); }
  }
  async function downloadAll() {
    if (!cleanReady || downloading) return;
    setDownloading(true); setError('');
    try {
      const files = await Promise.all(cleanOutputs.map(async (output, index) => ({ name: `${id}-reel-${index + 1}.mp4`, blob: await fetch(output.url).then((response) => { if (!response.ok) throw new Error('Download failed'); return response.blob(); }) })));
      const blob = await createZip(files); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${id}-reels.zip`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Unable to prepare the ZIP download.'); } finally { setDownloading(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f6f2]"><Loader2 className="animate-spin motion-reduce:animate-none"/></div>;
  if (!project || !previewJob) return <main className="grid min-h-screen place-items-center bg-[#f5f6f2] px-6 text-center"><div><h1 className="text-3xl font-black">No Reel preview found.</h1><button onClick={() => navigate(`/projects/${id}/hooks`)} className="mt-6 rounded-full bg-black px-5 py-3 text-sm font-bold text-white">Return to your hooks</button></div></main>;
  const previewFailed = previewJob.status === 'FAILED' || previewJob.status === 'CANCELLED';
  const finalFailed = finalJob?.status === 'FAILED' || finalJob?.status === 'CANCELLED';

  return <main className="min-h-screen bg-[#f5f6f2] pb-20 text-[#111]">
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f5f6f2]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1420px] items-center justify-between px-5 py-4 sm:px-8"><button onClick={() => navigate(`/projects/${id}/hooks`)} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold"><ArrowLeft size={15}/>Hooks</button><p className="text-[12px] uppercase tracking-[.34em]">ContentLane</p><UserButton /></div></header>
    <section className="mx-auto max-w-[1420px] px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#15803d]">Your Reel lineup</p><h1 className="mt-3 max-w-[12ch] text-[clamp(3rem,7vw,6.6rem)] font-black leading-[.88] tracking-[-.075em]">{cleanReady ? 'Ready to post.' : billing?.hasAccess ? 'Removing the watermark.' : 'Eight complete previews.'}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#666]">{cleanReady ? 'Your clean MP4 files are ready to download.' : billing?.hasAccess ? 'Your preview stays playable while we render the clean versions.' : 'Watch every full Reel. Start your free trial when you are ready to download the clean files.'}</p></div>
        <div className="flex flex-col gap-3 lg:items-end">{cleanReady ? <button onClick={() => void downloadAll()} disabled={downloading} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-4 text-sm font-black text-white disabled:opacity-50"><Download size={17}/>{downloading ? 'Preparing ZIP…' : 'Download all 8 Reels'}</button> : billing?.hasAccess ? <div className="min-w-64 rounded-[22px] border border-black/8 bg-white p-4"><div className="flex items-center justify-between text-xs font-bold"><span>{finalFailed ? 'Clean render failed' : 'Rendering clean Reels'}</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full bg-[#15803d] transition-[width]" style={{ width: `${progress}%` }}/></div></div> : <button onClick={() => navigate(`/billing?plan=starter&projectId=${encodeURIComponent(id)}&returnTo=preview`)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(0,0,0,.18)]"><Sparkles size={17}/>Start free trial to download</button>}</div>
      </div>
      {(previewFailed || finalFailed || error) ? <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"><span className="flex items-center gap-2"><TriangleAlert size={17}/>{error || activeJob?.errorMessage || 'The render could not be completed.'}</span>{previewFailed ? <button onClick={() => void retryPreview()} className="rounded-full bg-white px-4 py-2">Retry previews</button> : finalFailed ? <button onClick={() => { setFinalJob(null); setError(''); }} className="rounded-full bg-white px-4 py-2">Retry clean render</button> : null}</div> : null}
      {!previewFailed ? <div className="mt-10 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{reelConceptIds.map((conceptId, index) => {
        const output = cleanByConcept.get(conceptId) ?? previewByConcept.get(conceptId);
        const cleanOutput = cleanByConcept.has(conceptId);
        return <article key={conceptId} className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[28px] border-2 border-[#151515] bg-black shadow-[0_18px_44px_rgba(0,0,0,.15)]">
          {output ? <video key={output.url} src={output.url} controls autoPlay muted loop playsInline preload="auto" className="h-full w-full object-contain"/> : <div className="grid h-full place-items-center bg-[#f0f1ed] px-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dff7c8] text-[#15803d]"><Loader2 className="animate-spin motion-reduce:animate-none"/></span><p className="mt-5 text-xl font-black">Rendering Reel {index + 1}</p><p className="mt-2 text-sm text-[#777]">It will play here when ready.</p></div></div>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pt-16 text-white"><div><p className="text-sm font-black">Reel {index + 1}</p>{output ? <p className="mt-1 text-[10px] text-white/70">{cleanOutput ? 'Clean Reel' : output.creatorName}</p> : null}</div>{output ? cleanOutput ? <a href={output.url} download={`${id}-reel-${index + 1}.mp4`} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-black text-black"><Download size={12}/>Download</a> : <button onClick={() => navigate(`/billing?plan=starter&projectId=${encodeURIComponent(id)}&returnTo=preview`)} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/70 px-3 py-2 text-[11px] font-black"><LockKeyhole size={12}/>Download</button> : null}</div>
        </article>;
      })}</div> : null}
    </section>
  </main>;
}
