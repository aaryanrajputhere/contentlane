import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Server, TriangleAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import { assignCreatorsToConcepts, effectiveCreatorSelection } from '../lib/creatorAssignments';
import { createZip } from '../lib/zip';
import { brandDemoName, brandDemos } from '../lib/brandDemos';
import type { CreatorRecord, GenerationJob, ProjectResponse, ProjectSnapshot } from '../types/domain';

const shell = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const panel = 'rounded-[32px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]';
const black = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50';
const white = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

type Reel = { conceptId: string; clipId: string; creatorName: string; clipUrl: string; sortOrder: number; demoAssetId: string; demoName: string };
type Output = { conceptId: string; creatorName: string; url: string; sortOrder: number; format: string; demoAssetId?: string; demoName?: string };

function isCompleted(job: GenerationJob | null): job is GenerationJob & { status: 'COMPLETED' } { return job?.status === 'COMPLETED'; }
function isInProgress(job: GenerationJob | null) { return job?.status === 'QUEUED' || job?.status === 'ACTIVE'; }

export default function ProjectRenderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<ProjectResponse>(`/projects/${id}`),
      api<{ creators: CreatorRecord[] }>('/creators'),
    ]).then(([projectResponse, creatorResponse]) => {
      if (cancelled) return;
      setProject(projectResponse.project);
      setCreators(creatorResponse.creators);
      // Jobs are returned newest-first; restore the latest render in any terminal
      // state as well so completed outputs survive a page reload.
      const existing = projectResponse.project.jobs.find((item) => item.type === 'RENDER_REELS');
      if (existing) setJob(existing);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load render'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!job || (job.status !== 'QUEUED' && job.status !== 'ACTIVE')) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await api<{ job: GenerationJob }>(`/jobs/${job.id}`);
        if (cancelled) return;
        setJob(response.job);
        if (response.job.status === 'QUEUED' || response.job.status === 'ACTIVE') window.setTimeout(() => void poll(), 1200);
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to poll render job'); }
    };
    void poll();
    return () => { cancelled = true; };
  }, [job?.id, job?.status]);

  const batchConceptIds = useMemo(() => {
    const value = job?.input?.conceptIds;
    return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : null;
  }, [job?.input]);
  const concepts = useMemo(() => {
    const source = batchConceptIds?.length
      ? (project?.concepts ?? []).filter((concept) => batchConceptIds.includes(concept.id))
      : (project?.concepts ?? []).filter((concept) => concept.reviewDecision === 'LIKED');
    return source.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [batchConceptIds, project?.concepts]);
  const assignments = useMemo(() => project ? assignCreatorsToConcepts(concepts, creators, effectiveCreatorSelection(project, creators)) : [], [project, creators, concepts]);
  const demos = project ? brandDemos(project) : [];
  const defaultDemo = demos.find((demo) => demo.id === project?.defaultBrandDemoAssetId) ?? demos[0];
  const reels: Reel[] = assignments.flatMap((item) => {
    const demo = demos.find((candidate) => candidate.id === item.concept.assignedBrandDemoAssetId) ?? defaultDemo;
    return item.clip && demo ? [{ conceptId: item.concept.id, clipId: item.clip.id, creatorName: item.creator.name, clipUrl: item.clip.url, sortOrder: item.concept.sortOrder, demoAssetId: demo.id, demoName: brandDemoName(demo) }] : [];
  });
  const outputs = isCompleted(job) && job.result && typeof job.result === 'object' && Array.isArray((job.result as { reels?: unknown }).reels)
    ? (job.result as { reels: Output[] }).reels : [];
  const outputByConcept = new Map(outputs.map((output) => [output.conceptId, output]));
  const progress = job?.progress ?? 0;
  const renderInProgress = isInProgress(job);

  async function startRender() {
    if (!id || starting || reels.length === 0) return;
    setStarting(true); setError('');
    try {
      const response = await api<{ job: GenerationJob }>(`/projects/${id}/render`, {
        method: 'POST',
        body: JSON.stringify({ conceptIds: reels.map((reel) => reel.conceptId) }),
      });
      setJob(response.job);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to start server render'); }
    finally { setStarting(false); }
  }

  async function downloadAll() {
    if (outputs.length === 0 || downloading) return;
    setDownloading(true);
    try {
      const files = await Promise.all(outputs.map(async (output, index) => ({ name: `${id}-reel-${index + 1}.mp4`, blob: await fetch(output.url).then((response) => response.blob()) })));
      const blob = await createZip(files);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${id}-reels.zip`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Unable to prepare the ZIP download.'); } finally { setDownloading(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#fafaf8]">Loading render…</div>;
  const failed = job?.status === 'FAILED';
  return <main className="min-h-screen bg-[#fafaf8] pb-16 text-[#111]">
    <header className="border-b border-black/6 bg-white"><div className={`${shell} flex items-center justify-between gap-4 py-4`}><div><p className="text-[13px] uppercase tracking-[0.34em]">ContentLane</p><p className="mt-2 text-sm text-[#666]">Server-rendered MP4 reels</p></div><button type="button" onClick={() => navigate(-1)} className={white}><ArrowLeft size={16} />Back</button></div></header>
    <section className={`${shell} pt-12`}>
      <div className="text-center"><div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"><Server size={15} />Video render</div><h1 className="mx-auto mt-7 max-w-[15ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[.94] tracking-[-.07em]">Your {reels.length} Reels are taking shape.</h1><p className="mx-auto mt-4 max-w-2xl text-[1.05rem] leading-7 text-[#666]">This render is preserved in your campaign history. Start another from your saved content whenever you want.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => navigate(`/projects/${id}/content`)} className={white}>Render more videos</button><button type="button" onClick={() => void startRender()} disabled={starting || renderInProgress || isCompleted(job) || reels.length === 0} className={black}>{starting || renderInProgress ? <Loader2 size={16} className="animate-spin" /> : <Server size={15} />}{starting || renderInProgress ? `Rendering ${progress}%` : isCompleted(job) ? 'Render complete' : 'Render on server'}</button><button type="button" onClick={() => void downloadAll()} disabled={outputs.length === 0 || downloading} className={white}><Download size={16} />{downloading ? 'Preparing ZIP…' : 'Download all'}</button></div></div>
      {failed ? <div className="mx-auto mt-8 flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span className="flex items-center gap-2"><TriangleAlert size={17} />{job.errorMessage ?? 'The render failed.'}</span><button type="button" onClick={() => { setJob(null); void startRender(); }} className={white}>Retry</button></div> : null}
      {error ? <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-red-700">{error}</p> : null}
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{reels.map((reel, index) => { const output = outputByConcept.get(reel.conceptId); return <article key={reel.conceptId} className={`${panel} overflow-hidden p-4`}><div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#8c8c8c]">Reel {index + 1}</p><h2 className="mt-1 line-clamp-2 text-base font-bold">{concepts.find((concept) => concept.id === reel.conceptId)?.hookText}</h2><p className="mt-2 text-xs text-[#666]">{reel.creatorName} · Demo: {output?.demoName ?? reel.demoName}</p></div><span className="rounded-full bg-[#f2f0eb] px-2.5 py-1 text-xs">{output ? 'completed' : failed ? 'failed' : job ? 'rendering' : 'queued'}</span></div><div className="mt-4 overflow-hidden rounded-[24px] bg-[#111]">{output ? <video src={output.url} className="aspect-[9/16] w-full object-cover" controls playsInline /> : <video src={reel.clipUrl} className="aspect-[9/16] w-full object-cover opacity-70" muted loop autoPlay playsInline />}</div>{output ? <a href={output.url} download={`${id}-reel-${index + 1}.mp4`} className={`${black} mt-4 w-full`}><Download size={15} />Download MP4</a> : null}</article>; })}</div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[#888]">Server rendering keeps the browser responsive while the worker downloads, composes, and uploads each reel.</p>
    </section>
  </main>;
}
